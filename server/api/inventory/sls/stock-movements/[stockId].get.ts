/**
 * server/api/inventory/sls/stock-movements/[stockId].get.ts
 * GET /api/inventory/sls/stock-movements/:stockId
 *
 * Returns all stock register movements for a specific stock item.
 * Ordered by date descending — most recent movement first.
 *
 * Query params:
 *   type      string   Filter by movement type (SALE, PURCHASE, etc.)
 *   dateFrom  string   YYYY-MM-DD (inclusive)
 *   dateTo    string   YYYY-MM-DD (inclusive)
 *   limit     number   Max results (default 200, max 500)
 *
 * Auth: event.context.user
 */

import { StockReg, Stock }              from '../../../../models/index'
import { getFirmId, validateObjectId }  from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId  = getFirmId(event)
  const stockId = validateObjectId(getRouterParam(event, 'stockId'), 'stockId')
  const query   = getQuery(event)

  // Verify the stock item exists and belongs to this firm
  const stockDoc = await Stock.findOne({ _id: stockId, firm_id: firmId })
    .select('item uom')
    .lean() as any
  if (!stockDoc) {
    throw createError({ statusCode: 404, message: 'Stock item not found' })
  }

  const type     = String(query.type     || '').trim()
  const dateFrom = String(query.dateFrom || '').trim()
  const dateTo   = String(query.dateTo   || '').trim()
  const limit    = Math.min(500, Math.max(1, parseInt(String(query.limit || 200))))

  // ── Build filter ───────────────────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId, stock_id: stockId }

  if (type) filter.type = type.toUpperCase()

  if (dateFrom || dateTo) {
    filter.bdate = {}
    if (dateFrom) filter.bdate.$gte = dateFrom
    if (dateTo)   filter.bdate.$lte = dateTo
  }

  const movements = await StockReg.find(filter)
    .sort({ bdate: -1, createdAt: -1 })
    .limit(limit)
    .lean()

  return {
    success: true,
    data: {
      stock:     stockDoc,
      movements,
      total:     movements.length,
    },
  }
})