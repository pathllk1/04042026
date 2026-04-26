<script setup>
/**
 * pages/inventory/reports.vue
 * Bills Reports - full-featured list with search, sort, column filters,
 * pagination, bill detail modal, and Excel/PDF exports.
 *
 * Replaces: inventory-reports.js
 * Auth: credentials:'include' on $fetch (httpOnly cookies sent automatically).
 * Mutating requests (cancel): useApiWithAuth().put()
 */

definePageMeta({ layout: 'default' })

const router = useRouter()
const route  = useRoute()
const toast  = useToast()

// Route hints
const isReturnMode   = route.query.action === 'return'
const returnTypeHint = route.query.type === 'PURCHASE'
  ? 'Purchase (Debit Note)'
  : 'Sales (Credit Note)'

// ---- Bills data ----

const allBills  = ref([])
const loading   = ref(false)
const loadError = ref(null)

async function loadBills() {
  loading.value   = true
  loadError.value = null
  try {
    const data = await $fetch('/api/inventory/sales/bills', {
      method: 'GET', credentials: 'include',
    })
    allBills.value    = Array.isArray(data) ? data : (data?.data || [])
    currentPage.value = 1
  } catch (err) {
    loadError.value = err.message || 'Failed to load bills'
    console.error('Error loading bills:', err)
  } finally {
    loading.value = false
  }
}

// ---- Search / type / date filters ----

const searchTerm = ref('')
const filterType = ref('')
const filterFrom = ref('')
const filterTo   = ref('')

const getBillParty = (bill) => bill?.supply || '--'

function getBillTax(bill) {
  return (bill?.cgst || 0) + (bill?.sgst || 0) + (bill?.igst || 0)
}

const filteredBills = computed(() => {
  const q    = searchTerm.value.toLowerCase().trim()
  const type = filterType.value
  const from = filterFrom.value
  const to   = filterTo.value

  return allBills.value.filter(bill => {
    if (q && !(
      (bill.bno  || '').toLowerCase().includes(q) ||
      getBillParty(bill).toLowerCase().includes(q)
    )) return false

    if (type && bill.btype !== type) return false

    if (from || to) {
      const bd = new Date(bill.bdate)
      if (from && bd < new Date(from)) return false
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        if (bd > toDate) return false
      }
    }

    if (!matchesColFilters(bill)) return false
    return true
  })
})

// ---- Summary cards ----

const summary = computed(() => {
  const active  = filteredBills.value.filter(b => b.status !== 'CANCELLED')
  const revenue = active.reduce((s, b) => s + (b.ntot || 0), 0)
  const tax     = active.reduce((s, b) => s + getBillTax(b), 0)
  const fmt     = (n) => 'Rs.' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    total:   filteredBills.value.length,
    active:  active.length,
    revenue: fmt(revenue),
    tax:     fmt(tax),
  }
})

// ---- Sorting ----

const sortCol = ref('')
const sortDir = ref('asc')

function toggleSort(col) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
}

const sortedBills = computed(() => {
  if (!sortCol.value) return filteredBills.value
  return [...filteredBills.value].sort((a, b) => {
    let vA, vB
    switch (sortCol.value) {
      case 'bno':   vA = a.bno || '';                   vB = b.bno || '';                   break
      case 'bdate': vA = new Date(a.bdate || 0);        vB = new Date(b.bdate || 0);        break
      case 'firm':  vA = getBillParty(a).toLowerCase(); vB = getBillParty(b).toLowerCase(); break
      case 'btype': vA = a.btype || '';                 vB = b.btype || '';                 break
      case 'gtot':  vA = parseFloat(a.gtot || 0);       vB = parseFloat(b.gtot || 0);       break
      case 'tax':   vA = getBillTax(a);                 vB = getBillTax(b);                 break
      case 'ntot':  vA = parseFloat(a.ntot || 0);       vB = parseFloat(b.ntot || 0);       break
      default: return 0
    }
    if (sortDir.value === 'asc') return vA > vB ? 1 : vA < vB ? -1 : 0
    return vA < vB ? 1 : vA > vB ? -1 : 0
  })
})

// ---- Column filters (Excel-style) ----

const colFilters = reactive({
  bno: null, bdate: null, firm: null, btype: null,
  gtot: null, tax: null, ntot: null, status: null,
})

const COL_CONFIG = {
  bno:    { label: 'Bill No',  type: 'text',   getValue: b => b.bno || '' },
  bdate:  { label: 'Date',     type: 'text',   getValue: b => formatDate(b.bdate) },
  firm:   { label: 'Party',    type: 'text',   getValue: b => getBillParty(b) },
  btype:  { label: 'Type',     type: 'choice', getValue: b => b.btype || 'SALES' },
  gtot:   { label: 'Taxable',  type: 'number', getValue: b => b.gtot || 0 },
  tax:    { label: 'Tax',      type: 'number', getValue: b => getBillTax(b) },
  ntot:   { label: 'Total',    type: 'number', getValue: b => b.ntot || 0 },
  status: { label: 'Status',   type: 'choice', getValue: b => b.status || 'ACTIVE' },
}

function allValuesFor(col) {
  const cfg = COL_CONFIG[col]
  if (!cfg) return []
  return [...new Set(allBills.value.map(b => String(cfg.getValue(b))).filter(Boolean))].sort()
}

function isColFilterActive(col) {
  const f = colFilters[col]
  if (!f) return false
  if (f instanceof Set) return f.size > 0
  return f.min !== '' || f.max !== ''
}

function matchesColFilters(bill) {
  for (const [col, state] of Object.entries(colFilters)) {
    if (!state) continue
    const cfg = COL_CONFIG[col]
    if (!cfg) continue
    const val = cfg.getValue(bill)
    if (cfg.type === 'number') {
      const n = Number(val)
      if (state.min !== '' && state.min !== null && !isNaN(state.min) && n < Number(state.min)) return false
      if (state.max !== '' && state.max !== null && !isNaN(state.max) && n > Number(state.max)) return false
    } else {
      if (state instanceof Set && state.size > 0 && !state.has(String(val))) return false
    }
  }
  return true
}

function onColFilterUpdate(col, value) {
  colFilters[col] = value
  currentPage.value = 1
}

// ---- Pagination ----

const currentPage  = ref(1)
const itemsPerPage = ref(10)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedBills.value.length / itemsPerPage.value)),
)

const paginatedBills = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return sortedBills.value.slice(start, start + itemsPerPage.value)
})

const paginationLabel = computed(() => {
  const total = sortedBills.value.length
  if (total === 0) return 'No bills'
  const start = (currentPage.value - 1) * itemsPerPage.value + 1
  const end   = Math.min(currentPage.value * itemsPerPage.value, total)
  return `Showing ${start}-${end} of ${total} bills`
})

const pageRange = computed(() => {
  const total = totalPages.value
  const cur   = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const range = [1]
  if (cur > 4) range.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) range.push(i)
  if (cur < total - 3) range.push('...')
  if (total > 1) range.push(total)
  return range
})

function goToPage(page) {
  if (typeof page !== 'number') return
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

watch([sortedBills, itemsPerPage], () => {
  if (currentPage.value > totalPages.value) currentPage.value = 1
})

// ---- Bill detail modal ----

const showModal  = ref(false)
const selectedId = ref(null)

function viewBill(billId) {
  selectedId.value = billId
  showModal.value  = true
}

function onBillCancelled() {
  showModal.value = false
  loadBills()
}

function onEditBill(billId, btype) {
  sessionStorage.setItem('editBillId', billId)
  showModal.value = false
  router.push(btype === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls')
}

function onReturnBill(billId, btype) {
  sessionStorage.setItem('returnFromBillId', billId)
  showModal.value = false
  router.push(btype === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls')
}

function handleReturn(billId, btype) {
  sessionStorage.setItem('returnFromBillId', billId)
  router.push(btype === 'PURCHASE' ? '/inventory/prs' : '/inventory/sls')
}

// ---- Exports ----

async function downloadBlob(url, filename) {
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob    = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href            = blobUrl
    a.download        = filename
    a.style.display   = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    toast.add({ title: 'Export failed: ' + err.message, color: 'error' })
  }
}

function buildExportParams() {
  const p = new URLSearchParams()
  if (filterType.value)  p.append('type',       filterType.value)
  if (searchTerm.value)  p.append('searchTerm', searchTerm.value)
  if (filterFrom.value)  p.append('dateFrom',   filterFrom.value)
  if (filterTo.value)    p.append('dateTo',     filterTo.value)
  return p.toString()
}

function exportExcel() {
  const today = new Date().toISOString().split('T')[0]
  downloadBlob(`/api/inventory/sales/bills/export?${buildExportParams()}`, `bills-report-${today}.xlsx`)
}

function exportPdf() {
  const today = new Date().toISOString().split('T')[0]
  downloadBlob(`/api/inventory/sales/bills/export/pdf?${buildExportParams()}`, `bills-report-${today}.pdf`)
}

// ---- Helpers ----

function formatDate(d) {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(n) {
  return 'Rs.' + (parseFloat(n) || 0).toFixed(2)
}

function typeBadgeClass(btype) {
  switch ((btype || 'SALES').toUpperCase()) {
    case 'PURCHASE':    return 'bg-purple-100 text-purple-700'
    case 'CREDIT_NOTE': return 'bg-amber-100 text-amber-700'
    case 'DEBIT_NOTE':  return 'bg-slate-100 text-slate-700'
    default:            return 'bg-teal-100 text-teal-700'
  }
}

function typeLabel(btype) {
  switch ((btype || 'SALES').toUpperCase()) {
    case 'PURCHASE':    return 'PUR'
    case 'CREDIT_NOTE': return 'CN'
    case 'DEBIT_NOTE':  return 'DN'
    default:            return 'SLS'
  }
}

// ---- Keyboard shortcuts ----

const searchInputEl = ref(null)

function onKeydown(e) {
  if (e.key === 'Escape' && showModal.value) { showModal.value = false; return }
  const tag = document.activeElement?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchInputEl.value?.focus(); return }
  if (e.key === 'r' || e.key === 'R') { loadBills(); return }
  if (e.key === 'e' || e.key === 'E') { exportExcel(); return }
  if (e.key === 'p' || e.key === 'P') { exportPdf(); return }
  if (e.key === 'ArrowLeft')  goToPage(currentPage.value - 1)
  if (e.key === 'ArrowRight') goToPage(currentPage.value + 1)
}

onMounted(() => { document.addEventListener('keydown', onKeydown); loadBills() })
onUnmounted(() => { document.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="px-3 py-3 space-y-3">

    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg
                    flex items-center justify-center flex-shrink-0">
          <UIcon name="i-lucide-bar-chart-2" class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">Bills Reports</h1>
          <p class="text-xs text-gray-500">View and analyze all bills and transactions</p>
        </div>
      </div>
      <NuxtLink
        to="/inventory/dashboard"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
               text-orange-700 bg-orange-50 border border-orange-200 rounded-lg
               hover:bg-orange-100 transition self-start sm:self-auto"
      >
        <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
        Dashboard
      </NuxtLink>
    </div>

    <!-- Return mode notice -->
    <div
      v-if="isReturnMode"
      class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded shadow-sm"
    >
      <div class="flex">
        <UIcon name="i-lucide-alert-triangle" class="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div class="ml-3">
          <p class="text-sm text-amber-700 font-bold uppercase tracking-tight">
            Create {{ returnTypeHint }} Return
          </p>
          <p class="text-sm text-amber-600">
            Please locate the <strong>original bill</strong> below and click
            <span class="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">Return</span>
            to proceed.
          </p>
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div
        v-for="card in [
          { icon: 'i-lucide-file',         color: 'blue',   label: 'Total Bills',  value: summary.total   },
          { icon: 'i-lucide-indian-rupee',  color: 'green',  label: 'Revenue',      value: summary.revenue },
          { icon: 'i-lucide-receipt',       color: 'orange', label: 'Total Tax',    value: summary.tax     },
          { icon: 'i-lucide-check-circle',  color: 'purple', label: 'Active Bills', value: summary.active  },
        ]"
        :key="card.label"
        class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          :class="{
            'bg-blue-100':   card.color === 'blue',
            'bg-green-100':  card.color === 'green',
            'bg-orange-100': card.color === 'orange',
            'bg-purple-100': card.color === 'purple',
          }"
        >
          <UIcon
            :name="card.icon"
            class="w-4 h-4"
            :class="{
              'text-blue-600':   card.color === 'blue',
              'text-green-600':  card.color === 'green',
              'text-orange-600': card.color === 'orange',
              'text-purple-600': card.color === 'purple',
            }"
          />
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500 truncate">{{ card.label }}</p>
          <p class="text-lg font-bold text-gray-900 leading-tight">{{ card.value }}</p>
        </div>
      </div>
    </div>

    <!-- Controls bar -->
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      <div class="flex flex-col sm:flex-row gap-2">
        <div class="relative flex-1">
          <input
            ref="searchInputEl"
            v-model="searchTerm"
            type="text"
            placeholder="Search bills... (Ctrl+F)"
            class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md
                   focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                   bg-gray-50 focus:bg-white transition"
          />
          <UIcon
            name="i-lucide-search"
            class="w-4 h-4 absolute left-2.5 top-2 text-gray-400 pointer-events-none"
          />
        </div>
        <select
          v-model="filterType"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md
                 focus:ring-2 focus:ring-orange-400 bg-gray-50"
        >
          <option value="">All Types</option>
          <option value="SALES">Sales</option>
          <option value="PURCHASE">Purchase</option>
          <option value="CREDIT_NOTE">Credit Note</option>
          <option value="DEBIT_NOTE">Debit Note</option>
        </select>
      </div>

      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div class="flex flex-wrap gap-2 items-center">
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input
              v-model="filterFrom"
              type="date"
              class="px-2 py-1.5 text-sm border border-gray-300 rounded-md
                     focus:ring-2 focus:ring-orange-400 bg-gray-50"
            />
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input
              v-model="filterTo"
              type="date"
              class="px-2 py-1.5 text-sm border border-gray-300 rounded-md
                     focus:ring-2 focus:ring-orange-400 bg-gray-50"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <UButton label="Refresh" icon="i-lucide-refresh-cw" size="xs" color="primary" :loading="loading" @click="loadBills" />
          <UButton label="PDF" icon="i-lucide-download" size="xs" color="error" @click="exportPdf" />
          <UButton label="Excel" icon="i-lucide-download" size="xs" color="success" @click="exportExcel" />
        </div>
      </div>
    </div>

    <!-- Bills table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">

          <thead class="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600">
            <tr>
              <!-- Bill No -->
              <th
                class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition"
                @click="toggleSort('bno')"
              >
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">
                    Bill No
                    <UIcon
                      :name="sortCol === 'bno' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'bno' ? 'opacity-100' : 'opacity-40'"
                    />
                  </div>
                  <ColFilterBtn col="bno" label="Bill No" type="text"
                    :all-values="allValuesFor('bno')" :model-value="colFilters.bno"
                    :active="isColFilterActive('bno')"
                    @update:model-value="onColFilterUpdate('bno', $event)" />
                </div>
              </th>

              <!-- Date -->
              <th
                class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition"
                @click="toggleSort('bdate')"
              >
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">
                    Date
                    <UIcon
                      :name="sortCol === 'bdate' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'bdate' ? 'opacity-100' : 'opacity-40'"
                    />
                  </div>
                  <ColFilterBtn col="bdate" label="Date" type="text"
                    :all-values="allValuesFor('bdate')" :model-value="colFilters.bdate"
                    :active="isColFilterActive('bdate')"
                    @update:model-value="onColFilterUpdate('bdate', $event)" />
                </div>
              </th>

              <!-- Party -->
              <th
                class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition hidden sm:table-cell"
                @click="toggleSort('firm')"
              >
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">
                    Party
                    <UIcon
                      :name="sortCol === 'firm' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'firm' ? 'opacity-100' : 'opacity-40'"
                    />
                  </div>
                  <ColFilterBtn col="firm" label="Party" type="text"
                    :all-values="allValuesFor('firm')" :model-value="colFilters.firm"
                    :active="isColFilterActive('firm')"
                    @update:model-value="onColFilterUpdate('firm', $event)" />
                </div>
              </th>

              <!-- Type -->
              <th
                class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition"
                @click="toggleSort('btype')"
              >
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1">
                    Type
                    <UIcon
                      :name="sortCol === 'btype' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'btype' ? 'opacity-100' : 'opacity-40'"
                    />
                  </div>
                  <ColFilterBtn col="btype" label="Type" type="choice"
                    :all-values="allValuesFor('btype')" :model-value="colFilters.btype"
                    :active="isColFilterActive('btype')"
                    @update:model-value="onColFilterUpdate('btype', $event)" />
                </div>
              </th>

              <!-- Taxable -->
              <th
                class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition hidden md:table-cell"
                @click="toggleSort('gtot')"
              >
                <div class="flex items-center justify-end gap-1">
                  <ColFilterBtn col="gtot" label="Taxable" type="number"
                    :all-values="allValuesFor('gtot')" :model-value="colFilters.gtot"
                    :active="isColFilterActive('gtot')"
                    @update:model-value="onColFilterUpdate('gtot', $event)" />
                  <div class="flex items-center gap-1">
                    <UIcon :name="sortCol === 'gtot' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'gtot' ? 'opacity-100' : 'opacity-40'" />
                    Taxable
                  </div>
                </div>
              </th>

              <!-- Tax -->
              <th
                class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase
                       tracking-wider cursor-pointer hover:bg-white/10 transition hidden md:table-cell"
                @click="toggleSort('tax')"
              >
                <div class="flex items-center justify-end gap-1">
                  <ColFilterBtn col="tax" label="Tax" type="number"
                    :all-values="allValuesFor('tax')" :model-value="colFilters.tax"
                    :active="isColFilterActive('tax')"
                    @update:model-value="onColFilterUpdate('tax', $event)" />
                  <div class="flex items-center gap-1">
                    <UIcon :name="sortCol === 'tax' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                      class="w-3 h-3" :class="sortCol === 'tax' ? 'opacity-100' : 'opacity-40'" />
                    Tax
                  </div>
                </div>
              </th>

              <!-- Total -->
              <th
                class="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase tracking-wider"
              >
                <div class="flex items-center justify-end gap-1">
                  <ColFilterBtn col="ntot" label="Total" type="number"
                    :all-values="allValuesFor('ntot')" :model-value="colFilters.ntot"
                    :active="isColFilterActive('ntot')"
                    @update:model-value="onColFilterUpdate('ntot', $event)" />
                  Total
                </div>
              </th>

              <!-- Status -->
              <th class="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">
                <div class="flex items-center justify-between gap-1">
                  Status
                  <ColFilterBtn col="status" label="Status" type="choice"
                    :all-values="allValuesFor('status')" :model-value="colFilters.status"
                    :active="isColFilterActive('status')"
                    @update:model-value="onColFilterUpdate('status', $event)" />
                </div>
              </th>

              <!-- Actions -->
              <th class="px-3 py-2.5 text-center text-xs font-semibold text-white uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="bg-white divide-y divide-gray-100">

            <!-- Loading -->
            <tr v-if="loading">
              <td colspan="9" class="px-4 py-8 text-center text-sm text-gray-400">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  Loading bills...
                </div>
              </td>
            </tr>

            <!-- Error -->
            <tr v-else-if="loadError">
              <td colspan="9" class="px-4 py-8 text-center text-sm text-red-500">
                <div class="flex items-center justify-center gap-2">
                  <UIcon name="i-lucide-alert-circle" class="w-5 h-5" />
                  Failed to load: {{ loadError }}
                </div>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="paginatedBills.length === 0">
              <td colspan="9" class="px-4 py-10 text-center">
                <div class="flex flex-col items-center gap-2 text-gray-400">
                  <UIcon name="i-lucide-file-x" class="w-10 h-10 text-gray-300" />
                  <span class="text-sm">No bills found matching your criteria</span>
                </div>
              </td>
            </tr>

            <!-- Data rows -->
            <tr
              v-for="bill in paginatedBills"
              :key="bill._id"
              class="transition-colors"
              :class="bill.status === 'CANCELLED' ? 'bg-red-50/60 border-l-2 border-l-red-300' : 'hover:bg-amber-50'"
            >
              <td class="px-3 py-2 whitespace-nowrap">
                <span class="text-xs font-bold text-gray-900 font-mono">{{ bill.bno || '--' }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                {{ formatDate(bill.bdate) }}
              </td>

              <td class="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                <span v-if="bill.status === 'CANCELLED'" class="font-mono tracking-widest text-gray-300 text-xs">XXXX</span>
                <span v-else class="text-xs text-gray-900">{{ getBillParty(bill) }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold"
                  :class="typeBadgeClass(bill.btype)"
                >{{ typeLabel(bill.btype) }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap text-right hidden md:table-cell">
                <span v-if="bill.status === 'CANCELLED'" class="font-mono tracking-widest text-gray-300 text-xs">XXXX</span>
                <span v-else class="text-xs font-mono text-gray-700">{{ formatCurrency(bill.gtot) }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap text-right hidden md:table-cell">
                <span v-if="bill.status === 'CANCELLED'" class="font-mono tracking-widest text-gray-300 text-xs">XXXX</span>
                <span v-else class="text-xs font-mono text-gray-700">{{ formatCurrency(getBillTax(bill)) }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap text-right">
                <span v-if="bill.status === 'CANCELLED'" class="font-mono tracking-widest text-gray-300 text-xs">XXXX</span>
                <span v-else class="text-xs font-mono font-semibold text-gray-900">{{ formatCurrency(bill.ntot) }}</span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  :class="bill.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="bill.status === 'CANCELLED' ? 'bg-red-400' : 'bg-green-500'" />
                  {{ bill.status === 'CANCELLED' ? 'Cancelled' : 'Active' }}
                </span>
              </td>

              <td class="px-3 py-2 whitespace-nowrap text-center">
                <div class="flex items-center justify-center gap-1">
                  <UButton label="View" size="xs" color="primary" @click="viewBill(bill._id)" />
                  <UButton
                    v-if="bill.status !== 'CANCELLED' && ['SALES', 'PURCHASE'].includes((bill.btype || '').toUpperCase())"
                    label="Return" size="xs" color="warning"
                    @click="handleReturn(bill._id, bill.btype)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination footer -->
      <div class="px-3 py-2.5 bg-gray-50 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{ paginationLabel }}</span>
            <select
              v-model="itemsPerPage"
              class="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-orange-400 bg-white"
            >
              <option :value="10">10 / page</option>
              <option :value="25">25 / page</option>
              <option :value="50">50 / page</option>
              <option :value="100">100 / page</option>
            </select>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <UButton
              label="Prev" size="xs" color="neutral" variant="outline"
              :disabled="currentPage === 1"
              @click="goToPage(currentPage - 1)"
            />
            <template v-for="(pg, idx) in pageRange" :key="idx">
              <span v-if="pg === '...'" class="px-1 text-xs text-gray-400 self-center">...</span>
              <UButton
                v-else
                :label="String(pg)" size="xs"
                :color="pg === currentPage ? 'primary' : 'neutral'"
                :variant="pg === currentPage ? 'solid' : 'outline'"
                @click="goToPage(pg)"
              />
            </template>
            <UButton
              label="Next" size="xs" color="neutral" variant="outline"
              :disabled="currentPage === totalPages"
              @click="goToPage(currentPage + 1)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard shortcuts hint -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 justify-end">
      <span v-for="hint in [
        { key: 'Ctrl+F', label: 'search' }, { key: 'R', label: 'refresh' },
        { key: 'E', label: 'export xlsx' }, { key: 'P', label: 'export pdf' },
        { key: 'Esc', label: 'close modal' }, { key: '<- ->', label: 'page' },
      ]" :key="hint.key" class="flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">{{ hint.key }}</kbd>
        {{ hint.label }}
      </span>
    </div>

    <!-- Bill detail modal -->
    <BillDetailModal
      v-model:open="showModal"
      :bill-id="selectedId"
      :all-bills="allBills"
      @cancelled="onBillCancelled"
      @edit="onEditBill"
      @return="onReturnBill"
    />

  </div>
</template>