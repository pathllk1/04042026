/**
 * server/api/inventory/sls/stock-movements/index.get.ts
 * GET /api/inventory/sls/stock-movements
 *
 * Returns a paginated list of stock register movements for the firm.
 *
 * Query params:
 *   page      number   default 1
 *   limit     number   default 50 (max 200)
 *   type      string   SALE | PURCHASE | SALE_CANCELLED | PURCHASE_CANCELLED
 *   search    string   matches item name or bno
 *   dateFrom  string   YYYY-MM-DD (inclusive)
 *   dateTo    string   YYYY-MM-DD (inclusive)
 *   stockId   string   filter by specific stock item ObjectId
 *
 * Auth: event.context.user
 */

import { StockReg }                      from '../../../../models/index'
import { getFirmId, escapeRegex, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const page    = Math.max(1, parseInt(String(query.page  || 1)))
  const limit   = Math.min(200, Math.max(1, parseInt(String(query.limit || 50))))
  const skip    = (page - 1) * limit

  const type     = String(query.type     || '').trim()
  const search   = String(query.search   || '').trim()
  const dateFrom = String(query.dateFrom || '').trim()
  const dateTo   = String(query.dateTo   || '').trim()
  const stockId  = String(query.stockId  || '').trim()

  // ── Build filter ───────────────────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId }

  if (type)    filter.type     = type.toUpperCase()
  if (stockId && stockId.length === 24) {
    try { filter.stock_id = validateObjectId(stockId, 'stockId') } catch { /* ignore invalid */ }
  }

  if (search) {
    const re   = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ item: re }, { bno: re }]
  }

  if (dateFrom || dateTo) {
    filter.bdate = {}
    if (dateFrom) filter.bdate.$gte = dateFrom
    if (dateTo)   filter.bdate.$lte = dateTo
  }

  const [movements, total] = await Promise.all([
    StockReg.find(filter)
      .sort({ bdate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockReg.countDocuments(filter),
  ])

  return {
    success: true,
    data:    movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})