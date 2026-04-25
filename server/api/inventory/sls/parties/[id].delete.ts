/**
 * server/api/inventory/sls/parties/[id].delete.ts
 * DELETE /api/inventory/sls/parties/:id
 *
 * Hard-deletes a party scoped to the authenticated firm.
 * Ledger and Bill rows that reference this party are left intact
 * for audit purposes — only the Party document is removed.
 *
 * Auth: event.context.user
 */

import { Party } from '../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId  = getFirmId(event)
  const partyId = validateObjectId(getRouterParam(event, 'id'), 'party ID')

  const existing = await Party.findOne({ _id: partyId, firm_id: firmId }).lean()
  if (!existing) {
    throw createError({
      statusCode: 404,
      message:    'Party not found or does not belong to your firm',
    })
  }

  await Party.deleteOne({ _id: partyId, firm_id: firmId })

  return { success: true, message: 'Party deleted successfully' }
})