/**
 * server/api/inventory/sls/stocks.get.ts
 * GET /api/inventory/sls/stocks
 *
 * Returns all stock items for the authenticated user's firm,
 * flattened so the first batch's fields are promoted to the root level.
 *
 * Auth: event.context.user (set by server/middleware/auth.ts)
 */

import { Stock } from '../../../models/index'
import { getFirmId } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)

  const stocks = await Stock.find({ firm_id: firmId }).lean()

  const flattenedStocks = stocks.map((stock: any) => {
    const flattened: any = { ...stock, id: stock._id.toString() }

    if (Array.isArray(stock.batches) && stock.batches.length > 0) {
      const b0           = stock.batches[0]
      flattened.batch    = b0.batch
      flattened.mrp      = b0.mrp
      flattened.expiryDate = b0.expiry
      if (!flattened.qty  && b0.qty)  flattened.qty  = b0.qty
      if (!flattened.rate && b0.rate) flattened.rate = b0.rate
    }

    flattened.pno   = flattened.pno   || ''
    flattened.oem   = flattened.oem   || ''
    flattened.hsn   = flattened.hsn   || '0000'
    flattened.qty   = flattened.qty   || 0
    flattened.uom   = flattened.uom   || 'PCS'
    flattened.rate  = flattened.rate  || 0
    flattened.grate = flattened.grate || 18
    flattened.total = flattened.total || (flattened.qty * flattened.rate)
    flattened.mrp   = flattened.mrp   || flattened.rate * 1.2

    return flattened
  })

  return { success: true, data: flattenedStocks }
})