/**
 * server/api/inventory/sls/bills/export/pdf.get.ts
 * GET /api/inventory/sls/bills/export/pdf
 *
 * Exports a filtered list of bills as a PDF report.
 *
 * Query params:
 *   type      string   SALES | PURCHASE | CREDIT_NOTE | etc.
 *   search    string   matches bno or supply
 *   dateFrom  string   ISO date (inclusive)
 *   dateTo    string   ISO date (inclusive, end of day)
 *
 * Auth: event.context.user
 */

import { getFirmId }                   from '../../../../../utils/billUtils'
import { exportBillsListToPdfBuffer }  from '../../../../../utils/pdfUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const { buffer, filename } = await exportBillsListToPdfBuffer({
    firmId,
    type:       String(query.type      || '').trim() || undefined,
    searchTerm: String(query.search    || '').trim() || undefined,
    dateFrom:   String(query.dateFrom  || '').trim() || undefined,
    dateTo:     String(query.dateTo    || '').trim() || undefined,
  })

  setResponseHeader(event, 'Content-Type',        'application/pdf')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setResponseHeader(event, 'Content-Length',      String(buffer.length))

  return buffer
})