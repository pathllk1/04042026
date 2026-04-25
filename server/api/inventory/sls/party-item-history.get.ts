/**
 * server/api/inventory/sls/party-item-history.get.ts
 * GET /api/inventory/sls/party-item-history
 *
 * Returns purchase/sale history for a specific party + stock item pair.
 * Used by the history modal in the sales invoice UI to show previous
 * transactions so the salesperson can see what rate was used before.
 *
 * Query params:
 *   partyId   string   Party ObjectId — REQUIRED
 *   stockId   string   Stock ObjectId — REQUIRED
 *   limit     number | 'all'   default 20; pass 'all' for unlimited
 *
 * Response rows:
 *   bdate, batch, qty, rate, total, bno
 *
 * Auth: event.context.user
 */

import { StockReg, Bill }              from '../../../models/index'
import { getFirmId, validateObjectId } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  // ── Validate required params ───────────────────────────────────────────
  const rawPartyId = String(query.partyId || '').trim()
  const rawStockId = String(query.stockId || '').trim()

  if (!rawPartyId) {
    throw createError({ statusCode: 400, message: 'partyId is required' })
  }
  if (!rawStockId) {
    throw createError({ statusCode: 400, message: 'stockId is required' })
  }

  const partyId = validateObjectId(rawPartyId, 'partyId')
  const stockId = validateObjectId(rawStockId, 'stockId')

  // ── Limit handling ─────────────────────────────────────────────────────
  const rawLimit = String(query.limit || '20').trim()
  const unlimited = rawLimit === 'all'
  const limitNum  = unlimited ? 0 : Math.min(200, Math.max(1, parseInt(rawLimit) || 20))

  // ── Step 1: Find bills for this party (SALES only, not CANCELLED) ──────
  const bills = await Bill.find({
    firm_id:  firmId,
    party_id: partyId,
    btype:    'SALES',
    status:   { $ne: 'CANCELLED' },
  })
    .select('_id bno bdate')
    .sort({ bdate: -1, createdAt: -1 })
    .lean() as any[]

  if (!bills.length) {
    return { success: true, data: { rows: [], total: 0 } }
  }

  const billIds = bills.map((b: any) => b._id)

  // ── Step 2: Find StockReg rows for this stock + those bills ───────────
  const srQuery = StockReg.find({
    firm_id:  firmId,
    stock_id: stockId,
    bill_id:  { $in: billIds },
    type:     'SALE',
  })
    .sort({ bdate: -1, createdAt: -1 })

  if (!unlimited) srQuery.limit(limitNum)

  const srRows = await srQuery.lean() as any[]

  // ── Step 3: Map bill metadata onto each row ────────────────────────────
  const billMap = new Map(bills.map((b: any) => [b._id.toString(), b]))

  const rows = srRows.map((sr: any) => {
    const billDoc = billMap.get((sr.bill_id || '').toString())
    return {
      bdate: billDoc?.bdate || sr.bdate || null,
      batch: sr.batch       || null,
      qty:   sr.qty         || 0,
      rate:  sr.rate        || 0,
      total: sr.total       || 0,
      bno:   billDoc?.bno   || sr.bno || null,
    }
  })

  return {
    success: true,
    data: {
      rows,
      total: rows.length,
    },
  }
})