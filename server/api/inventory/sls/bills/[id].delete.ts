/**
 * server/api/inventory/sls/bills/[id].delete.ts
 * DELETE /api/inventory/sls/bills/:id
 *
 * Cancels a bill (same as PUT /:id/cancel but called via DELETE verb).
 * Cancellation reason defaults to "Cancelled via DELETE".
 *
 * Auth: event.context.user
 */

import { validateObjectId } from '../../../../utils/billUtils'
import { cancelBillById }   from '../../../../utils/cancelBill'

export default defineEventHandler(async (event) => {
  const billId = validateObjectId(getRouterParam(event, 'id'), 'bill ID')
  const body   = await readBody(event).catch(() => ({}))
  const reason = body?.reason || 'Cancelled via DELETE'

  const { billNo } = await cancelBillById(event, billId, reason)

  return {
    success: true,
    billNo,
    message: `Bill ${billNo} cancelled successfully`,
  }
})