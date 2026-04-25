/**
 * server/api/inventory/sls/current-firm.get.ts
 * GET /api/inventory/sls/current-firm
 *
 * Returns the authenticated user's firm details, including all GST
 * locations. Used by the invoice page to:
 *   - Display the firm name in the header
 *   - Populate the "Billing from GSTIN" selector for multi-location firms
 *   - Determine intra/inter-state for auto bill-type detection
 *
 * Auth: event.context.user
 */

import { Firm }      from '../../../models/index'
import { getFirmId } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)

  const firm = await Firm.findById(firmId)
    .select(
      'name legal_name gst_number address city state pincode ' +
      'phone_number email logo_url locations ' +
      'bank_account_number bank_name bank_branch ifsc_code',
    )
    .lean() as any

  if (!firm) {
    throw createError({ statusCode: 404, message: 'Firm not found' })
  }

  // ── Normalise locations array ─────────────────────────────────────────
  // Ensure each location has a state_code derived from its GSTIN prefix
  // for cases where it wasn't stored during firm creation.
  const locations = (firm.locations || []).map((loc: any) => ({
    gst_number:        loc.gst_number  || '',
    state_code:        loc.state_code
      || (loc.gst_number && /^\d{2}/.test(loc.gst_number)
        ? loc.gst_number.substring(0, 2)
        : null),
    state:             loc.state             || '',
    registration_type: loc.registration_type || 'PPOB',
    address:           loc.address           || firm.address || '',
    city:              loc.city              || firm.city    || '',
    pincode:           loc.pincode           || firm.pincode || '',
    is_default:        loc.is_default        === true,
  }))

  // If no locations stored, synthesise one from the top-level firm fields
  // (backward-compatible with firms created before locations[] was added)
  if (locations.length === 0 && firm.gst_number) {
    locations.push({
      gst_number:        firm.gst_number,
      state_code:        /^\d{2}/.test(firm.gst_number)
        ? firm.gst_number.substring(0, 2)
        : null,
      state:             firm.state   || '',
      registration_type: 'PPOB',
      address:           firm.address || '',
      city:              firm.city    || '',
      pincode:           firm.pincode || '',
      is_default:        true,
    })
  }

  return {
    success: true,
    data: {
      id:          firm._id.toString(),
      name:        firm.name        || '',
      legal_name:  firm.legal_name  || firm.name || '',
      gst_number:  firm.gst_number  || '',
      address:     firm.address     || '',
      city:        firm.city        || '',
      state:       firm.state       || '',
      pincode:     firm.pincode     || '',
      phone:       firm.phone_number || '',
      email:       firm.email        || '',
      logo_url:    firm.logo_url     || null,
      locations,
      bank: {
        account_number: firm.bank_account_number || '',
        bank_name:      firm.bank_name           || '',
        branch:         firm.bank_branch         || '',
        ifsc_code:      firm.ifsc_code           || '',
      },
    },
  }
})