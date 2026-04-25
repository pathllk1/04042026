/**
 * server/api/inventory/sls/bills/[id].put.ts
 * PUT /api/inventory/sls/bills/:id
 *
 * Updates an existing ACTIVE sales bill.
 *
 * Steps (all inside a Mongoose transaction):
 *   1. Validate bill exists + is not CANCELLED
 *   2. RESTORE: reverse all original stock movements and delete StockReg rows
 *   3. DELETE original ledger entries for this voucher
 *   4. RE-APPLY: same logic as createBill — deduct stock, write StockReg,
 *      post ledger entries
 *   5. UPDATE the Bill document in-place (same _id, same bno)
 *
 * Body: same shape as POST /bills
 *
 * Auth: event.context.user
 */

import mongoose from 'mongoose'
import {
  Stock, StockReg, Bill, Party, Firm, Ledger,
} from '../../../../models/index'
import {
  getFirmId,
  getActorUsername,
  validateObjectId,
  getLocalDateString,
  isServiceItem,
  getEffectiveItemQty,
  calcBillTotals,
  getNextVoucherNumber,
  isGstEnabled,
} from '../../../../utils/billUtils'
import { postSalesLedger } from '../../../../utils/inventoryLedgerHelper'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)
  const billId        = validateObjectId(getRouterParam(event, 'id'), 'bill ID')

  const body = await readBody(event)
  const { meta = {}, party: partyId, cart = [], otherCharges = [], consignee = {} } = body

  // ── Basic validation ───────────────────────────────────────────────────
  if (!Array.isArray(cart) || cart.length === 0) {
    throw createError({ statusCode: 400, message: 'Cart is empty — add at least one item' })
  }
  const validatedPartyId = validateObjectId(partyId, 'party ID')

  const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean() as any
  if (!existingBill) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }
  if ((existingBill.status || 'ACTIVE') === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Cannot edit a cancelled bill' })
  }

  const billDate = meta.billDate || existingBill.bdate || getLocalDateString()
  const billType = (meta.billType === 'inter-state') ? 'inter-state' : 'intra-state'

  // ── Resolve party ──────────────────────────────────────────────────────
  const partyDoc = await Party.findOne({
    _id: validatedPartyId, firm_id: firmId,
  }).lean() as any
  if (!partyDoc) {
    throw createError({ statusCode: 404, message: 'Party not found' })
  }

  // ── Resolve firm ───────────────────────────────────────────────────────
  const firmDoc = await Firm.findById(firmId)
    .select('name gst_number locations')
    .lean() as any

  const firmGstin = meta.firmGstin
    || existingBill.firm_gstin
    || firmDoc?.locations?.find((l: any) => l.is_default)?.gst_number
    || firmDoc?.gst_number
    || null
  const firmLocation = firmDoc?.locations?.find((l: any) => l.gst_number === firmGstin)
    || firmDoc?.locations?.find((l: any) => l.is_default)
    || null

  const gstEnabled = await isGstEnabled(firmId)

  const { gtot, totalTax, otherChargesTotal, otherChargesGstTotal,
    cgst, sgst, igst, ntot, rof } = calcBillTotals(
    cart, otherCharges, gstEnabled, billType,
    Boolean(meta.reverseCharge), getEffectiveItemQty,
  )

  // ── Open transaction ───────────────────────────────────────────────────
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // ── STEP 1: Restore original stock from existing StockReg rows ────────
    const originalSRRows = await StockReg.find({
      bill_id: billId, firm_id: firmId,
    }).session(session).lean() as any[]

    for (const sr of originalSRRows) {
      if (!sr.stock_id || sr.item_type === 'SERVICE') continue

      const stockDoc = await Stock.findOne({
        _id: sr.stock_id, firm_id: firmId,
      }).session(session).lean() as any

      if (!stockDoc) continue

      const restoredQty   = (stockDoc.qty   || 0) + (sr.qty   || 0)
      const restoredTotal = (stockDoc.total  || 0) + (sr.total || 0)

      // Restore batch qty
      const updatedBatches = Array.isArray(stockDoc.batches)
        ? stockDoc.batches.map((b: any) => ({ ...b }))
        : []

      if (sr.batch) {
        const batchIdx = updatedBatches.findIndex((b: any) => b.batch === sr.batch)
        if (batchIdx !== -1) {
          updatedBatches[batchIdx].qty += (sr.qty || 0)
        } else {
          updatedBatches.push({
            batch:  sr.batch,
            qty:    sr.qty   || 0,
            rate:   sr.rate  || stockDoc.rate || 0,
            uom:    sr.uom   || stockDoc.uom  || 'PCS',
            grate:  sr.grate || stockDoc.grate || 18,
            expiry: null,
            mrp:    null,
          })
        }
      }

      await Stock.findOneAndUpdate(
        { _id: sr.stock_id, firm_id: firmId },
        { $set: { qty: restoredQty, total: restoredTotal, batches: updatedBatches } },
        { session },
      )
    }

    // ── STEP 2: Delete original StockReg + Ledger entries ─────────────────
    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId }, { session })
    await Ledger.deleteMany({
      firm_id:    firmId,
      voucher_id: Number(existingBill.voucher_id),
    }, { session })

    // ── STEP 3: Re-apply stock deductions (mirrors createBill) ─────────────
    const stockRegDocs: any[] = []
    const cogsLines:    any[] = []
    const goodsItems = cart.filter((item: any) => !isServiceItem(item))

    for (const item of goodsItems) {
      if (!item.stockId) continue

      const stockDoc = await Stock.findOne({
        _id: item.stockId, firm_id: firmId,
      }).session(session).lean() as any

      if (!stockDoc) {
        throw createError({
          statusCode: 400,
          message:    `Stock item "${item.item}" not found`,
        })
      }

      const saleQty = getEffectiveItemQty(item)
      if (saleQty <= 0) continue

      if (stockDoc.qty < saleQty) {
        throw createError({
          statusCode: 400,
          message:    `Insufficient stock for "${item.item}": available ${stockDoc.qty}, requested ${saleQty}`,
        })
      }

      const costRate  = stockDoc.rate || 0
      const cogsValue = saleQty * costRate

      // Batch deduction — named batch first, then FIFO
      let remainingToDeduct = saleQty
      const updatedBatches  = Array.isArray(stockDoc.batches)
        ? stockDoc.batches.map((b: any) => ({ ...b }))
        : []

      if (updatedBatches.length > 0 && item.batch) {
        const bIdx = updatedBatches.findIndex((b: any) => b.batch === item.batch)
        if (bIdx !== -1) {
          const available = updatedBatches[bIdx].qty
          const deducted  = Math.min(available, remainingToDeduct)
          updatedBatches[bIdx].qty = available - deducted
          remainingToDeduct       -= deducted
        }
      } else {
        for (let i = 0; i < updatedBatches.length && remainingToDeduct > 0; i++) {
          const available = updatedBatches[i].qty
          const deducted  = Math.min(available, remainingToDeduct)
          updatedBatches[i].qty = available - deducted
          remainingToDeduct    -= deducted
        }
      }

      const newQty   = Math.max(0, (stockDoc.qty || 0) - saleQty)
      const newTotal = newQty * costRate

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newQty, total: newTotal, batches: updatedBatches } },
        { session },
      )

      const lineValue = saleQty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      stockRegDocs.push({
        firm_id:        firmId,
        type:           'SALE',
        bno:            existingBill.bno,
        bdate:          billDate,
        supply:         partyDoc.firm,
        item_type:      'GOODS',
        show_qty:       true,
        item:           item.item,
        item_narration: item.narration || null,
        batch:          item.batch     || null,
        hsn:            item.hsn       || stockDoc.hsn || '',
        qty:            saleQty,
        uom:            item.uom       || stockDoc.uom || 'PCS',
        rate:           item.rate      || 0,
        grate:          item.grate     || 0,
        disc:           item.disc      || 0,
        total:          lineValue,
        cost_rate:      costRate,
        stock_id:       item.stockId,
        bill_id:        billId,
        user:           actorUsername,
        firm:           firmDoc?.name  || '',
      })

      cogsLines.push({
        stockId:    item.stockId,
        stockRegId: null,
        item:       item.item,
        cogsValue,
      })
    }

    // SERVICE lines
    for (const item of cart.filter((i: any) => isServiceItem(i))) {
      const effQty  = getEffectiveItemQty(item) || 1
      const lineVal = effQty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      stockRegDocs.push({
        firm_id:        firmId,
        type:           'SALE',
        bno:            existingBill.bno,
        bdate:          billDate,
        supply:         partyDoc.firm,
        item_type:      'SERVICE',
        show_qty:       item.showQty !== false,
        item:           item.item,
        item_narration: item.narration || null,
        batch:          null,
        hsn:            item.hsn   || '',
        qty:            effQty,
        uom:            item.uom   || '',
        rate:           item.rate  || 0,
        grate:          item.grate || 0,
        disc:           item.disc  || 0,
        total:          lineVal,
        cost_rate:      null,
        stock_id:       null,
        bill_id:        billId,
        user:           actorUsername,
        firm:           firmDoc?.name || '',
      })
    }

    // ── STEP 4: Insert new StockReg rows ───────────────────────────────────
    const insertedSRDocs = await StockReg.insertMany(stockRegDocs, { session }) as any[]

    // Back-fill stockRegId on cogsLines
    let goodsInsertIdx = 0
    for (const cl of cogsLines) {
      while (
        goodsInsertIdx < insertedSRDocs.length &&
        insertedSRDocs[goodsInsertIdx].item_type !== 'GOODS'
      ) goodsInsertIdx++
      if (goodsInsertIdx < insertedSRDocs.length) {
        cl.stockRegId = insertedSRDocs[goodsInsertIdx]._id
        goodsInsertIdx++
      }
    }

    // ── STEP 5: Get new voucher number + post ledger ───────────────────────
    const voucherId = await getNextVoucherNumber(firmId)

    const taxableItemsTotal = cart.reduce((sum: number, item: any) => {
      const qty     = getEffectiveItemQty(item)
      const lineVal = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      return sum + lineVal
    }, 0)

    await postSalesLedger({
      firmId,
      billId,
      voucherId,
      billNo:            existingBill.bno,
      billDate,
      party:             partyDoc,
      ntot,
      cgst:              gstEnabled ? cgst : 0,
      sgst:              gstEnabled ? sgst : 0,
      igst:              gstEnabled ? igst : 0,
      rof,
      otherCharges,
      taxableItemsTotal,
      cogsLines,
      actorUsername,
      session,
    })

    // ── STEP 6: Update the Bill document ───────────────────────────────────
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      {
        $set: {
          voucher_id:       String(voucherId),
          bdate:            billDate,
          bill_subtype:     billType,
          supply:           partyDoc.firm,
          addr:             meta.partyGstin
            ? partyDoc.gstLocations?.find((l: any) => l.gstin === meta.partyGstin)?.address
              || partyDoc.addr
            : partyDoc.addr,
          gstin:            meta.partyGstin  || partyDoc.gstin,
          state:            partyDoc.state   || '',
          pin:              partyDoc.pin     || null,
          state_code:       partyDoc.state_code || null,
          firm_gstin:       firmGstin,
          firm_state:       firmLocation?.state      || null,
          firm_state_code:  firmLocation?.state_code || null,
          gtot,
          ntot,
          rof,
          cgst:             gstEnabled ? cgst : 0,
          sgst:             gstEnabled ? sgst : 0,
          igst:             gstEnabled ? igst : 0,
          reverse_charge:   Boolean(meta.reverseCharge),
          order_no:         meta.referenceNo     || null,
          vehicle_no:       meta.vehicleNo       || null,
          dispatch_through: meta.dispatchThrough || null,
          narration:        meta.narration       || null,
          party_id:         partyDoc._id,
          other_charges:    otherCharges,
          oth_chg_json:     JSON.stringify(otherCharges),
          consignee_name:    consignee.name    || null,
          consignee_gstin:   consignee.gstin   || null,
          consignee_address: consignee.address || null,
          consignee_state:   consignee.state   || null,
          consignee_pin:     consignee.pin     || null,
        },
      },
      { session },
    )

    await session.commitTransaction()

    return {
      success: true,
      id:      billId,
      billNo:  existingBill.bno,
      message: `Bill ${existingBill.bno} updated successfully`,
    }

  } catch (err: any) {
    await session.abortTransaction()
    console.error('[updateBill] Transaction aborted:', err.message)
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message || 'Failed to update bill' })
  } finally {
    session.endSession()
  }
})