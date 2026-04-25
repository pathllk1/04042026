/**
 * server/utils/billUtils.ts
 *
 * Shared utilities for all inventory controllers (sales + purchase).
 * Ported from billUtils.js — adapted for Nuxt H3 event handlers:
 *
 *   • getFirmId / getActorUsername / validateObjectId
 *     throw createError() instead of calling res.status(N).json()
 *     Callers no longer need the `if (!firmId) return` null-guard pattern.
 *
 *   • Auth field mapping
 *     Express authMiddleware  → req.user.firm_id   (snake_case)
 *     Nuxt auth.ts middleware → event.context.user.firmId  (camelCase, from JWT)
 *     Both are checked so legacy sessions still work during transition.
 */

import mongoose from 'mongoose'
import type { H3Event } from 'h3'
import {
  BillSequence,
  VoucherSequence,
  Settings,
  FirmSettings,
  Bill,
} from '../models/index'

/* ── Actor ────────────────────────────────────────────────────────────────── */

/**
 * Returns the authenticated user's username.
 * Throws 401 if the request is unauthenticated.
 */
export function getActorUsername(event: H3Event): string {
  const user = event.context.user
  const username = user?.username
  if (!username) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return String(username)
}

/* ── Firm ID ─────────────────────────────────────────────────────────────── */

/**
 * Extracts and validates the firm_id from the authenticated user context.
 *
 * Nuxt auth.ts stores the full DB user object in event.context.user.
 * The JWT payload uses `firmId` (camelCase); the raw DB field may be
 * either `firmId` or `firm_id` depending on the User model version.
 * Both are checked for backward compatibility.
 *
 * Throws 400 if the ID is absent or not a valid ObjectId.
 */
export function getFirmId(event: H3Event): string {
  const user = event.context.user
  const raw  = user?.firmId ?? user?.firm_id
  if (!raw || !mongoose.Types.ObjectId.isValid(String(raw))) {
    throw createError({
      statusCode: 400,
      message:    'Invalid or missing firm ID',
    })
  }
  return String(raw)
}

/* ── ObjectId validation ─────────────────────────────────────────────────── */

/**
 * Validates an arbitrary string as a MongoDB ObjectId.
 * Throws 400 with a descriptive message if invalid.
 */
export function validateObjectId(value: unknown, fieldName: string): string {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
    throw createError({
      statusCode: 400,
      message:    `Invalid ${fieldName}`,
    })
  }
  return String(value)
}

/* ── Text normalizers ─────────────────────────────────────────────────────── */

export function normalizeOptionalText(
  value: unknown,
  maxLen = 120,
): string | null {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim().replace(/\s+/g, ' ')
  if (!normalized) return null
  return normalized.slice(0, maxLen)
}

export function normalizeOptionalMultilineText(
  value: unknown,
  maxLen = 2000,
): string | null {
  if (value === undefined || value === null) return null
  const normalized = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
  if (!normalized) return null
  return normalized.slice(0, maxLen)
}

export function getLocalDateString(date = new Date()): string {
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day   = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ── Service-item helpers ─────────────────────────────────────────────────── */

export function isServiceItem(item: Record<string, unknown>): boolean {
  return String(
    item?.itemType ?? item?.item_type ?? 'GOODS',
  ).toUpperCase() === 'SERVICE'
}

export function getEffectiveItemQty(item: Record<string, unknown>): number {
  const qty = parseFloat(String(item?.qty))
  if (Number.isFinite(qty) && qty > 0) return qty
  return 0
}

/* ── Financial year ───────────────────────────────────────────────────────── */

export function getCurrentFinancialYear(): string {
  const d     = new Date()
  const month = d.getMonth() + 1
  const year  = d.getFullYear()
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`
}

/* ── WAC (Weighted Average Cost) ──────────────────────────────────────────── */

function roundInventoryRate(value: number, precision = 6): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(precision))
}

/**
 * Compute blended WAC after ADDING stock (purchase).
 */
export function computeWAC(
  existingTotal: number,
  existingQty:   number,
  purchasedQty:  number,
  lineValue:     number,
): { blendedRate: number; newTotal: number; newQty: number } {
  const safeExistingTotal = existingTotal ?? 0
  const newQty            = existingQty + purchasedQty
  const newTotal          = safeExistingTotal + lineValue
  const blendedRate       = newQty > 0
    ? newTotal / newQty
    : purchasedQty > 0
      ? lineValue / purchasedQty
      : 0
  return { blendedRate: roundInventoryRate(blendedRate), newTotal, newQty }
}

/**
 * Reverse WAC when REMOVING stock (purchase cancel / purchase return).
 */
export function reverseWAC(
  existingTotal: number,
  existingQty:   number,
  removedQty:    number,
  costValue:     number,
): { newRate: number; newTotal: number; newQty: number } {
  const newQty   = Math.max(0, existingQty - removedQty)
  const newTotal = Math.max(0, (existingTotal ?? 0) - costValue)
  const newRate  = newQty > 0
    ? newTotal / newQty
    : existingQty > 0
      ? (existingTotal ?? 0) / existingQty
      : 0
  return { newRate: roundInventoryRate(newRate), newTotal, newQty }
}

/* ── Bill / voucher number generation ─────────────────────────────────────── */

export const BILL_PREFIX: Record<string, string> = {
  SALES:          'INV',
  PURCHASE:       'PUR',
  CREDIT_NOTE:    'CN',
  DEBIT_NOTE:     'DN',
  DELIVERY_NOTE:  'DLN',
  JOURNAL:        'JV',
  PAYMENT:        'PV',
  RECEIPT:        'RV',
}

export async function getNextBillNumber(
  firmId: string,
  type = 'SALES',
): Promise<string> {
  const fy     = getCurrentFinancialYear()
  const key    = type.toUpperCase()
  const prefix = BILL_PREFIX[key] ?? key.slice(0, 3)
  const seq    = await BillSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: fy, voucher_type: key },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
  return `${prefix}/${fy}/${String((seq as any).last_sequence).padStart(4, '0')}`
}

export async function previewNextBillNumber(
  firmId: string,
  type = 'SALES',
): Promise<string> {
  const fy     = getCurrentFinancialYear()
  const key    = type.toUpperCase()
  const prefix = BILL_PREFIX[key] ?? key.slice(0, 3)
  const seq    = await BillSequence.findOne({
    firm_id: firmId, financial_year: fy, voucher_type: key,
  }).lean()
  const nextNum = ((seq as any)?.last_sequence ?? 0) + 1
  return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`
}

/**
 * Returns the next integer voucher group ID.
 * Stored as Number in Ledger.voucher_id, cast to String in Bill.voucher_id.
 */
export async function getNextVoucherNumber(firmId: string): Promise<number> {
  const fy  = getCurrentFinancialYear()
  const seq = await VoucherSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: fy },
    { $inc: { last_sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
  return (seq as any).last_sequence as number
}

/* ── GST setting ──────────────────────────────────────────────────────────── */

export async function isGstEnabled(firmId: string): Promise<boolean> {
  try {
    const firmSetting = await FirmSettings.findOne({
      firm_id:     firmId,
      setting_key: 'gst_enabled',
    }).lean()
    if (firmSetting) return (firmSetting as any).setting_value === 'true'

    const globalSetting = await Settings.findOne({
      setting_key: 'gst_enabled',
    }).lean()
    return globalSetting
      ? (globalSetting as any).setting_value === 'true'
      : true
  } catch {
    return true
  }
}

/* ── Duplicate supplier-bill check (purchase only) ────────────────────────── */

export async function ensureUniqueSupplierBillNo(opts: {
  firmId:         string
  partyId:        string
  supplierBillNo: string | null | undefined
  excludeBillId?: string | null
}): Promise<void> {
  const { firmId, partyId, supplierBillNo, excludeBillId = null } = opts
  if (!supplierBillNo) return

  const query: Record<string, unknown> = {
    firm_id:          firmId,
    party_id:         partyId,
    btype:            'PURCHASE',
    status:           { $ne: 'CANCELLED' },
    supplier_bill_no: {
      $regex:   `^${escapeRegex(supplierBillNo)}$`,
      $options: 'i',
    },
  }
  if (excludeBillId) query._id = { $ne: excludeBillId }

  const duplicate = await Bill.findOne(query)
    .select('_id bno supplier_bill_no bdate')
    .lean()

  if (duplicate) {
    throw createError({
      statusCode: 409,
      message:    `Supplier bill number "${supplierBillNo}" already exists for this supplier under purchase ${(duplicate as any).bno}`,
    })
  }
}

/* ── Bill totals calculation ──────────────────────────────────────────────── */

export interface BillTotals {
  gtot:               number
  totalTax:           number
  otherChargesTotal:  number
  otherChargesGstTotal: number
  cgst:               number
  sgst:               number
  igst:               number
  ntot:               number
  rof:                number
}

/**
 * Calculate bill totals (GST, round-off, etc.)
 *
 * @param cart          Array of cart line items
 * @param otherCharges  Array of extra charges (freight, packing, etc.)
 * @param gstEnabled    Whether GST is active for this firm
 * @param billType      'intra-state' | 'inter-state'
 * @param reverseCharge Whether reverse charge applies
 * @param qtyFn         How to extract qty per item (defaults to item.qty).
 *                      Sales: pass getEffectiveItemQty (handles service items).
 */
export function calcBillTotals(
  cart:          Record<string, unknown>[],
  otherCharges:  Record<string, unknown>[] | null | undefined,
  gstEnabled:    boolean,
  billType:      string,
  reverseCharge: boolean,
  qtyFn:         ((item: Record<string, unknown>) => number) | null = null,
): BillTotals {
  const getQty = qtyFn ?? ((item) => parseFloat(String(item.qty)))

  let gtot = 0, totalTax = 0

  for (const item of cart) {
    const lineVal =
      getQty(item) *
      (item.rate as number) *
      (1 - ((item.disc as number) || 0) / 100)
    if (gstEnabled) totalTax += lineVal * ((item.grate as number) / 100)
    gtot += lineVal
  }

  let otherChargesTotal = 0, otherChargesGstTotal = 0

  if (otherCharges?.length) {
    for (const charge of otherCharges) {
      const amt = parseFloat(String(charge.amount)) || 0
      otherChargesTotal += amt
      if (gstEnabled) {
        otherChargesGstTotal +=
          (amt * (parseFloat(String(charge.gstRate)) || 0)) / 100
      }
    }
  }
  gtot += otherChargesTotal

  let cgst = 0, sgst = 0, igst = 0

  if (gstEnabled && billType === 'intra-state') {
    cgst = totalTax / 2 + otherChargesGstTotal / 2
    sgst = totalTax / 2 + otherChargesGstTotal / 2
  } else if (gstEnabled) {
    igst = totalTax + otherChargesGstTotal
  }

  let ntot = gtot + (reverseCharge ? 0 : totalTax + otherChargesGstTotal)
  const roundedNtot = Math.round(ntot)
  const rof  = roundedNtot - ntot
  ntot = roundedNtot

  return {
    gtot,
    totalTax,
    otherChargesTotal,
    otherChargesGstTotal,
    cgst: reverseCharge && gstEnabled ? 0 : cgst,
    sgst: reverseCharge && gstEnabled ? 0 : sgst,
    igst: reverseCharge && gstEnabled ? 0 : igst,
    ntot,
    rof,
  }
}