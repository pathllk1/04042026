/**
 * useOtherCharges.js
 * Other-charges (freight, packing, insurance, etc.) composable.
 * Location: app/composables/sales/useOtherCharges.js
 *
 * Replaces: otherChargesManager.js
 *
 * Receives the shared reactive `state` object from useSalesState() and
 * mutates it directly. No API calls — pure in-memory operations.
 *
 * The renderOtherChargesList() function from the original is NOT ported here;
 * that presentational logic belongs in OtherChargesModal.vue as a template loop.
 */

import { computed } from 'vue'
import { formatCurrency } from '~/utils/salesUtils'

/**
 * @param {import('vue').UnwrapNestedRefs<object>} state
 *   The reactive state object from useSalesState()
 */
export function useOtherCharges(state) {

  // ─── Computed helpers ────────────────────────────────────────────────────────

  /**
   * Sum of all charge base amounts (before GST).
   * Reactive — updates automatically when state.otherCharges changes.
   */
  const totalOtherChargesBase = computed(() =>
    state.otherCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0),
  )

  /**
   * Sum of all charge totals including GST.
   * This is the figure shown in the modal footer and the invoice totals row.
   */
  const totalOtherChargesWithGst = computed(() =>
    state.otherCharges.reduce((sum, c) => {
      const amt    = parseFloat(c.amount)  || 0
      const gstAmt = state.gstEnabled !== false
        ? (amt * (parseFloat(c.gstRate) || 0)) / 100
        : 0
      return sum + amt + gstAmt
    }, 0),
  )

  /**
   * Formatted string of totalOtherChargesWithGst — ready to bind directly
   * to a template with `{{ totalOtherChargesFormatted }}`.
   */
  const totalOtherChargesFormatted = computed(() =>
    formatCurrency(totalOtherChargesWithGst.value),
  )

  // ─── Mutations ───────────────────────────────────────────────────────────────

  /**
   * Appends a new charge to state.otherCharges.
   * gstAmount is pre-computed and stored alongside the charge so the
   * invoice-totals calculation can read it without re-deriving.
   *
   * @param {{ name: string, type: string, hsnSac?: string,
   *            amount: number, gstRate?: number }} charge
   */
  function addOtherCharge(charge) {
    const gstRate = charge.gstRate ?? 0
    const gstAmount = state.gstEnabled !== false
      ? ((charge.amount * gstRate) / 100)
      : 0

    state.otherCharges.push({
      name:      charge.name,
      type:      charge.type    || 'other',
      hsnSac:    charge.hsnSac  || '',
      amount:    parseFloat(charge.amount) || 0,
      gstRate,
      gstAmount,
    })
  }

  /**
   * Removes the charge at the given index.
   * @param {number} index
   */
  function removeOtherCharge(index) {
    state.otherCharges.splice(index, 1)
  }

  /**
   * Replaces the charge at the given index with a new charge object.
   * Re-computes gstAmount based on the current gstEnabled flag.
   *
   * @param {number} index
   * @param {{ name: string, type: string, hsnSac?: string,
   *            amount: number, gstRate?: number }} charge
   */
  function updateOtherCharge(index, charge) {
    const gstRate = charge.gstRate ?? 0
    const gstAmount = state.gstEnabled !== false
      ? ((charge.amount * gstRate) / 100)
      : 0

    state.otherCharges[index] = {
      name:      charge.name,
      type:      charge.type   || 'other',
      hsnSac:    charge.hsnSac || '',
      amount:    parseFloat(charge.amount) || 0,
      gstRate,
      gstAmount,
    }
  }

  /**
   * Recalculates gstAmount on every charge when the GST-enabled flag changes.
   * Call this in a watcher on state.gstEnabled in the parent page component.
   */
  function recomputeChargeGst() {
    state.otherCharges = state.otherCharges.map((c) => ({
      ...c,
      gstAmount: state.gstEnabled !== false
        ? ((c.amount * (c.gstRate || 0)) / 100)
        : 0,
    }))
  }

  return {
    // Computed
    totalOtherChargesBase,
    totalOtherChargesWithGst,
    totalOtherChargesFormatted,
    // Mutations
    addOtherCharge,
    removeOtherCharge,
    updateOtherCharge,
    recomputeChargeGst,
  }
}