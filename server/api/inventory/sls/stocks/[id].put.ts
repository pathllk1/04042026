/**
 * server/api/inventory/sls/stocks/[id].put.ts
 * PUT /api/inventory/sls/stocks/:id
 *
 * Updates an existing stock item.
 * If a batches array is provided it replaces the current batch list.
 * If only a batch name is provided the matching batch is updated in-place,
 * or a new batch is appended if none matches.
 *
 * Body (all fields optional — only supplied fields are updated):
 *   item         string
 *   pno          string
 *   oem          string
 *   hsn          string
 *   batch        string   — which batch to update when batches[] not supplied
 *   qty          number
 *   uom          string
 *   rate         number
 *   grate        number
 *   mrp          number
 *   expiryDate   string
 *   batches      string | array   — full replacement batch list (JSON or array)
 *
 * Auth: event.context.user
 */

import { Stock } from '../../../../models/index'
import { getFirmId, getActorUsername, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)
  const stockId       = validateObjectId(getRouterParam(event, 'id'), 'stock ID')

  const currentStock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean() as any
  if (!currentStock) {
    throw createError({ statusCode: 404, message: 'Stock not found or does not belong to your firm' })
  }

  const body = await readBody(event)
  let {
    item, pno, oem, hsn, uom, grate,
    batch, qty, rate, mrp, expiryDate,
    batches: incomingBatches,
  } = body

  // ── Resolve batches array ──────────────────────────────────────────────
  let batches: any[] = Array.isArray(currentStock.batches)
    ? [...currentStock.batches]
    : []

  if (incomingBatches) {
    // Full replacement: parse and use the supplied array
    try {
      const parsed = Array.isArray(incomingBatches)
        ? incomingBatches
        : JSON.parse(incomingBatches)
      if (Array.isArray(parsed)) batches = parsed
    } catch { /* ignore bad JSON — fall through to batch-name logic */ }

    // Promote first batch fields to root-level variables for the $set below
    const b0 = batches[0] ?? {}
    if (!batch      && b0.batch  !== undefined) batch      = b0.batch
    if (!qty        && b0.qty    !== undefined) qty        = b0.qty
    if (!rate       && b0.rate   !== undefined) rate       = b0.rate
    if (!mrp        && b0.mrp    !== undefined) mrp        = b0.mrp
    if (!expiryDate && b0.expiry !== undefined) expiryDate = b0.expiry
    if (!uom        && b0.uom    !== undefined) uom        = b0.uom
    if (!grate      && b0.grate  !== undefined) grate      = b0.grate

  } else if (batch) {
    // Patch a single named batch in-place
    const batchIdx = batches.findIndex((b: any) => b.batch === batch)

    if (batchIdx !== -1) {
      if (qty        != null) batches[batchIdx].qty    = parseFloat(qty)
      if (rate       != null) batches[batchIdx].rate   = parseFloat(rate)
      if (uom        != null) batches[batchIdx].uom    = uom
      if (grate      != null) batches[batchIdx].grate  = parseFloat(grate)
      if (expiryDate != null) batches[batchIdx].expiry = expiryDate
      if (mrp        != null) batches[batchIdx].mrp    = parseFloat(mrp)
    } else {
      // Append new batch
      batches.push({
        batch,
        qty:    parseFloat(qty),
        rate:   parseFloat(rate),
        uom:    uom   || 'PCS',
        grate:  parseFloat(grate) || 18,
        expiry: expiryDate || null,
        mrp:    mrp ? parseFloat(mrp) : null,
      })
    }
  }

  // ── Aggregate totals from the final batches array ──────────────────────
  const newTotalQty = batches.reduce((s: number, b: any) => s + (parseFloat(b.qty) || 0), 0)

  // Root-level rate: prefer the first batch rate; fall back to supplied rate or existing
  let rootRate = parseFloat(rate ?? currentStock.rate ?? 0)
  let rootMrp  = mrp != null ? parseFloat(mrp) : currentStock.mrp

  if (batches.length > 0) {
    if (batches[0].rate != null) rootRate = parseFloat(batches[0].rate)
    if (batches[0].mrp  != null) rootMrp  = parseFloat(batches[0].mrp)
  }

  await Stock.findOneAndUpdate(
    { _id: stockId, firm_id: firmId },
    {
      $set: {
        item:   item   ?? currentStock.item,
        pno:    pno    != null ? (pno  || null) : currentStock.pno,
        oem:    oem    != null ? (oem  || null) : currentStock.oem,
        hsn:    hsn    ?? currentStock.hsn,
        qty:    newTotalQty,
        uom:    uom    ?? currentStock.uom,
        rate:   rootRate,
        grate:  grate  != null ? parseFloat(grate) : currentStock.grate,
        total:  newTotalQty * rootRate,
        mrp:    rootMrp,
        batches,
        user:   actorUsername,
      },
    },
  )

  return { success: true, message: 'Stock updated successfully' }
})