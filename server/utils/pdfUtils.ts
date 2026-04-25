/**
 * server/utils/pdfUtils.ts
 *
 * pdfmake-based invoice PDF generation — returns a Buffer.
 * Route handler: server/api/inventory/sls/bills/[id]/pdf.get.ts
 *
 * Ported from pdfMakeController.js.
 *
 * Font files must exist at:
 *   <project-root>/client/public/fonts/DejaVuSans.ttf        (normal)
 *   <project-root>/client/public/fonts/DejaVuSans-Bold.ttf   (bold)
 *   <project-root>/client/public/fonts/DejaVuSans-Oblique.ttf (italics)
 *   <project-root>/client/public/fonts/DejaVuSans-BoldOblique.ttf (bolditalics)
 *
 * If you move the fonts, update getFontPath() below.
 */

import path           from 'path'
import fs             from 'fs'
import { fileURLToPath } from 'url'
import PrinterModule  from 'pdfmake/js/Printer.js'
import { Bill, StockReg, Firm } from '../models/index'

const PdfPrinter = (PrinterModule as any).default ?? PrinterModule

/* ── Font setup ───────────────────────────────────────────────────────────── */

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// Resolve from the project root (CWD at runtime)
const getFontPath = (fileName: string) =>
  path.join(process.cwd(), 'client', 'public', 'fonts', fileName)

const FONT_FILES = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'DejaVuSans-Oblique.ttf',
  'DejaVuSans-BoldOblique.ttf',
]

// Warn on missing fonts at startup rather than crashing on first request
FONT_FILES.forEach(f => {
  if (!fs.existsSync(getFontPath(f))) {
    console.warn(`[pdfUtils] Font file missing: ${getFontPath(f)}`)
  }
})

const fonts = {
  DejaVuSans: {
    normal:      getFontPath('DejaVuSans.ttf'),
    bold:        getFontPath('DejaVuSans-Bold.ttf'),
    italics:     getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf'),
  },
}

const printer = new PdfPrinter(fonts)

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const formatCurrency = (amount: number) =>
  '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount || 0)

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  } catch { return dateString ?? '' }
}

/* ══════════════════════════════════════════════════════════════════════════
   generateInvoicePdfBuffer
   Returns a Buffer containing the PDF bytes.
   Route handler: server/api/inventory/sls/bills/[id]/pdf.get.ts
══════════════════════════════════════════════════════════════════════════ */

export async function generateInvoicePdfBuffer(
  billId: string,
  firmId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean() as any
  if (!bill) throw createError({ statusCode: 404, message: 'Bill not found' })

  const items        = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean() as any[]
  const otherCharges: any[] = Array.isArray(bill.other_charges) ? bill.other_charges : []

  const firmRecord = await Firm.findById(firmId)
    .select('name address gst_number locations')
    .lean() as any
  if (!firmRecord) throw createError({ statusCode: 404, message: 'Firm not found' })

  const firmGstin  = bill.firm_gstin || firmRecord.gst_number || ''
  const firmAddress = firmRecord.address || ''

  // ── Design colours ────────────────────────────────────────────────────
  const C = {
    primary:    '#1B3A6B',
    border:     '#A0B4CC',
    borderDark: '#1B3A6B',
    textDark:   '#1A1A2E',
    textMid:    '#3D4D6A',
    textLight:  '#6B7A99',
  }

  const tableLayout = {
    hLineWidth: (i: number, node: any) =>
      i === 0 || i === 1 || i === node.table.body.length ? 1.5 : 0.5,
    vLineWidth: (i: number, node: any) =>
      i === 0 || i === node.table.widths.length ? 1.5 : 0.5,
    hLineColor: (i: number, node: any) =>
      i === 0 || i === 1 || i === node.table.body.length ? C.borderDark : C.border,
    vLineColor: () => C.border,
    paddingLeft:   () => 5,
    paddingRight:  () => 5,
    paddingTop:    () => 2,
    paddingBottom: () => 2,
  }

  // ── Item rows ─────────────────────────────────────────────────────────
  const itemRows = items.map((item: any, idx: number) => {
    const qty      = parseFloat(item.qty) || 0
    const rate     = parseFloat(item.rate) || 0
    const disc     = parseFloat(item.disc) || 0
    const grate    = parseFloat(item.grate) || 0
    const taxable  = qty * rate * (1 - disc / 100)
    const taxAmt   = (taxable * grate) / 100
    const total    = taxable + taxAmt

    return [
      { text: String(idx + 1),          style: 'tableCell', alignment: 'center' },
      { text: item.item || '',           style: 'tableCell' },
      { text: item.hsn || '',            style: 'tableCell', alignment: 'center' },
      { text: String(qty),               style: 'tableCell', alignment: 'right'  },
      { text: item.uom || '',            style: 'tableCell', alignment: 'center' },
      { text: formatCurrency(rate),      style: 'tableCell', alignment: 'right'  },
      { text: `${disc}%`,               style: 'tableCell', alignment: 'right'  },
      { text: `${grate}%`,              style: 'tableCell', alignment: 'right'  },
      { text: formatCurrency(total),     style: 'tableCell', alignment: 'right', bold: true },
    ]
  })

  const chargeRows = otherCharges.map((ch: any, idx: number) => {
    const amt    = parseFloat(ch.amount) || 0
    const gstAmt = (amt * (parseFloat(ch.gstRate) || 0)) / 100
    const total  = amt + gstAmt
    return [
      { text: String(items.length + idx + 1), style: 'tableCell', alignment: 'center' },
      { text: ch.name || ch.type || 'Other',  style: 'tableCell' },
      { text: ch.hsnSac || '',               style: 'tableCell', alignment: 'center' },
      { text: '1',                            style: 'tableCell', alignment: 'right'  },
      { text: 'NOS',                          style: 'tableCell', alignment: 'center' },
      { text: formatCurrency(amt),           style: 'tableCell', alignment: 'right'  },
      { text: '0%',                           style: 'tableCell', alignment: 'right'  },
      { text: `${ch.gstRate || 0}%`,         style: 'tableCell', alignment: 'right'  },
      { text: formatCurrency(total),         style: 'tableCell', alignment: 'right', bold: true },
    ]
  })

  // ── Totals ────────────────────────────────────────────────────────────
  const taxableValue = bill.gtot || 0
  const totalTax     = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)
  const grandTotal   = bill.ntot || 0
  const roundOff     = parseFloat(bill.rof || 0)

  // ── Document definition ───────────────────────────────────────────────
  const docDefinition: any = {
    content: [
      // Header
      { text: `${firmRecord.name || 'Company Name'}`, style: 'firmName' },
      { text: firmAddress,                style: 'firmAddress' },
      firmGstin ? { text: `GSTIN: ${firmGstin}`, style: 'firmGstin' } : {},
      { text: bill.btype === 'PURCHASE' ? 'PURCHASE INVOICE' : 'SALES INVOICE', style: 'invoiceTitle' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: C.borderDark }] },
      { text: '\n' },

      // Bill metadata
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Bill To', style: 'sectionLabel' },
              { text: bill.supply || '', bold: true, fontSize: 11 },
              { text: bill.addr   || '', fontSize: 9, color: C.textMid },
              { text: bill.state  ? `State: ${bill.state}` : '', fontSize: 9 },
              { text: bill.gstin  ? `GSTIN: ${bill.gstin}` : '', fontSize: 9, bold: true },
            ],
          },
          {
            width: '50%',
            stack: [
              { columns: [{ text: 'Invoice No:', width: 80, fontSize: 9, color: C.textMid }, { text: bill.bno || '', bold: true, fontSize: 9 }] },
              { columns: [{ text: 'Date:',       width: 80, fontSize: 9, color: C.textMid }, { text: formatDate(bill.bdate), bold: true, fontSize: 9 }] },
              ...(bill.order_no      ? [{ columns: [{ text: 'PO No:',       width: 80, fontSize: 9, color: C.textMid }, { text: bill.order_no,      bold: true, fontSize: 9 }] }] : []),
              ...(bill.vehicle_no    ? [{ columns: [{ text: 'Vehicle No:',  width: 80, fontSize: 9, color: C.textMid }, { text: bill.vehicle_no,    bold: true, fontSize: 9 }] }] : []),
            ],
          },
        ],
      },

      { text: '\n' },

      // Items table
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            // Header row
            [
              { text: '#',             style: 'tableHeader' },
              { text: 'Description',   style: 'tableHeader' },
              { text: 'HSN/SAC',       style: 'tableHeader' },
              { text: 'Qty',           style: 'tableHeader', alignment: 'right' },
              { text: 'UOM',           style: 'tableHeader' },
              { text: 'Rate',          style: 'tableHeader', alignment: 'right' },
              { text: 'Disc%',         style: 'tableHeader', alignment: 'right' },
              { text: 'GST%',          style: 'tableHeader', alignment: 'right' },
              { text: 'Amount',        style: 'tableHeader', alignment: 'right' },
            ],
            ...itemRows,
            ...chargeRows,
          ],
        },
        layout: tableLayout,
      },

      { text: '\n' },

      // Totals
      {
        alignment: 'right',
        stack: [
          { columns: [{ text: 'Taxable Value:', width: 120 }, { text: formatCurrency(taxableValue), width: 100, alignment: 'right' }] },
          ...(bill.cgst > 0 ? [{ columns: [{ text: 'CGST:',  width: 120 }, { text: formatCurrency(bill.cgst), width: 100, alignment: 'right' }] }] : []),
          ...(bill.sgst > 0 ? [{ columns: [{ text: 'SGST:',  width: 120 }, { text: formatCurrency(bill.sgst), width: 100, alignment: 'right' }] }] : []),
          ...(bill.igst > 0 ? [{ columns: [{ text: 'IGST:',  width: 120 }, { text: formatCurrency(bill.igst), width: 100, alignment: 'right' }] }] : []),
          ...(Math.abs(roundOff) > 0 ? [{ columns: [{ text: 'Round Off:', width: 120 }, { text: formatCurrency(roundOff), width: 100, alignment: 'right' }] }] : []),
          { canvas: [{ type: 'line', x1: -220, y1: 2, x2: 0, y2: 2, lineWidth: 1 }] },
          { columns: [{ text: 'Grand Total:', width: 120, bold: true, fontSize: 12 }, { text: formatCurrency(grandTotal), width: 100, alignment: 'right', bold: true, fontSize: 12 }] },
        ],
      },

      { text: '\n\n' },

      // Signature
      {
        columns: [
          { text: "Receiver's Signature", width: '50%', fontSize: 9 },
          { text: `For ${firmRecord.name || ''}`, width: '50%', alignment: 'right', fontSize: 9 },
        ],
      },
      { text: '\n\n\n' },
      {
        columns: [
          { text: '', width: '50%' },
          { text: 'Authorised Signatory', width: '50%', alignment: 'right', fontSize: 9 },
        ],
      },
      { text: 'This is a computer generated invoice', alignment: 'center', fontSize: 7, color: C.textLight, italics: true },
    ],

    styles: {
      firmName:     { fontSize: 16, bold: true,  margin: [0, 0, 0, 2] },
      firmAddress:  { fontSize: 9,  color: C.textMid, margin: [0, 0, 0, 1] },
      firmGstin:    { fontSize: 9,  bold: true,  margin: [0, 0, 0, 4] },
      invoiceTitle: { fontSize: 13, bold: true,  alignment: 'center', color: C.primary, margin: [0, 4, 0, 4] },
      sectionLabel: { fontSize: 8,  bold: true,  color: C.primary, margin: [0, 0, 0, 2] },
      tableHeader:  { fontSize: 8,  bold: true,  color: C.primary, fillColor: '#EEF2F7' },
      tableCell:    { fontSize: 8.5 },
    },

    defaultStyle: { font: 'DejaVuSans' },
    pageSize:     'A4',
    pageMargins:  [30, 30, 30, 30],
  }

  const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename   = `Invoice_${safeBillNo}.pdf`

  // pdfmake creates the document and pipes to a buffer
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition)
      const chunks: Buffer[] = []
      pdfDoc.on('data',  (chunk: Buffer) => chunks.push(chunk))
      pdfDoc.on('end',   () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    } catch (err) {
      reject(err)
    }
  })

  return { buffer, filename }
}

/* ══════════════════════════════════════════════════════════════════════════
   exportBillsListToPdf
   Bills-list report PDF — used by bills/export/pdf.get.ts
══════════════════════════════════════════════════════════════════════════ */

export async function exportBillsListToPdfBuffer(opts: {
  firmId:     string
  type?:      string
  searchTerm?: string
  dateFrom?:  string
  dateTo?:    string
}): Promise<{ buffer: Buffer; filename: string }> {
  const { firmId, type, searchTerm, dateFrom, dateTo } = opts

  const query: Record<string, any> = { firm_id: firmId }
  if (type) query.btype = type
  if (searchTerm) {
    const re = new RegExp(searchTerm, 'i')
    query.$or = [{ bno: re }, { supply: re }]
  }
  if (dateFrom || dateTo) {
    query.bdate = {}
    if (dateFrom) query.bdate.$gte = new Date(dateFrom)
    if (dateTo)   { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); query.bdate.$lte = t }
  }

  const bills = await Bill.find(query).sort({ bdate: -1, bno: -1 }).lean() as any[]
  if (!bills.length) throw createError({ statusCode: 404, message: 'No bills found for the selected criteria' })

  const firm = await Firm.findById(firmId).select('name address gst_number').lean() as any

  const C = { primary: '#1B3A6B', border: '#A0B4CC', borderDark: '#1B3A6B' }

  const docDefinition: any = {
    content: [
      { text: 'Bills Report',                                        style: 'header' },
      { text: `Firm: ${firm?.name || ''}`,                          style: 'subheader' },
      { text: `Date Range: ${dateFrom ? formatDate(dateFrom) : 'N/A'} to ${dateTo ? formatDate(dateTo) : 'N/A'}`, style: 'subheader' },
      { text: `Generated on: ${formatDate(new Date().toISOString())}`, style: 'subheader', margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 80],
          body: [
            ['Bill No', 'Date', 'Party', 'Type', 'Status', { text: 'Amount', alignment: 'right' }],
            ...bills.map((bill: any) => {
              const cancelled = (bill.status || 'ACTIVE') === 'CANCELLED'
              return [
                bill.bno,
                formatDate(bill.bdate),
                bill.supply,
                bill.btype,
                bill.status,
                { text: cancelled ? formatCurrency(0) : formatCurrency(bill.ntot), alignment: 'right' },
              ]
            }),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
          hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
          vLineColor: () => C.border,
          paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 2, paddingBottom: () => 2,
        },
      },
    ],
    styles: {
      header:    { fontSize: 18, bold: true,  margin: [0, 0, 0, 10] },
      subheader: { fontSize: 10, margin: [0, 0, 0, 2] },
    },
    defaultStyle: { font: 'DejaVuSans' },
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition)
      const chunks: Buffer[] = []
      pdfDoc.on('data',  (chunk: Buffer) => chunks.push(chunk))
      pdfDoc.on('end',   () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    } catch (err) { reject(err) }
  })

  return { buffer, filename: 'bills_report.pdf' }
}