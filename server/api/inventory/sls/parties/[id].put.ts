/**
 * server/api/inventory/sls/parties/[id].put.ts
 * PUT /api/inventory/sls/parties/:id
 *
 * Updates an existing party for the authenticated firm.
 * Supports both single-GST and multi-GST update modes —
 * identical logic to parties.post.ts but applied to an existing document.
 *
 * Body: same shape as POST /parties
 *   firm, gstin, contact, state, state_code, addr, pin, pan,
 *   gstLocations[], primary_gstin_index
 *
 * Auth: event.context.user
 */

import { Party } from '../../../../models/index'
import {
  getFirmId,
  getActorUsername,
  validateObjectId,
  normalizeOptionalText,
} from '../../../../utils/billUtils'
import { getStateCode } from '../../../../utils/gstCalculator'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)
  const partyId       = validateObjectId(getRouterParam(event, 'id'), 'party ID')

  const existingParty = await Party.findOne({ _id: partyId, firm_id: firmId }).lean() as any
  if (!existingParty) {
    throw createError({ statusCode: 404, message: 'Party not found or does not belong to your firm' })
  }

  const body = await readBody(event)
  const {
    firm, gstin, contact, state, state_code, addr, pin, pan,
    gstLocations, primary_gstin_index,
  } = body

  const isMultiGst = Array.isArray(gstLocations) && gstLocations.length > 0

  // ── Derived fields (mirrors parties.post.ts logic exactly) ────────────
  let finalGstin             = gstin   || 'UNREGISTERED'
  let finalContact           = contact || null
  let finalState             = state   || ''
  let finalStateCode         = state_code || null
  let finalAddr              = addr    || null
  let finalPin               = pin     || null
  let finalLocations: any[]  = []
  let finalPrimaryIdx        = 0

  if (isMultiGst) {
    // ── Multi-GST: validate and normalise each location ──────────────
    finalLocations = gstLocations.map((loc: any) => {
      const locGstin    = normalizeOptionalText(loc.gstin, 15)
      const locState    = normalizeOptionalText(loc.state, 80)

      const locStateCode = locGstin && locGstin !== 'UNREGISTERED' && /^\d{2}/.test(locGstin)
        ? locGstin.substring(0, 2)
        : (loc.state_code || (locState ? String(getStateCode(locState) ?? '').padStart(2, '0') || null : null))

      return {
        gstin:      locGstin     || 'UNREGISTERED',
        state_code: locStateCode || null,
        state:      locState     || null,
        address:    normalizeOptionalText(loc.address, 500) || null,
        city:       normalizeOptionalText(loc.city,    100) || null,
        pincode:    normalizeOptionalText(loc.pincode,  10) || null,
        contact:    normalizeOptionalText(loc.contact,  20) || null,
        is_primary: loc.is_primary === true,
      }
    })

    // Resolve primary index — prefer explicit primary_gstin_index, then is_primary flag, then 0
    if (
      typeof primary_gstin_index === 'number' &&
      primary_gstin_index >= 0 &&
      primary_gstin_index < finalLocations.length
    ) {
      finalPrimaryIdx = primary_gstin_index
    } else {
      const markedIdx = finalLocations.findIndex((l: any) => l.is_primary)
      finalPrimaryIdx = markedIdx !== -1 ? markedIdx : 0
    }

    // Enforce exactly one primary
    finalLocations.forEach((loc: any, idx: number) => {
      loc.is_primary = idx === finalPrimaryIdx
    })

    // Sync legacy top-level fields from primary location
    const primaryLoc = finalLocations[finalPrimaryIdx]
    if (primaryLoc) {
      finalGstin     = primaryLoc.gstin
      finalState     = primaryLoc.state     || ''
      finalStateCode = primaryLoc.state_code
      finalAddr      = primaryLoc.address
      finalPin       = primaryLoc.pincode
      finalContact   = primaryLoc.contact
    }

  } else {
    // ── Single-GST: derive state_code from GSTIN or state name ──────────
    if (finalGstin && finalGstin !== 'UNREGISTERED' && /^\d{2}/.test(finalGstin)) {
      finalStateCode = finalGstin.substring(0, 2)
    } else if (finalState) {
      const code = getStateCode(finalState)
      finalStateCode = code ? String(code).padStart(2, '0') : null
    }
  }

  await Party.findOneAndUpdate(
    { _id: partyId, firm_id: firmId },
    {
      $set: {
        firm:                firm?.trim() || existingParty.firm,
        gstin:               finalGstin,
        contact:             finalContact,
        state:               finalState,
        state_code:          finalStateCode,
        addr:                finalAddr,
        pin:                 finalPin,
        pan:                 pan ?? existingParty.pan ?? null,
        gstLocations:        finalLocations,
        primary_gstin_index: finalPrimaryIdx,
        supply:              finalState,
      },
    },
  )

  return {
    success: true,
    message: isMultiGst
      ? 'Party with multiple GST registrations updated successfully'
      : 'Party updated successfully',
  }
})