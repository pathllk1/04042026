/**
 * server/api/inventory/sls/parties.post.ts
 * POST /api/inventory/sls/parties
 *
 * Creates a new party (customer / supplier) for the authenticated firm.
 *
 * Supports two modes:
 *   Single-GST  — legacy mode, gstLocations[] is empty
 *   Multi-GST   — gstLocations[] contains one entry per GSTIN registration
 *
 * In multi-GST mode, the top-level legacy fields (gstin, state, state_code,
 * addr, pin, contact) are synced from the primary location automatically.
 *
 * Body:
 *   firm          string   Party name (unique per firm) — REQUIRED
 *   gstin         string   GSTIN or 'UNREGISTERED'
 *   contact       string
 *   state         string
 *   state_code    string
 *   addr          string
 *   pin           string
 *   pan           string
 *   gstLocations  array    [{ gstin, state, address, city, pincode, contact, is_primary }]
 *
 * Auth: event.context.user
 */

import { Party } from '../../../models/index'
import {
  getFirmId,
  getActorUsername,
  normalizeOptionalText,
} from '../../../utils/billUtils'
import { getStateCode } from '../../../utils/gstCalculator'

export default defineEventHandler(async (event) => {
  const actorUsername = getActorUsername(event)
  const firmId        = getFirmId(event)

  const body = await readBody(event)
  const { firm, gstin, contact, state, state_code, addr, pin, pan, gstLocations } = body

  if (!firm?.trim()) {
    throw createError({ statusCode: 400, message: 'Firm name is required' })
  }

  const isMultiGst = Array.isArray(gstLocations) && gstLocations.length > 0

  // ── Derived fields ────────────────────────────────────────────────────
  let finalGstin      = gstin   || 'UNREGISTERED'
  let finalContact    = contact || null
  let finalState      = state   || ''
  let finalStateCode  = state_code || null
  let finalAddr       = addr    || null
  let finalPin        = pin     || null
  let finalLocations: any[]  = []
  let primaryGstinIndex      = 0

  if (isMultiGst) {
    // ── Multi-GST: validate and normalise each location ──────────────
    finalLocations = gstLocations.map((loc: any) => {
      const locGstin    = normalizeOptionalText(loc.gstin, 15)
      const locState    = normalizeOptionalText(loc.state, 80)

      // Derive state_code: GSTIN prefix beats explicit value beats name lookup
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

    // Ensure exactly one primary; default to first if none marked
    const primaryIdx = finalLocations.findIndex((l: any) => l.is_primary)
    if (primaryIdx !== -1) {
      primaryGstinIndex = primaryIdx
    } else if (finalLocations.length > 0) {
      finalLocations[0].is_primary = true
      primaryGstinIndex = 0
    }

    // Sync legacy top-level fields from the primary location
    const primaryLoc = finalLocations[primaryGstinIndex]
    if (primaryLoc) {
      finalGstin     = primaryLoc.gstin
      finalState     = primaryLoc.state     || ''
      finalStateCode = primaryLoc.state_code
      finalAddr      = primaryLoc.address
      finalPin       = primaryLoc.pincode
      finalContact   = primaryLoc.contact
    }

  } else {
    // ── Single-GST: derive state_code from GSTIN prefix or state name ──
    if (finalGstin && finalGstin !== 'UNREGISTERED' && /^\d{2}/.test(finalGstin)) {
      finalStateCode = finalGstin.substring(0, 2)
    } else if (finalState) {
      const code = getStateCode(finalState)
      finalStateCode = code ? String(code).padStart(2, '0') : null
    }
  }

  const newParty = await Party.create({
    firm_id:              firmId,
    firm:                 firm.trim(),
    gstin:                finalGstin,
    contact:              finalContact,
    state:                finalState,
    state_code:           finalStateCode,
    addr:                 finalAddr,
    pin:                  finalPin,
    pan:                  pan || null,
    gstLocations:         finalLocations,
    primary_gstin_index:  primaryGstinIndex,
    usern:                actorUsername,
    supply:               finalState,
  }) as any

  return {
    success:              true,
    id:                   newParty._id,
    firm:                 newParty.firm,
    gstin:                newParty.gstin,
    contact:              newParty.contact,
    state:                newParty.state,
    state_code:           newParty.state_code,
    addr:                 newParty.addr,
    pin:                  newParty.pin,
    pan:                  newParty.pan,
    gstLocations:         newParty.gstLocations,
    primary_gstin_index:  newParty.primary_gstin_index,
    message: isMultiGst
      ? 'Party with multiple GST registrations created successfully'
      : 'Party created successfully',
  }
})