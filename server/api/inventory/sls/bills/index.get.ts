/**
 * server/api/inventory/sls/bills/index.get.ts
 * GET /api/inventory/sls/bills
 *
 * Returns a paginated list of bills for the authenticated firm.
 *
 * Query params:
 *   page      number   default 1
 *   limit     number   default 50
 *   search    string   matches bno or supply (party name)
 *   type      string   SALES | PURCHASE | CREDIT_NOTE | DEBIT_NOTE
 *   status    string   ACTIVE | CANCELLED
 *   dateFrom  string   ISO date string (inclusive)
 *   dateTo    string   ISO date string (inclusive, end of day)
 *
 * Auth: event.context.user
 */

import { Bill } from '../../../../models/index'
import { getFirmId, escapeRegex } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const page    = Math.max(1, parseInt(String(query.page  || 1)))
  const limit   = Math.min(200, Math.max(1, parseInt(String(query.limit || 50))))
  const skip    = (page - 1) * limit

  const search   = String(query.search   || '').trim()
  const type     = String(query.type     || '').trim()
  const status   = String(query.status   || '').trim()
  const dateFrom = String(query.dateFrom || '').trim()
  const dateTo   = String(query.dateTo   || '').trim()

  // ── Build filter ───────────────────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId }

  if (type)   filter.btype  = type.toUpperCase()
  if (status) filter.status = status.toUpperCase()

  if (search) {
    const re   = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ bno: re }, { supply: re }]
  }

  if (dateFrom || dateTo) {
    filter.bdate = {}
    if (dateFrom) filter.bdate.$gte = dateFrom
    if (dateTo)   filter.bdate.$lte = dateTo
  }

  // ── Execute ────────────────────────────────────────────────────────────
  const [bills, total] = await Promise.all([
    Bill.find(filter)
      .sort({ bdate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Bill.countDocuments(filter),
  ])

  return {
    success: true,
    data:    bills,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})