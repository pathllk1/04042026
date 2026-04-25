/**
 * server/api/inventory/sls/bills/index.post.ts
 * POST /api/inventory/sls/bills
 *
 * Creates a new sales bill (SALES | DELIVERY_NOTE).
 *
 * Steps (all inside a Mongoose transaction / session):
 *   1. Validate request + resolve party
 *   2. Calculate bill totals (GST, round-off)
 *   3. Generate bill number + voucher number
 *   4. Deduct stock qty per GOODS line (batch-aware)
 *   5. Write StockReg movement rows (SALE type)
 *   6. Insert Bill document
 *   7. Post double-entry ledger entries (postSalesLedger)
 *
 * Body shape (from index.vue → useSalesState):
 *   meta          { billNo, billDate, billType, reverseCharge, referenceNo,
 *                   vehicleNo, dispatchThrough, narration,
 *                   firmGstin, partyGstin }
 *   party         string   party ObjectId
 *   cart          CartItem[]
 *   otherCharges  OtherCharge[]
 *   consignee     { name, address, gstin, state, pin, deliveryInstructions }
 *
 * Auth: event.context.user
 */

import mongoose from 'mongoose'
import {
  Stock, StockReg, Bill, Party, Firm,
} from '../../../../models/index'
import {
  getFirmId,
  getActorUsername,
  validateObjectId,
  getLocalDateString,
  isServiceItem,
  getEffectiveItemQty,
  calcBillTotals,
  getNextBillNumber,
  getNextVoucherNumber,
  isGstEnabled,
} from '../../../../utils/billUtils'
import { postSalesLedger } from '../../../../utils/inventoryLedgerHelper'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)

  const body = await readBody(event)
  const { meta = {}, party: partyId, cart = [], otherCharges = [], consignee = {} } = body

  // ── Basic validation ───────────────────────────────────────────────────
  if (!Array.isArray(cart) || cart.length === 0) {
    throw createError({ statusCode: 400, message: 'Cart is empty — add at least one item' })
  }
  const validatedPartyId = validateObjectId(partyId, 'party ID')

  const billDate = meta.billDate || getLocalDateString()
  const billType = (meta.billType === 'inter-state') ? 'inter-state' : 'intra-state'

  // ── Resolve party ──────────────────────────────────────────────────────
  const partyDoc = await Party.findOne({
    _id: validatedPartyId, firm_id: firmId,
  }).lean() as any
  if (!partyDoc) {
    throw createError({ statusCode: 404, message: 'Party not found' })
  }

  // ── Resolve firm (for firm_gstin / firm_state fields) ─────────────────
  const firmDoc = await Firm.findById(firmId)
    .select('name gst_number locations')
    .lean() as any

  const firmGstin = meta.firmGstin
    || firmDoc?.locations?.find((l: any) => l.is_default)?.gst_number
    || firmDoc?.gst_number
    || null
  const firmLocation = firmDoc?.locations?.find((l: any) => l.gst_number === firmGstin)
    || firmDoc?.locations?.find((l: any) => l.is_default)
    || null

  // ── GST enabled flag ───────────────────────────────────────────────────
  const gstEnabled = await isGstEnabled(firmId)

  // ── Totals ─────────────────────────────────────────────────────────────
  const { gtot, totalTax, otherChargesTotal, otherChargesGstTotal,
    cgst, sgst, igst, ntot, rof } = calcBillTotals(
    cart,
    otherCharges,
    gstEnabled,
    billType,
    Boolean(meta.reverseCharge),
    getEffectiveItemQty,
  )

  // ── Open Mongoose session (transaction) ────────────────────────────────
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // ── 1. Generate bill + voucher numbers ───────────────────────────────
    const billNo    = await getNextBillNumber(firmId, 'SALES')
    const voucherId = await getNextVoucherNumber(firmId)

    // ── 2. Process each cart line ────────────────────────────────────────
    const stockRegDocs: any[] = []
    const cogsLines:    any[] = []
    const goodsItems = cart.filter((item: any) => !isServiceItem(item))

    for (const item of goodsItems) {
      if (!item.stockId) continue

      const stockDoc = await Stock.findOne({
        _id:     item.stockId,
        firm_id: firmId,
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
          message:    `Insufficient stock for "${item.item}": available ${stockDoc.qty} ${stockDoc.uom}, requested ${saleQty}`,
        })
      }

      // WAC cost at time of sale — used for COGS ledger entry
      const costRate  = stockDoc.rate || 0
      const cogsValue = saleQty * costRate

      // ── Deduct from batch ──────────────────────────────────────────────
      let remainingToDeduct = saleQty
      const updatedBatches  = Array.isArray(stockDoc.batches)
        ? stockDoc.batches.map((b: any) => ({ ...b }))
        : []

      if (updatedBatches.length > 0 && item.batch) {
        // Deduct from the specific batch selected by the user
        const batchIdx = updatedBatches.findIndex((b: any) => b.batch === item.batch)
        if (batchIdx !== -1) {
          const available = updatedBatches[batchIdx].qty
          const deducted  = Math.min(available, remainingToDeduct)
          updatedBatches[batchIdx].qty = available - deducted
          remainingToDeduct           -= deducted
        }
      } else if (updatedBatches.length > 0) {
        // FIFO across batches when no specific batch specified
        for (let i = 0; i < updatedBatches.length && remainingToDeduct > 0; i++) {
          const available = updatedBatches[i].qty
          const deducted  = Math.min(available, remainingToDeduct)
          updatedBatches[i].qty = available - deducted
          remainingToDeduct    -= deducted
        }
      }

      const newQty   = Math.max(0, (stockDoc.qty || 0) - saleQty)
      const newTotal = newQty * costRate   // inventory value at WAC

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newQty, total: newTotal, batches: updatedBatches } },
        { session },
      )

      // ── StockReg row ───────────────────────────────────────────────────
      const lineValue = saleQty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      const srDoc: any = {
        firm_id:        firmId,
        type:           'SALE',
        bno:            billNo,
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
        user:           actorUsername,
        firm:           firmDoc?.name  || '',
      }
      stockRegDocs.push(srDoc)

      cogsLines.push({
        stockId:    item.stockId,
        stockRegId: null,   // filled after insertMany
        item:       item.item,
        cogsValue,
      })
    }

    // ── SERVICE lines → StockReg (no stock deduction) ────────────────────
    const serviceItems = cart.filter((item: any) => isServiceItem(item))
    for (const item of serviceItems) {
      const effQty   = getEffectiveItemQty(item) || 1
      const lineVal  = effQty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      stockRegDocs.push({
        firm_id:        firmId,
        type:           'SALE',
        bno:            billNo,
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
        user:           actorUsername,
        firm:           firmDoc?.name || '',
      })
    }

    // ── 3. Insert StockReg rows ───────────────────────────────────────────
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

    // ── 4. Build & insert Bill ────────────────────────────────────────────
    const billDoc: any = {
      firm_id:          firmId,
      voucher_id:       String(voucherId),
      bno:              billNo,
      bdate:            billDate,
      btype:            'SALES',
      bill_subtype:     billType,
      supply:           partyDoc.firm,
      addr:             meta.partyGstin
        ? partyDoc.gstLocations?.find((l: any) => l.gstin === meta.partyGstin)?.address
          || partyDoc.addr
        : partyDoc.addr,
      gstin:            meta.partyGstin || partyDoc.gstin,
      state:            partyDoc.state  || '',
      pin:              partyDoc.pin    || null,
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
      status:           'ACTIVE',
      usern:            actorUsername,
      firm:             firmDoc?.name || '',

      consignee_name:    consignee.name    || null,
      consignee_gstin:   consignee.gstin   || null,
      consignee_address: consignee.address || null,
      consignee_state:   consignee.state   || null,
      consignee_pin:     consignee.pin     || null,
    }

    const [newBill] = await Bill.insertMany([billDoc], { session }) as any[]

    // Back-fill bill_id on StockReg rows
    await StockReg.updateMany(
      { _id: { $in: insertedSRDocs.map((d: any) => d._id) } },
      { $set: { bill_id: newBill._id } },
      { session },
    )

    // ── 5. Post sales ledger ─────────────────────────────────────────────
    const taxableItemsTotal = cart.reduce((sum: number, item: any) => {
      const qty      = getEffectiveItemQty(item)
      const lineVal  = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100))
      return sum + lineVal
    }, 0)

    await postSalesLedger({
      firmId,
      billId:            newBill._id,
      voucherId,
      billNo,
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

    // ── Commit ────────────────────────────────────────────────────────────
    await session.commitTransaction()

    return {
      success: true,
      id:      newBill._id,
      billNo,
      message: `Sales bill ${billNo} created successfully`,
    }

  } catch (err: any) {
    await session.abortTransaction()
    console.error('[createBill] Transaction aborted:', err.message)

    // Re-throw H3 errors as-is; wrap others as 500
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      message:    err.message || 'Failed to create bill',
    })
  } finally {
    session.endSession()
  }
})