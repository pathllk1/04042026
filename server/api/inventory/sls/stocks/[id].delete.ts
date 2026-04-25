/**
 * server/api/inventory/sls/stocks/[id].delete.ts
 * DELETE /api/inventory/sls/stocks/:id
 *
 * Hard-deletes a stock item scoped to the authenticated firm.
 * No cascade — StockReg history rows are left intact for audit purposes.
 *
 * Auth: event.context.user
 */

import { Stock } from '../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId  = getFirmId(event)
  const stockId = validateObjectId(getRouterParam(event, 'id'), 'stock ID')

  const existing = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean()
  if (!existing) {
    throw createError({
      statusCode: 404,
      message:    'Stock not found or does not belong to your firm',
    })
  }

  await Stock.deleteOne({ _id: stockId, firm_id: firmId })

  return { success: true, message: 'Stock deleted successfully' }
})