/**
 * server/api/inventory/sls/stocks.post.ts
 * POST /api/inventory/sls/stocks
 *
 * Creates a new stock item, or merges a batch into an existing item
 * of the same name within the same firm.
 *
 * Body (all fields optional except item, hsn, qty, rate):
 *   item        string   Item description (unique per firm)
 *   pno         string   Part number
 *   batch       string   Batch identifier
 *   oem         string   OEM / brand
 *   hsn         string   HSN/SAC code
 *   qty         number   Opening quantity
 *   uom         string   Unit of measure (default: NOS)
 *   rate        number   Selling rate
 *   grate       number   GST rate % (default: 18)
 *   mrp         number   Maximum retail price
 *   expiryDate  string   Batch expiry date (ISO string)
 *   batches     string | array   Pre-built batches array (JSON string or array)
 *
 * Auth: event.context.user
 */

import { Stock } from '../../../models/index'
import { getFirmId, getActorUsername } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)

  const body = await readBody(event)

  let {
    item, pno, oem, hsn, uom, grate,
    batch, qty, rate, mrp, expiryDate, batches: incomingBatches,
  } = body

  // ── Parse batches if provided as JSON string ───────────────────────────
  let parsedBatches: any[] | null = null
  if (incomingBatches) {
    try {
      parsedBatches = Array.isArray(incomingBatches)
        ? incomingBatches
        : JSON.parse(incomingBatches)
      if (!Array.isArray(parsedBatches)) parsedBatches = null
    } catch { /* ignore — use individual fields */ }
  }

  // Promote first batch fields to root if batches array supplied but individual fields absent
  if (parsedBatches?.length && !batch && !qty && !rate && !mrp && !expiryDate) {
    const b0   = parsedBatches[0] ?? {}
    batch      = b0.batch      ?? batch
    qty        = b0.qty        ?? qty
    rate       = b0.rate       ?? rate
    mrp        = b0.mrp        ?? mrp
    expiryDate = b0.expiry     ?? expiryDate
  }

  // ── Check for existing stock with same item name ───────────────────────
  const existingStock = await Stock.findOne({ firm_id: firmId, item }).lean() as any

  if (existingStock) {
    // ── MERGE: update existing stock + add/update batch ─────────────────
    let existingBatches: any[] = Array.isArray(existingStock.batches)
      ? [...existingStock.batches]
      : []

    // If parsedBatches supplied, promote first batch fields again for merge
    if (parsedBatches?.length) {
      const b0   = parsedBatches[0] ?? {}
      batch      = b0.batch  ?? batch
      qty        = b0.qty    ?? qty
      rate       = b0.rate   ?? rate
      mrp        = b0.mrp    ?? mrp
      expiryDate = b0.expiry ?? expiryDate
    }

    const existingBatchIdx = existingBatches.findIndex((b: any) => b.batch === batch)

    if (existingBatchIdx !== -1) {
      // Batch already exists — increment qty, update optional fields
      existingBatches[existingBatchIdx].qty += parseFloat(qty)
      if (mrp        != null && mrp        !== '') existingBatches[existingBatchIdx].mrp    = parseFloat(mrp)
      if (expiryDate)                              existingBatches[existingBatchIdx].expiry = expiryDate
      if (rate       != null && rate       !== '') existingBatches[existingBatchIdx].rate   = parseFloat(rate)
      if (uom        != null && uom        !== '') existingBatches[existingBatchIdx].uom    = uom
      if (grate      != null && grate      !== '') existingBatches[existingBatchIdx].grate  = parseFloat(grate)
    } else {
      // New batch for existing stock — push
      existingBatches.push({
        batch:  batch  || null,
        qty:    parseFloat(qty),
        rate:   parseFloat(rate),
        uom:    uom    || 'PCS',
        grate:  parseFloat(grate) || 18,
        expiry: expiryDate || null,
        mrp:    mrp ? parseFloat(mrp) : null,
      })
    }

    const newTotalQty = existingBatches.reduce((s: number, b: any) => s + (parseFloat(b.qty) || 0), 0)
    const newTotal    = newTotalQty * parseFloat(rate)

    await Stock.findOneAndUpdate(
      { _id: existingStock._id, firm_id: firmId },
      {
        $set: {
          item,
          pno:     pno  || null,
          oem:     oem  || null,
          hsn,
          qty:     newTotalQty,
          uom:     uom  || 'PCS',
          rate:    parseFloat(rate),
          grate:   parseFloat(grate) || 18,
          total:   newTotal,
          mrp:     mrp ? parseFloat(mrp) : null,
          batches: existingBatches,
          user:    actorUsername,
        },
      },
    )

    return {
      success: true,
      id:      existingStock._id,
      message: 'Stock batch updated successfully',
    }
  }

  // ── CREATE: new stock item ─────────────────────────────────────────────
  const batchesToStore = parsedBatches?.length
    ? parsedBatches
    : [{
        batch:  batch  || null,
        qty:    parseFloat(qty),
        rate:   parseFloat(rate),
        expiry: expiryDate || null,
        mrp:    mrp ? parseFloat(mrp) : null,
      }]

  const total    = parseFloat(qty) * parseFloat(rate)
  const newStock = await Stock.create({
    firm_id: firmId,
    item,
    pno:     pno   || null,
    oem:     oem   || null,
    hsn,
    qty:     parseFloat(qty)   || 0,
    uom:     uom   || 'PCS',
    rate:    parseFloat(rate)  || 0,
    grate:   parseFloat(grate) || 0,
    total,
    mrp:     mrp ? parseFloat(mrp) : null,
    batches: batchesToStore,
    user:    actorUsername,
  })

  return {
    success: true,
    id:      (newStock as any)._id,
    message: 'Stock added successfully',
  }
})