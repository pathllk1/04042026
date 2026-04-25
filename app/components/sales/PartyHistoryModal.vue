<script setup>
/**
 * PartyHistoryModal.vue
 * Displays party-item purchase history with client-side pagination.
 * Location: app/components/sales/PartyHistoryModal.vue
 *
 * Replaces: historyModal.js → openPartyItemHistoryModal()
 *
 * Props
 *   open   {boolean}  v-model:open
 *   stock  {object}   the stock item whose history to fetch
 *   state  {object}   shared reactive sales state (for selectedParty + historyCache)
 *
 * Emits
 *   update:open  (false)
 */

import { ref, computed, watch } from 'vue'
import { getPartyId, isPartySelected, getHistoryCacheKey } from '~/utils/salesUtils'

const props = defineProps({
  open:  { type: Boolean, required: true },
  stock: { type: Object,  required: true },
  state: { type: Object,  required: true },
})

const emit = defineEmits(['update:open'])

const toast = useToast()

// ── Pagination state ─────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10
const currentPage    = ref(1)
const historyRows    = ref([])
const loading        = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────

const totalPages = computed(() =>
  Math.max(1, Math.ceil(historyRows.value.length / ITEMS_PER_PAGE)),
)

const pageRows = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return historyRows.value.slice(start, start + ITEMS_PER_PAGE)
})

const rangeLabel = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE + 1
  const end   = Math.min(currentPage.value * ITEMS_PER_PAGE, historyRows.value.length)
  return `Showing ${start}–${end} of ${historyRows.value.length}`
})

// Visible page buttons — up to 5 around currentPage
const pageButtons = computed(() => {
  const total = totalPages.value
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(currentPage.value - 2, total - 4))
  return Array.from({ length: 5 }, (_, i) => start + i)
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function loadHistory() {
  if (!isPartySelected(props.state.selectedParty)) {
    toast.add({ title: 'Please select a party first to view history.', color: 'error' })
    emit('update:open', false)
    return
  }

  const partyId  = getPartyId(props.state.selectedParty)
  const cacheKey = getHistoryCacheKey(partyId, props.stock.id)

  // Serve from cache if available — avoids a network round-trip every open
  if (props.state.historyCache[cacheKey]) {
    historyRows.value = props.state.historyCache[cacheKey]
    return
  }

  loading.value = true
  try {
    const response = await $fetch(
      `/api/inventory/sales/party-item-history?partyId=${partyId}&stockId=${props.stock.id}&limit=all`,
      { method: 'GET', credentials: 'include' },
    )

    if (response.success && Array.isArray(response.data?.rows)) {
      const rows = response.data.rows.map((row) => ({
        date:  row.bdate ? new Date(row.bdate).toLocaleDateString('en-IN') : '-',
        batch: row.batch || '-',
        qty:   row.qty   || 0,
        rate:  row.rate  || 0,
        total: ((row.qty || 0) * (row.rate || 0)).toFixed(2),
        refNo: row.bno   || '-',
      }))

      historyRows.value = rows
      // Store in cache so subsequent opens are instant
      props.state.historyCache[cacheKey] = rows
    }
  } catch (err) {
    console.error('Error fetching history:', err)
    toast.add({ title: 'Failed to load history', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── Pagination actions ────────────────────────────────────────────────────────

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function goToPage(page) {
  currentPage.value = page
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

// Reset pagination and load fresh data each time the modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      currentPage.value = 1
      historyRows.value = []
      loadHistory()
    }
  },
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ width: 'max-w-4xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-base text-gray-800">
            {{ stock.item }} — History
          </h3>
          <p class="text-xs text-gray-500 mt-0.5">
            Party:
            <strong>{{ state.selectedParty?.supply }}</strong>
            <span
              v-if="historyRows.length > 0"
              class="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-mono"
            >
              {{ historyRows.length }} records
            </span>
          </p>
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

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center p-16 text-gray-400"
    >
      <div class="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
      <span class="text-sm">Loading history…</span>
    </div>

    <!-- History table -->
    <div v-else class="flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto max-h-[55vh]">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase
                        tracking-wider sticky top-0 border-b border-gray-200">
            <tr>
              <th class="p-2.5">Date</th>
              <th class="p-2.5">Batch</th>
              <th class="p-2.5 text-right">Qty</th>
              <th class="p-2.5 text-right">Rate</th>
              <th class="p-2.5 text-right">Total</th>
              <th class="p-2.5">Ref No</th>
            </tr>
          </thead>

          <tbody class="bg-white divide-y divide-gray-50">
            <!-- Empty state -->
            <tr v-if="pageRows.length === 0">
              <td colspan="6" class="p-10 text-center text-gray-300 italic text-sm">
                No purchase history found
              </td>
            </tr>

            <!-- Data rows -->
            <tr
              v-for="(record, idx) in pageRows"
              :key="idx"
              class="hover:bg-blue-50/60 transition-colors border-b border-gray-50"
            >
              <td class="p-2.5 text-gray-600">{{ record.date }}</td>
              <td class="p-2.5 font-mono text-gray-400 text-[11px]">{{ record.batch }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ record.qty }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ record.rate }}</td>
              <td class="p-2.5 text-right font-semibold tabular-nums text-gray-800">
                {{ record.total }}
              </td>
              <td class="p-2.5 text-gray-400 font-mono text-[11px]">{{ record.refNo }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Pagination bar ─────────────────────────────────────────────── -->
      <div
        v-if="historyRows.length > ITEMS_PER_PAGE"
        class="px-4 py-2.5 border-t border-gray-200 bg-gray-50
               flex justify-between items-center text-xs shrink-0"
      >
        <span class="text-gray-500">{{ rangeLabel }}</span>

        <div class="flex items-center gap-1">
          <!-- Prev -->
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="xs"
            :disabled="currentPage === 1"
            @click="prevPage"
          />

          <!-- Page numbers -->
          <UButton
            v-for="page in pageButtons"
            :key="page"
            :label="String(page)"
            :color="page === currentPage ? 'primary' : 'neutral'"
            :variant="page === currentPage ? 'solid' : 'outline'"
            size="xs"
            @click="goToPage(page)"
          />

          <!-- Next -->
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="xs"
            :disabled="currentPage === totalPages"
            @click="nextPage"
          />
        </div>
      </div>
    </div>
    </template>
  </UModal>
</template>