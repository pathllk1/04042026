<script setup>
/**
 * InvoiceItemsList.vue
 * Renders the cart rows with inline editing, return mode, and
 * service-item autocomplete.
 * Location: app/components/sales/InvoiceItemsList.vue
 *
 * Replaces:
 *   layoutRenderer.js → renderItemsList() + attachServiceAutocomplete()
 *
 * Props
 *   state         {object}   shared reactive sales state
 *   isReturnMode  {boolean}
 *
 * Emits
 *   update-item      (index, field, value)
 *   update-narration (index, value)
 *   remove-item      (index)
 *   apply-service    (index, serviceObject)  — autocomplete selection
 *
 * All mutations are forwarded to the parent (index.vue) which calls
 * useCart() methods — keeping mutation logic out of the display component.
 */

import { ref, computed, watch } from 'vue'
import {
  formatCurrency,
  isServiceItem,
  getItemEffectiveQty,
  getItemDisplayQty,
  getItemLineTotal,
  shouldShowItemQty,
} from '~/utils/salesUtils'

const props = defineProps({
  state:        { type: Object,  required: true },
  isReturnMode: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update-item',
  'update-narration',
  'remove-item',
  'apply-service',
])

// ── Service autocomplete ──────────────────────────────────────────────────────

const SERVICE_CACHE_TTL = 5 * 60 * 1000   // 5 minutes
let   _serviceCache     = null
let   _serviceCacheAt   = 0

const serviceSuggestions = ref([])
const activeAutocompleteIdx = ref(null)
const autocompleteSearch    = ref('')

const filteredSuggestions = computed(() => {
  const q = autocompleteSearch.value.toLowerCase().trim()
  if (!q || activeAutocompleteIdx.value === null) return []
  return serviceSuggestions.value
    .filter((s) => s.item.toLowerCase().includes(q))
    .slice(0, 10)
})

async function loadServiceSuggestions() {
  const now = Date.now()
  if (_serviceCache && now - _serviceCacheAt < SERVICE_CACHE_TTL) {
    serviceSuggestions.value = _serviceCache
    return
  }
  try {
    const data = await $fetch('/api/inventory/sales/services', {
      method: 'GET', credentials: 'include',
    })
    if (data.success && Array.isArray(data.data)) {
      _serviceCache        = data.data
      _serviceCacheAt      = now
      serviceSuggestions.value = data.data
    }
  } catch (err) {
    console.warn('Could not load service suggestions:', err.message ?? err)
  }
}

function onServiceInputFocus(idx) {
  activeAutocompleteIdx.value = idx
  autocompleteSearch.value    = props.state.cart[idx]?.item || ''
  loadServiceSuggestions()
}

function onServiceInputChange(idx, val) {
  autocompleteSearch.value = val
  activeAutocompleteIdx.value = idx
  emit('update-item', idx, 'item', val)
}

function applyServiceSuggestion(idx, service) {
  emit('apply-service', idx, service)
  activeAutocompleteIdx.value = null
  autocompleteSearch.value    = ''
}

function closeAutocomplete() {
  // Delay so click on a suggestion fires before blur hides the list
  setTimeout(() => { activeAutocompleteIdx.value = null }, 180)
}

// Keyboard nav state per-row
const keyboardIdx = ref(-1)

function onServiceKeydown(e, idx) {
  if (activeAutocompleteIdx.value !== idx) return
  const len = filteredSuggestions.value.length
  if (len === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    keyboardIdx.value = Math.min(keyboardIdx.value + 1, len - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    keyboardIdx.value = Math.max(keyboardIdx.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (keyboardIdx.value >= 0 && keyboardIdx.value < len) {
      applyServiceSuggestion(idx, filteredSuggestions.value[keyboardIdx.value])
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    activeAutocompleteIdx.value = null
  }
}

watch(activeAutocompleteIdx, () => { keyboardIdx.value = -1 })

// ── Row helpers ───────────────────────────────────────────────────────────────

function rowTotal(item) {
  if (props.isReturnMode) {
    const qty  = item.returnQty || 0
    const rate = Number(item.rate) || 0
    const disc = Number(item.disc) || 0
    return qty * rate * (1 - disc / 100)
  }
  return getItemLineTotal(item)
}

function displayQty(item) {
  if (props.isReturnMode) return item.returnQty ?? 0
  return getItemDisplayQty(item)
}

function rowBg(index) {
  return index % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'
}
</script>

<template>
  <!-- ── Empty cart ──────────────────────────────────────────────────────── -->
  <div
    v-if="state.cart.length === 0"
    class="absolute inset-0 flex flex-col items-center justify-center
           text-gray-300 select-none pointer-events-none"
  >
    <UIcon name="i-lucide-shopping-cart" class="w-16 h-16 mb-3 text-gray-200" />
    <p class="text-sm font-medium text-gray-400">Your cart is empty</p>
    <p class="text-xs text-gray-400 mt-1">
      Quick Actions:
      <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F2</kbd>
      Add Items &nbsp;|&nbsp;
      <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F3</kbd>
      Select Party &nbsp;|&nbsp;
      <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F4</kbd>
      Other Charges
    </p>
  </div>

  <!-- ── Cart rows ──────────────────────────────────────────────────────── -->
  <template v-else>
    <template
      v-for="(item, index) in state.cart"
      :key="`${item.stockId}-${item.batch}-${index}`"
    >
      <!-- ── Main item row ───────────────────────────────────────────────── -->
      <div
        class="flex items-center border-b border-gray-200 text-xs text-gray-700
               transition-colors min-h-10 group hover:bg-blue-100/50"
        :class="[rowBg(index), isReturnMode ? 'bg-amber-50/20' : '']"
      >

        <!-- # -->
        <div class="p-2 w-10 text-center text-gray-500 font-mono font-bold shrink-0">
          {{ index + 1 }}
        </div>

        <!-- Item description -->
        <div class="p-2 flex-1 font-medium truncate flex flex-col justify-center min-w-0">

          <!-- SERVICE: editable input + autocomplete -->
          <div
            v-if="isServiceItem(item)"
            class="relative"
          >
            <input
              type="text"
              :value="item.item"
              :readonly="isReturnMode"
              placeholder="Service description"
              class="w-full text-xs bg-transparent border-b border-transparent
                     focus:bg-white focus:border-blue-500 outline-none px-1
                     font-medium text-gray-800"
              @focus="onServiceInputFocus(index)"
              @blur="closeAutocomplete"
              @input="onServiceInputChange(index, $event.target.value)"
              @keydown="onServiceKeydown($event, index)"
            />

            <!-- Autocomplete dropdown -->
            <div
              v-if="activeAutocompleteIdx === index && filteredSuggestions.length > 0"
              class="absolute top-full left-0 right-0 bg-white border border-blue-300
                     rounded shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              <div
                v-for="(sugg, sIdx) in filteredSuggestions"
                :key="sIdx"
                class="px-3 py-2 cursor-pointer text-xs border-b border-gray-100
                       last:border-b-0 transition-colors"
                :class="keyboardIdx === sIdx ? 'bg-blue-100' : 'hover:bg-blue-50'"
                @mousedown.prevent="applyServiceSuggestion(index, sugg)"
              >
                <div class="font-medium text-gray-800">{{ sugg.item }}</div>
                <div class="text-[10px] text-gray-500">
                  <span v-if="sugg.hsn">SAC: {{ sugg.hsn }}</span>
                  <span v-if="sugg.rate"> | Rate: ₹{{ sugg.rate }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- GOODS: static label -->
          <span v-else class="text-gray-800 font-semibold truncate">{{ item.item }}</span>

          <!-- Sub-label -->
          <span class="text-[10px] text-gray-500 font-normal">
            <template v-if="isServiceItem(item)">🔧 Service Line</template>
            <template v-else>
              📦 Batch: {{ item.batch || '-' }} | OEM: {{ item.oem || '-' }}
            </template>
          </span>
        </div>

        <!-- HSN -->
        <div class="p-2 w-20 text-gray-600 border-l border-gray-200
                    group-hover:border-blue-300 shrink-0">
          <input
            v-if="isServiceItem(item)"
            type="text"
            :value="item.hsn"
            :readonly="isReturnMode"
            placeholder="SAC"
            class="w-full text-xs bg-transparent border-b border-transparent
                   focus:bg-white focus:border-blue-500 outline-none px-1
                   text-gray-600 font-mono"
            @input="emit('update-item', index, 'hsn', $event.target.value)"
          />
          <span v-else class="font-mono text-gray-700">{{ item.hsn }}</span>
        </div>

        <!-- Original qty (return mode only) -->
        <div
          v-if="isReturnMode"
          class="p-2 w-16 text-right text-gray-400 font-medium border-l
                 border-transparent group-hover:border-blue-100 shrink-0"
        >
          {{ item.qty }}
        </div>

        <!-- Qty input -->
        <div class="p-1 w-16 border-l border-transparent
                    group-hover:border-blue-100 shrink-0">
          <input
            v-if="shouldShowItemQty(item) || isReturnMode"
            type="number"
            min="0"
            :max="isReturnMode ? item.qty : undefined"
            step="0.01"
            :value="displayQty(item)"
            :readonly="!isReturnMode && isServiceItem(item) && !shouldShowItemQty(item)"
            class="w-full text-right bg-transparent border-b border-transparent
                   focus:bg-white outline-none px-1 font-semibold"
            :class="isReturnMode
              ? 'focus:border-amber-500 bg-amber-50 border-amber-200 text-amber-700'
              : 'focus:border-blue-500 text-blue-700'"
            @input="emit('update-item', index,
                         isReturnMode ? 'returnQty' : 'qty',
                         $event.target.value)"
          />
        </div>

        <!-- UOM -->
        <div class="p-2 w-12 text-center text-gray-600 text-[10px] border-l
                    border-gray-200 group-hover:border-blue-300 font-medium shrink-0">
          <input
            v-if="isServiceItem(item)"
            type="text"
            :value="item.uom"
            :readonly="isReturnMode"
            :placeholder="shouldShowItemQty(item) ? 'UOM' : ''"
            class="w-full text-[10px] text-center bg-transparent border-b
                   border-transparent focus:bg-white focus:border-blue-500
                   outline-none px-1"
            @input="emit('update-item', index, 'uom', $event.target.value)"
          />
          <span v-else class="font-semibold">{{ item.uom }}</span>
        </div>

        <!-- Rate -->
        <div class="p-1 w-24 border-l border-gray-200
                    group-hover:border-blue-300 shrink-0">
          <input
            type="number"
            min="0"
            step="0.01"
            :value="Number(item.rate)"
            :readonly="isReturnMode"
            class="w-full text-right bg-transparent border-b border-transparent
                   focus:bg-white focus:border-blue-500 outline-none px-1
                   font-mono font-semibold text-gray-800"
            @input="emit('update-item', index, 'rate', $event.target.value)"
          />
        </div>

        <!-- Disc % -->
        <div class="p-1 w-16 border-l border-gray-200
                    group-hover:border-blue-300 shrink-0">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            :value="Number(item.disc || 0)"
            :readonly="isReturnMode"
            placeholder="0"
            class="w-full text-right bg-transparent border-b border-transparent
                   focus:bg-white focus:border-blue-500 outline-none px-1
                   placeholder-gray-300 font-mono"
            @input="emit('update-item', index, 'disc', $event.target.value)"
          />
        </div>

        <!-- Tax % -->
        <div class="p-1 w-16 border-l border-gray-200
                    group-hover:border-blue-300 shrink-0">
          <input
            v-if="isServiceItem(item)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            :value="Number(item.grate || 0)"
            :readonly="isReturnMode"
            class="w-full text-right bg-transparent border-b border-transparent
                   focus:bg-white focus:border-blue-500 outline-none px-1
                   text-gray-700 font-mono font-semibold"
            @input="emit('update-item', index, 'grate', $event.target.value)"
          />
          <div
            v-else
            class="p-1 text-right text-gray-700 font-mono font-semibold"
          >
            {{ item.grate }}%
          </div>
        </div>

        <!-- Row total -->
        <div
          class="p-2 w-28 text-right font-bold text-blue-700 border-l
                 border-gray-200 group-hover:border-blue-300
                 bg-blue-50/50 group-hover:bg-blue-100/30
                 tabular-nums rounded-r shrink-0"
          :class="isReturnMode ? 'text-amber-700' : 'text-blue-700'"
        >
          {{ formatCurrency(rowTotal(item)) }}
        </div>

        <!-- Remove -->
        <div class="p-2 w-10 text-center border-l border-gray-200
                    group-hover:border-blue-300 shrink-0">
          <button
            v-if="!isReturnMode"
            class="text-gray-400 hover:text-red-600 transition-colors
                   font-bold text-lg leading-none hover:scale-125"
            @click="emit('remove-item', index)"
          >
            ×
          </button>
        </div>

      </div>

      <!-- ── Narration row ───────────────────────────────────────────────── -->
      <div
        class="flex items-start border-b border-gray-200 text-xs text-gray-700
               group pl-20 pr-2 py-1"
        :class="rowBg(index)"
      >
        <div class="flex-shrink-0 text-[10px] text-gray-600 uppercase
                    tracking-wide pt-1 font-semibold w-28">
          📝 Narration
        </div>
        <div class="flex-1 p-1 border-l border-gray-200 group-hover:border-blue-300">
          <textarea
            :value="item.narration || ''"
            placeholder="Add narration for this item"
            class="w-full text-xs bg-transparent border-b border-transparent
                   focus:bg-white focus:border-blue-500 outline-none px-1
                   min-h-[2.5rem] resize-y"
            @input="emit('update-narration', index, $event.target.value)"
          />
        </div>
      </div>

    </template>
  </template>
</template>