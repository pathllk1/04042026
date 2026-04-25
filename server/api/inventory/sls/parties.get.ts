/**
 * server/api/inventory/sls/parties.get.ts
 * GET /api/inventory/sls/parties
 *
 * Returns all parties (customers/suppliers) for the authenticated firm.
 * Includes the full gstLocations[] array so the frontend can render
 * multi-GSTIN party cards without additional requests.
 *
 * Auth: event.context.user
 */

import { Party } from '../../../models/index'
import { getFirmId } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)

  const parties = await Party.find({ firm_id: firmId }).lean()

  return { success: true, data: parties }
})