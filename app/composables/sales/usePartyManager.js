/**
 * usePartyManager.js
 * GST lookup and party-field population composable.
 * Location: app/composables/sales/usePartyManager.js
 *
 * Replaces: partyManager.js
 *
 * POST /api/inventory/sales/gst-lookup  → uses useApiWithAuth (mutating request)
 * All other helpers are pure functions — no state dependency.
 *
 * Usage in a component:
 *   const { fetchingGst, fetchPartyByGST, populatePartyFromRapidAPI } = usePartyManager()
 */

import { ref } from 'vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

export function usePartyManager() {
  const { post } = useApiWithAuth()

  // Tracks in-flight GST lookup so the fetch button can show a spinner
  const fetchingGst = ref(false)

  // ─── Address helpers ──────────────────────────────────────────────────────

  /**
   * Builds a single-line address string from the GST API's
   * place_of_business_principal.address object.
   *
   * @param {object} partyData  Raw response from the GST lookup API
   * @returns {string}
   */
  function formatPowerfulGSTINAddress(partyData) {
    if (!partyData?.place_of_business_principal) return ''
    const addr = partyData.place_of_business_principal.address
    if (!addr) return ''
    return [
      addr.door_num,
      addr.building_name,
      addr.floor_num,
      addr.street,
      addr.location,
      addr.city,
      addr.district,
    ]
      .filter((p) => p && String(p).trim())
      .join(', ')
  }

  /**
   * Extracts the 6-digit PIN code from the GST API response.
   * Returns empty string if the value is absent or not exactly 6 digits.
   *
   * @param {object} partyData
   * @returns {string}
   */
  function extractPowerfulGSTINPinCode(partyData) {
    if (!partyData?.place_of_business_principal) return ''
    const addr = partyData.place_of_business_principal.address
    if (!addr?.pin_code) return ''
    const pinStr = addr.pin_code.toString().trim()
    return /^\d{6}$/.test(pinStr) ? pinStr : ''
  }

  // ─── Form population ──────────────────────────────────────────────────────

  /**
   * Maps a GST API response onto a plain object that matches the create-party
   * form's v-model fields.
   *
   * Returns null and emits a toast-worthy error string if the API response
   * contains no usable company name.
   *
   * @param {object} partyData  Raw response from the GST lookup API
   * @param {string} gstin      The GSTIN that was looked up
   * @returns {{ firm, addr, state, pin, stateCode, pan } | null}
   */
  function extractPartyFieldsFromGSTData(partyData, gstin) {
    const displayName = partyData.trade_name || partyData.legal_name || ''
    if (!displayName) return null

    const address   = formatPowerfulGSTINAddress(partyData) || ''
    const pinCode   = extractPowerfulGSTINPinCode(partyData) || ''
    let   stateName = partyData.place_of_business_principal?.address?.state
                   || partyData.state_jurisdiction
                   || ''
    stateName = String(stateName).trim()
    if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim()

    const stateCode  = gstin?.length >= 2  ? gstin.substring(0, 2)  : ''
    const pan        = gstin?.length >= 12 ? gstin.substring(2, 12) : ''

    return {
      firm:      displayName,
      addr:      address,
      state:     stateName,
      pin:       pinCode,
      stateCode,
      pan,
    }
  }

  /**
   * Populates a party location object (used for additional GST locations
   * in the create-party form) from a GST API response.
   *
   * @param {object} gstData   Raw GST API response
   * @param {string} gstin     The GSTIN that was looked up
   * @returns {{ state, address, pin }}
   */
  function extractLocationFieldsFromGSTData(gstData, gstin) {
    const data = gstData.data || gstData

    let stateName = data.place_of_business_principal?.address?.state
                 || data.state_jurisdiction
                 || ''

    const address = [
      data.place_of_business_principal?.address?.door_num,
      data.place_of_business_principal?.address?.building_name,
      data.place_of_business_principal?.address?.floor_num,
      data.place_of_business_principal?.address?.street,
      data.place_of_business_principal?.address?.location,
      data.place_of_business_principal?.address?.city,
      data.place_of_business_principal?.address?.district,
    ].filter((p) => p && String(p).trim()).join(', ') || ''

    const rawPin = data.place_of_business_principal?.address?.pin_code || ''
    const pin    = /^\d{6}$/.test(String(rawPin).trim()) ? rawPin : ''

    return { state: stateName, address, pin }
  }

  // ─── GST fetch ────────────────────────────────────────────────────────────

  /**
   * Hits the GST lookup API and returns the raw response data on success,
   * or throws an Error with a user-facing message on failure.
   *
   * The caller (PartyCreateModal.vue or the form's fetch button handler)
   * is responsible for showing toasts and mapping the result into form fields
   * via extractPartyFieldsFromGSTData() or extractLocationFieldsFromGSTData().
   *
   * Uses useApiWithAuth().post() because the backend endpoint is
   * a POST (it calls an external paid API and must be CSRF-protected).
   *
   * @param {string} gstin  15-character GSTIN string
   * @returns {Promise<object>}  The raw `data` object from the API response
   * @throws {Error}
   */
  async function fetchGSTDetails(gstin) {
    if (!gstin || gstin.trim().length !== 15) {
      throw new Error('Please enter a valid 15-character GSTIN')
    }

    fetchingGst.value = true
    try {
      const result = await post('/api/inventory/sls/gst-lookup', { gstin: gstin.trim() })

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch GST details')
      }

      return result.data || result
    } finally {
      fetchingGst.value = false
    }
  }

  // ─── Party balance ────────────────────────────────────────────────────────

  /**
   * Fetches the outstanding balance for a party.
   * Returns a normalised balance object, or a zeroed default on error.
   *
   * GET request — uses $fetch directly (no CSRF needed).
   *
   * @param {string} partyId
   * @returns {Promise<{ balance: number, balanceType: string,
   *                     balanceFormatted: string }>}
   */
  async function fetchPartyBalance(partyId) {
    const empty = { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' }
    if (!partyId) return empty

    try {
      const data = await $fetch(`/api/inventory/sls/party-balance/${partyId}`, {
        method: 'GET', credentials: 'include',
      })

      if (!data.success) return empty

      const bal         = data.data?.balance    || 0
      const balanceType = data.data?.balance_type
                       || (bal >= 0 ? 'Debit' : 'Credit')
      const outstanding = data.data?.outstanding ?? Math.abs(bal)

      return {
        balance: bal,
        balanceType,
        balanceFormatted: new Intl.NumberFormat('en-IN', {
          style: 'currency', currency: 'INR',
        }).format(outstanding),
      }
    } catch (err) {
      console.warn('Failed to fetch party balance:', err.message ?? err)
      return empty
    }
  }

  return {
    // Reactive
    fetchingGst,
    // Helpers — useful directly in PartyCreateModal & PartyCard
    formatPowerfulGSTINAddress,
    extractPowerfulGSTINPinCode,
    extractPartyFieldsFromGSTData,
    extractLocationFieldsFromGSTData,
    // API calls
    fetchGSTDetails,
    fetchPartyBalance,
  }
}