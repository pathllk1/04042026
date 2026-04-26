/**
 * useSalesState.js
 * Reactive state + data-fetching composable for the Sales Invoice system.
 * Location: app/composables/sales/useSalesState.js
 *
 * Replaces: stateManager.js
 *
 * Rules applied:
 *  - GET requests  → $fetch (Nuxt built-in, cookie auth automatic)
 *  - Mutating requests → useApiWithAuth (POST / PUT / PATCH / DELETE)
 *  - State is a single reactive() object so that child components can receive
 *    it as a prop and mutations stay in-place (same reference).
 */

import { reactive } from 'vue'
import { populateConsigneeFromBillTo } from '~/utils/salesUtils'

// ─── India GST State Code Table ───────────────────────────────────────────────
// Keys are lower-cased state name variants; value is the 2-digit code (GSTIN[0:2]).
// Used as a fallback when resolving a state_code from a plain state name string,
// particularly for unregistered parties where no GSTIN is present.

export const INDIA_STATE_CODES = {
  'jammu and kashmir':           '01', 'j&k':                       '01', 'jk':             '01',
  'himachal pradesh':            '02', 'hp':                        '02',
  'punjab':                      '03',
  'chandigarh':                  '04',
  'uttarakhand':                 '05', 'uttaranchal':               '05',
  'haryana':                     '06',
  'delhi':                       '07', 'new delhi':                 '07',
  'rajasthan':                   '08',
  'uttar pradesh':               '09', 'up':                        '09',
  'bihar':                       '10',
  'sikkim':                      '11',
  'arunachal pradesh':           '12',
  'nagaland':                    '13',
  'manipur':                     '14',
  'mizoram':                     '15',
  'tripura':                     '16',
  'meghalaya':                   '17',
  'assam':                       '18',
  'west bengal':                 '19', 'wb':                        '19',
  'jharkhand':                   '20',
  'odisha':                      '21', 'orissa':                    '21',
  'chhattisgarh':                '22',
  'madhya pradesh':              '23', 'mp':                        '23',
  'gujarat':                     '24',
  'daman and diu':               '25', 'daman & diu':               '25',
  'dadra and nagar haveli':      '26', 'dadra & nagar haveli':      '26',
  'maharashtra':                 '27',
  'andhra pradesh':              '28', 'ap':                        '28',
  'karnataka':                   '29',
  'goa':                         '30',
  'lakshadweep':                 '31',
  'kerala':                      '32',
  'tamil nadu':                  '33', 'tn':                        '33',
  'puducherry':                  '34', 'pondicherry':               '34',
  'andaman and nicobar islands': '35', 'andaman & nicobar islands': '35',
  'telangana':                   '36', 'ts':                        '36',
  'andhra pradesh (new)':        '37',
  'ladakh':                      '38',
  'other territory':             '97',
}

// ─── GST bill-type determination ─────────────────────────────────────────────

/**
 * Determines the correct GST bill type by comparing the firm's active GSTIN
 * state code against the party's state code.
 *
 * GST law rule (Section 8, IGST Act):
 *   Supplier state === Recipient state  →  CGST + SGST  (intra-state)
 *   Supplier state !== Recipient state  →  IGST         (inter-state)
 *
 * @returns {'intra-state'|'inter-state'|null}  null = cannot determine
 */
export function determineGstBillType(activeFirmLocation, selectedParty, selectedPartyLocation) {
  const firmCode = activeFirmLocation?.state_code
    || activeFirmLocation?.gst_number?.substring(0, 2)

  // Priority order for party state code:
  //  1. selected location state_code (multi-GSTIN parties)
  //  2. explicit state_code on party document
  //  3. first 2 digits of selected location GSTIN
  //  4. first 2 digits of primary party GSTIN
  //  5. state name → code lookup (unregistered parties)
  const partyCode = selectedPartyLocation?.state_code
    || selectedParty?.state_code
    || (selectedPartyLocation?.gstin && selectedPartyLocation.gstin !== 'UNREGISTERED'
      ? selectedPartyLocation.gstin.substring(0, 2)
      : null)
    || (selectedParty?.gstin && selectedParty.gstin !== 'UNREGISTERED'
      ? selectedParty.gstin.substring(0, 2)
      : null)
    || (selectedPartyLocation?.state
      ? INDIA_STATE_CODES[selectedPartyLocation.state.trim().toLowerCase()] ?? null
      : null)
    || (selectedParty?.state
      ? INDIA_STATE_CODES[selectedParty.state.trim().toLowerCase()] ?? null
      : null)

  if (!firmCode || !partyCode) return null
  return firmCode === partyCode ? 'intra-state' : 'inter-state'
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useSalesState() {

  // ── Initial reactive state ────────────────────────────────────────────────
  const state = reactive({
    stocks:  [],
    parties: [],

    // Cart items
    cart: [],

    // Party selection
    selectedParty:         null,
    selectedPartyGstin:    null,
    selectedPartyLocation: null, // full location object for selected GSTIN

    // Consignee
    selectedConsignee:     null,
    consigneeSameAsBillTo: true,

    // Party-item history cache  { 'partyId:stockId': [...rows] }
    historyCache: {},

    // Invoice metadata
    meta: {
      billNo:          '',
      billDate:        new Date().toISOString().split('T')[0],
      billType:        'intra-state',
      reverseCharge:   false,
      referenceNo:     '',
      vehicleNo:       '',
      dispatchThrough: '',
      narration:       '',
    },

    otherCharges:    [],
    currentFirmName: 'Your Company Name',
    gstEnabled:      true,

    // Firm GST locations — populated from /api/inventory/sales/current-firm
    // firmLocations[]      all locations from Firm.locations
    // activeFirmLocation   whichever GSTIN the user has selected for this bill
    firmLocations:      [],
    activeFirmLocation: null,

    // Edit / Return mode flags — set by the page before calling fetchData()
    isReturnMode:     false,
    returnFromBillId: null,
    currentBill:      null, // full bill document loaded in edit/return mode
  })

  // ── Fetch helpers (all GET — cookie auth is automatic via $fetch) ─────────

  async function fetchCurrentUserFirmName() {
    try {
      const data = await $fetch('/api/inventory/sls/current-firm', {
        method:      'GET',
        credentials: 'include',
      })

      if (data.success && data.data?.name) {
        state.currentFirmName = data.data.name

        if (Array.isArray(data.data.locations)) {
          state.firmLocations     = data.data.locations
          state.activeFirmLocation =
            data.data.locations.find((l) => l.is_default)
            || data.data.locations[0]
            || null
        }
      }
    } catch (err) {
      console.warn('Could not fetch firm name:', err.message ?? err)
      state.currentFirmName = 'Your Company Name'
    }
  }

  async function fetchNextBillNumber() {
    try {
      const data = await $fetch('/api/inventory/sls/next-bill-number', {
        method:      'GET',
        credentials: 'include',
      })
      state.meta.billNo = data.success && data.nextBillNumber
        ? data.nextBillNumber
        : 'Will be generated on save'
    } catch (err) {
      console.warn('Could not fetch bill number:', err.message ?? err)
      state.meta.billNo = 'Will be generated on save'
    }
  }

  /**
   * Loads all reference data needed to render the invoice page:
   * stocks, parties, bill-number preview, GST on/off flag, firm locations.
   */
  async function fetchData() {
    // ── Stocks ──────────────────────────────────────────────────────────────
    try {
      const stockData = await $fetch('/api/inventory/sls/stocks', {
        method: 'GET', credentials: 'include',
      })
      state.stocks = stockData.success && Array.isArray(stockData.data)
        ? stockData.data : []
    } catch (err) {
      console.warn('Failed to fetch stocks:', err.message ?? err)
      state.stocks = []
    }

    // ── Parties ─────────────────────────────────────────────────────────────
    try {
      const partyData = await $fetch('/api/inventory/sls/parties', {
        method: 'GET', credentials: 'include',
      })
      state.parties = partyData.success && Array.isArray(partyData.data)
        ? partyData.data : []
    } catch (err) {
      console.warn('Could not fetch parties:', err.message ?? err)
      state.parties = []
    }

    // ── Bill-number preview (non-incrementing) ───────────────────────────────
    if (!state.meta.billNo || state.meta.billNo === 'Will be generated on save') {
      state.meta.billNo = 'Will be generated on save'
      try {
        const previewData = await $fetch('/api/inventory/sls/next-bill-number', {
          method: 'GET', credentials: 'include',
        })
        if (previewData.success && previewData.nextBillNumber) {
          state.meta.billNo = previewData.nextBillNumber
        }
      } catch (err) {
        console.warn('Could not fetch bill-number preview:', err.message ?? err)
      }
    }

    // ── GST enabled flag ─────────────────────────────────────────────────────
    let gstFetched = false
    
    try {
      // First try to fetch from database API
      const gstData = await $fetch('/api/settings/gst-config', {
        method: 'GET', credentials: 'include',
      })
      if (gstData.success && gstData.data?.gst_enabled !== undefined) {
        state.gstEnabled = gstData.data.gst_enabled
        gstFetched = true
        console.info('GST setting loaded from database:', state.gstEnabled)
        return
      }
    } catch (err) {
      console.warn('Could not fetch GST from database:', err.message ?? err)
    }

    // Fallback to localStorage
    if (!gstFetched) {
      try {
        const savedSettings = localStorage.getItem('app_settings')
        if (savedSettings) {
          const appSettings = JSON.parse(savedSettings)
          if (appSettings.gstEnabled !== undefined) {
            state.gstEnabled = appSettings.gstEnabled
            gstFetched = true
            console.info('GST setting loaded from localStorage:', state.gstEnabled)
            return
          }
        }
      } catch (e) {
        console.warn('Could not parse app settings:', e)
      }
    }

    // If still not fetched, log that we're using the default
    if (!gstFetched) {
      console.info('Using default GST setting: enabled')
    }

    // ── Firm locations (safety net — primary path is fetchCurrentUserFirmName) ─
    if (state.firmLocations.length === 0) {
      try {
        const firmData = await $fetch('/api/inventory/sls/current-firm', {
          method: 'GET', credentials: 'include',
        })
        if (firmData.success && Array.isArray(firmData.data?.locations)) {
          state.firmLocations = firmData.data.locations
          if (!state.activeFirmLocation) {
            state.activeFirmLocation =
              firmData.data.locations.find((l) => l.is_default)
              || firmData.data.locations[0]
              || null
          }
        }
      } catch (err) {
        console.warn('Could not fetch firm locations:', err.message ?? err)
      }
    }
  }

  /**
   * Loads a saved bill into state for edit or return (credit-note) mode.
   * Throws on network / API errors — the calling page should catch and
   * render an error UI.
   */
  async function loadExistingBillData(billId) {
    // $fetch throws on non-2xx — let it bubble up to the caller
    const billData = await $fetch(`/api/inventory/sls/bills/${billId}`, {
      method: 'GET', credentials: 'include',
    })

    if (!billData.success) {
      throw new Error(billData.error || 'Failed to load bill data')
    }

    const bill       = billData.data
    state.currentBill = bill

    state.meta = {
      billNo:          bill.bno,
      billDate:        bill.bdate,
      billType:        bill.bill_subtype
        ? bill.bill_subtype.toLowerCase()
        : ((bill.cgst || bill.sgst) ? 'intra-state' : 'inter-state'),
      reverseCharge:   Boolean(bill.reverse_charge),
      referenceNo:     bill.order_no         || '',
      vehicleNo:       bill.vehicle_no       || '',
      dispatchThrough: bill.dispatch_through || '',
      narration:       bill.narration        || '',
    }

    if (bill.party_id) {
      state.selectedParty = {
        id:         bill.party_id,
        firm:       bill.supply     || '',
        gstin:      bill.gstin      || '',
        state:      bill.state      || '',
        addr:       bill.addr       || '',
        pin:        bill.pin        || null,
        state_code: bill.state_code || null,
      }
      state.selectedPartyGstin    = bill.gstin
      state.selectedPartyLocation = {
        gstin:      bill.gstin,
        state:      bill.state,
        state_code: bill.state_code,
        address:    bill.addr,
        pincode:    bill.pin,
        contact:    bill.contact || '',
        is_primary: true,
      }
    }

    // Restore the active firm location that was active when the bill was saved
    if (bill.firm_gstin && state.firmLocations.length > 0) {
      const match = state.firmLocations.find((l) => l.gst_number === bill.firm_gstin)
      if (match) state.activeFirmLocation = match
    }

    if (bill.consignee_name || bill.consignee_address) {
      state.selectedConsignee = {
        name:                 bill.consignee_name    || '',
        address:              bill.consignee_address || '',
        gstin:                bill.consignee_gstin   || '',
        state:                bill.consignee_state   || '',
        pin:                  bill.consignee_pin     || '',
        contact:              '',
        deliveryInstructions: '',
      }
      state.consigneeSameAsBillTo = false
    } else {
      state.consigneeSameAsBillTo = true
    }

    state.cart = (bill.items || []).map((item) => {
      const itemType  = item.item_type || (item.stock_id ? 'GOODS' : 'SERVICE')
      const parsedQty = parseFloat(item.qty)
      return {
        stockId:   item.stock_id,
        itemType,
        item:      item.item,
        narration: item.item_narration || '',
        batch:     item.batch          || null,
        oem:       item.oem            || '',
        hsn:       item.hsn,
        qty:       Number.isFinite(parsedQty) && parsedQty > 0
          ? parsedQty
          : (itemType === 'SERVICE' ? 1 : 0),
        showQty:   item.show_qty !== false,
        uom:       item.uom || (item.stock_id ? 'PCS' : ''),
        rate:      parseFloat(item.rate)  || 0,
        grate:     parseFloat(item.grate) || 0,
        disc:      parseFloat(item.disc)  || 0,
      }
    })

    state.otherCharges = (bill.otherCharges || []).map((charge) => ({
      name:    charge.name   || charge.type || 'Other Charge',
      type:    charge.type   || 'other',
      hsnSac:  charge.hsnSac || '',
      amount:  parseFloat(charge.amount)  || 0,
      gstRate: parseFloat(charge.gstRate) || 0,
    }))

    state.historyCache = {}
  }

  // ── Consignee sync ────────────────────────────────────────────────────────

  /** Re-populates selectedConsignee from the active party / location. */
  function syncConsigneeFromBillTo() {
    populateConsigneeFromBillTo(state)
  }

  // ── Hard reset ────────────────────────────────────────────────────────────

  function resetState() {
    state.cart                  = []
    state.selectedParty         = null
    state.selectedConsignee     = null
    state.consigneeSameAsBillTo = true
    state.selectedPartyGstin    = null
    state.selectedPartyLocation = null
    state.otherCharges          = []
    state.meta = {
      billNo:          '',
      billDate:        new Date().toISOString().split('T')[0],
      billType:        'intra-state',
      reverseCharge:   false,
      referenceNo:     '',
      vehicleNo:       '',
      dispatchThrough: '',
      narration:       '',
    }
  }

  // ── Listen for global settings changes ────────────────────────────────────
  if (process.client) {
    window.addEventListener('storage', (event) => {
      if (event.key === 'app_settings') {
        try {
          const newSettings = JSON.parse(event.newValue)
          if (newSettings?.gstEnabled !== undefined) {
            state.gstEnabled = newSettings.gstEnabled
          }
        } catch (e) {
          console.warn('Could not parse updated app settings:', e)
        }
      }
    })
  }

  return {
    state,
    fetchCurrentUserFirmName,
    fetchNextBillNumber,
    fetchData,
    loadExistingBillData,
    syncConsigneeFromBillTo,
    resetState,
    // Re-exported so page components only need one import
    determineGstBillType,
    INDIA_STATE_CODES,
  }
}