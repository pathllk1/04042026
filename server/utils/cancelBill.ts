/**
 * server/utils/cancelBill.ts
 *
 * Shared cancellation logic used by both:
 *   DELETE /api/inventory/sls/bills/:id   (hard-cancel, no reason required)
 *   PUT    /api/inventory/sls/bills/:id/cancel  (soft-cancel with reason)
 *
 * Steps (all inside a Mongoose transaction):
 *   1. Find bill — must be ACTIVE SALES bill owned by the firm
 *   2. Restore stock qty + batch qtys from original StockReg rows
 *   3. Mark StockReg rows type = 'SALE_CANCELLED' (audit trail preserved)
 *   4. Delete ledger entries for the voucher
 *   5. Mark Bill status = 'CANCELLED'
 */

import mongoose from 'mongoose'
import { Stock, StockReg, Bill, Ledger } from '../models/index'
import { getFirmId, getActorUsername, validateObjectId } from './billUtils'
import type { H3Event } from 'h3'

export async function cancelBillById(
  event:              H3Event,
  billId:             string,
  cancellationReason: string | null = null,
): Promise<{ billNo: string }> {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)

  const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean() as any
  if (!existingBill) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }
  if ((existingBill.status || 'ACTIVE') === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Bill is already cancelled' })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // ── 1. Fetch original StockReg rows ────────────────────────────────────
    const srRows = await StockReg.find({
      bill_id: billId, firm_id: firmId,
    }).session(session).lean() as any[]

    // ── 2. Restore stock qty for each GOODS movement ───────────────────────
    for (const sr of srRows) {
      if (!sr.stock_id || sr.item_type === 'SERVICE') continue

      const stockDoc = await Stock.findOne({
        _id: sr.stock_id, firm_id: firmId,
      }).session(session).lean() as any
      if (!stockDoc) continue

      const restoreQty   = sr.qty   || 0
      const restoreCost  = sr.cost_rate != null
        ? sr.cost_rate * restoreQty      // use WAC captured at time of sale
        : (sr.total || 0)                // fallback: selling value (legacy rows)

      const newQty   = (stockDoc.qty   || 0) + restoreQty
      const newTotal = (stockDoc.total || 0) + restoreCost

      // Restore batch qty
      const updatedBatches = Array.isArray(stockDoc.batches)
        ? stockDoc.batches.map((b: any) => ({ ...b }))
        : []

      if (sr.batch) {
        const bIdx = updatedBatches.findIndex((b: any) => b.batch === sr.batch)
        if (bIdx !== -1) {
          updatedBatches[bIdx].qty += restoreQty
        } else {
          updatedBatches.push({
            batch:  sr.batch,
            qty:    restoreQty,
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
        { $set: { qty: newQty, total: newTotal, batches: updatedBatches } },
        { session },
      )
    }

    // ── 3. Mark StockReg rows as SALE_CANCELLED (preserves audit trail) ────
    if (srRows.length > 0) {
      await StockReg.updateMany(
        { _id: { $in: srRows.map((r: any) => r._id) } },
        { $set: { type: 'SALE_CANCELLED' } },
        { session },
      )
    }

    // ── 4. Delete ledger entries for this voucher ──────────────────────────
    await Ledger.deleteMany(
      {
        firm_id:    firmId,
        voucher_id: Number(existingBill.voucher_id),
      },
      { session },
    )

    // ── 5. Mark bill CANCELLED ─────────────────────────────────────────────
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      {
        $set: {
          status:               'CANCELLED',
          cancellation_reason:  cancellationReason || 'Cancelled',
          cancelled_at:         new Date(),
          cancelled_by:         (event.context.user as any)?._id || null,
        },
      },
      { session },
    )

    await session.commitTransaction()
    return { billNo: existingBill.bno }

  } catch (err: any) {
    await session.abortTransaction()
    console.error('[cancelBill] Transaction aborted:', err.message)
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message || 'Failed to cancel bill' })
  } finally {
    session.endSession()
  }
}