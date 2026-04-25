/**
 * server/api/inventory/sls/bills/export.get.ts
 * GET /api/inventory/sls/bills/export
 *
 * Exports a filtered list of bills to an Excel (.xlsx) file.
 *
 * Query params:
 *   type      string   SALES | PURCHASE | CREDIT_NOTE | etc.
 *   search    string   matches bno or supply
 *   dateFrom  string   ISO date (inclusive)
 *   dateTo    string   ISO date (inclusive, end of day)
 *
 * NOTE: Nuxt file-based routing resolves /bills/export before /bills/[id]
 * because static segments take priority over dynamic params. No naming
 * conflict with [id].get.ts.
 *
 * Auth: event.context.user
 */

import { Bill }              from '../../../../models/index'
import { getFirmId, escapeRegex } from '../../../../utils/billUtils'
import { exportBillsToExcel } from '../../../../utils/exportUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const type      = String(query.type      || '').trim()
  const search    = String(query.search    || '').trim()
  const dateFrom  = String(query.dateFrom  || '').trim()
  const dateTo    = String(query.dateTo    || '').trim()

  // ── Build filter ───────────────────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId }

  if (type)   filter.btype = type.toUpperCase()

  if (search) {
    const re   = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ bno: re }, { supply: re }]
  }

  if (dateFrom || dateTo) {
    filter.bdate = {}
    if (dateFrom) filter.bdate.$gte = dateFrom
    if (dateTo)   filter.bdate.$lte = dateTo
  }

  const bills = await Bill.find(filter)
    .sort({ bdate: -1, createdAt: -1 })
    .lean() as any[]

  if (!bills.length) {
    throw createError({
      statusCode: 404,
      message:    'No bills found for the selected criteria',
    })
  }

  const buffer = await exportBillsToExcel(bills)

  const dateTag = dateFrom && dateTo
    ? `_${dateFrom}_to_${dateTo}`
    : dateFrom
      ? `_from_${dateFrom}`
      : dateTo
        ? `_to_${dateTo}`
        : ''

  const filename = `Bills_Export${dateTag}.xlsx`

  setResponseHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setResponseHeader(event, 'Content-Length',      String(buffer.length))

  return buffer
})