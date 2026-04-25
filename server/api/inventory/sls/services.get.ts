/**
 * server/api/inventory/sls/services.get.ts
 * GET /api/inventory/sls/services
 *
 * Returns unique service items from StockReg (item_type === 'SERVICE')
 * for the authenticated firm, used by the service-line autocomplete in the
 * sales invoice UI.
 *
 * Deduplicates by item name — the most recent entry wins (sort by createdAt desc
 * before the seen-set dedup loop).
 *
 * Auth: event.context.user
 */

import { StockReg } from '../../../models/index'
import { getFirmId } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)

  const services = await StockReg.find({
    firm_id:   firmId,
    item_type: 'SERVICE',
    item:      { $exists: true, $ne: '' },
  })
    .select('item hsn uom rate grate')
    .sort({ createdAt: -1 })
    .lean() as any[]

  // Deduplicate by item name — first occurrence (most recent) wins
  const seen            = new Set<string>()
  const uniqueServices  = []

  for (const svc of services) {
    if (!seen.has(svc.item)) {
      seen.add(svc.item)
      uniqueServices.push({
        item:  svc.item  || '',
        hsn:   svc.hsn   || '',
        uom:   svc.uom   || '',
        rate:  parseFloat(svc.rate)  || 0,
        grate: parseFloat(svc.grate) || 18,
      })
    }
  }

  return { success: true, data: uniqueServices }
})