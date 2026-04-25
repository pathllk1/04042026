/**
 * server/api/inventory/sls/stocks/[id].get.ts
 * GET /api/inventory/sls/stocks/:id
 *
 * Returns a single stock item by ID, scoped to the authenticated firm.
 *
 * Auth: event.context.user
 */

import { Stock } from '../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId  = getFirmId(event)
  const stockId = validateObjectId(getRouterParam(event, 'id'), 'stock ID')

  const stock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean()

  if (!stock) {
    throw createError({ statusCode: 404, message: 'Stock not found' })
  }

  return { success: true, data: stock }
})