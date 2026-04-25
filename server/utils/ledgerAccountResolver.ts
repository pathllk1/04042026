/**
 * server/utils/ledgerAccountResolver.ts
 *
 * Resolves the correct ledger account head and type for a posting.
 * Ported from utils/mongo/ledgerAccountResolver.js with TypeScript types.
 *
 * Strategy:
 *   1. Look up the most recently used Ledger entry for this firm + account head
 *      (optionally scoped to a party_id for debtor/creditor accounts).
 *   2. If found → reuse the existing account_head casing and account_type.
 *      This ensures the ledger stays consistent (e.g. "Freight" not "freight").
 *   3. If not found → use the normalized head + the caller's fallbackType.
 *
 * This design means the first posting for any new account head sets the type,
 * and all subsequent postings inherit it — matching the original Express behaviour.
 */

import type { ClientSession } from 'mongoose'
import { Ledger } from '../models/index'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalise a raw account head string:
 *   - trim whitespace
 *   - collapse internal runs of whitespace to a single space
 *   - fall back to `fallback` if the result is empty
 */
export function normalizeLedgerAccountHead(
  value:    unknown,
  fallback = 'Other Charges',
): string {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  return normalized || fallback
}

/* ── Main resolver ────────────────────────────────────────────────────────── */

export interface ResolvedAccount {
  accountHead: string
  accountType: string
}

/**
 * Resolve the posting account head and type for a ledger entry.
 *
 * @param firmId       Firm ObjectId string
 * @param accountHead  Raw account head (will be normalised)
 * @param fallbackType Account type to use when no existing entry is found
 * @param partyId      Optional party ObjectId — if supplied the lookup is
 *                     scoped to party-specific entries (debtor/creditor)
 * @param session      Optional Mongoose transaction session
 */
export async function resolveLedgerPostingAccount(opts: {
  firmId:       string
  accountHead:  string
  fallbackType: string
  partyId?:     string | null
  session?:     ClientSession | null
}): Promise<ResolvedAccount> {
  const { firmId, accountHead, fallbackType, partyId = null, session = null } = opts

  const normalizedHead = normalizeLedgerAccountHead(accountHead)
  const escapedHead    = escapeRegex(normalizedHead)

  const baseFilter: Record<string, unknown> = {
    firm_id:      firmId,
    account_head: { $regex: `^${escapedHead}$`, $options: 'i' },
  }

  const queryOptions: Record<string, unknown> = {
    sort: { updatedAt: -1, createdAt: -1 },
  }
  if (session) queryOptions.session = session

  // Scoped lookup: try party-specific entry first, then fall back to generic
  const filter = partyId
    ? { ...baseFilter, party_id: partyId }
    : { ...baseFilter, party_id: null }

  const existing = await Ledger
    .findOne(filter, 'account_head account_type', queryOptions)
    .lean() as { account_head?: string; account_type?: string } | null

  return {
    accountHead: existing?.account_head || normalizedHead,
    accountType: existing?.account_type || fallbackType,
  }
}