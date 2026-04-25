<script setup>
/**
 * InvoiceTotals.vue
 * Reactive invoice totals panel — taxable value, GST breakdown, round-off, net total.
 * Location: app/components/sales/InvoiceTotals.vue
 *
 * Replaces: layoutRenderer.js → renderTotals()
 *
 * Props
 *   state         {object}   shared reactive sales state
 *   isReturnMode  {boolean}
 *
 * No emits — display only.
 * Totals re-compute automatically whenever state.cart or state.otherCharges change.
 */

import { computed } from 'vue'
import {
  formatCurrency,
  calculateBillTotals,
  getItemEffectiveQty,
  shouldShowItemQty,
} from '~/utils/salesUtils'

const props = defineProps({
  state:        { type: Object,  required: true },
  isReturnMode: { type: Boolean, default: false },
})

// ── Effective cart for calculation ────────────────────────────────────────────
// In return mode we use returnQty in place of qty for every line.

const effectiveCart = computed(() => {
  if (!props.isReturnMode) return props.state?.cart || []
  return (props.state?.cart || []).map((item) => ({ ...item, qty: item.returnQty || 0 }))
})

// ── Totals ────────────────────────────────────────────────────────────────────

const totals = computed(() =>
  calculateBillTotals({
    cart:          effectiveCart.value,
    otherCharges:  props.state?.otherCharges || [],
    gstEnabled:    props.state?.gstEnabled !== false,
    billType:      props.state?.meta?.billType || 'intra-state',
    reverseCharge: props.state?.meta?.reverseCharge || false,
  }),
)

// ── Total quantity ────────────────────────────────────────────────────────────

const totalQty = computed(() =>
  effectiveCart.value
    .reduce((sum, item) => {
      if (!shouldShowItemQty(item)) return sum
      return sum + (props.isReturnMode ? (item.returnQty || 0) : (Number(item.qty) || 0))
    }, 0)
    .toFixed(2),
)

// ── Derived flags ─────────────────────────────────────────────────────────────

const isIntraState   = computed(() => props.state?.meta?.billType === 'intra-state')
const hasOtherCharges = computed(() => (props.state?.otherCharges?.length || 0) > 0)
const reverseCharge  = computed(() => props.state?.meta?.reverseCharge || false)
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">

    <!-- ── Left: summary labels ──────────────────────────────────────────── -->
    <div class="text-[11px] text-gray-400 space-y-1">
      <div class="flex gap-4">
        <span>
          Total Items: <b class="text-gray-600">{{ state?.cart?.length || 0 }}</b>
        </span>
        <span :class="isReturnMode ? 'text-amber-700' : ''">
          {{ isReturnMode ? 'Ret Qty' : 'Total Qty' }}:
          <b>{{ totalQty }}</b>
        </span>
      </div>

      <div v-if="reverseCharge" class="text-red-600 font-bold mt-1">
        REVERSE CHARGE APPLIES
      </div>

      <div class="text-gray-400 italic mt-2">
        * Rates are inclusive of discounts before tax
      </div>
    </div>

    <!-- ── Right: totals table ───────────────────────────────────────────── -->
    <div class="flex gap-6 text-xs">

      <!-- Labels column -->
      <div class="text-right space-y-1.5 text-gray-500 font-medium">
        <div class="mb-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
          {{ isReturnMode ? 'Return Totals' : 'Invoice Totals' }}
        </div>
        <div>Taxable Value</div>

        <template v-if="isIntraState">
          <div>CGST Output</div>
          <div>SGST Output</div>
        </template>
        <template v-else>
          <div>IGST Output</div>
        </template>

        <div v-if="hasOtherCharges">Other Charges</div>
        <div>Round Off</div>
        <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-gray-700">
          {{ isReturnMode ? 'Net Return Total' : 'Net Total' }}
        </div>
      </div>

      <!-- Values column -->
      <div class="text-right space-y-1.5 font-mono font-bold text-gray-800">
        <div class="mb-2 h-4" />

        <div class="tabular-nums">
          {{ formatCurrency(totals.itemTaxableTotal) }}
        </div>

        <template v-if="isIntraState">
          <div class="text-gray-600 tabular-nums">{{ formatCurrency(totals.cgst) }}</div>
          <div class="text-gray-600 tabular-nums">{{ formatCurrency(totals.sgst) }}</div>
        </template>
        <template v-else>
          <div class="text-gray-600 tabular-nums">{{ formatCurrency(totals.igst) }}</div>
        </template>

        <div v-if="hasOtherCharges" class="text-gray-600 tabular-nums">
          {{ formatCurrency(totals.otherChargesTotal) }}
        </div>

        <div class="text-gray-600 tabular-nums">{{ formatCurrency(totals.rof) }}</div>

        <div
          class="pt-2 mt-2 border-t border-gray-200 font-bold text-lg leading-none tabular-nums"
          :class="isReturnMode ? 'text-amber-700' : 'text-blue-700'"
        >
          {{ formatCurrency(totals.ntot) }}
        </div>
      </div>

    </div>
  </div>
</template>