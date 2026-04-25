/**
 * server/utils/gstCalculator.ts
 *
 * Pure GST calculation utilities — no DB dependency.
 * Ported from utils/mongo/gstCalculator.js with full TypeScript types.
 *
 * Note: state codes are stored as numbers in STATE_CODES but GSTIN[0:2]
 * is a zero-padded 2-digit string (e.g. '27' not 27). getStateCode()
 * returns a number; callers that compare with GSTIN substrings must
 * use parseInt() on the GSTIN slice — or use getStateCodeStr() below.
 */

/* ── State code map ───────────────────────────────────────────────────────── */

export const STATE_CODES: Record<string, number> = {
  'JAMMU AND KASHMIR':         1,
  'HIMACHAL PRADESH':          2,
  'PUNJAB':                    3,
  'CHANDIGARH':                4,
  'UTTARAKHAND':               5,
  'HARYANA':                   6,
  'DELHI':                     7,
  'RAJASTHAN':                 8,
  'UTTAR PRADESH':             9,
  'BIHAR':                     10,
  'SIKKIM':                    11,
  'ARUNACHAL PRADESH':         12,
  'NAGALAND':                  13,
  'MANIPUR':                   14,
  'MIZORAM':                   15,
  'TRIPURA':                   16,
  'MEGHALAYA':                 17,
  'ASSAM':                     18,
  'WEST BENGAL':               19,
  'JHARKHAND':                 20,
  'ODISHA':                    21,
  'CHHATTISGARH':              22,
  'MADHYA PRADESH':            23,
  'GUJARAT':                   24,
  'DAMAN AND DIU':             25,
  'DADRA AND NAGAR HAVELI':    26,
  'MAHARASHTRA':               27,
  'ANDHRA PRADESH':            28,
  'KARNATAKA':                 29,
  'GOA':                       30,
  'LAKSHADWEEP':               31,
  'KERALA':                    32,
  'TAMIL NADU':                33,
  'PUDUCHERRY':                34,
  'ANDAMAN AND NICOBAR ISLANDS': 35,
  'TELANGANA':                 36,
  'LADAKH':                    37,
  // Aliases used in practice
  'JAMMU & KASHMIR':           1,
  'J&K':                       1,
  'PONDICHERRY':                34,
  'ANDAMAN & NICOBAR ISLANDS': 35,
  'UTTARANCHAL':               5,
}

/* ── Lookups ──────────────────────────────────────────────────────────────── */

/**
 * Get numeric state code from state name.
 * Returns null if not found.
 */
export function getStateCode(stateName: string | null | undefined): number | null {
  if (!stateName) return null
  return STATE_CODES[stateName.toUpperCase().trim()] ?? null
}

/**
 * Get zero-padded 2-digit state code string from state name.
 * Returns null if not found.
 * Use this when comparing against GSTIN[0:2].
 */
export function getStateCodeStr(stateName: string | null | undefined): string | null {
  const code = getStateCode(stateName)
  return code !== null ? String(code).padStart(2, '0') : null
}

/**
 * Get state name from numeric state code.
 */
export function getStateName(stateCode: number): string | null {
  const entry = Object.entries(STATE_CODES).find(([, c]) => c === stateCode)
  return entry ? entry[0] : null
}

/* ── Intra/inter state check ──────────────────────────────────────────────── */

/**
 * Returns true when seller and buyer are in the same state (CGST + SGST applies).
 * Both arguments accept either a number or a string (GSTIN prefix or raw code).
 */
export function isIntraState(
  sellerStateCode: number | string,
  buyerStateCode:  number | string,
): boolean {
  return parseInt(String(sellerStateCode)) === parseInt(String(buyerStateCode))
}

/* ── GSTIN helpers ────────────────────────────────────────────────────────── */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/**
 * Validates GSTIN format.
 * Treats 'UNREGISTERED' as valid (pass-through for unregistered dealers).
 */
export function validateGSTIN(gstin: string | null | undefined): boolean {
  if (!gstin || gstin === 'UNREGISTERED') return true
  return GSTIN_REGEX.test(gstin)
}

/**
 * Extracts numeric state code from a GSTIN.
 * Returns null for UNREGISTERED or malformed GSTINs.
 */
export function getStateCodeFromGSTIN(
  gstin: string | null | undefined,
): number | null {
  if (!gstin || gstin === 'UNREGISTERED') return null
  if (!validateGSTIN(gstin)) return null
  return parseInt(gstin.substring(0, 2))
}

/* ── Line item GST calculation ────────────────────────────────────────────── */

export interface ItemGSTResult {
  baseAmount:          number
  discount:            number
  amountAfterDiscount: number
  cgst:                number
  sgst:                number
  igst:                number
  gstAmount:           number
  total:               number
}

/**
 * Calculate GST for a single cart line item.
 */
export function calculateItemGST(params: {
  rate:        number
  qty:         number
  gstRate:     number
  isIntraState: boolean
  discount?:   number
}): ItemGSTResult {
  const { rate, qty, gstRate, isIntraState: intra, discount = 0 } = params
  const baseAmount          = rate * qty
  const amountAfterDiscount = baseAmount - discount
  const gstAmount           = (amountAfterDiscount * gstRate) / 100

  let cgst = 0, sgst = 0, igst = 0
  if (intra) {
    cgst = gstAmount / 2
    sgst = gstAmount / 2
  } else {
    igst = gstAmount
  }

  return {
    baseAmount:          parseFloat(baseAmount.toFixed(2)),
    discount:            parseFloat(discount.toFixed(2)),
    amountAfterDiscount: parseFloat(amountAfterDiscount.toFixed(2)),
    cgst:                parseFloat(cgst.toFixed(2)),
    sgst:                parseFloat(sgst.toFixed(2)),
    igst:                parseFloat(igst.toFixed(2)),
    gstAmount:           parseFloat(gstAmount.toFixed(2)),
    total:               parseFloat((amountAfterDiscount + gstAmount).toFixed(2)),
  }
}

/* ── Bill aggregate totals ────────────────────────────────────────────────── */

export interface BillTotalResult {
  subtotal:           number
  totalDiscount:      number
  otherChargesAmount: number
  grossTotal:         number
  cgst:               number
  sgst:               number
  igst:               number
  totalGST:           number
  grandTotal:         number
  roundOff:           number
  netTotal:           number
}

/**
 * Aggregate totals from pre-calculated line items.
 * Used when line items have already been through calculateItemGST().
 */
export function calculateBillTotals(
  items: ItemGSTResult[],
  additionalDiscount = 0,
  otherCharges: { amount?: number; gstRate?: number; isIntraState?: boolean }[] = [],
): BillTotalResult {
  let subtotal = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0
  let totalDiscount = additionalDiscount

  for (const item of items) {
    subtotal      += item.amountAfterDiscount ?? 0
    totalCGST     += item.cgst     ?? 0
    totalSGST     += item.sgst     ?? 0
    totalIGST     += item.igst     ?? 0
    totalDiscount += item.discount ?? 0
  }

  let otherChargesAmount = 0

  for (const charge of otherCharges) {
    const amt = charge.amount ?? 0
    otherChargesAmount += amt
    if (charge.gstRate) {
      const chargeGST = (amt * charge.gstRate) / 100
      if (charge.isIntraState) {
        totalCGST += chargeGST / 2
        totalSGST += chargeGST / 2
      } else {
        totalIGST += chargeGST
      }
    }
  }

  const grossTotal = subtotal + otherChargesAmount
  const totalGST   = totalCGST + totalSGST + totalIGST
  const grandTotal = grossTotal + totalGST - additionalDiscount
  const roundOff   = Math.round(grandTotal) - grandTotal

  return {
    subtotal:           parseFloat(subtotal.toFixed(2)),
    totalDiscount:      parseFloat(totalDiscount.toFixed(2)),
    otherChargesAmount: parseFloat(otherChargesAmount.toFixed(2)),
    grossTotal:         parseFloat(grossTotal.toFixed(2)),
    cgst:               parseFloat(totalCGST.toFixed(2)),
    sgst:               parseFloat(totalSGST.toFixed(2)),
    igst:               parseFloat(totalIGST.toFixed(2)),
    totalGST:           parseFloat(totalGST.toFixed(2)),
    grandTotal:         parseFloat(grandTotal.toFixed(2)),
    roundOff:           parseFloat(roundOff.toFixed(2)),
    netTotal:           Math.round(grandTotal),
  }
}