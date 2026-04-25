/**
 * server/api/inventory/sls/stock-movements/export.get.ts
 * GET /api/inventory/sls/stock-movements/export
 *
 * Exports filtered stock movements to Excel (.xlsx).
 *
 * NOTE: Static segment "export" takes routing priority over dynamic
 * [stockId] — no conflict with [stockId].get.ts.
 *
 * Query params: same as index.get.ts
 *   type, search, dateFrom, dateTo, stockId
 *
 * Auth: event.context.user
 */

import ExcelJS                           from 'exceljs'
import { StockReg }                      from '../../../../models/index'
import { getFirmId, escapeRegex }        from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const type     = String(query.type     || '').trim()
  const search   = String(query.search   || '').trim()
  const dateFrom = String(query.dateFrom || '').trim()
  const dateTo   = String(query.dateTo   || '').trim()
  const stockId  = String(query.stockId  || '').trim()

  // ── Build filter ───────────────────────────────────────────────────────
  const filter: Record<string, any> = { firm_id: firmId }

  if (type) filter.type = type.toUpperCase()

  if (stockId && stockId.length === 24) {
    filter.stock_id = stockId
  }

  if (search) {
    const re   = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ item: re }, { bno: re }, { supply: re }]
  }

  if (dateFrom || dateTo) {
    filter.bdate = {}
    if (dateFrom) filter.bdate.$gte = dateFrom
    if (dateTo)   filter.bdate.$lte = dateTo
  }

  const movements = await StockReg.find(filter)
    .sort({ bdate: -1, createdAt: -1 })
    .limit(5000)   // Safety cap — large exports should use a background job
    .lean() as any[]

  if (!movements.length) {
    throw createError({
      statusCode: 404,
      message:    'No stock movements found for the selected criteria',
    })
  }

  // ── Build workbook ─────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  const ws       = workbook.addWorksheet('Stock Movements')

  // Header row
  const HEADERS = [
    'Date', 'Type', 'Bill No', 'Party', 'Item',
    'Batch', 'HSN', 'Qty', 'UOM', 'Rate',
    'Disc %', 'GST %', 'Total', 'Narration',
  ]

  ws.addRow(HEADERS)
  const hdr = ws.getRow(1)
  hdr.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
  hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } }
  hdr.alignment = { horizontal: 'center', vertical: 'middle' }
  hdr.eachCell(cell => {
    cell.border = {
      top:    { style: 'thin' },
      left:   { style: 'thin' },
      bottom: { style: 'thin' },
      right:  { style: 'thin' },
    }
  })

  // Data rows
  for (const mov of movements) {
    const row = ws.addRow([
      mov.bdate                      || '',
      mov.type                       || '',
      mov.bno                        || '',
      mov.supply                     || '',
      mov.item                       || '',
      mov.batch                      || '',
      mov.hsn                        || '',
      Math.abs(parseFloat(mov.qty))  || 0,
      mov.uom                        || '',
      parseFloat(mov.rate)           || 0,
      parseFloat(mov.disc)           || 0,
      parseFloat(mov.grate)          || 0,
      Math.abs(parseFloat(mov.total))|| 0,
      mov.item_narration             || '',
    ])

    row.eachCell(cell => {
      cell.border = {
        top:    { style: 'thin' },
        left:   { style: 'thin' },
        bottom: { style: 'thin' },
        right:  { style: 'thin' },
      }
    })

    // Colour-code by movement direction
    const isOut = (mov.type || '').includes('CANCEL')
      || (mov.type || '').includes('OUT')
      || (mov.type || '').includes('WRITE')
      || (mov.type || '') === 'SALE'

    if (isOut) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } }
    } else if ((mov.type || '') === 'PURCHASE') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF4' } }
    }
  }

  // Column widths
  const colWidths = [12, 20, 15, 25, 35, 12, 10, 8, 6, 10, 6, 6, 12, 30]
  ws.columns.forEach((col, idx) => { col.width = colWidths[idx] || 12 })

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Print setup
  ws.pageSetup.paperSize   = 9   // A4
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage   = true
  ws.pageSetup.fitToWidth  = 1
  ws.pageSetup.fitToHeight = 0

  // ── Totals summary row ─────────────────────────────────────────────────
  const totalQty   = movements.reduce((s, m) => s + Math.abs(parseFloat(m.qty)   || 0), 0)
  const totalValue = movements.reduce((s, m) => s + Math.abs(parseFloat(m.total) || 0), 0)

  const summaryRow = ws.addRow([
    'TOTAL', '', '', '', `${movements.length} movements`,
    '', '', totalQty.toFixed(2), '', '',
    '', '', totalValue.toFixed(2), '',
  ])
  summaryRow.font = { bold: true }
  summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } }
  summaryRow.eachCell(cell => {
    cell.border = {
      top:    { style: 'medium' },
      left:   { style: 'thin' },
      bottom: { style: 'medium' },
      right:  { style: 'thin' },
    }
  })

  // ── Generate buffer + send ─────────────────────────────────────────────
  const buffer   = await workbook.xlsx.writeBuffer() as unknown as Buffer
  const dateTag  = dateFrom && dateTo ? `_${dateFrom}_to_${dateTo}` : ''
  const filename = `StockMovements${dateTag}.xlsx`

  setResponseHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"` as any)
  setResponseHeader(event, 'Content-Length', buffer.length)

  return buffer
})