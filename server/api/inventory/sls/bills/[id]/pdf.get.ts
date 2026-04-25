/**
 * server/api/inventory/sls/bills/[id]/pdf.get.ts
 * GET /api/inventory/sls/bills/:id/pdf
 *
 * Generates and streams a pdfmake invoice PDF for a single bill.
 *
 * Response: application/pdf blob
 *
 * Auth: event.context.user
 */

import { getFirmId, validateObjectId } from '../../../../../utils/billUtils'
import { generateInvoicePdfBuffer }    from '../../../../../utils/pdfUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const billId = validateObjectId(getRouterParam(event, 'id'), 'bill ID')

  const { buffer, filename } = await generateInvoicePdfBuffer(billId, firmId)

  setResponseHeader(event, 'Content-Type',        'application/pdf')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"` as any)
  setResponseHeader(event, 'Content-Length',      buffer.length)

  return buffer
})