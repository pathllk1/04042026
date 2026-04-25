/**
 * server/api/inventory/sls/next-bill-number.get.ts
 * GET /api/inventory/sls/next-bill-number
 *
 * Returns a PREVIEW of the next bill number without incrementing
 * the sequence counter. Used by the invoice page to pre-fill the
 * Bill No field (displayed as read-only).
 *
 * The actual bill number is only incremented (and permanently assigned)
 * when POST /bills is called inside the transaction.
 *
 * Query params:
 *   type  string   Voucher type (default: 'SALES')
 *                  Accepts: SALES | PURCHASE | CREDIT_NOTE | DEBIT_NOTE
 *
 * Auth: event.context.user
 */

import { getFirmId }             from '../../../utils/billUtils'
import { previewNextBillNumber } from '../../../utils/billUtils'

export default defineEventHandler(async (event) => {
  const firmId = getFirmId(event)
  const query  = getQuery(event)

  const type = String(query.type || 'SALES').trim().toUpperCase()

  const ALLOWED_TYPES = new Set([
    'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'DELIVERY_NOTE',
    'JOURNAL', 'PAYMENT', 'RECEIPT',
  ])

  const safeType = ALLOWED_TYPES.has(type) ? type : 'SALES'

  const nextBillNumber = await previewNextBillNumber(firmId, safeType)

  return {
    success:        true,
    nextBillNumber,
    type:           safeType,
  }
})