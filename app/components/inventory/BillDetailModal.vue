<script setup>
/**
 * BillDetailModal.vue
 * Full bill details modal — party info, items, financials, tax breakdown,
 * other charges, cancel bill flow, download PDF/Excel, edit, return.
 * Location: app/components/inventory/BillDetailModal.vue
 *
 * Props
 *   open    boolean   v-model:open
 *   billId  string    MongoDB _id to fetch
 *   allBills array    Full bills list (to resolve btype before fetching)
 *
 * Emits
 *   update:open
 *   cancelled  (billId)  — parent should refresh list
 *   edit       (billId, btype)
 *   return     (billId, btype)
 */

import useApiWithAuth from '~/composables/auth/useApiWithAuth'

const props = defineProps({
  open:     { type: Boolean, required: true },
  billId:   { type: String,  default: null },
  allBills: { type: Array,   default: () => [] },
})

const emit  = defineEmits(['update:open', 'cancelled', 'edit', 'return'])
const toast = useToast()
const { put } = useApiWithAuth()

// ── Bill data ─────────────────────────────────────────────────────────────────

const bill    = ref(null)
const loading = ref(false)
const error   = ref(null)

async function fetchBill(id) {
  if (!id) return
  loading.value = true
  error.value   = null
  bill.value    = null

  try {
    const billMeta   = props.allBills.find(b => b._id === id || b.id === id)
    const btype      = (billMeta?.btype || 'SALES').toUpperCase()
    const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales'

    const data = await $fetch(`/api/inventory/${apiSegment}/bills/${id}`, {
      method: 'GET', credentials: 'include',
    })
    bill.value = data.success ? data.data : data
  } catch (err) {
    error.value = err.message || 'Failed to load bill details'
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen && props.billId) {
    fetchBill(props.billId)
    resetCancelForm()
  }
})

// ── Computed helpers ──────────────────────────────────────────────────────────

const isCancelled = computed(() => (bill.value?.status || 'ACTIVE') === 'CANCELLED')
const taxAmount   = computed(() => (bill.value?.cgst || 0) + (bill.value?.sgst || 0) + (bill.value?.igst || 0))

function formatCurrency(n) {
  return '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const typeBadgeClass = computed(() => {
  const t = (bill.value?.btype || 'SALES').toUpperCase()
  if (t === 'PURCHASE')    return 'bg-purple-100 text-purple-700'
  if (t === 'CREDIT_NOTE') return 'bg-amber-100 text-amber-700'
  if (t === 'DEBIT_NOTE')  return 'bg-slate-100 text-slate-700'
  return 'bg-teal-100 text-teal-700'
})

const typeLabel = computed(() => {
  const t = (bill.value?.btype || 'SALES').toUpperCase()
  if (t === 'PURCHASE')    return 'PURCHASE'
  if (t === 'CREDIT_NOTE') return 'CREDIT NOTE'
  if (t === 'DEBIT_NOTE')  return 'DEBIT NOTE'
  return 'SALES'
})

// ── Cancel bill ───────────────────────────────────────────────────────────────

const showCancelForm   = ref(false)
const cancelReason     = ref('')
const cancelRemarks    = ref('')
const cancelling       = ref(false)

const CANCEL_REASONS = [
  { label: 'Customer Request',    value: 'CUSTOMER_REQUEST'  },
  { label: 'Data Entry Error',    value: 'DATA_ENTRY_ERROR'  },
  { label: 'Duplicate Bill',      value: 'DUPLICATE_BILL'    },
  { label: 'Billing Error',       value: 'BILLING_ERROR'     },
  { label: 'Other',               value: 'OTHER'             },
]

function resetCancelForm() {
  showCancelForm.value = false
  cancelReason.value   = ''
  cancelRemarks.value  = ''
}

async function confirmCancel() {
  if (!cancelReason.value) {
    toast.add({ title: 'Please select a cancellation reason', color: 'error' })
    return
  }
  if (!confirm('Are you sure you want to cancel this bill? This cannot be undone.')) return

  cancelling.value = true
  try {
    const btype      = (bill.value?.btype || 'SALES').toUpperCase()
    const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales'

    await put(`/api/inventory/${apiSegment}/bills/${props.billId}/cancel`, {
      reason:  cancelReason.value,
      remarks: cancelRemarks.value,
    })

    toast.add({ title: 'Bill cancelled successfully', color: 'success' })
    if (bill.value) bill.value.status = 'CANCELLED'
    showCancelForm.value = false
    emit('cancelled', props.billId)
  } catch (err) {
    toast.add({ title: 'Failed to cancel: ' + (err.message || 'Server error'), color: 'error' })
  } finally {
    cancelling.value = false
  }
}

// ── Downloads ─────────────────────────────────────────────────────────────────

async function downloadBlob(url, filename) {
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob    = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href     = blobUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    toast.add({ title: 'Download failed: ' + err.message, color: 'error' })
  }
}

function downloadPdf() {
  const btype      = (bill.value?.btype || 'SALES').toUpperCase()
  const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales'
  downloadBlob(
    `/api/inventory/${apiSegment}/bills/${props.billId}/pdf`,
    `Invoice_${bill.value?.bno || props.billId}.pdf`,
  )
}

function downloadExcel() {
  const btype      = (bill.value?.btype || 'SALES').toUpperCase()
  const apiSegment = btype === 'PURCHASE' ? 'purchase' : 'sales'
  downloadBlob(
    `/api/inventory/${apiSegment}/bills/${props.billId}/excel`,
    `Invoice_${bill.value?.bno || props.billId}.xlsx`,
  )
}

function printBill() {
  window.print()
}

// ── Edit / Return ─────────────────────────────────────────────────────────────

function editBill() {
  const btype = (bill.value?.btype || 'SALES').toUpperCase()
  emit('edit', props.billId, btype)
}

function returnBill() {
  const btype = (bill.value?.btype || 'SALES').toUpperCase()
  emit('return', props.billId, btype)
}
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
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <UIcon name="i-lucide-file-text" class="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-white">Bill Details</h3>
            <p class="text-xs text-slate-400">Read-only view</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            <kbd class="px-1.5 py-0.5 bg-slate-600 border border-slate-500 rounded font-mono text-xs text-slate-300">Esc</kbd>
            close
          </span>
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

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="p-4 space-y-4 overflow-y-auto max-h-[75vh]">

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-10 text-gray-400">
        <div class="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mr-2" />
        Loading bill details…
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-8 text-red-500 text-sm">
        {{ error }}
      </div>

      <!-- Bill content -->
      <template v-else-if="bill">

        <!-- Meta grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bill No</p>
            <p class="text-sm font-bold text-gray-900 font-mono">{{ bill.bno || '—' }}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
            <p class="text-sm font-semibold text-gray-900">{{ formatDate(bill.bdate) }}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</p>
            <div class="flex flex-col gap-1">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold w-fit"
                :class="typeBadgeClass"
              >
                {{ typeLabel }}
              </span>
              <button
                v-if="bill.ref_bill_id"
                class="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold text-left"
                @click="$emit('update:open', false); $nextTick(() => $emit('update:open', true))"
              >
                Ref: {{ bill.ref_bill_id }}
              </button>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</p>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
              :class="isCancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="isCancelled ? 'bg-red-500' : 'bg-green-500'"
              />
              {{ isCancelled ? 'CANCELLED' : 'ACTIVE' }}
            </span>
          </div>
        </div>

        <!-- Party info -->
        <div class="border border-gray-200 rounded-lg overflow-hidden">
          <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Party Information</h4>
          </div>
          <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-gray-500 mb-0.5">Party Name</p>
              <p class="font-medium text-gray-900">{{ bill.supply || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-0.5">GSTIN</p>
              <p class="font-mono text-gray-900">{{ bill.gstin || 'UNREGISTERED' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-0.5">Address</p>
              <p class="text-gray-900">{{ bill.addr || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-0.5">State</p>
              <p class="text-gray-900">{{ bill.state || '—' }}</p>
            </div>
          </div>
        </div>

        <!-- Items table -->
        <div class="border border-gray-200 rounded-lg overflow-hidden">
          <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bill Items</h4>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-100 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <template v-if="bill.items && bill.items.length">
                  <tr
                    v-for="(item, idx) in bill.items"
                    :key="idx"
                    class="hover:bg-gray-50"
                  >
                    <td class="px-3 py-2 text-xs font-medium text-gray-900">{{ item.item || '—' }}</td>
                    <td class="px-3 py-2 text-xs text-gray-500">
                      {{ (item.item_type || 'GOODS') === 'SERVICE' ? '—' : (item.batch || '—') }}
                    </td>
                    <td class="px-3 py-2 text-xs text-right font-mono text-gray-700">
                      {{ (item.item_type === 'SERVICE' && item.show_qty === false) ? '—' : (item.qty || 0) }}
                    </td>
                    <td class="px-3 py-2 text-xs text-right font-mono text-gray-700">
                      {{ formatCurrency(item.rate) }}
                    </td>
                    <td class="px-3 py-2 text-xs text-right font-mono font-semibold text-gray-900">
                      {{ formatCurrency(item.total) }}
                    </td>
                  </tr>
                </template>
                <tr v-else>
                  <td colspan="5" class="px-3 py-4 text-center text-xs text-gray-400">No items found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Financials -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
            <p class="text-xs text-blue-600 font-medium mb-1">Taxable</p>
            <p class="text-base font-bold text-blue-900">{{ formatCurrency(bill.gtot) }}</p>
          </div>
          <div class="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
            <p class="text-xs text-orange-600 font-medium mb-1">Tax</p>
            <p class="text-base font-bold text-orange-900">{{ formatCurrency(taxAmount) }}</p>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p class="text-xs text-green-600 font-medium mb-1">Grand Total</p>
            <p class="text-base font-bold text-green-700">{{ formatCurrency(bill.ntot) }}</p>
          </div>
        </div>

        <!-- Tax breakdown -->
        <div class="border border-gray-200 rounded-lg overflow-hidden">
          <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tax Breakdown</h4>
          </div>
          <div class="p-3 grid grid-cols-3 gap-2">
            <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
              <span class="text-xs font-medium text-blue-700">CGST</span>
              <span class="text-xs font-bold text-blue-900">{{ formatCurrency(bill.cgst) }}</span>
            </div>
            <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
              <span class="text-xs font-medium text-blue-700">SGST</span>
              <span class="text-xs font-bold text-blue-900">{{ formatCurrency(bill.sgst) }}</span>
            </div>
            <div class="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
              <span class="text-xs font-medium text-blue-700">IGST</span>
              <span class="text-xs font-bold text-blue-900">{{ formatCurrency(bill.igst) }}</span>
            </div>
          </div>
        </div>

        <!-- Other charges -->
        <div
          v-if="bill.other_charges && bill.other_charges.length"
          class="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Other Charges</h4>
          </div>
          <div class="p-3 space-y-1.5">
            <div
              v-for="(charge, idx) in bill.other_charges"
              :key="idx"
              class="flex justify-between items-center px-3 py-2 bg-gray-50 rounded
                     border border-gray-100 text-xs"
            >
              <span class="font-medium text-gray-700">{{ charge.name || charge.type }}</span>
              <span class="font-bold text-gray-900 font-mono">{{ formatCurrency(charge.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- Cancel bill section -->
        <div v-if="!isCancelled">
          <div class="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
            <div class="flex items-center justify-between px-3 py-2 border-b border-red-200 bg-red-100">
              <h4 class="text-xs font-semibold text-red-800 uppercase tracking-wide">Cancel Bill</h4>
              <UButton
                :icon="showCancelForm ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                color="error"
                variant="ghost"
                size="xs"
                @click="showCancelForm = !showCancelForm"
              />
            </div>

            <div v-if="showCancelForm" class="p-3 space-y-3">
              <div>
                <label class="block text-xs font-medium text-red-700 mb-1">
                  Cancellation Reason <span class="text-red-500">*</span>
                </label>
                <USelect
                  v-model="cancelReason"
                  :items="CANCEL_REASONS"
                  placeholder="Select a reason…"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-red-700 mb-1">Remarks / Notes</label>
                <UTextarea
                  v-model="cancelRemarks"
                  :rows="2"
                  placeholder="Additional notes about the cancellation…"
                  class="w-full"
                />
              </div>
              <div class="flex items-center gap-2 pt-1">
                <UButton
                  label="Confirm Cancellation"
                  icon="i-lucide-check"
                  color="error"
                  size="xs"
                  :loading="cancelling"
                  @click="confirmCancel"
                />
                <UButton
                  label="Dismiss"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="showCancelForm = false; resetCancelForm()"
                />
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>

    <!-- ── Footer actions ─────────────────────────────────────────────────── -->
    <template #footer>
      <div class="flex flex-wrap items-center gap-2 justify-between w-full">

        <!-- Left actions -->
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="bill && !isCancelled"
            label="Cancel Bill"
            icon="i-lucide-x"
            color="error"
            variant="soft"
            size="xs"
            @click="showCancelForm = !showCancelForm"
          />
          <UButton
            v-if="bill && !isCancelled"
            label="Edit"
            icon="i-lucide-pencil"
            color="warning"
            variant="soft"
            size="xs"
            @click="editBill"
          />
          <UButton
            v-if="bill && !isCancelled && ['SALES', 'PURCHASE'].includes((bill.btype || '').toUpperCase())"
            label="Return"
            color="warning"
            variant="soft"
            size="xs"
            @click="returnBill"
          />
        </div>

        <!-- Right actions -->
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="bill"
            label="Print"
            icon="i-lucide-printer"
            color="neutral"
            variant="outline"
            size="xs"
            @click="printBill"
          />
          <UButton
            v-if="bill"
            label="PDF"
            icon="i-lucide-download"
            color="primary"
            size="xs"
            @click="downloadPdf"
          />
          <UButton
            v-if="bill"
            label="Excel"
            icon="i-lucide-download"
            color="success"
            size="xs"
            @click="downloadExcel"
          />
          <UButton
            label="Close"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            size="xs"
            @click="$emit('update:open', false)"
          />
        </div>

      </div>
    </template>
  </UModal>
</template>