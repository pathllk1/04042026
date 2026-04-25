<script setup>
/**
 * StockSelectionModal.vue
 * Stock / item selection modal with search, batch handling, edit, and history.
 * Location: app/components/sales/StockSelectionModal.vue
 *
 * Replaces: stockModal.js → openStockModal() + renderStockRows()
 *
 * The original stored only the stock ID in a data-attribute and looked up the
 * full object on click to avoid broken JSON in HTML attributes (items whose
 * names contain quotes). Here we use v-for directly over the filtered array —
 * no data-attribute serialisation needed at all.
 *
 * Props
 *   open   {boolean}  v-model:open
 *   state  {object}   shared reactive sales state (stocks[])
 *
 * Emits
 *   update:open
 *   select-stock   (stock, needsBatchSelection: boolean)
 *   edit-stock     (stock)
 *   view-history   (stock)
 *   create-stock   ()
 */

import { ref, computed, watch } from 'vue'

const props = defineProps({
  open:  { type: Boolean, required: true },
  state: { type: Object,  required: true },
})

const emit = defineEmits([
  'update:open',
  'select-stock',
  'edit-stock',
  'view-history',
  'create-stock',
])

// ── Search ───────────────────────────────────────────────────────────────────

const searchTerm = ref('')

const filteredStocks = computed(() => {
  const term = searchTerm.value.toLowerCase().trim()
  if (!term) return props.state.stocks

  return props.state.stocks.filter((s) =>
    (s.item  && s.item.toLowerCase().includes(term))  ||
    (s.batch && s.batch.toLowerCase().includes(term)) ||
    (s.oem   && s.oem.toLowerCase().includes(term))   ||
    (s.hsn   && s.hsn.toLowerCase().includes(term))   ||
    (Array.isArray(s.batches) && s.batches.some(
      (b) =>
        (b.batch  && b.batch.toLowerCase().includes(term)) ||
        (b.expiry && b.expiry.toLowerCase().includes(term)),
    )),
  )
})

// ── Batch label helper ────────────────────────────────────────────────────────

function batchLabel(stock) {
  if (!Array.isArray(stock.batches) || stock.batches.length === 0) return null
  if (stock.batches.length === 1) return stock.batches[0].batch || 'No Batch'
  return null  // multiple — handled by badge
}

function batchCount(stock) {
  return Array.isArray(stock.batches) ? stock.batches.length : 0
}

// ── Actions ───────────────────────────────────────────────────────────────────

function onSelectStock(stock) {
  if (batchCount(stock) > 1) {
    // Multiple batches — parent opens BatchSelectionModal
    emit('select-stock', stock, true)
  } else if (batchCount(stock) === 1) {
    const b = stock.batches[0]
    emit('select-stock', { ...stock, batch: b.batch, qty: b.qty, rate: b.rate }, false)
  } else {
    emit('select-stock', stock, false)
  }
  emit('update:open', false)
}

function onEditStock(stock) {
  emit('edit-stock', stock)
  emit('update:open', false)
}

function onViewHistory(stock) {
  emit('view-history', stock)
  emit('update:open', false)
}

// ── Reset on open ────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => { if (isOpen) searchTerm.value = '' },
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
      <div class="flex items-center justify-between w-full gap-3">
        <h3 class="font-bold text-sm text-gray-800 shrink-0 uppercase tracking-wide">
          Item Selection
        </h3>

        <div class="flex items-center gap-2 flex-1 justify-end">
          <!-- Search -->
          <UInput
            v-model="searchTerm"
            placeholder="Search item, batch, OEM, HSN…"
            icon="i-lucide-search"
            size="sm"
            class="flex-1 max-w-sm"
            autofocus
          />

          <!-- New item -->
          <UButton
            icon="i-lucide-plus"
            label="New Item"
            size="sm"
            color="success"
            @click="$emit('create-stock'); $emit('update:open', false)"
          />

          <!-- Close -->
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="$emit('update:open', false)"
          />
        </div>
      </div>
    </template>

    <template #body>
    <!-- ── Body — stock table ─────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto max-h-[65vh]">
      <table class="w-full text-left border-collapse">
        <!-- Table head -->
        <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase
                      tracking-wider sticky top-0 border-b border-gray-200 z-10">
          <tr>
            <th class="p-2.5">Item Description</th>
            <th class="p-2.5">Batch / Batches</th>
            <th class="p-2.5">OEM</th>
            <th class="p-2.5 text-right">Available</th>
            <th class="p-2.5 text-right">Rate</th>
            <th class="p-2.5 text-right">GST %</th>
            <th class="p-2.5 text-center">Actions</th>
          </tr>
        </thead>

        <!-- Table body -->
        <tbody class="text-xs divide-y divide-gray-100 bg-white">

          <!-- Empty state -->
          <tr v-if="filteredStocks.length === 0">
            <td colspan="7" class="p-12 text-center text-gray-300 italic text-sm">
              No items match your search.
            </td>
          </tr>

          <!-- Stock rows -->
          <tr
            v-for="stock in filteredStocks"
            :key="stock.id || stock._id"
            class="hover:bg-blue-50/40 transition-colors group"
          >
            <!-- Item description -->
            <td class="p-2.5 font-semibold text-blue-900 max-w-[200px]">
              <div class="truncate" :title="stock.item">{{ stock.item }}</div>
              <div
                v-if="stock.pno"
                class="text-[10px] text-gray-400 font-normal font-mono"
              >
                {{ stock.pno }}
              </div>
            </td>

            <!-- Batch -->
            <td class="p-2.5">
              <!-- Multiple batches -->
              <span
                v-if="batchCount(stock) > 1"
                class="bg-blue-50 text-blue-600 border border-blue-100
                       px-1.5 py-0.5 rounded text-[10px] font-mono"
              >
                {{ batchCount(stock) }} batches
              </span>
              <!-- Single batch -->
              <span
                v-else-if="batchCount(stock) === 1"
                class="font-mono"
              >
                {{ batchLabel(stock) }}
              </span>
              <!-- No batch -->
              <span v-else class="text-gray-400">—</span>
            </td>

            <!-- OEM -->
            <td class="p-2.5 text-gray-400 text-[11px]">
              {{ stock.oem || '—' }}
            </td>

            <!-- Available qty -->
            <td
              class="p-2.5 text-right font-bold tabular-nums"
              :class="(Number(stock.qty) || 0) > 0 ? 'text-emerald-600' : 'text-red-500'"
            >
              {{ stock.qty }}
              <span class="font-normal text-[10px]">{{ stock.uom }}</span>
            </td>

            <!-- Rate -->
            <td class="p-2.5 text-right font-mono tabular-nums text-gray-700">
              {{ stock.rate }}
            </td>

            <!-- GST % -->
            <td class="p-2.5 text-right text-gray-500">
              {{ stock.grate }}%
            </td>

            <!-- Action buttons -->
            <td class="p-2.5">
              <div class="flex items-center justify-center gap-1">
                <UButton
                  label="EDIT"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click.stop="onEditStock(stock)"
                />
                <UButton
                  label="HIST"
                  size="xs"
                  color="warning"
                  variant="outline"
                  @click.stop="onViewHistory(stock)"
                />
                <UButton
                  label="ADD +"
                  size="xs"
                  color="primary"
                  variant="soft"
                  @click.stop="onSelectStock(stock)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </UModal>
</template>