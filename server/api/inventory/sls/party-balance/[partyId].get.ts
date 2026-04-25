/**
 * server/api/inventory/sls/party-balance/[partyId].get.ts
 * GET /api/inventory/sls/party-balance/:partyId
 *
 * Returns the current outstanding balance for a party by summing their
 * ledger entries (debit - credit) scoped to this firm.
 *
 * Positive result  → Debit balance  (party owes us money — AR)
 * Negative result  → Credit balance (we owe them money  — AP)
 *
 * Response:
 *   balance       number   Raw signed balance (positive = Debit)
 *   balance_type  string   'Debit' | 'Credit' | 'Nil'
 *   outstanding   number   Absolute value of balance
 *
 * Auth: event.context.user
 */

import { Ledger, Party }               from '../../../../models/index'
import { getFirmId, validateObjectId } from '../../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId  = getFirmId(event)
  const partyId = validateObjectId(getRouterParam(event, 'partyId'), 'partyId')

  // Verify party belongs to this firm
  const partyDoc = await Party.findOne({ _id: partyId, firm_id: firmId })
    .select('firm')
    .lean() as any
  if (!partyDoc) {
    throw createError({ statusCode: 404, message: 'Party not found' })
  }

  // ── Aggregate ledger balance ───────────────────────────────────────────
  // Sum all debit and credit amounts for this party across all voucher types.
  // Locked entries (is_locked: true) are included — they represent posted
  // journal adjustments that affect the balance.
  const agg = await Ledger.aggregate([
    {
      $match: {
        firm_id:  { $toObjectId: firmId },
        party_id: { $toObjectId: partyId },
      },
    },
    {
      $group: {
        _id:          null,
        totalDebit:   { $sum: '$debit_amount'  },
        totalCredit:  { $sum: '$credit_amount' },
      },
    },
  ])

  const totalDebit  = agg[0]?.totalDebit  || 0
  const totalCredit = agg[0]?.totalCredit || 0

  // Net balance: positive = Debit (customer owes us)
  const balance    = parseFloat((totalDebit - totalCredit).toFixed(2))
  const outstanding = Math.abs(balance)

  let balance_type: 'Debit' | 'Credit' | 'Nil'
  if (Math.abs(balance) < 0.01) {
    balance_type = 'Nil'
  } else if (balance > 0) {
    balance_type = 'Debit'
  } else {
    balance_type = 'Credit'
  }

  return {
    success: true,
    data: {
      partyId,
      partyName:    partyDoc.firm,
      balance,
      balance_type,
      outstanding,
      totalDebit:   parseFloat(totalDebit.toFixed(2)),
      totalCredit:  parseFloat(totalCredit.toFixed(2)),
    },
  }
})