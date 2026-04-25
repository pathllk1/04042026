/**
 * server/api/inventory/sls/bills/[id]/cancel.put.ts
 * PUT /api/inventory/sls/bills/:id/cancel
 *
 * Cancels a bill with an optional reason string.
 * Preferred over DELETE for UI flows where a cancellation reason is shown.
 *
 * Body (optional):
 *   reason  string   Human-readable cancellation reason
 *
 * Auth: event.context.user
 */

import { validateObjectId } from '../../../../../utils/billUtils'
import { cancelBillById }   from '../../../../../utils/cancelBill'

export default defineEventHandler(async (event) => {
  const billId = validateObjectId(getRouterParam(event, 'id'), 'bill ID')
  const body   = await readBody(event).catch(() => ({}))
  const reason = body?.reason || 'Cancelled by user'

  const { billNo } = await cancelBillById(event, billId, reason)

  return {
    success: true,
    billNo,
    message: `Bill ${billNo} cancelled successfully`,
  }
})