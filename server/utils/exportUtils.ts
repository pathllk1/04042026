/**
 * server/utils/exportUtils.ts
 *
 * Excel generation utilities — all functions return Buffers.
 * Route handlers in server/api/ call these and send the result.
 * No H3 / request / response imports here.
 *
 * Ported from exportUtils.js — all 10 Excel-formatting bugs fixed
 * in the original are preserved here (alignment objects, font+alignment
 * separation, border medium/thin on last rows, etc.).
 *
 * NOTE: BankAccount model is optional — if your app does not have it yet,
 * bank details fall back to the Firm document fields. Add the model import
 * when ready and uncomment the BankAccount query in resolveDefaultBankDetails().
 */

import ExcelJS from 'exceljs'
import { Bill, StockReg, Firm, FirmSettings, Settings } from '../models/index'

/* ── Pure formatters ──────────────────────────────────────────────────────── */

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const fmt = (amount: number) =>
  '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount || 0)

const fmtQty = (qty: unknown) => parseFloat(String(qty || 0)).toFixed(2)
const fmtPct = (pct: unknown) => parseFloat(String(pct || 0)).toFixed(2) + '%'

const isSvc     = (item: any) => (item?.item_type || 'GOODS') === 'SERVICE'
const effQty    = (item: any) => { const q = parseFloat(item?.qty); return Number.isFinite(q) && q > 0 ? q : (isSvc(item) ? 1 : 0) }
const showQty   = (item: any) => !isSvc(item) || item?.show_qty !== false

/* ── Number to words ──────────────────────────────────────────────────────── */

function numberToWords(num: number): string {
  if (!num || isNaN(num)) return 'Rupees Zero Only'
  const ones  = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens  = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const cvtTens = (n: number) => {
    const v = Math.floor(n)
    if (v < 10) return ones[v]
    if (v < 20) return teens[v - 10]
    return tens[Math.floor(v / 10)] + (v % 10 > 0 ? ' ' + ones[v % 10] : '')
  }
  const cvtHundreds = (n: number) => {
    const v = Math.floor(n)
    return v > 99 ? ones[Math.floor(v / 100)] + ' Hundred ' + cvtTens(v % 100) : cvtTens(v)
  }
  const abs   = Math.abs(Number(num))
  const whole = Math.floor(abs)
  const paise = Math.round((abs - whole) * 100)
  if (whole === 0 && paise === 0) return 'Rupees Zero Only'
  let result = 'Rupees '
  let t = whole
  if (t >= 10000000) { result += cvtHundreds(Math.floor(t / 10000000)) + ' Crore '; t %= 10000000 }
  if (t >= 100000)   { result += cvtHundreds(Math.floor(t / 100000))   + ' Lakh ';  t %= 100000   }
  if (t >= 1000)     { result += cvtHundreds(Math.floor(t / 1000))     + ' Thousand '; t %= 1000   }
  if (t > 0)         { result += cvtHundreds(t) }
  if (paise > 0)     { result += ' and ' + cvtTens(paise) + ' Paise' }
  return result.trim() + ' Only'
}

/* ── Bill type helpers ────────────────────────────────────────────────────── */

function getInvoiceTypeLabel(bill: any): string {
  switch ((bill.btype || 'SALES').toUpperCase()) {
    case 'SALES':         return 'SALES INVOICE'
    case 'PURCHASE':      return 'PURCHASE INVOICE'
    case 'CREDIT NOTE':   return 'CREDIT NOTE'
    case 'DEBIT NOTE':    return 'DEBIT NOTE'
    case 'DELIVERY NOTE': return 'DELIVERY NOTE'
    default:              return (bill.btype || 'SALES').toUpperCase()
  }
}

function getPartyLabels(bill: any) {
  switch ((bill.btype || 'SALES').toUpperCase()) {
    case 'PURCHASE':      return { billTo: 'Bill From (Supplier)',      shipTo: 'Bill To (Receiver)' }
    case 'CREDIT NOTE':   return { billTo: 'Bill To (Recipient)',       shipTo: 'Ship To (Consignee)' }
    case 'DEBIT NOTE':    return { billTo: 'Bill From (Supplier)',      shipTo: 'Bill To (Recipient)' }
    case 'DELIVERY NOTE': return { billTo: 'Deliver From (Supplier)',   shipTo: 'Deliver To (Recipient)' }
    default:              return { billTo: 'Bill To (Buyer)',           shipTo: 'Ship To (Consignee)' }
  }
}

function getBillType(bill: any): 'intra-state' | 'inter-state' {
  const src = (bill.bill_subtype || bill.btype || '').toString().toLowerCase()
  if (src.includes('intra')) return 'intra-state'
  if (src.includes('inter')) return 'inter-state'
  return (Number(bill.cgst) > 0 || Number(bill.sgst) > 0) ? 'intra-state' : 'inter-state'
}

/* ── HSN summary ──────────────────────────────────────────────────────────── */

function buildHsnSummary(bill: any, items: any[], otherCharges: any[], gstEnabled: boolean) {
  const hsnMap  = new Map<string, any>()
  const billType = getBillType(bill)
  for (const item of items) {
    const hsn = item.hsn || 'NA'
    const tv  = effQty(item) * (item.rate || 0) * (1 - (item.disc || 0) / 100)
    const tax = tv * (item.grate || 0) / 100
    if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 })
    const r = hsnMap.get(hsn)!
    r.taxableValue += tv
    if (gstEnabled) {
      r.totalTax += tax
      if (billType === 'intra-state') { r.cgst += tax / 2; r.sgst += tax / 2 } else { r.igst += tax }
    }
  }
  for (const ch of otherCharges) {
    const hsn = ch.hsnSac || '9999'
    const tv  = ch.amount || 0
    const tax = ch.gstAmount || 0
    if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 })
    const r = hsnMap.get(hsn)!
    r.taxableValue += tv
    if (gstEnabled) {
      r.totalTax += tax
      if (billType === 'intra-state') { r.cgst += tax / 2; r.sgst += tax / 2 } else { r.igst += tax }
    }
  }
  return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn))
}

/* ── GST / Bank helpers ───────────────────────────────────────────────────── */

async function resolveGstEnabled(firmId: string): Promise<boolean> {
  try {
    const fs = await FirmSettings.findOne({ firm_id: firmId, setting_key: 'gst_enabled' }).lean() as any
    if (fs) return fs.setting_value === 'true'
    const gs = await Settings.findOne({ setting_key: 'gst_enabled' }).lean() as any
    return gs ? gs.setting_value === 'true' : true
  } catch { return true }
}

async function resolveDefaultBankDetails(firmId: string, firm: any): Promise<any | null> {
  // Uncomment when BankAccount model is available:
  // const defaultBank = await BankAccount.findOne({ firm_id: firmId, is_default: true, status: 'ACTIVE' })
  //   .select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean()
  // if (defaultBank) return defaultBank

  // Fallback to firm-level bank fields
  if (firm?.bank_account_number || firm?.bank_name || firm?.ifsc_code) {
    return {
      account_name:        firm.bank_name  || 'Default Bank Account',
      account_holder_name: firm.name       || '',
      bank_name:           firm.bank_name  || '',
      branch_name:         firm.bank_branch || '',
      account_number:      firm.bank_account_number || '',
      ifsc_code:           firm.ifsc_code  || '',
      upi_id:              null,
    }
  }
  return null
}

/* ══════════════════════════════════════════════════════════════════════════
   exportBillsToExcel — list view (used by bills/export.get.ts)
══════════════════════════════════════════════════════════════════════════ */

export async function exportBillsToExcel(bills: any[]): Promise<Buffer> {
  const workbook  = new ExcelJS.Workbook()
  const ws        = workbook.addWorksheet('Bills')

  ws.addRow(['Bill No', 'Date', 'Party', 'Type', 'Taxable Amount', 'Tax Amount', 'Total Amount', 'Status'])
  const hdr = ws.getRow(1)
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }
  hdr.eachCell(cell => {
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })

  for (const bill of bills) {
    const row = ws.addRow([
      bill.bno || '',
      formatDate(bill.bdate),
      bill.supply || '',
      bill.btype || 'SALES',
      (bill.gtot || 0).toFixed(2),
      ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)).toFixed(2),
      (bill.ntot || 0).toFixed(2),
      bill.status || 'ACTIVE',
    ])
    row.eachCell(cell => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })
  }

  ws.columns.forEach(col => { col.width = 15 })
  return workbook.xlsx.writeBuffer() as Promise<Buffer>
}

/* ══════════════════════════════════════════════════════════════════════════
   generateInvoiceExcelBuffer
   Single-bill detailed invoice in Excel — returns a Buffer.
   Route handler: server/api/inventory/sls/bills/[id]/excel.get.ts
══════════════════════════════════════════════════════════════════════════ */

export async function generateInvoiceExcelBuffer(
  billId: string,
  firmId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean() as any
  if (!bill) throw createError({ statusCode: 404, message: 'Bill not found' })

  const items       = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean() as any[]
  const otherCharges: any[] = Array.isArray(bill.other_charges) ? bill.other_charges : []

  const gstEnabled  = await resolveGstEnabled(firmId)

  const firmRecord  = await Firm.findById(firmId)
    .select('name address gst_number bank_account_number bank_name bank_branch ifsc_code locations')
    .lean() as any
  if (!firmRecord) throw createError({ statusCode: 404, message: 'Firm not found' })

  const firmGstin   = bill.firm_gstin || firmRecord.gst_number || ''
  const firmAddress = firmRecord.address || ''
  const seller      = { name: bill.firm || firmRecord.name || 'Company', address: firmAddress, gstin: firmGstin }
  const bankDetails = await resolveDefaultBankDetails(firmId, firmRecord)
  const billType    = getBillType(bill)
  const partyLabels = getPartyLabels(bill)
  const hsnSummary  = buildHsnSummary(bill, items, otherCharges, gstEnabled)

  const fmtBuyerAddr = bill.addr
    ? (bill.pin ? `${bill.addr}, PIN: ${bill.pin}` : bill.addr)
    : (bill.pin ? `PIN: ${bill.pin}` : '')
  const consAddr    = bill.consignee_address || bill.addr || ''
  const consPin     = bill.consignee_pin     || bill.pin  || ''
  const fmtConsAddr = consAddr ? (consPin ? `${consAddr}, PIN: ${consPin}` : consAddr) : (consPin ? `PIN: ${consPin}` : '')

  const taxableValue      = bill.gtot || 0
  const totalTax          = gstEnabled ? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)) : 0
  const roundedGrandTotal = gstEnabled ? (bill.ntot || 0) : Math.round(taxableValue)
  const roundOff          = parseFloat(bill.rof || 0)

  // ── Design tokens ──────────────────────────────────────────────────────
  const C = {
    primary:    '1B3A6B', border:  'A0B4CC', borderDark: '1B3A6B',
    textDark:   '1A1A2E', textMid: '3D4D6A', textLight:  '6B7A99',
    red:        '991B1B', hdrFill: 'EEF2F7',
  }

  const bSide = (style: 'm' | 't', dark: boolean) => ({
    style:  style === 'm' ? ('medium' as const) : ('thin' as const),
    color:  { argb: 'FF' + (dark ? C.borderDark : C.border) },
  })
  const mkBorder = (top: 'm' | 't' | null, right: 'm' | 't' | null, bottom: 'm' | 't' | null, left: 'm' | 't' | null) => ({
    top:    top    ? bSide(top,    top    === 'm') : undefined,
    right:  right  ? bSide(right,  right  === 'm') : undefined,
    bottom: bottom ? bSide(bottom, bottom === 'm') : undefined,
    left:   left   ? bSide(left,   left   === 'm') : undefined,
  })

  // ── Workbook ───────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  const ws       = workbook.addWorksheet('Invoice')

  // 9 cols: A=# B=Desc C=HSN D=Qty E=UOM F=Rate G=Disc H=GST I=Amount
  ws.columns = [
    { width: 5  }, { width: 40 }, { width: 10 }, { width: 7  }, { width: 5  },
    { width: 12 }, { width: 8  }, { width: 8  }, { width: 15 },
  ]

  let row = 1

  /* SECTION 1 — HEADER */
  const headerStartRow = row
  const leftHeader = [
    { value: getInvoiceTypeLabel(bill), font: { size: 13, bold: true, color: { argb: 'FF' + C.primary } }, align: { horizontal: 'center' as const } },
    { value: gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)', font: { size: 7.5, color: { argb: 'FF' + C.textLight } }, align: { horizontal: 'center' as const } },
    { value: seller.name,    font: { size: 12, bold: true, color: { argb: 'FF' + C.textDark } } },
    { value: seller.address, font: { size: 8,  color: { argb: 'FF' + C.textMid  } } },
    { value: seller.gstin ? `GSTIN: ${seller.gstin}` : '', font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
  ]
  leftHeader.forEach((item, i) => {
    const r = headerStartRow + i
    ws.getCell(`A${r}`).value     = item.value
    ws.getCell(`A${r}`).font      = item.font
    ws.getCell(`A${r}`).alignment = (item as any).align || {}
    ws.mergeCells(`A${r}:F${r}`)
  })

  const metaRows = [
    { label: bill.btype === 'PURCHASE' ? 'Purchase No' : 'Invoice No', value: bill.bno || '' },
    { label: 'Supplier Bill No', value: bill.supplier_bill_no || '', skip: !(bill.btype === 'PURCHASE' && bill.supplier_bill_no) },
    { label: 'Date',         value: formatDate(bill.bdate) },
    { label: bill.btype === 'PURCHASE' ? 'Reference / PO No' : 'PO No', value: bill.order_no || '', skip: !bill.order_no },
    { label: 'Vehicle No',   value: bill.vehicle_no || '',        skip: !bill.vehicle_no },
    { label: 'Dispatch Via', value: bill.dispatch_through || '',  skip: !bill.dispatch_through },
  ]
  let metaRowIdx = headerStartRow
  metaRows.forEach(meta => {
    if ((meta as any).skip || metaRowIdx > headerStartRow + 4) return
    ws.getCell(`G${metaRowIdx}`).value     = meta.label
    ws.getCell(`G${metaRowIdx}`).font      = { size: 8, color: { argb: 'FF' + C.textLight } }
    ws.getCell(`G${metaRowIdx}`).alignment = { horizontal: 'left' }
    ws.getCell(`H${metaRowIdx}`).value     = meta.value
    ws.getCell(`H${metaRowIdx}`).font      = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } }
    ws.mergeCells(`H${metaRowIdx}:I${metaRowIdx}`)
    ws.getCell(`H${metaRowIdx}`).alignment = { horizontal: 'left' }
    metaRowIdx++
  })
  for (let r = headerStartRow; r <= headerStartRow + 4; r++) {
    const isFirst = r === headerStartRow, isLast = r === headerStartRow + 4
    ws.getCell(`G${r}`).border = mkBorder(isFirst ? 'm' : 't', 't', isLast ? 'm' : 't', 'm')
    ws.getCell(`H${r}`).border = mkBorder(isFirst ? 'm' : 't', null, isLast ? 'm' : 't', null)
    ws.getCell(`I${r}`).border = mkBorder(isFirst ? 'm' : 't', 'm', isLast ? 'm' : 't', null)
  }
  row = headerStartRow + 5

  /* SECTION 2 — PARTY DETAILS */
  const partyStart = row
  const partyLeft  = [
    { value: partyLabels.billTo.toUpperCase(), font: { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } } },
    { value: bill.supply || '',                font: { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } } },
    { value: fmtBuyerAddr,                     font: { size: 8,  color: { argb: 'FF' + C.textMid  } } },
    { value: bill.state ? `State: ${bill.state}` : '', font: { size: 8, color: { argb: 'FF' + C.textMid } } },
    { value: bill.gstin ? `GSTIN: ${bill.gstin}` : '', font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
  ]
  const partyRight = [
    { value: partyLabels.shipTo.toUpperCase(), font: { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } } },
    { value: bill.consignee_name || '',        font: { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } } },
    { value: fmtConsAddr,                      font: { size: 8,  color: { argb: 'FF' + C.textMid  } } },
    { value: (bill.consignee_state || bill.state) ? `State: ${bill.consignee_state || bill.state}` : '', font: { size: 8, color: { argb: 'FF' + C.textMid } } },
    { value: (bill.consignee_gstin || bill.gstin)  ? `GSTIN: ${bill.consignee_gstin || bill.gstin}`  : '', font: { size: 8, bold: true, color: { argb: 'FF' + C.textDark } } },
  ]
  partyLeft.forEach((item, i) => {
    const r = partyStart + i
    ws.getCell(`A${r}`).value = item.value; ws.getCell(`A${r}`).font = item.font
    ws.getCell(`A${r}`).alignment = { wrapText: true }; ws.mergeCells(`A${r}:D${r}`)
  })
  partyRight.forEach((item, i) => {
    const r = partyStart + i
    ws.getCell(`E${r}`).value = item.value; ws.getCell(`E${r}`).font = item.font
    ws.getCell(`E${r}`).alignment = { wrapText: true }; ws.mergeCells(`E${r}:I${r}`)
  })
  const partyEnd = partyStart + 4
  for (let r = partyStart; r <= partyEnd; r++) {
    const isFirst = r === partyStart, isLast = r === partyEnd
    for (let c = 0; c < 4; c++) {
      const col = String.fromCharCode(65 + c)
      ws.getCell(`${col}${r}`).border = mkBorder(isFirst ? 'm' : 't', c === 3 ? 'm' : 't', isLast ? 'm' : 't', c === 0 ? 'm' : 't')
    }
    for (let c = 4; c < 9; c++) {
      const col = String.fromCharCode(65 + c)
      ws.getCell(`${col}${r}`).border = mkBorder(isFirst ? 'm' : 't', c === 8 ? 'm' : 't', isLast ? 'm' : 't', c === 4 ? 'm' : 't')
    }
  }
  row = partyEnd + 2

  /* SECTION 3 — ITEMS TABLE */
  const itemsHeaderRow = row
  const itemColDefs = [
    { col: 'A', label: '#',                              align: 'center' },
    { col: 'B', label: 'Description of Goods / Services', align: 'left'  },
    { col: 'C', label: 'HSN/SAC',                        align: 'center' },
    { col: 'D', label: 'Qty',                            align: 'center' },
    { col: 'E', label: 'UOM',                            align: 'center' },
    { col: 'F', label: 'Rate (₹)',                       align: 'right'  },
    { col: 'G', label: 'Disc%',                          align: 'right'  },
    { col: 'H', label: 'GST%',                           align: 'right'  },
    { col: 'I', label: 'Amount (₹)',                     align: 'right'  },
  ]
  itemColDefs.forEach(({ col, label, align }, idx) => {
    const cell = ws.getCell(`${col}${itemsHeaderRow}`)
    cell.value     = label
    cell.font      = { size: 8, bold: true, color: { argb: 'FF' + C.primary } }
    cell.alignment = { horizontal: align as any }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.hdrFill } }
    cell.border    = mkBorder('m', idx === 8 ? 'm' : 't', 'm', idx === 0 ? 'm' : 't')
  })
  row++

  const writeItemRow = (rowNum: number, cells: any[], isLastRow: boolean) => {
    cells.forEach(({ col, value, align, bold, fontSize, color }: any, idx: number) => {
      const cell = ws.getCell(`${col}${rowNum}`)
      cell.value = value
      if (!value || typeof value !== 'object' || !value.richText) {
        cell.font = { size: fontSize || 8.5, bold: bold || false, color: { argb: 'FF' + (color || C.textDark) } }
      }
      cell.alignment = { horizontal: (align || 'left') as any, wrapText: col === 'B' }
      cell.border    = mkBorder('t', idx === cells.length - 1 ? 'm' : 't', isLastRow ? 'm' : 't', idx === 0 ? 'm' : 't')
    })
  }

  const allDataRows = [
    ...items.map((it: any, idx: number) => ({
      cells: [
        { col: 'A', value: idx + 1, align: 'center' },
        { col: 'B', value: (() => {
          const parts: any[] = [{ text: it.item || '', font: { bold: true, size: 8.5, color: { argb: 'FF' + C.textDark } } }]
          if (!isSvc(it) && it.batch) parts.push({ text: '  Batch: ' + it.batch, font: { size: 7.5, color: { argb: 'FF' + C.textLight } } })
          if (it.item_narration)      parts.push({ text: '  ' + it.item_narration, font: { size: 7.5, color: { argb: 'FF' + C.textLight } } })
          return parts.length > 1 ? { richText: parts } : (it.item || '')
        })(), align: 'left', bold: true },
        { col: 'C', value: it.hsn  || '',                                      align: 'center' },
        { col: 'D', value: showQty(it) ? fmtQty(it.qty) : '',                 align: 'center' },
        { col: 'E', value: showQty(it) ? (it.uom || '') : '',                 align: 'center' },
        { col: 'F', value: fmt(it.rate),                                       align: 'right'  },
        { col: 'G', value: fmtPct(it.disc),                                   align: 'right'  },
        { col: 'H', value: gstEnabled ? fmtPct(it.grate) : '-',               align: 'right'  },
        { col: 'I', value: fmt(it.total),                                      align: 'right', bold: true },
      ],
    })),
    ...otherCharges.map((ch: any, idx: number) => ({
      cells: [
        { col: 'A', value: items.length + idx + 1,         align: 'center' },
        { col: 'B', value: ch.name || ch.type || 'Other Charge', align: 'left', bold: true },
        { col: 'C', value: ch.hsnSac || '',                align: 'center' },
        { col: 'D', value: '1',                            align: 'center' },
        { col: 'E', value: 'NOS',                          align: 'center' },
        { col: 'F', value: fmt(ch.amount),                 align: 'right'  },
        { col: 'G', value: '0.00%',                        align: 'right'  },
        { col: 'H', value: gstEnabled ? fmtPct(ch.gstRate) : '-', align: 'right' },
        { col: 'I', value: fmt(ch.amount),                 align: 'right', bold: true },
      ],
    })),
  ]

  allDataRows.forEach(({ cells }, idx) => {
    writeItemRow(row, cells, idx === allDataRows.length - 1)
    row++
  })

  /* SECTION 4 — HSN SUMMARY */
  if (hsnSummary.length > 0 && gstEnabled) {
    row += 1
    const hsnHdrRow = row
    const hsnHdrFont = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } }
    const hsnHdrFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF' + C.hdrFill } }

    const styleHsnMaster = (col: string, label: string, align: string, leftBorder: 'm' | 't', rightBorder: 'm' | 't') => {
      const c = ws.getCell(`${col}${hsnHdrRow}`)
      c.value = label; c.font = { ...hsnHdrFont }
      c.alignment = { horizontal: align as any }; c.fill = hsnHdrFill
      c.border = mkBorder('m', rightBorder, 'm', leftBorder)
    }

    ws.mergeCells(`B${hsnHdrRow}:C${hsnHdrRow}`)
    ws.mergeCells(`D${hsnHdrRow}:E${hsnHdrRow}`)
    ws.mergeCells(`F${hsnHdrRow}:G${hsnHdrRow}`)

    styleHsnMaster('A', 'HSN/SAC',       'center', 'm', 't')
    styleHsnMaster('B', 'Taxable Value',  'right',  't', 't')
    styleHsnMaster('D', 'CGST (₹)',       'right',  't', 't')
    styleHsnMaster('F', 'SGST (₹)',       'right',  't', 't')
    styleHsnMaster('H', 'IGST (₹)',       'right',  't', 't')
    styleHsnMaster('I', 'Total Tax (₹)', 'right',  't', 'm')
    ;['C', 'E', 'G'].forEach(col => {
      ws.getCell(`${col}${hsnHdrRow}`).fill   = hsnHdrFill
      ws.getCell(`${col}${hsnHdrRow}`).border = mkBorder('m', 't', 'm', null)
    })
    row++

    hsnSummary.forEach((hsn: any, idx: number) => {
      const isLast = idx === hsnSummary.length - 1
      const bot: 'm' | 't' = isLast ? 'm' : 't'

      ws.getCell(`A${row}`).value = hsn.hsn; ws.getCell(`A${row}`).font = { size: 8 }
      ws.getCell(`A${row}`).alignment = { horizontal: 'center' }; ws.getCell(`A${row}`).border = mkBorder('t', 't', bot, 'm')

      ws.getCell(`B${row}`).value = fmt(hsn.taxableValue); ws.getCell(`B${row}`).font = { size: 8 }
      ws.getCell(`B${row}`).alignment = { horizontal: 'right' }; ws.getCell(`B${row}`).border = mkBorder('t', 't', bot, 't')
      ws.mergeCells(`B${row}:C${row}`); ws.getCell(`C${row}`).border = mkBorder('t', 't', bot, 't')

      ws.getCell(`D${row}`).value = billType === 'intra-state' ? fmt(hsn.cgst) : '—'; ws.getCell(`D${row}`).font = { size: 8 }
      ws.getCell(`D${row}`).alignment = { horizontal: 'right' }; ws.getCell(`D${row}`).border = mkBorder('t', 't', bot, 't')
      ws.mergeCells(`D${row}:E${row}`); ws.getCell(`E${row}`).border = mkBorder('t', 't', bot, 't')

      ws.getCell(`F${row}`).value = billType === 'intra-state' ? fmt(hsn.sgst) : '—'; ws.getCell(`F${row}`).font = { size: 8 }
      ws.getCell(`F${row}`).alignment = { horizontal: 'right' }; ws.getCell(`F${row}`).border = mkBorder('t', 't', bot, 't')
      ws.mergeCells(`F${row}:G${row}`); ws.getCell(`G${row}`).border = mkBorder('t', 't', bot, 't')

      ws.getCell(`H${row}`).value = billType === 'inter-state' ? fmt(hsn.igst) : '—'; ws.getCell(`H${row}`).font = { size: 8 }
      ws.getCell(`H${row}`).alignment = { horizontal: 'right' }; ws.getCell(`H${row}`).border = mkBorder('t', 't', bot, 't')

      ws.getCell(`I${row}`).value = fmt(hsn.totalTax); ws.getCell(`I${row}`).font = { size: 8, bold: true }
      ws.getCell(`I${row}`).alignment = { horizontal: 'right' }; ws.getCell(`I${row}`).border = mkBorder('t', 'm', bot, 't')
      row++
    })
  }

  /* SECTION 5 — FOOTER: AMOUNT IN WORDS + TOTALS */
  row += 1
  const footerStartRow = row

  ws.getCell(`A${row}`).value = 'AMOUNT IN WORDS'
  ws.getCell(`A${row}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } }
  ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++

  ws.getCell(`A${row}`).value = numberToWords(roundedGrandTotal)
  ws.getCell(`A${row}`).font = { size: 9, bold: true }
  ws.getCell(`A${row}`).alignment = { wrapText: true }; ws.mergeCells(`A${row}:F${row}`); row++

  if (bill.narration) {
    ws.getCell(`A${row}`).value = 'NARRATION'; ws.getCell(`A${row}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } }
    ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
    ws.getCell(`A${row}`).value = bill.narration; ws.getCell(`A${row}`).font = { size: 8.5, color: { argb: 'FF' + C.textMid } }
    ws.getCell(`A${row}`).alignment = { wrapText: true }; ws.mergeCells(`A${row}:F${row}`); row++
  }

  if (bankDetails) {
    ws.getCell(`A${row}`).value = 'BANK DETAILS'; ws.getCell(`A${row}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } }
    ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
    const bankLines = [
      `A/C: ${bankDetails.account_number || '-'}`,
      `Bank: ${bankDetails.bank_name || '-'}`,
      `Branch: ${bankDetails.branch_name || '-'}`,
      `IFSC: ${bankDetails.ifsc_code || '-'}`,
      ...(bankDetails.upi_id ? [`UPI: ${bankDetails.upi_id}`] : []),
    ]
    for (const line of bankLines) {
      ws.getCell(`A${row}`).value = line; ws.getCell(`A${row}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } }
      ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
    }
  }

  const totalsLines = [
    { label: 'Taxable Value',  value: fmt(taxableValue) },
    ...(gstEnabled ? (billType === 'intra-state'
      ? [{ label: 'Add: CGST', value: fmt(bill.cgst) }, { label: 'Add: SGST', value: fmt(bill.sgst) }]
      : [{ label: 'Add: IGST', value: fmt(bill.igst) }]
    ) : []),
    { label: 'Total Tax',   value: fmt(totalTax) },
    { label: 'Round Off',   value: fmt(roundOff) },
    { label: 'GRAND TOTAL', value: fmt(roundedGrandTotal), isGrand: true },
  ]

  let totalsRow = footerStartRow
  totalsLines.forEach((line: any, idx: number) => {
    const isFirst = idx === 0, isLast = idx === totalsLines.length - 1, isAboveGrand = idx === totalsLines.length - 2
    ws.getCell(`G${totalsRow}`).value     = line.label
    ws.getCell(`G${totalsRow}`).font      = line.isGrand ? { size: 9.5, bold: true, color: { argb: 'FF' + C.primary } } : { size: 8, color: { argb: 'FF' + C.textMid } }
    ws.getCell(`G${totalsRow}`).alignment = { horizontal: 'left' }
    ws.getCell(`G${totalsRow}`).border    = mkBorder(isFirst || isAboveGrand ? 'm' : 't', 't', isLast || isAboveGrand ? 'm' : 't', 'm')
    ws.mergeCells(`G${totalsRow}:H${totalsRow}`)
    ws.getCell(`I${totalsRow}`).value     = line.value
    ws.getCell(`I${totalsRow}`).font      = line.isGrand ? { size: 10, bold: true, color: { argb: 'FF' + C.primary } } : { size: 8.5 }
    ws.getCell(`I${totalsRow}`).alignment = { horizontal: 'right' }
    ws.getCell(`I${totalsRow}`).border    = mkBorder(isFirst || isAboveGrand ? 'm' : 't', 'm', isLast || isAboveGrand ? 'm' : 't', 't')
    totalsRow++
  })

  if (bill.reverse_charge && gstEnabled) {
    ws.getCell(`G${totalsRow}`).value = '* Reverse charge applicable. Tax liability on recipient.'
    ws.getCell(`G${totalsRow}`).font  = { size: 7.5, color: { argb: 'FF' + C.red } }
    ws.getCell(`G${totalsRow}`).alignment = { horizontal: 'right' }
    ws.mergeCells(`G${totalsRow}:I${totalsRow}`)
    totalsRow++
  }

  const footerEndRow = Math.max(row, totalsRow)
  row = footerEndRow + 1

  /* SECTION 6 — SIGNATURES */
  ws.getCell(`A${row}`).value = 'TERMS & CONDITIONS'; ws.getCell(`A${row}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } }
  ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
  for (const t of ['1. Goods once sold will not be taken back.', '2. Subject to local jurisdiction only.', '3. E. & O.E.']) {
    ws.getCell(`A${row}`).value = t; ws.getCell(`A${row}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } }
    ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
  }
  row += 2
  ws.getCell(`A${row}`).value = "Receiver's Signature"; ws.getCell(`A${row}`).font = { size: 8, color: { argb: 'FF' + C.textMid } }
  ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`); row++
  ws.getCell(`A${row}`).value = '(Authorised Signatory)'; ws.getCell(`A${row}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } }
  ws.getCell(`A${row}`).alignment = { horizontal: 'left' }; ws.mergeCells(`A${row}:F${row}`)

  const sigStart = footerEndRow + 1
  ws.getCell(`G${sigStart}`).value = `For ${seller.name}`; ws.getCell(`G${sigStart}`).font = { size: 9, bold: true, color: { argb: 'FF' + C.textDark } }
  ws.getCell(`G${sigStart}`).alignment = { horizontal: 'right' }; ws.mergeCells(`G${sigStart}:I${sigStart}`)
  ws.getCell(`G${sigStart + 1}`).value = gstEnabled ? `GSTIN: ${seller.gstin}` : ''
  ws.getCell(`G${sigStart + 1}`).font  = { size: 7.5, color: { argb: 'FF' + C.textLight } }
  ws.getCell(`G${sigStart + 1}`).alignment = { horizontal: 'right' }; ws.mergeCells(`G${sigStart + 1}:I${sigStart + 1}`)
  ws.getCell(`G${sigStart + 4}`).value = 'Authorised Signatory'; ws.getCell(`G${sigStart + 4}`).font = { size: 8, color: { argb: 'FF' + C.textMid } }
  ws.getCell(`G${sigStart + 4}`).alignment = { horizontal: 'right' }; ws.mergeCells(`G${sigStart + 4}:I${sigStart + 4}`)
  ws.getCell(`G${sigStart + 5}`).value = 'This is a computer generated invoice'
  ws.getCell(`G${sigStart + 5}`).font  = { size: 7, italic: true, color: { argb: 'FF' + C.textLight } }
  ws.getCell(`G${sigStart + 5}`).alignment = { horizontal: 'right' }; ws.mergeCells(`G${sigStart + 5}:I${sigStart + 5}`)

  ws.pageSetup.paperSize   = 9
  ws.pageSetup.orientation = 'portrait'
  ws.pageSetup.fitToPage   = true
  ws.pageSetup.fitToWidth  = 1
  ws.pageSetup.fitToHeight = 0
  ws.pageSetup.scale       = 100
  ws.pageMargins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }

  const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename   = `Invoice_${safeBillNo}.xlsx`
  const buffer     = await workbook.xlsx.writeBuffer() as Buffer

  return { buffer, filename }
}