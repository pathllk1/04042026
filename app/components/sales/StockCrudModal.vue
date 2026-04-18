<script setup>
/**
 * StockCrudModal.vue
 * Create and edit stock items — single component with a `mode` prop.
 * Location: app/components/sales/StockCrudModal.vue
 *
 * Replaces: stockCrud.js → openCreateStockModal() + openEditStockModal()
 *
 * Props
 *   open   {boolean}          v-model:open
 *   mode   {'create'|'edit'}  default 'create'
 *   stock  {object|null}      required in edit mode; ignored in create mode
 *
 * Emits
 *   update:open
 *   saved   ()  — parent should refresh its stocks list after this fires
 *
 * POST /api/inventory/sales/stocks        → useApiWithAuth().post()
 * PUT  /api/inventory/sales/stocks/:id   → useApiWithAuth().put()
 */

import useApiWithAuth from '~/composables/auth/useApiWithAuth'

const props = defineProps({
  open:  { type: Boolean, required: true },
  mode:  { type: String,  default: 'create' },   // 'create' | 'edit'
  stock: { type: Object,  default: null },
})

const emit = defineEmits(['update:open', 'saved'])

const { post, put } = useApiWithAuth()
const toast         = useToast()

// ── Constants ─────────────────────────────────────────────────────────────────

const UOM_OPTIONS = ['NOS', 'PCS', 'SET', 'BOX', 'MTR', 'KGS'].map((u) => ({
  label: u, value: u,
}))

const GST_OPTIONS = [18, 12, 5, 28, 0].map((g) => ({
  label: `${g}%`, value: g,
}))

// ── Form state ────────────────────────────────────────────────────────────────

const saving = ref(false)

const form = reactive({
  item:       '',
  batch:      '',
  pno:        '',
  oem:        '',
  hsn:        '',
  qty:        '',
  uom:        'NOS',
  rate:       '',
  grate:      18,
  mrp:        '',
  expiryDate: '',
})

// ── Batch selection (edit mode with multiple batches) ─────────────────────────

const selectedBatchIndex = ref(null)   // null = not yet selected

const batchOptions = computed(() => {
  if (!Array.isArray(props.stock?.batches)) return []
  return props.stock.batches.map((b, idx) => ({
    label: `${b.batch || 'No Batch'}  ·  Qty: ${b.qty}  ·  Exp: ${b.expiry || 'N/A'}`,
    value: idx,
  }))
})

const selectedBatchDetail = computed(() => {
  if (selectedBatchIndex.value === null) return null
  return props.stock?.batches?.[selectedBatchIndex.value] ?? null
})

function onBatchSelect(idx) {
  selectedBatchIndex.value = idx
  const b = props.stock.batches[idx]
  if (!b) return
  form.batch      = b.batch      ?? ''
  form.qty        = b.qty        ?? ''
  form.rate       = b.rate       ?? ''
  form.mrp        = b.mrp        ?? ''
  form.expiryDate = b.expiry ? String(b.expiry).split('T')[0] : ''
}

// ── Initialise form on open ───────────────────────────────────────────────────

function initForm() {
  if (props.mode === 'create' || !props.stock) {
    Object.assign(form, {
      item: '', batch: '', pno: '', oem: '', hsn: '',
      qty: '', uom: 'NOS', rate: '', grate: 18, mrp: '', expiryDate: '',
    })
    selectedBatchIndex.value = null
    return
  }

  // Edit mode — prefill from stock
  const stock     = props.stock
  const firstBatch = Array.isArray(stock.batches) && stock.batches.length > 0
    ? stock.batches[0]
    : null

  Object.assign(form, {
    item:       stock.item        || '',
    batch:      firstBatch?.batch ?? stock.batch ?? '',
    pno:        stock.pno         || '',
    oem:        stock.oem         || '',
    hsn:        stock.hsn         || '',
    qty:        Number(stock.qty  || 0),
    uom:        stock.uom         || 'NOS',
    rate:       Number(stock.rate || 0),
    grate:      Number(stock.grate ?? 18),
    mrp:        stock.mrp         ? Number(stock.mrp) : '',
    expiryDate: stock.expiryDate  ? String(stock.expiryDate).split('T')[0] : '',
  })

  selectedBatchIndex.value = null
}

watch(() => props.open, (isOpen) => { if (isOpen) initForm() })

// ── Build payload ─────────────────────────────────────────────────────────────

function buildBatchesPayload(existingBatches) {
  // CREATE — no existing batches
  if (!existingBatches) {
    if (form.batch || form.expiryDate || form.mrp) {
      return [{
        batch:  form.batch      || null,
        qty:    parseFloat(form.qty)  || 0,
        rate:   parseFloat(form.rate) || 0,
        expiry: form.expiryDate || null,
        mrp:    form.mrp ? parseFloat(form.mrp) : null,
      }]
    }
    return undefined // no batch data — omit field
  }

  // EDIT — update the correct batch in the array
  const updated  = JSON.parse(JSON.stringify(existingBatches))
  const selIdx   = selectedBatchIndex.value
  let   targetIdx = -1

  if (selIdx !== null && selIdx >= 0 && selIdx < updated.length) {
    targetIdx = selIdx
  } else {
    targetIdx = updated.findIndex((b) => b.batch === (form.batch || null))
  }

  if (targetIdx !== -1) {
    updated[targetIdx].qty    = parseFloat(form.qty)  || updated[targetIdx].qty
    updated[targetIdx].rate   = parseFloat(form.rate) || updated[targetIdx].rate
    updated[targetIdx].expiry = form.expiryDate        || updated[targetIdx].expiry
    updated[targetIdx].mrp    = form.mrp
      ? parseFloat(form.mrp)
      : updated[targetIdx].mrp
  } else if (form.batch) {
    updated.push({
      batch:  form.batch,
      qty:    parseFloat(form.qty)  || 0,
      rate:   parseFloat(form.rate) || 0,
      expiry: form.expiryDate       || null,
      mrp:    form.mrp ? parseFloat(form.mrp) : null,
    })
  } else {
    // Fallback: update index 0
    updated[0].qty    = parseFloat(form.qty)  || updated[0].qty
    updated[0].rate   = parseFloat(form.rate) || updated[0].rate
    updated[0].expiry = form.expiryDate        || updated[0].expiry
    updated[0].mrp    = form.mrp ? parseFloat(form.mrp) : updated[0].mrp
  }

  return updated
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function onSubmit() {
  if (!form.item.trim()) {
    toast.add({ title: 'Item description is required', color: 'error' })
    return
  }
  if (!form.hsn.trim()) {
    toast.add({ title: 'HSN/SAC code is required', color: 'error' })
    return
  }

  saving.value = true
  try {
    if (props.mode === 'create') {
      await handleCreate()
    } else {
      await handleEdit()
    }
  } finally {
    saving.value = false
  }
}

async function handleCreate() {
  const batches = buildBatchesPayload(null)
  const payload = {
    item:       form.item.trim(),
    pno:        form.pno.trim()  || undefined,
    oem:        form.oem.trim()  || undefined,
    hsn:        form.hsn.trim(),
    qty:        parseFloat(form.qty)  || 0,
    uom:        form.uom,
    rate:       parseFloat(form.rate) || 0,
    grate:      parseFloat(form.grate) ?? 18,
    total:      ((parseFloat(form.qty) || 0) * (parseFloat(form.rate) || 0)).toFixed(2),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(batches ? { batches: JSON.stringify(batches) } : {}),
  }

  await post('/api/inventory/sales/stocks', payload)
  toast.add({ title: 'Stock item created successfully!', color: 'success' })
  emit('saved')
  emit('update:open', false)
}

async function handleEdit() {
  const stockId = props.stock.id || props.stock._id
  if (!stockId) {
    toast.add({ title: 'Invalid stock item — no ID found', color: 'error' })
    return
  }

  const existingBatches = Array.isArray(props.stock.batches) && props.stock.batches.length > 0
    ? props.stock.batches
    : null

  const batches = buildBatchesPayload(existingBatches)
  const payload = {
    item:       form.item.trim(),
    pno:        form.pno.trim()  || undefined,
    oem:        form.oem.trim()  || undefined,
    hsn:        form.hsn.trim(),
    qty:        parseFloat(form.qty)  || 0,
    uom:        form.uom,
    rate:       parseFloat(form.rate) || 0,
    grate:      parseFloat(form.grate) ?? 18,
    total:      ((parseFloat(form.qty) || 0) * (parseFloat(form.rate) || 0)).toFixed(2),
    updated_at: new Date().toISOString(),
    ...(batches ? { batches: JSON.stringify(batches) } : {}),
  }

  await put(`/api/inventory/sales/stocks/${stockId}`, payload)
  toast.add({ title: 'Stock item updated successfully!', color: 'success' })
  emit('saved')
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ width: 'max-w-2xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-sm tracking-wide uppercase">
            {{ mode === 'create' ? 'Create Stock Item' : 'Edit Stock Item' }}
          </h3>
          <p
            v-if="mode === 'edit' && stock"
            class="text-slate-400 text-[10px] mt-0.5 truncate max-w-[260px]"
          >
            {{ stock.item }}
          </p>
          <p v-else class="text-slate-400 text-[10px] mt-0.5">
            Fill in item details below
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

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="p-5 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto max-h-[72vh]">

      <!-- ── Batch selector (edit mode, multiple batches only) ──────────── -->
      <div
        v-if="mode === 'edit' && batchOptions.length > 1"
        class="col-span-2"
      >
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Select Batch to Edit
        </label>
        <USelect
          :model-value="selectedBatchIndex"
          :items="batchOptions"
          placeholder="— Select a batch to edit —"
          class="w-full"
          @update:model-value="onBatchSelect($event)"
        />

        <!-- Selected batch detail card -->
        <div
          v-if="selectedBatchDetail"
          class="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg
                 grid grid-cols-3 gap-2 text-xs text-gray-600"
        >
          <div>
            <span class="text-gray-400 uppercase text-[9px] tracking-wide block">Batch</span>
            <strong>{{ selectedBatchDetail.batch || 'No Batch' }}</strong>
          </div>
          <div>
            <span class="text-gray-400 uppercase text-[9px] tracking-wide block">Qty</span>
            <strong>{{ selectedBatchDetail.qty ?? '' }}</strong>
          </div>
          <div>
            <span class="text-gray-400 uppercase text-[9px] tracking-wide block">Rate</span>
            <strong>₹{{ selectedBatchDetail.rate ?? '' }}</strong>
          </div>
          <div>
            <span class="text-gray-400 uppercase text-[9px] tracking-wide block">Expiry</span>
            <strong>{{ selectedBatchDetail.expiry || 'N/A' }}</strong>
          </div>
          <div>
            <span class="text-gray-400 uppercase text-[9px] tracking-wide block">MRP</span>
            <strong>{{ selectedBatchDetail.mrp ? '₹' + selectedBatchDetail.mrp : 'N/A' }}</strong>
          </div>
        </div>
      </div>

      <!-- ── Item description ──────────────────────────────────────────────── -->
      <div class="col-span-2">
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Item Description *
        </label>
        <UInput
          v-model="form.item"
          placeholder="e.g. Dell Monitor 24 inch"
          class="w-full"
        />
      </div>

      <!-- ── Batch No ──────────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Batch No
        </label>
        <UInput v-model="form.batch" placeholder="Optional" class="w-full" />
      </div>

      <!-- ── Part No ───────────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Part No (P/No)
        </label>
        <UInput v-model="form.pno" class="w-full" />
      </div>

      <!-- ── OEM / Brand ───────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          OEM / Brand
        </label>
        <UInput v-model="form.oem" class="w-full" />
      </div>

      <!-- ── HSN/SAC ───────────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          HSN/SAC Code *
        </label>
        <UInput
          v-model="form.hsn"
          placeholder="Goods or services code"
          class="w-full"
        />
      </div>

      <!-- ── Qty + UOM ─────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
            {{ mode === 'create' ? 'Opening Qty *' : 'Qty *' }}
          </label>
          <UInput
            v-model="form.qty"
            type="number"
            step="0.01"
            placeholder="0.00"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
            UOM *
          </label>
          <USelect
            v-model="form.uom"
            :items="UOM_OPTIONS"
            class="w-full"
          />
        </div>
      </div>

      <!-- ── Selling Rate ──────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Selling Rate (₹) *
        </label>
        <UInput
          v-model="form.rate"
          type="number"
          step="0.01"
          class="w-full"
        />
      </div>

      <!-- ── GST % + MRP ───────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
            GST % *
          </label>
          <USelect
            v-model="form.grate"
            :items="GST_OPTIONS"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
            MRP
          </label>
          <UInput
            v-model="form.mrp"
            type="number"
            step="0.01"
            class="w-full"
          />
        </div>
      </div>

      <!-- ── Expiry Date ───────────────────────────────────────────────────── -->
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
          Expiry Date
        </label>
        <UInput
          v-model="form.expiryDate"
          type="date"
          class="w-full"
        />
      </div>

    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="saving"
          @click="$emit('update:open', false)"
        />
        <UButton
          :label="mode === 'create' ? 'Save Item' : 'Update Item'"
          color="neutral"
          variant="solid"
          :loading="saving"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>