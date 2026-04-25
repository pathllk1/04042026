/**
 * server/api/inventory/sls/firm-management/firms/[id].get.ts
 * GET /api/inventory/sls/firm-management/firms/:id
 *
 * Returns a single firm by its ObjectId.
 * Ported from firmManagementController.js → getFirm().
 *
 * Access is scoped: a user can only fetch their own firm unless they
 * have a superadmin role. This prevents firm data leakage between tenants.
 *
 * Auth: event.context.user
 */

import { Firm }                        from '../../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const userFirmId = getFirmId(event)
  const firmId     = validateObjectId(getRouterParam(event, 'id'), 'firm ID')
  const user       = event.context.user as any

  // ── Tenant isolation ──────────────────────────────────────────────────
  // Regular users can only fetch their own firm.
  // Superadmin users (role === 'superadmin') may fetch any firm.
  const isSuperAdmin = user?.role === 'superadmin'

  if (!isSuperAdmin && firmId !== userFirmId) {
    throw createError({
      statusCode: 403,
      message:    'Access denied — you can only view your own firm details',
    })
  }

  const firm = await Firm.findById(firmId).lean() as any
  if (!firm) {
    throw createError({ statusCode: 404, message: 'Firm not found' })
  }

  return { success: true, data: firm }
})