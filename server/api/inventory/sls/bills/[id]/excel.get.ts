/**
 * server/api/inventory/sls/bills/[id]/excel.get.ts
 * GET /api/inventory/sls/bills/:id/excel
 *
 * Generates and streams an ExcelJS invoice workbook for a single bill.
 *
 * Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *
 * Auth: event.context.user
 */

import { getFirmId, validateObjectId }   from '../../../../../utils/billUtils'
import { generateInvoiceExcelBuffer }    from '../../../../../utils/exportUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const billId = validateObjectId(getRouterParam(event, 'id'), 'bill ID')

  const { buffer, filename } = await generateInvoiceExcelBuffer(billId, firmId)

  setResponseHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"` as any)
  setResponseHeader(event, 'Content-Length', buffer.length)

  return buffer
})