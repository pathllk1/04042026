<script setup>
/**
 * pages/inventory/sls/index.vue
 * Sales Invoice system — main orchestrator page.
 * Location: app/pages/inventory/sls/index.vue
 *
 * Replaces: index.js → initSalesSystem()
 *
 * Composes:
 *   useSalesState()      — reactive state, data fetching, bill loading
 *   useCart()            — cart mutations
 *   useOtherCharges()    — other-charges mutations
 *   useInvoiceExport()   — CSV / PDF / Excel download
 *   useApiWithAuth()     — CSRF-protected POST / PUT for save
 *
 * Child components (all in app/components/sales/):
 *   PartyCard, InvoiceItemsList, InvoiceTotals
 *   PartySelectionModal, PartyCreateModal
 *   StockSelectionModal, BatchSelectionModal
 *   StockCrudModal, OtherChargesModal, PartyHistoryModal
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSalesState }     from '~/composables/sales/useSalesState'
import { useCart }           from '~/composables/sales/useCart'
import { useOtherCharges }   from '~/composables/sales/useOtherCharges'
import { useInvoiceExport }  from '~/composables/sales/useInvoiceExport'
import { getPartyId, populateConsigneeFromBillTo } from '~/utils/salesUtils'
import useApiWithAuth         from '~/composables/auth/useApiWithAuth'

// Components
import PartyCard from '~/components/sales/PartyCard.vue'
import InvoiceItemsList from '~/components/sales/InvoiceItemsList.vue'
import InvoiceTotals from '~/components/sales/InvoiceTotals.vue'
import PartySelectionModal from '~/components/sales/PartySelectionModal.vue'
import PartyCreateModal from '~/components/sales/PartyCreateModal.vue'
import StockSelectionModal from '~/components/sales/StockSelectionModal.vue'
import BatchSelectionModal from '~/components/sales/BatchSelectionModal.vue'
import StockCrudModal from '~/components/sales/StockCrudModal.vue'
import OtherChargesModal from '~/components/sales/OtherChargesModal.vue'
import PartyHistoryModal from '~/components/sales/PartyHistoryModal.vue'

// ── Page meta ─────────────────────────────────────────────────────────────────

definePageMeta({ layout: 'default' })

// ── Route / mode detection ────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const OBJECTID_RE = /^[a-f\d]{24}$/i

function resolveMode() {
  const qEdit   = route.query.edit || (process.client ? sessionStorage.getItem('editBillId') : '') || ''
  const qReturn = route.query.returnFrom || (process.client ? sessionStorage.getItem('returnFromBillId') : '') || ''

  if (qReturn && OBJECTID_RE.test(qReturn)) {
    return { mode: 'return', billId: qReturn }
  }
  if (qEdit && OBJECTID_RE.test(qEdit)) {
    return { mode: 'edit', billId: qEdit }
  }
  return { mode: 'new', billId: null }
}

const { mode, billId: modeBillId } = resolveMode()
const isEditMode   = mode === 'edit'
const isReturnMode = mode === 'return'
const editBillId   = isEditMode   ? modeBillId : null
const returnBillId = isReturnMode ? modeBillId : null

// ── Composables ───────────────────────────────────────────────────────────────

const {
  state,
  fetchCurrentUserFirmName,
  fetchData,
  loadExistingBillData,
  syncConsigneeFromBillTo,
  resetState,
  determineGstBillType,
} = useSalesState()

state.isReturnMode    = isReturnMode
state.returnFromBillId = returnBillId

const cart          = useCart(state)
const otherCharges  = useOtherCharges(state)
const invoiceExport = useInvoiceExport(state)
const { post, put } = useApiWithAuth()

// ── Page loading state ────────────────────────────────────────────────────────

const pageLoading = ref(true)
const pageError   = ref(null)
const saving      = ref(false)

// ── Modal visibility refs ─────────────────────────────────────────────────────

const showStockModal    = ref(false)
const showPartyModal    = ref(false)
const showPartyCreate   = ref(false)
const showChargesModal  = ref(false)

// Batch sub-modal
const showBatchModal    = ref(false)
const pendingBatchStock = ref(null)

// History modal
const showHistoryModal  = ref(false)
const historyStock      = ref(null)

// Stock CRUD modal
const showStockCrud  = ref(false)
const stockCrudMode  = ref('create')
const editingStock   = ref(null)

// Save-confirmation modal
const showSaveConfirm = ref(false)
const savedBillId     = ref(null)
const savedBillNo     = ref('')

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  pageLoading.value = true
  pageError.value   = null

  try {
    // Always fetch firm name/locations first — needed for bill-type detection
    await fetchCurrentUserFirmName()

    if (isReturnMode && returnBillId) {
      sessionStorage.removeItem('returnFromBillId')
      await loadExistingBillData(returnBillId)
      cart.prepareCartForReturn()
    } else if (isEditMode && editBillId) {
      sessionStorage.removeItem('editBillId')
      await loadExistingBillData(editBillId)
    }

    await fetchData()

    // Auto-detect bill type from loaded party vs firm state
    if (state.selectedParty) autoSetBillType()

  } catch (err) {
    console.error('Sales system init error:', err)
    pageError.value = err.message || 'Failed to load sales system'
  } finally {
    pageLoading.value = false
  }
}

onMounted(() => {
  init()
  
  // Listen for firm updates from GlobalSettingsPopup
  if (process.client) {
    window.addEventListener('firm-updated', async () => {
      console.log('[SALES] Firm updated, refreshing...')
      await fetchCurrentUserFirmName()
      await fetchData()
    })
  }
})

// ── Bill-type auto detection ──────────────────────────────────────────────────

function autoSetBillType() {
  const detected = determineGstBillType(
    state.activeFirmLocation,
    state.selectedParty,
    state.selectedPartyLocation,
  )
  if (detected) state.meta.billType = detected
}

// ── Firm GSTIN selector ───────────────────────────────────────────────────────

const firmGstinItems = computed(() => {
  return state.firmLocations.map((l) => ({
    label: `${l.gst_number || 'No GSTIN'} — ${l.state || l.state_code || ''}${l.is_default ? ' (Default)' : ''}`,
    value: l.gst_number || '',
  }))
})

const activeFirmGstin = computed({
  get: () => {
    return state.activeFirmLocation?.gst_number || ''
  },
  set: (val) => {
    state.activeFirmLocation = state.firmLocations.find((l) => l.gst_number === val) || null
    autoSetBillType()
  },
})

// ── Party selection ───────────────────────────────────────────────────────────

function onPartySelected(party) {
  state.selectedParty = party
  state.historyCache  = {}
  autoSetBillType()
  if (state.consigneeSameAsBillTo) syncConsigneeFromBillTo()
}

function onPartySaved(newParty) {
  state.parties.push(newParty)
  onPartySelected(newParty)
  showPartyCreate.value = false
  showPartyModal.value  = false
}

// ── Stock modal flow ──────────────────────────────────────────────────────────

function onSelectStock(stock, needsBatch) {
  if (needsBatch) {
    pendingBatchStock.value = stock
    showBatchModal.value    = true
  } else {
    cart.addItemToCart(stock)
  }
}

function onBatchSelected(stockWithBatch) {
  cart.addItemToCart(stockWithBatch)
  showBatchModal.value = false
}

function onEditStock(stock) {
  editingStock.value   = stock
  stockCrudMode.value  = 'edit'
  showStockCrud.value  = true
}

function onViewHistory(stock) {
  historyStock.value    = stock
  showHistoryModal.value = true
}

async function onStockSaved() {
  showStockCrud.value = false
  // Refresh stocks list
  try {
    const data = await $fetch('/api/inventory/sls/stocks', {
      method: 'GET', credentials: 'include',
    })
    if (data.success && Array.isArray(data.data)) state.stocks = data.data
  } catch (err) {
    console.warn('Could not refresh stocks:', err)
  }
  // Re-open stock modal so user can add the new item immediately
  showStockModal.value = true
}

// ── Service autocomplete apply ────────────────────────────────────────────────

function onApplyService(idx, service) {
  const item = state.cart[idx]
  if (!item) return
  item.item  = service.item
  item.hsn   = service.hsn   || ''
  item.uom   = service.uom   || ''
  item.rate  = service.rate  || 0
  item.grate = service.grate || 0
}

// ── Cart event handlers ───────────────────────────────────────────────────────

function onUpdateItem(idx, field, value) {
  cart.updateCartItem(idx, field, value)
}

function onUpdateNarration(idx, value) {
  cart.updateCartItemNarration(idx, value)
}

function onRemoveItem(idx) {
  cart.removeItemFromCart(idx)
}

// ── Other charges ─────────────────────────────────────────────────────────────

function onAddCharge(charge)    { otherCharges.addOtherCharge(charge) }
function onRemoveCharge(idx) { otherCharges.removeOtherCharge(idx) }

// ── Add service line ──────────────────────────────────────────────────────────

function addServiceLine() {
  cart.addServiceToCart()
  // Focus the new service input after Vue renders
  nextTick(() => {
    const idx   = state.cart.length - 1
    const input = document.querySelector(
      `[data-service-idx="${idx}"]`,
    )
    input?.focus()
  })
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function onReset() {
  if (!confirm('Clear current invoice details?')) return
  resetState()
}

// ── Consignee toggle ──────────────────────────────────────────────────────────

function onConsigneeSameToggle(val) {
  state.consigneeSameAsBillTo = val
  if (val) syncConsigneeFromBillTo()
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveBill() {
  // Validate
  if (state.cart.length === 0) {
    toast.add({ title: 'Cannot save an empty invoice. Please add items.', color: 'error' })
    return
  }
  if (isReturnMode) {
    const hasReturn = state.cart.some((i) => (i.returnQty || 0) > 0)
    if (!hasReturn) {
      toast.add({ title: 'Please enter return quantities for at least one item.', color: 'error' })
      return
    }
  }
  if (!state.selectedParty) {
    toast.add({ title: 'Please select a party before saving.', color: 'error' })
    return
  }

  // Confirm for edit / return
  if (isEditMode && !confirm(
    '⚠️ Edit Bill Confirmation\n\nEditing this bill will:\n• Update stock quantities\n• Recalculate GST and totals\n• Update accounting ledger entries\n\nThis action cannot be undone. Continue?',
  )) return

  if (isReturnMode && !confirm(
    '⚠️ Create Credit Note Confirmation\n\nThis will:\n• Restore items back to stock\n• Reverse sales revenue and tax liability\n• Reduce party balance\n\nContinue?',
  )) return

  saving.value = true
  try {
    let result

    if (isReturnMode) {
      const returnData = {
        originalBillId: state.returnFromBillId,
        returnCart: state.cart
          .filter((i) => (i.returnQty || 0) > 0)
          .map((i) => ({
            stockId:   i.stockId || i.stock_id || null,
            returnQty: i.returnQty,
            rate:      i.rate,
            grate:     i.grate,
            disc:      i.disc,
            item:      i.item,
            gstRate:   i.grate,
          })),
        narration: state.meta.narration,
      }
      result = await post('/api/inventory/sls/create-credit-note', returnData)
    } else {
      const billData = {
        meta: {
          ...state.meta,
          firmGstin:  state.activeFirmLocation?.gst_number || null,
          partyGstin: state.selectedPartyGstin || null,
        },
        party:        getPartyId(state.selectedParty),
        partyName:    state.selectedParty?.supply || '',
        partyAddress: state.selectedPartyLocation?.address || state.selectedParty?.addr || '',
        partyGstin:   state.selectedPartyGstin || state.selectedParty?.gstin || '',
        partyState:   state.selectedPartyLocation?.state   || state.selectedParty?.state || '',
        partyPin:     state.selectedPartyLocation?.pincode || state.selectedParty?.pin   || null,
        stockItems:   state.cart,
        otherCharges: state.otherCharges,
        consignee:    state.selectedConsignee,
        type:         'SALES',
      }

      if (isEditMode && editBillId) {
        result = await put(`/api/inventory/sls/bills/${editBillId}`, billData)
      } else {
        result = await post('/api/inventory/sls/bills', billData)
      }
    }

    if (!result.success) {
      toast.add({ title: result.error || 'Failed to save bill', color: 'error' })
      return
    }

    const msg = isReturnMode
      ? `Credit Note created! No: ${result.billNo}`
      : isEditMode
        ? `Bill updated! Bill No: ${result.billNo || state.meta.billNo}`
        : `Invoice saved! Bill No: ${result.billNo}`

    toast.add({ title: msg, color: 'success' })
    savedBillId.value   = result.id
    savedBillNo.value   = result.billNo || state.meta.billNo
    showSaveConfirm.value = true

  } catch (err) {
    toast.add({ title: 'Error saving: ' + (err.message || 'Server error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Post-save actions ─────────────────────────────────────────────────────────

function afterSaveModal() {
  showSaveConfirm.value = false
  if (isEditMode || isReturnMode) {
    router.push('/inventory/reports')
  } else {
    resetState()
    fetchData()
  }
}

async function downloadPdf() {
  if (savedBillId.value) await invoiceExport.exportToPdf(savedBillId.value)
  afterSaveModal()
}

async function downloadExcel() {
  if (savedBillId.value) await invoiceExport.exportToExcel(savedBillId.value)
  afterSaveModal()
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function onKeydown(e) {
  // Don't fire if focused in an input/textarea
  const tag = (e.target).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'F8') { e.preventDefault(); saveBill() }
    return
  }

  const map = {
    F2: () => { showStockModal.value  = true },
    F3: () => { showPartyModal.value  = true },
    F4: () => { showChargesModal.value = true },
    F5: () => { addServiceLine() },
    F8: () => { saveBill() },
    F9: () => { onReset() },
  }
  if (map[e.key]) { e.preventDefault(); map[e.key]() }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (process.client) {
    window.removeEventListener('firm-updated', init)
  }
})

// ── Edit-party helper ─────────────────────────────────────────────────────────

function openEditParty() {
  window.open('/inventory/suppliers', '_blank')
}
</script>

<template>
  <div class="flex flex-col bg-gray-50 font-sans text-sm">

    <!-- ══════════════════ LOADING ══════════════════ -->
    <div v-if="pageLoading" class="flex items-center justify-center h-64 text-gray-400">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span class="text-sm">Loading sales system…</span>
      </div>
    </div>

    <!-- ══════════════════ ERROR ══════════════════ -->
    <div
      v-else-if="pageError"
      class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded m-4"
    >
      <h3 class="font-bold text-lg">System Error</h3>
      <p class="mt-2">{{ pageError }}</p>
      <UButton label="Reload" color="error" class="mt-4" @click="init" />
    </div>

    <!-- ══════════════════ MAIN LAYOUT ══════════════════ -->
    <div
      v-else
      class="h-[calc(100vh-140px)] flex flex-col border rounded-lg shadow-sm overflow-hidden"
      :class="isReturnMode ? 'border-amber-300' : 'border-gray-300'"
    >

      <!-- ── Return mode banner ─────────────────────────────────────────── -->
      <div
        v-if="isReturnMode && state.currentBill"
        class="bg-amber-100 border-b border-amber-200 px-4 py-2
               flex items-center justify-between"
      >
        <div class="flex items-center gap-2 text-amber-800 font-medium text-sm">
          <UIcon name="i-lucide-corner-up-left" class="w-4 h-4" />
          Returning items from Bill
          <strong>#{{ state.currentBill.bno }}</strong>
          (dated {{ state.currentBill.bdate }})
        </div>
        <UButton
          label="Cancel Return"
          size="xs"
          color="warning"
          variant="ghost"
          @click="router.push('/inventory/sls')"
        />
      </div>

      <!-- ── Header toolbar ────────────────────────────────────────────── -->
      <div
        class="border-b p-2 flex flex-col sm:flex-row justify-between
               items-start sm:items-center gap-2 shadow-sm z-20"
        :class="isReturnMode ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'"
      >
        <!-- Left: title + controls -->
        <div class="flex flex-col sm:flex-row flex-wrap gap-2">
          <!-- Title + mode badge -->
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-gray-800">
              {{ isReturnMode ? 'Credit Note (Sales Return)' : 'Sales Invoice' }}
            </h1>
            <UBadge v-if="isEditMode"   label="EDIT MODE"   color="warning" />
            <UBadge v-if="isReturnMode" label="RETURN MODE" color="warning" />
          </div>

          <!-- Bill No (read-only) -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill No</label>
            <UInput
              :model-value="isReturnMode ? 'CN-AUTO' : state.meta?.billNo"
              readonly
              size="xs"
              class="w-32 bg-gray-100 cursor-not-allowed font-bold"
            />
            </div>

            <!-- Date -->
            <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Date</label>
            <UInput
              v-model="state.meta.billDate"

              type="date"
              size="xs"
              class="w-36"
            />
          </div>

          <!-- Firm GSTIN selector (always visible) -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
              Billing from GSTIN
            </label>
            <USelect
              v-model="activeFirmGstin"
              :items="firmGstinItems"
              size="xs"
              class="border-orange-300 bg-orange-50"
            />
          </div>

          <!-- Transaction type -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
              Transaction Type
            </label>
            <USelect
              v-model="state.meta.billType"
              :items="[
                { label: 'Intra-State (CGST + SGST)', value: 'intra-state' },
                { label: 'Inter-State (IGST)',         value: 'inter-state' },
              ]"
              size="xs"
            />
            </div>

            <!-- Reverse charge + GST badge -->
            <div class="flex items-center gap-3 pt-4">
            <UCheckbox
              v-model="state.meta.reverseCharge"

              label="Reverse Charge"
              :ui="{ label: 'text-[10px] uppercase text-gray-500 font-bold tracking-wider' }"
            />
            <UBadge
              :label="state.gstEnabled ? 'GST: ON' : 'GST: OFF'"
              :color="state.gstEnabled ? 'success' : 'error'"
              size="xs"
            />
          </div>
        </div>

        <!-- Right: action buttons -->
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Other Charges"
            size="xs"
            color="primary"
            variant="outline"
            @click="showChargesModal = true"
          />
          <template v-if="!isReturnMode">
            <UButton
              label="Add Items (F2)"
              size="xs"
              color="primary"
              variant="soft"
              @click="showStockModal = true"
            />
            <UButton
              label="Add Service (F5)"
              size="xs"
              color="success"
              variant="soft"
              @click="addServiceLine"
            />
          </template>
          <UButton
            label="Reset"
            size="xs"
            color="error"
            variant="soft"
            @click="onReset"
          />
          <UButton
            :label="isReturnMode ? 'Save Credit Note' : isEditMode ? 'Update Bill' : 'Save Invoice'"
            size="xs"
            color="neutral"
            :loading="saving"
            icon="i-lucide-save"
            @click="saveBill"
          />
        </div>
      </div>

      <!-- ── GST List (All firm locations) ──────────────────────────── -->
      <div v-if="state.firmLocations.length > 0" class="bg-indigo-50 border-b border-indigo-200 px-4 py-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] uppercase text-indigo-700 font-bold tracking-wider">Available GSTINs:</span>
          <div class="flex gap-2 flex-wrap">
            <UBadge
              v-for="loc in state.firmLocations"
              :key="loc.gst_number"
              :label="`${loc.gst_number} ${loc.is_default ? '(Default)' : ''}`"
              :color="activeFirmGstin === loc.gst_number ? 'indigo' : 'gray'"
              variant="subtle"
              size="sm"
              class="cursor-pointer hover:opacity-80 transition"
              @click="activeFirmGstin = loc.gst_number"
            />
          </div>
        </div>
      </div>

      <!-- ── Main content ──────────────────────────────────────────────── -->
      <div class="flex-1 overflow-hidden flex flex-col md:flex-row">

        <!-- ──── Sidebar ──────────────────────────────────────────────── -->
        <div class="w-full md:w-64 bg-slate-50 border-r border-gray-200
                    flex flex-col overflow-y-auto z-10">

          <!-- Party card -->
          <div class="p-3 border-b border-gray-200 bg-white">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
              Bill To
            </label>
            <div class="mt-1">
              <PartyCard
                :state="state"
                :is-return-mode="isReturnMode"
                @change-party="showPartyModal = true"
                @edit-party="openEditParty"
              />
            </div>
          </div>

          <!-- Consignee -->
          <div class="p-3 border-b border-gray-200 bg-white mt-3">
            <div class="flex justify-between items-center mb-2">
              <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                Consignee
              </label>
              <UCheckbox
                :model-value="state.consigneeSameAsBillTo"
                label="Same as Bill To"
                :ui="{ label: 'text-[10px] text-blue-600 font-medium' }"
                @update:model-value="onConsigneeSameToggle"
              />
            </div>

            <div class="space-y-2">
              <div v-for="(field, key) in {
                name: 'Consignee Name *', address: 'Address *', gstin: 'GSTIN',
                state: 'State *', pin: 'PIN Code', contact: 'Contact',
                deliveryInstructions: 'Delivery Instructions',
              }" :key="key">
                <label class="text-[10px] text-gray-500 font-bold mb-1 block">{{ field }}</label>
                <UTextarea
                  v-if="key === 'address' || key === 'deliveryInstructions'"
                  :model-value="state.selectedConsignee?.[key] || ''"
                  :rows="key === 'address' ? 2 : 1"
                  :placeholder="field"
                  class="w-full text-xs"
                  :disabled="state.consigneeSameAsBillTo"
                  @update:model-value="val => {
                    if (!state.selectedConsignee) state.selectedConsignee = {}
                    state.selectedConsignee[key] = val
                  }"
                />
                <UInput
                  v-else
                  :model-value="state.selectedConsignee?.[key] || ''"
                  :placeholder="field"
                  size="xs"
                  :disabled="state.consigneeSameAsBillTo"
                  :class="key === 'gstin' ? 'uppercase font-mono' : ''"
                  @update:model-value="val => {
                    if (!state.selectedConsignee) state.selectedConsignee = {}
                    state.selectedConsignee[key] = val
                  }"
                />
              </div>
            </div>
          </div>

          <!-- Meta fields -->
          <div class="p-3 space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 font-bold">Reference / PO No</label>
              <UInput
                v-model="state.meta.referenceNo"
                placeholder="e.g. PO-2025-001"
                size="xs"
                class="w-full mt-1"
              />
              </div>
              <div>
              <label class="text-[10px] text-gray-500 font-bold">Vehicle No</label>
              <UInput
                v-model="state.meta.vehicleNo"
                placeholder="e.g. KA01AB1234"
                size="xs"
                class="w-full mt-1"
              />
              </div>
              <div>
              <label class="text-[10px] text-gray-500 font-bold">Narration</label>
              <UTextarea
                v-model="state.meta.narration"
                placeholder="Additional notes…"
                :rows="3"
                class="w-full mt-1"
              />

            </div>
          </div>
        </div>

        <!-- ──── Items area ────────────────────────────────────────────── -->
        <div class="flex-1 bg-white flex flex-col relative min-w-0">

          <!-- Table header -->
          <div
            class="text-[11px] font-bold text-white uppercase tracking-wider
                   flex pr-2 shrink-0 shadow-sm"
            :class="isReturnMode
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
              : 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600'"
          >
            <div class="p-2 w-10 text-center">#</div>
            <div class="p-2 flex-1">Item Description</div>
            <div class="p-2 w-20">HSN</div>
            <div v-if="isReturnMode" class="p-2 w-16 text-right">Orig Qty</div>
            <div class="p-2 w-16 text-right">
              {{ isReturnMode ? 'Ret Qty' : 'Qty' }}
            </div>
            <div class="p-2 w-12 text-center">Unit</div>
            <div class="p-2 w-24 text-right">Rate</div>
            <div class="p-2 w-16 text-right">Disc %</div>
            <div class="p-2 w-16 text-right">Tax %</div>
            <div class="p-2 w-28 text-right">Total</div>
            <div class="p-2 w-10 text-center" />
          </div>

          <!-- Items list -->
          <div class="flex-1 overflow-y-auto relative" id="items-container">
            <InvoiceItemsList
              :state="state"
              :is-return-mode="isReturnMode"
              @update-item="onUpdateItem"
              @update-narration="onUpdateNarration"
              @remove-item="onRemoveItem"
              @apply-service="onApplyService"
            />
          </div>

          <!-- Quick-action bar -->
          <div class="p-2 border-t border-dashed border-gray-200 bg-gray-50 shrink-0">
            <button
              class="w-full py-2 border border-dashed border-blue-300 text-blue-600
                     rounded hover:bg-blue-50 text-xs font-bold transition-colors
                     uppercase tracking-wide"
              @click="showStockModal = true"
            >
              + Add Items (F2) &nbsp;|&nbsp; Select Party (F3) &nbsp;|&nbsp;
              Add Service (F5) &nbsp;|&nbsp; Charges (F4) &nbsp;|&nbsp;
              Save (F8) &nbsp;|&nbsp; Reset (F9)
            </button>
          </div>

          <!-- Totals panel -->
          <div
            class="bg-slate-50 border-t border-slate-300 p-4 shrink-0
                   shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            <InvoiceTotals :state="state" :is-return-mode="isReturnMode" />
          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════ MODALS ══════════════════ -->

    <!-- Stock selection -->
    <StockSelectionModal
      :open="showStockModal"
      @update:open="showStockModal = $event"
      :state="state"
      @select-stock="onSelectStock"
      @edit-stock="onEditStock"
      @view-history="onViewHistory"
      @create-stock="() => {
        stockCrudMode = 'create'; editingStock = null; showStockCrud = true
      }"
    />

    <!-- Batch selection (sub-modal when stock has multiple batches) -->
    <BatchSelectionModal
      :open="showBatchModal"
      @update:open="showBatchModal = $event"
      :stock="pendingBatchStock || {}"
      @select-batch="onBatchSelected"
    />

    <!-- Party selection -->
    <PartySelectionModal
      :open="showPartyModal"
      @update:open="showPartyModal = $event"
      :state="state"
      @select-party="onPartySelected"
      @create-party="() => { showPartyModal = false; showPartyCreate = true }"
    />

    <!-- Party create -->
    <PartyCreateModal
      :open="showPartyCreate"
      @update:open="showPartyCreate = $event"
      @saved="onPartySaved"
    />

    <!-- Other charges -->
    <OtherChargesModal
      :open="showChargesModal"
      @update:open="showChargesModal = $event"
      :state="state"
      @add-charge="onAddCharge"
      @remove-charge="onRemoveCharge"
      @save="showChargesModal = false"
    />

    <!-- Stock CRUD (create / edit) -->
    <StockCrudModal
      :open="showStockCrud"
      @update:open="showStockCrud = $event"
      :mode="stockCrudMode"
      :stock="editingStock"
      @saved="onStockSaved"
    />

    <!-- Party item history -->
    <PartyHistoryModal
      v-if="historyStock"
      :open="showHistoryModal"
      @update:open="showHistoryModal = $event"
      :stock="historyStock"
      :state="state"
    />

    <!-- ── Save confirmation ──────────────────────────────────────────── -->
    <UModal :open="showSaveConfirm" @update:open="showSaveConfirm = $event" :ui="{ width: 'max-w-sm' }">

      <template #header>
        <div class="w-full text-center">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center
                      justify-center mx-auto mb-3">
            <UIcon name="i-lucide-check" class="w-6 h-6 text-green-600" />
          </div>
          <h3 class="text-base font-bold text-gray-800">
            {{ isReturnMode ? 'Credit Note Saved!' : 'Invoice Saved!' }}
          </h3>
          <p class="text-gray-500 text-sm mt-1">
            Bill No: <span class="font-bold text-gray-800">{{ savedBillNo }}</span>
          </p>
        </div>
      </template>

      <template #body>
      <div class="p-5 flex flex-col gap-2">
        <UButton
          label="Download PDF"
          color="primary"
          class="w-full justify-center"
          :loading="invoiceExport.exportingPdf.value"
          icon="i-lucide-file-text"
          @click="downloadPdf"
        />
        <UButton
          label="Download Excel"
          color="success"
          class="w-full justify-center"
          :loading="invoiceExport.exportingExcel.value"
          icon="i-lucide-file-spreadsheet"
          @click="downloadExcel"
        />
        <UButton
          label="Close"
          color="neutral"
          variant="outline"
          class="w-full justify-center"
          @click="afterSaveModal"
        />
      </div>
      </template>
    </UModal>

  </div>
</template>