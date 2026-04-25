/**
 * server/api/inventory/sls/stock-batches.get.ts
 * GET /api/inventory/sls/stock-batches
 *
 * Returns batch-level inventory detail for all stock items in the firm.
 * Each entry is one batch row (not one stock item), making it easy for
 * the frontend to render a batch-aware stock register view.
 *
 * Query params:
 *   stockId   string   Filter to a single stock item (optional)
 *   search    string   Matches item name or batch name (optional)
 *   inStock   boolean  If 'true', only returns batches with qty > 0
 *
 * Auth: event.context.user
 */

import { Stock }                                from '../../../models/index'
import { getFirmId, validateObjectId, escapeRegex } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const stockId = String(query.stockId || '').trim()
  const search  = String(query.search  || '').trim()
  const inStock = query.inStock === 'true' || query.inStock === '1'

  // ── Build Stock-level filter ───────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId }

  if (stockId) {
    try { filter._id = validateObjectId(stockId, 'stockId') } catch { /* skip invalid */ }
  }

  if (search) {
    const re   = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ item: re }, { 'batches.batch': re }]
  }

  const stocks = await Stock.find(filter)
    .select('item pno oem hsn uom grate batches rate total qty')
    .sort({ item: 1 })
    .lean() as any[]

  // ── Flatten: one row per batch ────────────────────────────────────────
  const rows: any[] = []

  for (const stock of stocks) {
    const batches: any[] = Array.isArray(stock.batches) && stock.batches.length > 0
      ? stock.batches
      : [
          // Stocks without batches: emit a single "no-batch" row
          {
            _id:    null,
            batch:  null,
            qty:    stock.qty   || 0,
            rate:   stock.rate  || 0,
            grate:  stock.grate || 0,
            uom:    stock.uom   || 'PCS',
            expiry: null,
            mrp:    null,
          },
        ]

    for (const b of batches) {
      const batchQty = parseFloat(b.qty) || 0
      if (inStock && batchQty <= 0) continue   // skip zero-qty batches if requested

      rows.push({
        stockId:   stock._id.toString(),
        item:      stock.item,
        pno:       stock.pno  || '',
        oem:       stock.oem  || '',
        hsn:       stock.hsn  || '',
        batchId:   b._id ? b._id.toString() : null,
        batch:     b.batch  || null,
        qty:       batchQty,
        uom:       b.uom    || stock.uom   || 'PCS',
        rate:      parseFloat(b.rate)       || stock.rate  || 0,
        grate:     parseFloat(b.grate)      || stock.grate || 0,
        expiry:    b.expiry || null,
        mrp:       b.mrp    || null,
        stockQty:  stock.qty   || 0,   // total qty across all batches
        stockRate: stock.rate  || 0,   // WAC rate
      })
    }
  }

  return { success: true, data: rows, total: rows.length }
})