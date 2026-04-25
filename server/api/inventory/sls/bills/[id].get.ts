/**
 * server/api/inventory/sls/bills/[id].get.ts
 * GET /api/inventory/sls/bills/:id
 *
 * Returns a single bill with its associated StockReg line items.
 * Used by the edit/return flow to reload saved bill state into the frontend.
 *
 * Auth: event.context.user
 */

import { Bill, StockReg } from '../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const billId = validateObjectId(getRouterParam(event, 'id'), 'bill ID')

  const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean() as any
  if (!bill) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }

  // Fetch associated stock movements
  const items = await StockReg.find({ bill_id: billId, firm_id: firmId })
    .sort({ createdAt: 1 })
    .lean() as any[]

  // Merge items into the bill response so the frontend gets one payload
  const billWithItems = {
    ...bill,
    items,
    other_charges: Array.isArray(bill.other_charges)
      ? bill.other_charges
      : bill.oth_chg_json
        ? (() => {
            try { return JSON.parse(bill.oth_chg_json) } catch { return [] }
          })()
        : [],
  }

  return { success: true, data: billWithItems }
})