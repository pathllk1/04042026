<script setup>
/**
 * OtherChargesModal.vue
 * Other-charges management modal (freight, packing, insurance, etc.).
 * Location: app/components/sales/OtherChargesModal.vue
 *
 * Replaces: chargesModal.js → openOtherChargesModal()
 *
 * Props
 *   open   {boolean}  v-model:open
 *   state  {object}   shared reactive sales state (otherCharges[], gstEnabled)
 *
 * Emits
 *   update:open
 *   add-charge     ({ name, type, hsnSac, amount, gstRate })
 *   remove-charge  (index: number)
 *   save           ()   — emitted when "Save & Close" is clicked
 *
 * GET /api/inventory/sales/other-charges-types  → $fetch (no CSRF needed)
 */

import { ref, computed, watch, nextTick } from 'vue'
import { formatCurrency } from '~/utils/salesUtils'

const props = defineProps({
  open:  { type: Boolean, required: true },
  state: { type: Object,  required: true },
})

const emit = defineEmits(['update:open', 'add-charge', 'remove-charge', 'save'])

const toast = useToast()

// ── Add-form fields ──────────────────────────────────────────────────────────

const chargeName   = ref('')
const chargeType   = ref('')
const chargeHsn    = ref('')
const chargeAmount = ref('')
const chargeGst    = ref(0)

const CHARGE_TYPES = ['Freight', 'Packing', 'Insurance', 'Handling', 'Labour', 'Commission', 'Discount', 'Other']
const GST_RATES    = [0, 5, 12, 18, 28]

// ── Autocomplete ──────────────────────────────────────────────────────────────

const existingCharges  = ref([])
const chargesLoaded    = ref(false)
const showSuggestions  = ref(false)

const filteredSuggestions = computed(() => {
  const q = chargeName.value.toLowerCase().trim()
  if (!q || !chargesLoaded.value) return []
  return existingCharges.value.filter(
    (c) =>
      c.name?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q),
  ).slice(0, 8)
})

async function loadChargeTypes() {
  if (chargesLoaded.value) return
  try {
    const data = await $fetch('/api/inventory/sls/other-charges-types', {
      method: 'GET', credentials: 'include',
    })
    if (data.success) existingCharges.value = data.data || []
  } catch (err) {
    console.warn('Could not load charge types:', err.message ?? err)
  } finally {
    chargesLoaded.value = true
  }
}

function applySuggestion(charge) {
  chargeName.value   = charge.name  || ''
  chargeType.value   = charge.type  || 'Other'
  chargeHsn.value    = charge.hsnSac || ''
  chargeGst.value    = charge.gstRate ?? 0
  showSuggestions.value = false
  // Focus amount field after picking
  nextTick(() => document.getElementById('charge-amount-input')?.focus())
}

function hideSuggestions() {
  // Small delay so click on suggestion registers before blur hides the list
  setTimeout(() => { showSuggestions.value = false }, 150)
}

// ── Add charge ────────────────────────────────────────────────────────────────

function addCharge() {
  if (!chargeName.value.trim()) {
    toast.add({ title: 'Please enter a charge name', color: 'error' })
    return
  }
  const amount = parseFloat(chargeAmount.value)
  if (isNaN(amount) || amount <= 0) {
    toast.add({ title: 'Please enter a valid amount', color: 'error' })
    return
  }

  emit('add-charge', {
    name:    chargeName.value.trim(),
    type:    chargeType.value || 'Other',
    hsnSac:  chargeHsn.value.trim(),
    amount,
    gstRate: parseFloat(chargeGst.value) || 0,
  })

  // Reset form
  chargeName.value   = ''
  chargeType.value   = ''
  chargeHsn.value    = ''
  chargeAmount.value = ''
  chargeGst.value    = 0
  showSuggestions.value = false
}

// ── Totals ────────────────────────────────────────────────────────────────────

const grandTotal = computed(() =>
  props.state.otherCharges.reduce((sum, c) => {
    const amt    = parseFloat(c.amount)  || 0
    const gstAmt = props.state.gstEnabled !== false
      ? (amt * (parseFloat(c.gstRate) || 0)) / 100
      : 0
    return sum + amt + gstAmt
  }, 0),
)

// ── Per-row helpers ───────────────────────────────────────────────────────────

function rowGstAmount(charge) {
  if (props.state.gstEnabled === false) return 0
  return (parseFloat(charge.amount) || 0) * (parseFloat(charge.gstRate) || 0) / 100
}

function rowTotal(charge) {
  return (parseFloat(charge.amount) || 0) + rowGstAmount(charge)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => { if (isOpen) loadChargeTypes() },
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'max-w-6xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-base text-gray-800">Other Charges</h3>
          <p class="text-xs text-gray-400 mt-0.5">Add freight, packing, insurance, etc.</p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="$emit('update:open', false)"
        />
      </div>
    </template>

    <template #body>
    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto p-4 bg-white space-y-4">

      <!-- ── Add form ──────────────────────────────────────────────────────── -->
      <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">

        <!-- Row 1: Name + Type -->
        <div class="grid grid-cols-2 gap-3">

          <!-- Charge name with autocomplete -->
          <div class="relative">
            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
              Charge Name *
            </label>
            <UInput
              v-model="chargeName"
              placeholder="e.g. Freight, Packing"
              autocomplete="off"
              class="w-full"
              @focus="showSuggestions = true"
              @blur="hideSuggestions"
            />
            <!-- Suggestion dropdown -->
            <div
              v-if="showSuggestions && filteredSuggestions.length > 0"
              class="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl
                     mt-0.5 w-full max-h-40 overflow-y-auto"
            >
              <div
                v-for="(sugg, idx) in filteredSuggestions"
                :key="idx"
                class="px-3 py-2 hover:bg-blue-50 cursor-pointer
                       border-b border-gray-50 last:border-0"
                @mousedown.prevent="applySuggestion(sugg)"
              >
                <div class="text-sm font-medium text-gray-800">
                  {{ sugg.name || sugg.type }}
                </div>
                <div class="text-[10px] text-gray-400">
                  {{ sugg.type }} · HSN: {{ sugg.hsnSac || 'N/A' }} · GST {{ sugg.gstRate || 0 }}%
                </div>
              </div>
            </div>
          </div>

          <!-- Type (free-text with datalist) -->
          <div>
            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
              Type
            </label>
            <input
              v-model="chargeType"
              list="charge-type-list"
              placeholder="Select or type custom type"
              class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none bg-white"
            />
            <datalist id="charge-type-list">
              <option v-for="t in CHARGE_TYPES" :key="t" :value="t" />
            </datalist>
          </div>
        </div>

        <!-- Row 2: HSN + Amount + GST + Button -->
        <div class="grid grid-cols-4 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
              HSN/SAC Code
            </label>
            <UInput v-model="chargeHsn" placeholder="e.g. 9965" class="w-full" />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
              Amount (₹) *
            </label>
            <UInput
              id="charge-amount-input"
              v-model="chargeAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
              GST %
            </label>
            <USelect
              v-model="chargeGst"
              :items="GST_RATES.map(r => ({ label: `${r}%`, value: r }))"
              class="w-full"
            />
          </div>

          <div class="flex items-end">
            <UButton
              label="+ Add Charge"
              color="primary"
              class="w-full justify-center"
              @click="addCharge"
            />
          </div>
        </div>
      </div>

      <!-- ── Charges list ───────────────────────────────────────────────────── -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <h4 class="font-bold text-sm text-gray-700">Charges Added</h4>
          <span class="text-xs text-gray-500">
            Total:
            <span class="font-bold text-blue-600">{{ formatCurrency(grandTotal) }}</span>
          </span>
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200">
          <table class="w-full text-left border-collapse">
            <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase
                          tracking-wide border-b border-gray-200">
              <tr>
                <th class="p-2.5">Name</th>
                <th class="p-2.5">Type</th>
                <th class="p-2.5">HSN/SAC</th>
                <th class="p-2.5 text-right">Amount</th>
                <th class="p-2.5 text-right">GST %</th>
                <th class="p-2.5 text-right">Total</th>
                <th class="p-2.5 text-center">Action</th>
              </tr>
            </thead>

            <tbody class="bg-white">
              <!-- Empty state -->
              <tr v-if="state.otherCharges.length === 0">
                <td
                  colspan="7"
                  class="p-8 text-center text-gray-300 italic text-sm"
                >
                  No charges added yet
                </td>
              </tr>

              <!-- Charge rows -->
              <template
                v-for="(charge, idx) in state.otherCharges"
                :key="idx"
              >
                <!-- Main row -->
                <tr class="hover:bg-blue-50/60 transition-colors border-b border-gray-50 text-xs">
                  <td class="p-2.5 font-semibold text-gray-800">{{ charge.name }}</td>
                  <td class="p-2.5 text-gray-500">{{ charge.type || '-' }}</td>
                  <td class="p-2.5 text-gray-400 font-mono text-[11px]">
                    {{ charge.hsnSac || '-' }}
                  </td>
                  <td class="p-2.5 text-right font-mono tabular-nums">
                    {{ formatCurrency(parseFloat(charge.amount) || 0) }}
                  </td>
                  <td class="p-2.5 text-right text-gray-500">
                    {{ charge.gstRate || 0 }}%
                  </td>
                  <td class="p-2.5 text-right font-bold tabular-nums text-gray-800">
                    {{ formatCurrency(rowTotal(charge)) }}
                  </td>
                  <td class="p-2.5 text-center">
                    <UButton
                      label="REMOVE"
                      size="xs"
                      color="error"
                      variant="soft"
                      @click="$emit('remove-charge', idx)"
                    />
                  </td>
                </tr>

                <!-- GST breakdown sub-row -->
                <tr class="bg-gray-50 text-[11px]">
                  <td colspan="3" class="px-3 py-1 text-right text-gray-400">
                    GST ({{ charge.gstRate || 0 }}%):
                  </td>
                  <td class="px-3 py-1 text-right text-gray-400">
                    {{ formatCurrency(rowGstAmount(charge)) }}
                  </td>
                  <td class="px-3 py-1 text-right text-gray-500 font-bold">Total:</td>
                  <td class="px-3 py-1 text-right text-gray-700 font-bold">
                    {{ formatCurrency(rowTotal(charge)) }}
                  </td>
                  <td />
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </template>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="$emit('update:open', false)"
        />
        <UButton
          label="Save & Close"
          color="neutral"
          variant="solid"
          @click="$emit('save'); $emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>