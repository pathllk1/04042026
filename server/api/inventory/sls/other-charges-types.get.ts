/**
 * server/api/inventory/sls/other-charges-types.get.ts
 * GET /api/inventory/sls/other-charges-types
 *
 * Returns distinct other-charge names previously used by this firm,
 * along with their most-recently-used HSN/SAC code and GST rate.
 * Powers the autocomplete dropdown in OtherChargesModal.vue.
 *
 * Deduplicates by charge name — the most recent usage wins for
 * HSN and GST rate, since those are most likely to be correct.
 *
 * Auth: event.context.user
 */

import { Bill }             from '../../../models/index'
import { getFirmId }        from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)

  // ── Aggregate distinct charge types from bill other_charges arrays ─────
  // Using MongoDB aggregation to unwind the embedded other_charges array
  // and deduplicate by name, keeping the most recent occurrence.

  const pipeline = [
    // 1. Match only this firm's active bills that have other_charges
    {
      $match: {
        firm_id:       { $exists: true, $eq: { $toObjectId: firmId } },
        other_charges: { $exists: true, $not: { $size: 0 } },
        status:        { $ne: 'CANCELLED' },
      },
    },
    // 2. Sort by creation date descending so unwind yields most-recent first
    { $sort: { createdAt: -1 } },
    // 3. Unwind the other_charges array
    { $unwind: '$other_charges' },
    // 4. Group by charge name, keep first (= most recent) HSN and GST rate
    {
      $group: {
        _id:     { $toLower: { $trim: { input: '$other_charges.name' } } },
        name:    { $first: '$other_charges.name' },
        type:    { $first: '$other_charges.type' },
        hsnSac:  { $first: '$other_charges.hsnSac' },
        gstRate: { $first: '$other_charges.gstRate' },
      },
    },
    // 5. Sort result alphabetically for the dropdown
    { $sort: { name: 1 } },
    // 6. Cap at 100 suggestions
    { $limit: 100 },
  ]

  let charges: any[] = []
  try {
    charges = await Bill.aggregate(pipeline as any[])
  } catch (aggErr) {
    // Aggregation can fail on older MongoDB versions with $toObjectId in $match.
    // Fall back to a simpler in-memory approach.
    const bills = await Bill.find({
      firm_id:       firmId,
      status:        { $ne: 'CANCELLED' },
      other_charges: { $exists: true },
    })
      .select('other_charges createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean() as any[]

    const seen  = new Map<string, any>()
    for (const bill of bills) {
      for (const ch of (bill.other_charges || [])) {
        const key = (ch.name || '').trim().toLowerCase()
        if (key && !seen.has(key)) {
          seen.set(key, {
            name:    ch.name    || '',
            type:    ch.type    || 'Other',
            hsnSac:  ch.hsnSac  || '',
            gstRate: ch.gstRate ?? 0,
          })
        }
      }
    }
    charges = Array.from(seen.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || ''),
    )
  }

  // ── Normalise + filter empty names ────────────────────────────────────
  const result = charges
    .filter((c: any) => c.name && String(c.name).trim())
    .map((c: any) => ({
      name:    String(c.name    || '').trim(),
      type:    String(c.type    || 'Other').trim(),
      hsnSac:  String(c.hsnSac  || '').trim(),
      gstRate: parseFloat(c.gstRate) || 0,
    }))

  return { success: true, data: result }
})