/**
 * server/utils/inventoryLedgerHelper.ts
 *
 * Perpetual-inventory double-entry ledger posting helpers.
 * Ported from inventoryLedgerHelper.js with full TypeScript types.
 *
 * Accounting model: PERPETUAL INVENTORY
 *   Purchase    → Inventory A/c DR (ASSET)        Supplier CR (CREDITOR)
 *   Sale        → Party DR (DEBTOR)               Sales A/c CR (INCOME)
 *                 COGS DR (EXPENSE)               Inventory CR (ASSET)   ← per goods line
 *   Credit Note → Party CR, Sales DR (reverse)    Inventory DR, COGS CR  ← goods return
 *   Debit Note  → Party DR, Inventory CR          GST Input CR           ← purchase return
 *
 * Every postXxx function asserts ΣDR = ΣCR before inserting — an imbalanced
 * voucher throws rather than silently corrupting the ledger.
 */

import type { ClientSession } from 'mongoose'
import { Ledger } from '../models/index'
import {
  resolveLedgerPostingAccount,
  normalizeLedgerAccountHead,
} from './ledgerAccountResolver'

/* ── Internal types ───────────────────────────────────────────────────────── */

interface LedgerDoc {
  firm_id:          string
  voucher_id:       number
  voucher_type:     string
  voucher_no:       string
  bill_id:          unknown
  ref_type:         string
  ref_id:           unknown
  transaction_date: string
  created_by:       string
  account_head:     string
  account_type:     string
  debit_amount:     number
  credit_amount:    number
  narration:        string
  party_id:         unknown
  stock_id:         unknown
  stock_reg_id:     unknown
}

export interface CogsLine {
  stockId:    unknown
  stockRegId: unknown
  item:       string
  cogsValue:  number
}

export interface PurchasedItem {
  stockId:    unknown
  stockRegId: unknown
  item:       string
  lineValue:  number
}

/* ── Balance assertion ────────────────────────────────────────────────────── */

function assertBalancedVoucher(
  docs:        LedgerDoc[],
  voucherType: string,
  billNo:      string,
): void {
  const totals = docs.reduce(
    (acc, doc) => {
      acc.debit  += parseFloat(String(doc.debit_amount))  || 0
      acc.credit += parseFloat(String(doc.credit_amount)) || 0
      return acc
    },
    { debit: 0, credit: 0 },
  )

  const diff = Number((totals.debit - totals.credit).toFixed(6))
  if (Math.abs(diff) >= 0.01) {
    throw new Error(
      `Unbalanced ${voucherType} ledger for ${billNo}: ` +
      `debit ${totals.debit.toFixed(2)} vs credit ${totals.credit.toFixed(2)} ` +
      `(diff ${diff.toFixed(2)})`,
    )
  }
}

/* ── Shared base builder ──────────────────────────────────────────────────── */

function makeBase(opts: {
  firmId:          string
  voucherId:       number
  voucherType:     string
  billNo:          string
  billId:          unknown
  billDate:        string
  actorUsername:   string
}): Omit<LedgerDoc, 'account_head' | 'account_type' | 'debit_amount' | 'credit_amount' | 'narration' | 'party_id' | 'stock_id' | 'stock_reg_id'> {
  return {
    firm_id:          opts.firmId,
    voucher_id:       opts.voucherId,
    voucher_type:     opts.voucherType,
    voucher_no:       opts.billNo,
    bill_id:          opts.billId,
    ref_type:         'BILL',
    ref_id:           opts.billId,
    transaction_date: opts.billDate,
    created_by:       opts.actorUsername,
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   PURCHASE
════════════════════════════════════════════════════════════════════════════ */

export async function postPurchaseLedger(opts: {
  firmId:         string
  billId:         unknown
  voucherId:      number
  billNo:         string
  billDate:       string
  party:          { _id?: unknown; id?: unknown; firm: string }
  ntot:           number
  cgst:           number
  sgst:           number
  igst:           number
  rof:            number
  otherCharges:   Record<string, unknown>[] | null | undefined
  purchasedItems: PurchasedItem[]
  actorUsername:  string
  session?:       ClientSession | null
}): Promise<void> {
  const {
    firmId, billId, voucherId, billNo, billDate,
    party, ntot, cgst, sgst, igst, rof,
    otherCharges, purchasedItems, actorUsername, session = null,
  } = opts

  const base    = makeBase({ firmId, voucherId, voucherType: 'PURCHASE', billNo, billId, billDate, actorUsername })
  const docs: LedgerDoc[] = []
  const partyId = party._id ?? party.id ?? null

  // 1. Supplier CR (creditor — total payable)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'CREDITOR', partyId: String(partyId), session,
  })
  docs.push({
    ...base,
    account_head:  partyLedger.accountHead,
    account_type:  partyLedger.accountType,
    debit_amount:  0,
    credit_amount: ntot,
    narration:     `Purchase Bill No: ${billNo}`,
    party_id:      partyId,
    stock_id:      null,
    stock_reg_id:  null,
  })

  // 2. GST Input Credit DR (asset — recoverable)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Input Credit', account_type: 'ASSET', debit_amount: cgst, credit_amount: 0, narration: `CGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Input Credit', account_type: 'ASSET', debit_amount: sgst, credit_amount: 0, narration: `SGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Input Credit', account_type: 'ASSET', debit_amount: igst, credit_amount: 0, narration: `IGST Input on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // 3. Round-off
  // PURCHASE: rof > 0 → ntot > (gtot+GST) → firm pays more → EXPENSE DR
  //           rof < 0 → ntot < (gtot+GST) → firm pays less → INCOME CR
  const rofVal = parseFloat(String(rof))
  if (Math.abs(rofVal) > 0) {
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session })
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal > 0 ? rofVal : 0, credit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, narration: `Round Off on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  }

  // 4. Other Charges DR (expense)
  for (const charge of otherCharges ?? []) {
    const amt = parseFloat(String(charge.amount)) || 0
    if (amt > 0) {
      const head = normalizeLedgerAccountHead(charge.name ?? charge.type, 'Other Charges')
      const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: head, fallbackType: 'EXPENSE', session })
      docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: amt, credit_amount: 0, narration: `${chargeLedger.accountHead} on Purchase Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
    }
  }

  // 5. Inventory DR per goods line (ASSET — perpetual inventory)
  for (const pi of purchasedItems) {
    if (!pi.stockId || !(pi.lineValue > 0)) continue
    docs.push({
      ...base,
      account_head:  'Inventory',
      account_type:  'ASSET',
      debit_amount:  pi.lineValue,
      credit_amount: 0,
      narration:     `Purchase of ${pi.item} — Bill No: ${billNo}`,
      party_id:      null,
      stock_id:      pi.stockId    ?? null,
      stock_reg_id:  pi.stockRegId ?? null,
    })
  }

  assertBalancedVoucher(docs, 'PURCHASE', billNo)
  const insertOpts = session ? [{ session }] : []
  await Ledger.insertMany(docs, ...insertOpts)
}

/* ════════════════════════════════════════════════════════════════════════════
   SALES
════════════════════════════════════════════════════════════════════════════ */

export async function postSalesLedger(opts: {
  firmId:            string
  billId:            unknown
  voucherId:         number
  billNo:            string
  billDate:          string
  party:             { _id?: unknown; id?: unknown; firm: string }
  ntot:              number
  cgst:              number
  sgst:              number
  igst:              number
  rof:               number
  otherCharges:      Record<string, unknown>[] | null | undefined
  taxableItemsTotal: number
  cogsLines:         CogsLine[]
  actorUsername:     string
  session?:          ClientSession | null
}): Promise<void> {
  const {
    firmId, billId, voucherId, billNo, billDate,
    party, ntot, cgst, sgst, igst, rof,
    otherCharges, taxableItemsTotal, cogsLines, actorUsername, session = null,
  } = opts

  const base    = makeBase({ firmId, voucherId, voucherType: 'SALES', billNo, billId, billDate, actorUsername })
  const docs: LedgerDoc[] = []
  const partyId = party._id ?? party.id ?? null

  // 1. Party DR (debtor — ntot receivable)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'DEBTOR', partyId: String(partyId), session,
  })
  docs.push({
    ...base,
    account_head:  partyLedger.accountHead,
    account_type:  partyLedger.accountType,
    debit_amount:  ntot,
    credit_amount: 0,
    narration:     `Sales Bill No: ${billNo}`,
    party_id:      partyId,
    stock_id:      null,
    stock_reg_id:  null,
  })

  // 2. GST Payable CR (liability — collected from customer)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: cgst, narration: `CGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: sgst, narration: `SGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Payable', account_type: 'LIABILITY', debit_amount: 0, credit_amount: igst, narration: `IGST on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // 3. Round-off
  // SALES: rof > 0 → customer pays more → firm gains → CR INCOME
  //        rof < 0 → customer pays less → firm loses → DR EXPENSE
  const rofVal = parseFloat(String(rof))
  if (Math.abs(rofVal) > 0) {
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session })
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, credit_amount: rofVal > 0 ? rofVal : 0, narration: `Round Off on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  }

  // 4. Other Charges CR (income — charged to customer)
  for (const charge of otherCharges ?? []) {
    const amt = parseFloat(String(charge.amount)) || 0
    if (amt > 0) {
      const head = normalizeLedgerAccountHead(charge.name ?? charge.type, 'Other Charges')
      const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: head, fallbackType: 'INCOME', session })
      docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: 0, credit_amount: amt, narration: `${chargeLedger.accountHead} on Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
    }
  }

  // 5. Sales A/c CR (income — goods/service total, excludes charges)
  docs.push({ ...base, account_head: 'Sales', account_type: 'INCOME', debit_amount: 0, credit_amount: taxableItemsTotal, narration: `Sales Bill No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // 6. COGS DR + Inventory CR per goods line (skipped for service-only items)
  for (const cl of cogsLines) {
    if (!cl.stockId || !(cl.cogsValue > 0)) continue
    docs.push({ ...base, account_head: 'COGS',      account_type: 'EXPENSE', debit_amount: cl.cogsValue, credit_amount: 0,           narration: `Cost of goods: ${cl.item} — Bill No: ${billNo}`,   party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null })
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET',   debit_amount: 0,            credit_amount: cl.cogsValue, narration: `Inventory out: ${cl.item} — Bill No: ${billNo}`,   party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null })
  }

  assertBalancedVoucher(docs, 'SALES', billNo)
  const insertOpts = session ? [{ session }] : []
  await Ledger.insertMany(docs, ...insertOpts)
}

/* ════════════════════════════════════════════════════════════════════════════
   CREDIT NOTE (sales return)
════════════════════════════════════════════════════════════════════════════ */

export async function postCreditNoteLedger(opts: {
  firmId:            string
  billId:            unknown
  voucherId:         number
  billNo:            string
  billDate:          string
  party:             { _id?: unknown; id?: unknown; firm: string }
  ntot:              number
  cgst:              number
  sgst:              number
  igst:              number
  rof:               number
  otherCharges:      Record<string, unknown>[] | null | undefined
  taxableItemsTotal: number
  cogsLines:         CogsLine[]
  actorUsername:     string
  session?:          ClientSession | null
}): Promise<void> {
  const {
    firmId, billId, voucherId, billNo, billDate,
    party, ntot, cgst, sgst, igst, rof,
    otherCharges, taxableItemsTotal, cogsLines, actorUsername, session = null,
  } = opts

  const base    = makeBase({ firmId, voucherId, voucherType: 'CREDIT_NOTE', billNo, billId, billDate, actorUsername })
  const docs: LedgerDoc[] = []
  const partyId = party._id ?? party.id ?? null

  // Party CR (customer owes less — reduces debtor balance)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'DEBTOR', partyId: String(partyId), session,
  })
  docs.push({ ...base, account_head: partyLedger.accountHead, account_type: partyLedger.accountType, debit_amount: 0, credit_amount: ntot, narration: `Credit Note No: ${billNo}`, party_id: partyId, stock_id: null, stock_reg_id: null })

  // Reverse GST Payable (liability reduces → DR)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Payable', account_type: 'LIABILITY', debit_amount: cgst, credit_amount: 0, narration: `CGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Payable', account_type: 'LIABILITY', debit_amount: sgst, credit_amount: 0, narration: `SGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Payable', account_type: 'LIABILITY', debit_amount: igst, credit_amount: 0, narration: `IGST reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // Round-off reversal (mirror of sales posting)
  const rofVal = parseFloat(String(rof))
  if (Math.abs(rofVal) > 0) {
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session })
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal > 0 ? rofVal : 0, credit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, narration: `Round Off reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  }

  // Other charges reversal DR (reverse income earned on original sale)
  for (const charge of otherCharges ?? []) {
    const amt = parseFloat(String(charge.amount)) || 0
    if (amt > 0) {
      const head = normalizeLedgerAccountHead(charge.name ?? charge.type, 'Other Charges')
      const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: head, fallbackType: 'INCOME', session })
      docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: amt, credit_amount: 0, narration: `${chargeLedger.accountHead} reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
    }
  }

  // Sales A/c DR (reverse revenue)
  docs.push({ ...base, account_head: 'Sales', account_type: 'INCOME', debit_amount: taxableItemsTotal, credit_amount: 0, narration: `Sales reversal — Credit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // Goods back in inventory: Inventory DR, COGS CR
  for (const cl of cogsLines) {
    if (!cl.stockId || !(cl.cogsValue > 0)) continue
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET',   debit_amount: cl.cogsValue, credit_amount: 0,           narration: `Goods returned: ${cl.item} — Credit Note No: ${billNo}`,  party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null })
    docs.push({ ...base, account_head: 'COGS',      account_type: 'EXPENSE', debit_amount: 0,            credit_amount: cl.cogsValue, narration: `COGS reversal: ${cl.item} — Credit Note No: ${billNo}`, party_id: null, stock_id: cl.stockId ?? null, stock_reg_id: cl.stockRegId ?? null })
  }

  assertBalancedVoucher(docs, 'CREDIT_NOTE', billNo)
  const insertOpts = session ? [{ session }] : []
  await Ledger.insertMany(docs, ...insertOpts)
}

/* ════════════════════════════════════════════════════════════════════════════
   DEBIT NOTE (purchase return)
════════════════════════════════════════════════════════════════════════════ */

export async function postDebitNoteLedger(opts: {
  firmId:         string
  billId:         unknown
  voucherId:      number
  billNo:         string
  billDate:       string
  party:          { _id?: unknown; id?: unknown; firm: string }
  ntot:           number
  cgst:           number
  sgst:           number
  igst:           number
  rof:            number
  otherCharges:   Record<string, unknown>[] | null | undefined
  purchasedItems: PurchasedItem[]
  actorUsername:  string
  session?:       ClientSession | null
}): Promise<void> {
  const {
    firmId, billId, voucherId, billNo, billDate,
    party, ntot, cgst, sgst, igst, rof,
    otherCharges, purchasedItems, actorUsername, session = null,
  } = opts

  const base    = makeBase({ firmId, voucherId, voucherType: 'DEBIT_NOTE', billNo, billId, billDate, actorUsername })
  const docs: LedgerDoc[] = []
  const partyId = party._id ?? party.id ?? null

  // Party DR (creditor reduces — we owe supplier less)
  const partyLedger = await resolveLedgerPostingAccount({
    firmId, accountHead: party.firm, fallbackType: 'CREDITOR', partyId: String(partyId), session,
  })
  docs.push({ ...base, account_head: partyLedger.accountHead, account_type: partyLedger.accountType, debit_amount: ntot, credit_amount: 0, narration: `Debit Note No: ${billNo}`, party_id: partyId, stock_id: null, stock_reg_id: null })

  // GST Input Credit CR (forfeited on return)
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: cgst, narration: `CGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: sgst, narration: `SGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Input Credit', account_type: 'ASSET', debit_amount: 0, credit_amount: igst, narration: `IGST Input reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })

  // Round-off reversal (mirror of purchase posting)
  const rofVal = parseFloat(String(rof))
  if (Math.abs(rofVal) > 0) {
    const roundOffLedger = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'GENERAL', session })
    docs.push({ ...base, account_head: roundOffLedger.accountHead, account_type: roundOffLedger.accountType, debit_amount: rofVal < 0 ? Math.abs(rofVal) : 0, credit_amount: rofVal > 0 ? rofVal : 0, narration: `Round Off reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
  }

  // Other charges CR (reverse expense from original purchase)
  for (const charge of otherCharges ?? []) {
    const amt = parseFloat(String(charge.amount)) || 0
    if (amt > 0) {
      const head = normalizeLedgerAccountHead(charge.name ?? charge.type, 'Other Charges')
      const chargeLedger = await resolveLedgerPostingAccount({ firmId, accountHead: head, fallbackType: 'EXPENSE', session })
      docs.push({ ...base, account_head: chargeLedger.accountHead, account_type: chargeLedger.accountType, debit_amount: 0, credit_amount: amt, narration: `${chargeLedger.accountHead} reversal — Debit Note No: ${billNo}`, party_id: null, stock_id: null, stock_reg_id: null })
    }
  }

  // Inventory CR per goods line (goods leave stock, value reduces)
  for (const pi of purchasedItems) {
    if (!pi.stockId || !(pi.lineValue > 0)) continue
    docs.push({ ...base, account_head: 'Inventory', account_type: 'ASSET', debit_amount: 0, credit_amount: pi.lineValue, narration: `Goods returned to supplier: ${pi.item} — Debit Note No: ${billNo}`, party_id: null, stock_id: pi.stockId ?? null, stock_reg_id: pi.stockRegId ?? null })
  }

  assertBalancedVoucher(docs, 'DEBIT_NOTE', billNo)
  const insertOpts = session ? [{ session }] : []
  await Ledger.insertMany(docs, ...insertOpts)
}