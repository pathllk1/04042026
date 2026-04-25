/**
 * server/api/inventory/sls/stock-movements/index.post.ts
 * POST /api/inventory/sls/stock-movements
 *
 * Creates a manual stock movement (adjustment, write-off, opening stock, etc.)
 * and updates the Stock document's qty + total accordingly.
 *
 * This endpoint is for manual adjustments only — bill-driven movements
 * (SALE, PURCHASE) are created automatically inside createBill / createCreditNote.
 *
 * Body:
 *   stockId   string   Stock ObjectId — REQUIRED
 *   type      string   Movement type, e.g. 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' |
 *                      'OPENING_STOCK' | 'WRITE_OFF'
 *   qty       number   REQUIRED (positive)
 *   rate      number   Rate per unit (defaults to stock's current rate)
 *   bdate     string   Date string YYYY-MM-DD (defaults to today)
 *   bno       string   Reference number (optional)
 *   batch     string   Batch identifier (optional)
 *   narration string   Notes (optional)
 *   direction string   'IN' | 'OUT'  (default: derived from type)
 *
 * Auth: event.context.user
 */

import { Stock, StockReg }          from '../../../../models/index'
import {
  getFirmId,
  getActorUsername,
  validateObjectId,
  getLocalDateString,
} from '../../../../utils/billUtils'

// Types that add to stock (qty goes up)
const IN_TYPES = new Set([
  'ADJUSTMENT_IN', 'OPENING_STOCK', 'PURCHASE_RETURN_IN',
  'TRANSFER_IN',   'PRODUCTION_IN', 'STOCK_IN',
])

// Types that remove from stock (qty goes down)
const OUT_TYPES = new Set([
  'ADJUSTMENT_OUT', 'WRITE_OFF', 'TRANSFER_OUT',
  'CONSUMPTION',    'STOCK_OUT', 'SALE_RETURN_OUT',
])

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)

  const body = await readBody(event)
  const {
    stockId: rawStockId,
    type,
    qty: rawQty,
    rate: rawRate,
    bdate,
    bno,
    batch,
    narration,
    direction: rawDirection,
  } = body

  // ── Validate required fields ───────────────────────────────────────────
  if (!rawStockId) {
    throw createError({ statusCode: 400, message: 'stockId is required' })
  }
  if (!type?.trim()) {
    throw createError({ statusCode: 400, message: 'Movement type is required' })
  }

  const stockId = validateObjectId(rawStockId, 'stockId')
  const qty     = parseFloat(rawQty)

  if (!Number.isFinite(qty) || qty <= 0) {
    throw createError({ statusCode: 400, message: 'qty must be a positive number' })
  }

  // ── Resolve stock item ─────────────────────────────────────────────────
  const stockDoc = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean() as any
  if (!stockDoc) {
    throw createError({ statusCode: 404, message: 'Stock item not found' })
  }

  const rate      = rawRate != null ? parseFloat(rawRate) : (stockDoc.rate || 0)
  const lineValue = qty * rate
  const movDate   = bdate || getLocalDateString()
  const typeUpper = type.toUpperCase()

  // ── Determine direction ────────────────────────────────────────────────
  let isIn: boolean
  if (rawDirection === 'IN') {
    isIn = true
  } else if (rawDirection === 'OUT') {
    isIn = false
  } else {
    // Auto-derive from type keyword
    isIn = IN_TYPES.has(typeUpper) || typeUpper.includes('IN') || typeUpper.includes('OPEN')
    if (!isIn && (OUT_TYPES.has(typeUpper) || typeUpper.includes('OUT') || typeUpper.includes('WRITE'))) {
      isIn = false
    }
  }

  // ── Update Stock document ─────────────────────────────────────────────
  const currentQty   = stockDoc.qty   || 0
  const currentTotal = stockDoc.total || 0

  const newQty   = isIn
    ? currentQty   + qty
    : Math.max(0, currentQty - qty)

  const newTotal = isIn
    ? currentTotal + lineValue
    : Math.max(0, currentTotal - lineValue)

  // Batch adjustment if batch specified
  const updatedBatches = Array.isArray(stockDoc.batches)
    ? stockDoc.batches.map((b: any) => ({ ...b }))
    : []

  if (batch) {
    const bIdx = updatedBatches.findIndex((b: any) => b.batch === batch)
    if (bIdx !== -1) {
      updatedBatches[bIdx].qty = isIn
        ? updatedBatches[bIdx].qty + qty
        : Math.max(0, updatedBatches[bIdx].qty - qty)
    } else if (isIn) {
      updatedBatches.push({
        batch,
        qty:    qty,
        rate:   rate,
        uom:    stockDoc.uom   || 'PCS',
        grate:  stockDoc.grate || 0,
        expiry: null,
        mrp:    null,
      })
    }
  }

  await Stock.findOneAndUpdate(
    { _id: stockId, firm_id: firmId },
    { $set: { qty: newQty, total: newTotal, batches: updatedBatches } },
  )

  // ── Insert StockReg movement row ───────────────────────────────────────
  const srDoc = await StockReg.create({
    firm_id:        firmId,
    type:           typeUpper,
    bno:            bno     || null,
    bdate:          movDate,
    supply:         null,
    item_type:      'GOODS',
    show_qty:       true,
    item:           stockDoc.item,
    item_narration: narration || null,
    batch:          batch    || null,
    hsn:            stockDoc.hsn || '',
    qty:            isIn ? qty : -qty,   // negative for OUT movements for easy summation
    uom:            stockDoc.uom || 'PCS',
    rate,
    grate:          stockDoc.grate || 0,
    disc:           0,
    total:          isIn ? lineValue : -lineValue,
    cost_rate:      stockDoc.rate  || 0,
    stock_id:       stockId,
    bill_id:        null,
    user:           actorUsername,
    firm:           null,
    qtyh:           newQty,   // snapshot of qty after movement
  })

  return {
    success:  true,
    id:       (srDoc as any)._id,
    newQty,
    newTotal,
    message:  `Stock movement (${typeUpper}) recorded. New qty: ${newQty}`,
  }
})