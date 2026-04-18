<script setup>
/**
 * BatchSelectionModal.vue
 * Sub-modal: shown when a stock item has multiple batches.
 * Location: app/components/sales/BatchSelectionModal.vue
 *
 * Replaces: batchModal.js → showBatchSelectionModal()
 *
 * Props
 *   open   {boolean}  v-model:open — controls visibility
 *   stock  {object}   the stock item whose batches to list
 *
 * Emits
 *   update:open          (false)  — close the modal
 *   select-batch         (stockWithBatch)  — a batch was chosen
 */

const props = defineProps({
  open:  { type: Boolean, required: true },
  stock: { type: Object,  default: () => ({}) },
})

const emit = defineEmits(['update:open', 'select-batch'])

// ── Computed ────────────────────────────────────────────────────────────────

const batches = computed(() => props.stock?.batches ?? [])

// ── Actions ─────────────────────────────────────────────────────────────────

function selectBatch(batch) {
  emit('select-batch', {
    ...props.stock,
    batch:  batch.batch,
    qty:    batch.qty,
    rate:   batch.rate,
    expiry: batch.expiry,
  })
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ width: 'max-w-lg' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-sm tracking-wide text-white">Select Batch</h3>
          <p class="text-slate-400 text-[10px] mt-0.5 truncate max-w-xs">
            {{ stock?.item }}
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="close"
        />
      </div>
    </template>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="p-4 space-y-2.5 max-h-96 overflow-y-auto bg-gray-50">

      <!-- Empty state -->
      <div
        v-if="batches.length === 0"
        class="text-center text-gray-400 py-8 italic text-sm"
      >
        No batch information available.
      </div>

      <!-- Batch cards -->
      <div
        v-for="(batch, idx) in batches"
        :key="idx"
        class="p-3 border border-gray-200 rounded-xl hover:border-blue-400
               hover:bg-blue-50/60 hover:shadow-sm cursor-pointer
               transition-all bg-white group"
        @click="selectBatch(batch)"
      >
        <div class="flex justify-between items-start gap-3">

          <!-- Left: details -->
          <div class="min-w-0 flex-1">
            <div class="font-bold text-gray-800 group-hover:text-blue-800">
              {{ batch.batch || 'No Batch' }}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500 mt-1.5">
              <span>
                Qty:
                <strong class="text-gray-700">{{ batch.qty }} {{ stock?.uom }}</strong>
              </span>
              <span>
                Rate:
                <strong class="text-gray-700">₹{{ batch.rate }}</strong>
              </span>
              <span v-if="batch.expiry">
                Expiry:
                <strong class="text-gray-700">{{ batch.expiry }}</strong>
              </span>
              <span v-if="batch.mrp">
                MRP:
                <strong class="text-gray-700">₹{{ batch.mrp }}</strong>
              </span>
            </div>
          </div>

          <!-- Right: available qty badge -->
          <div class="shrink-0 text-right">
            <div class="text-[10px] text-gray-400 uppercase tracking-wide">Available</div>
            <div
              class="font-bold text-lg"
              :class="Number(batch.qty) > 0 ? 'text-emerald-600' : 'text-red-500'"
            >
              {{ batch.qty }}
            </div>
          </div>

        </div>
      </div>

    </div>
  </UModal>
</template>