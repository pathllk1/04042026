<template>
  <div class="max-w-screen-2xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Edit Wages</h1>

    <!-- ── Filters ────────────────────────────────────────────────────── -->
    <UCard class="mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        <UFormField label="Select Month">
          <UInput type="month" v-model="selectedMonth" :max="new Date().toISOString().slice(0, 7)" class="w-full" @change="loadWageRecords" />
        </UFormField>

        <UFormField label="Cheque No">
          <USelect v-model="chequeFilter" :items="chequeItems" class="w-full" @update:model-value="loadWageRecords" />
        </UFormField>

        <UFormField label="Select Bank">
          <USelect v-model="selectedBankId" :items="bankItems" :disabled="loadingLedgers" class="w-full" />
        </UFormField>

        <UFormField label="Payment Date">
          <UInput type="date" v-model="paymentDetails.paid_date" class="w-full" />
        </UFormField>

        <UFormField label=" ">
          <UButton
            color="success"
            icon="i-lucide-save"
            :loading="loading"
            :disabled="!wageRecords.length || loading"
            class="w-full justify-center"
            @click="saveWages"
          >
            {{ loading ? 'Processing…' : 'Save Changes' }}
          </UButton>
        </UFormField>
      </div>
    </UCard>

    <!-- ── Search ────────────────────────────────────────────────────── -->
    <div v-if="wageRecords.length" class="mb-4">
      <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Search by Sl. No., name, bank, branch, account, or IFSC…" class="w-full" />
      <div v-if="searchQuery" class="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        Showing {{ wageRecords.length }} of {{ allWages.length }} wage records
        <UButton size="xs" variant="ghost" color="primary" @click="searchQuery = ''">Clear</UButton>
      </div>
    </div>

    <!-- ── Mobile cards ───────────────────────────────────────────────── -->
    <div v-if="wageRecords.length" class="md:hidden space-y-3 mb-4">
      <UCard v-for="(wage, index) in wageRecords" :key="wage._id" class="border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <div class="font-medium text-indigo-700 dark:text-indigo-300 text-sm">
            <UBadge color="neutral" variant="soft" size="xs" class="mr-1">#{{ wage.slNo }}</UBadge>
            {{ wage.employeeName }}
          </div>
          <UButton size="xs" variant="soft" color="primary" @click="calculateWage(index)">Calculate</UButton>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs mb-3 bg-gray-50 dark:bg-gray-800 p-2 rounded">
          <div><span class="font-medium">Bank:</span> {{ wage.bank }}</div>
          <div><span class="font-medium">Account:</span> {{ wage.accountNo }}</div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <UFormField label="Per Day Wage">
            <UInput type="number" v-model="wage.pDayWage" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
          <UFormField label="Days">
            <UInput type="number" v-model="wage.wage_Days" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
          <UFormField label="Other Deduction">
            <UInput type="number" v-model="wage.other_deduction" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
          <UFormField>
            <template #label>
              Advance Recovery
              <span v-if="wage.hasAdvances" class="text-red-600 text-xs ml-1">(Pending)</span>
            </template>
            <div class="flex items-center gap-1">
              <UInput
                type="number"
                v-model="wage.advance_recovery"
                size="xs"
                :color="wage.hasAdvances && wage.selectedAdvanceId ? 'success' : undefined"
                class="w-full"
                @change="calculateWage(index)"
              />
              <UButton v-if="wage.masterRollId" size="xs" variant="ghost" :color="wage.hasAdvances ? 'error' : 'primary'" icon="i-lucide-eye" @click="showAdvances(wage.masterRollId, index)" />
            </div>
          </UFormField>
          <UFormField label="Other Benefit">
            <UInput type="number" v-model="wage.other_benefit" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs mb-2">
          <div><span class="font-medium">Gross:</span> ₹{{ wage.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
          <div><span class="font-medium">EPF:</span> ₹{{ wage.epf_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
          <div><span class="font-medium">ESIC:</span> ₹{{ wage.esic_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
          <div><span class="font-medium">Advance:</span> <span :class="wage.hasAdvances ? 'text-red-600 font-semibold' : ''">₹{{ wage.advance_recovery.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span></div>
          <div class="col-span-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span class="font-medium">Net Salary:</span>
            <span class="font-bold text-indigo-700 dark:text-indigo-300"> ₹{{ wage.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
          <UCheckbox v-model="wage.markedForDeletion" color="error" />
          <span class="text-xs font-medium text-red-600">Mark for deletion</span>
        </div>
      </UCard>
    </div>

    <!-- ── Desktop table ──────────────────────────────────────────────── -->
    <UCard v-if="wageRecords.length" class="hidden md:block overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
            <tr>
              <th v-for="col in desktopColumns" :key="col.key"
                class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider"
                :class="col.sortable ? 'cursor-pointer hover:bg-indigo-700' : ''"
                @click="col.sortable ? sortWageRecords(col.key) : undefined"
              >
                <div class="flex items-center gap-1">
                  <div v-if="col.sub" class="flex flex-col">
                    <span>{{ col.label }}</span>
                    <span class="text-xs opacity-80 normal-case font-normal">{{ col.sub }}</span>
                  </div>
                  <span v-else>{{ col.label }}</span>
                  <UIcon
                    v-if="col.sortable && sortColumn === col.key"
                    :name="sortDirection === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="h-3 w-3"
                  />
                  <UIcon v-else-if="col.sortable" name="i-lucide-chevrons-up-down" class="h-3 w-3 opacity-50" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(wage, index) in wageRecords" :key="wage._id" class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td class="px-2 py-3 whitespace-nowrap text-xs font-medium">{{ wage.slNo }}</td>
              <td class="px-2 py-3 whitespace-nowrap text-xs">{{ wage.employeeName }}</td>
              <td class="px-2 py-3 whitespace-nowrap text-xs">{{ wage.bank }}</td>
              <td class="px-2 py-3 whitespace-nowrap text-xs">{{ wage.accountNo }}</td>
              <!-- Per Day Wage -->
              <td class="px-2 py-3 whitespace-nowrap">
                <UInput type="number" v-model="wage.pDayWage" size="xs" class="w-20" @change="calculateWage(index)" />
              </td>
              <!-- Days -->
              <td class="px-2 py-3 whitespace-nowrap">
                <UInput type="number" v-model="wage.wage_Days" size="xs" class="w-14" @change="calculateWage(index)" />
              </td>
              <!-- Gross (readonly) -->
              <td class="px-2 py-3 whitespace-nowrap text-xs">₹{{ wage.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</td>
              <!-- EPF (readonly) -->
              <td class="px-2 py-3 whitespace-nowrap text-xs">₹{{ wage.epf_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</td>
              <!-- ESIC (readonly) -->
              <td class="px-2 py-3 whitespace-nowrap text-xs">₹{{ wage.esic_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</td>
              <!-- Other Deduction -->
              <td class="px-2 py-3 whitespace-nowrap">
                <UInput type="number" v-model="wage.other_deduction" size="xs" class="w-20" @change="calculateWage(index)" />
              </td>
              <!-- Advance Recovery -->
              <td class="px-2 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1">
                  <UInput
                    type="number"
                    v-model="wage.advance_recovery"
                    size="xs"
                    :color="wage.hasAdvances && wage.selectedAdvanceId ? 'success' : undefined"
                    class="w-20"
                    :title="wage.hasAdvances && wage.selectedAdvanceId ? 'Prefilled with installment amount' : ''"
                    @change="calculateWage(index)"
                  />
                  <UButton v-if="wage.masterRollId" size="xs" variant="ghost" :color="wage.hasAdvances ? 'error' : 'primary'" icon="i-lucide-eye" @click="showAdvancesModal_open(wage.masterRollId, index)" />
                </div>
              </td>
              <!-- Other Benefit -->
              <td class="px-2 py-3 whitespace-nowrap">
                <UInput type="number" v-model="wage.other_benefit" size="xs" class="w-20" @change="calculateWage(index)" />
              </td>
              <!-- Net Salary (readonly) -->
              <td class="px-2 py-3 whitespace-nowrap text-xs font-medium text-indigo-700 dark:text-indigo-300">
                ₹{{ wage.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>
              <!-- Mark for deletion -->
              <td class="px-2 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1">
                  <UCheckbox v-model="wage.markedForDeletion" color="error" />
                  <span v-if="wage.markedForDeletion" class="text-xs text-red-600">Delete</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Loading -->
    <UCard v-else-if="loading" class="mt-6 text-center py-10">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-loader-circle" class="h-10 w-10 animate-spin text-indigo-500" />
        <p class="text-gray-600 dark:text-gray-400">Loading wage records…</p>
      </div>
    </UCard>

    <!-- No data -->
    <UCard v-else-if="selectedMonth" class="mt-6 text-center py-10">
      <p class="text-gray-500 dark:text-gray-400">No wage records found for the selected month.</p>
    </UCard>

    <!-- Initial -->
    <UCard v-else class="mt-6 text-center py-10">
      <p class="text-gray-500 dark:text-gray-400">Please select a month to load wage records.</p>
    </UCard>

    <!-- ── Advances Modal ─────────────────────────────────────────────── -->
    <UModal v-model:open="showAdvancesModal" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h3 class="text-lg font-semibold text-white">Outstanding Advances</h3>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="closeAdvancesModal" />
            </div>
          </template>

          <div class="p-4">
            <div v-if="loadingAdvances" class="py-6 text-center text-gray-500">
              <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin mx-auto mb-2" />Loading advances…
            </div>
            <div v-else-if="employeeAdvances.length === 0" class="py-6 text-center text-gray-500">
              No outstanding advances found for this employee.
            </div>
            <div v-else>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Employee: <span class="font-medium text-gray-900 dark:text-white">{{ currentEmployeeName }}</span></p>
              <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="advance in employeeAdvances" :key="advance._id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ formatDate(advance.date) }}</td>
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.amount }}</td>
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.remainingBalance }}</td>
                      <td class="px-4 py-2 whitespace-nowrap">
                        <UButton size="xs" variant="ghost" color="primary" :disabled="advance.remainingBalance <= 0" @click="applyAdvanceRecovery(advance)">Apply</UButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="soft" @click="closeAdvancesModal">Close</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { usePageTitle } from '~/composables/ui/usePageTitle'
import { useLedgers } from '~/composables/expenses/useLedgers'
import { useEpfEsicRules } from '~/composables/business/useEpfEsicRules'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

// ─── Page setup ───────────────────────────────────────────────────────────────
definePageMeta({ requiresAuth: true })
usePageTitle('Edit Wages', 'Edit and update employee wage records')

const api   = useApiWithAuth()
const toast = useToast()

// Hoist composables — must not be called inside functions in Nuxt v4
const { bankLedgers, fetchLedgers, isLoading: loadingLedgers } = useLedgers()
const { calculateWithCurrentRules } = useEpfEsicRules()

// ─── State ────────────────────────────────────────────────────────────────────
const selectedMonth  = ref('')
const chequeFilter   = ref('')
const wageRecords    = ref<any[]>([])
const allWages       = ref<any[]>([])
const originalWages  = ref<any[]>([])
const loading        = ref(false)
const searchQuery    = ref('')

const paymentDetails = reactive({ paid_date: '', cheque_no: '', paid_from_bank_ac: '' })
const selectedBankId = ref('')

const sortColumn    = ref('employeeName')
const sortDirection = ref<'asc' | 'desc'>('asc')

const showAdvancesModal  = ref(false)
const loadingAdvances    = ref(false)
const employeeAdvances   = ref<any[]>([])
const currentEmployeeIndex = ref(-1)
const currentEmployeeId  = ref('')
const currentEmployeeName = ref('')

// ─── Table column definitions ─────────────────────────────────────────────────
const desktopColumns = [
  { key: 'slNo',             label: 'Sl. No.',   sortable: true },
  { key: 'employeeName',     label: 'Employee',   sortable: true },
  { key: 'bank',             label: 'Bank',       sortable: true },
  { key: 'accountNo',        label: 'Account',    sortable: true },
  { key: 'pDayWage',         label: 'Per Day',    sub: 'Wage',       sortable: false },
  { key: 'wage_Days',        label: 'Days',       sortable: false },
  { key: 'gross_salary',     label: 'Gross',      sub: 'Salary',     sortable: false },
  { key: 'epf_deduction',    label: 'EPF',        sub: '(12%)',      sortable: false },
  { key: 'esic_deduction',   label: 'ESIC',       sub: '(0.75%)',    sortable: false },
  { key: 'other_deduction',  label: 'Other',      sub: 'Deduction',  sortable: false },
  { key: 'advance_recovery', label: 'Advance',    sub: 'Recovery',   sortable: false },
  { key: 'other_benefit',    label: 'Other',      sub: 'Benefit',    sortable: false },
  { key: 'net_salary',       label: 'Net',        sub: 'Salary',     sortable: false },
  { key: 'markedForDeletion',label: 'Mark for',   sub: 'Deletion',   sortable: false },
]

// ─── Computed ─────────────────────────────────────────────────────────────────
const uniqueChequeNumbers = computed(() => {
  const nos = allWages.value.map(w => w.cheque_no).filter(Boolean)
  return [...new Set(nos)].sort()
})

const chequeItems = computed(() => [
  { label: 'All', value: '' },
  ...uniqueChequeNumbers.value.map(c => ({ label: String(c), value: String(c) }))
])

const bankItems = computed(() => [
  { label: '-- Select Bank --', value: '' },
  ...bankLedgers.value.map((b: any) => ({
    label: `${b.name} - ${b.bankDetails?.accountNumber || 'N/A'}`,
    value: b.id
  }))
])

// ─── Helpers ──────────────────────────────────────────────────────────────────
const notify = (msg: string, type: 'success' | 'error' | 'warning' = 'success') =>
  toast.add({ title: type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error', description: msg, color: type })

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

const processWageRecord = (wage: any, index: number) => ({
  ...wage,
  slNo: index + 1,
  pDayWage: Number(wage.pDayWage) || 0,
  wage_Days: Number(wage.wage_Days) || 0,
  gross_salary: Number(wage.gross_salary) || 0,
  epf_deduction: Number(wage.epf_deduction) || 0,
  esic_deduction: Number(wage.esic_deduction) || 0,
  other_deduction: Number(wage.other_deduction) || 0,
  advance_recovery: Number(wage.advance_recovery) || 0,
  selectedAdvanceId: wage.advance_recovery_id || null,
  hasAdvances: wage.hasAdvances || false,
  other_benefit: Number(wage.other_benefit) || 0,
  net_salary: Number(wage.net_salary) || 0,
  paid_date: wage.paid_date ? new Date(wage.paid_date).toISOString().split('T')[0] : '',
  markedForDeletion: false,
})

// ─── Sort / filter ────────────────────────────────────────────────────────────
const applySorting = () => {
  wageRecords.value.sort((a, b) => {
    let va = a[sortColumn.value], vb = b[sortColumn.value]
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (!isNaN(Number(va)) && !isNaN(Number(vb))) { va = Number(va); vb = Number(vb) }
    if (va < vb) return sortDirection.value === 'asc' ? -1 : 1
    if (va > vb) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
}

const sortWageRecords = (column: string) => {
  sortDirection.value = sortColumn.value === column
    ? (sortDirection.value === 'asc' ? 'desc' : 'asc')
    : 'asc'
  sortColumn.value = column
  applySorting()
}

const filterWageRecords = () => {
  let filtered = chequeFilter.value
    ? allWages.value.filter(w => w.cheque_no === chequeFilter.value)
    : [...allWages.value]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(w =>
      (w.slNo && String(w.slNo).includes(q)) ||
      w.employeeName.toLowerCase().includes(q) ||
      w.bank.toLowerCase().includes(q) ||
      (w.branch && w.branch.toLowerCase().includes(q)) ||
      String(w.accountNo).includes(q) ||
      (w.ifsc && w.ifsc.toLowerCase().includes(q))
    )
  }

  wageRecords.value = filtered.map(processWageRecord)
  if (sortColumn.value) applySorting()
}

watch(searchQuery, filterWageRecords)

// ─── Bank selection watcher ───────────────────────────────────────────────────
watch(selectedBankId, (id) => {
  if (!id) { paymentDetails.paid_from_bank_ac = ''; return }
  const bank = bankLedgers.value.find((b: any) => b.id === id)
  if (bank) paymentDetails.paid_from_bank_ac = bank.bankDetails?.accountNumber || ''
})

// ─── API: load wage records ───────────────────────────────────────────────────
const loadWageRecords = async () => {
  if (!selectedMonth.value) return
  loading.value    = true
  wageRecords.value = []
  try {
    const response   = await api.get('/api/wages', { params: { month: selectedMonth.value } })
    const data       = response?.data?.value || response?.value || response
    if (data?.wages?.length) {
      allWages.value      = data.wages
      originalWages.value = JSON.parse(JSON.stringify(data.wages))

      const filtered = chequeFilter.value
        ? data.wages.filter((w: any) => w.cheque_no === chequeFilter.value)
        : data.wages

      wageRecords.value = filtered.map(processWageRecord)

      if (wageRecords.value.length > 0) {
        paymentDetails.paid_date         = wageRecords.value[0].paid_date || ''
        paymentDetails.cheque_no         = wageRecords.value[0].cheque_no || ''
        paymentDetails.paid_from_bank_ac = wageRecords.value[0].paid_from_bank_ac || ''
      }

      sortColumn.value    = 'employeeName'
      sortDirection.value = 'asc'
      applySorting()

      await checkEmployeesForAdvances()
    } else {
      wageRecords.value = []
    }
  } catch (e) {
    wageRecords.value = []
    console.error('Error loading wage records:', e)
  } finally {
    loading.value = false
  }
}

// ─── Calculate single wage ────────────────────────────────────────────────────
const calculateWage = (index: number) => {
  const wage = wageRecords.value[index]
  if (!wage) return
  wage.gross_salary     = Number(wage.pDayWage) * Number(wage.wage_Days)
  const calcs           = calculateWithCurrentRules(wage.gross_salary)
  wage.epf_deduction    = calcs.employeeEpf
  wage.esic_deduction   = calcs.employeeEsic
  wage.other_deduction  = Number(wage.other_deduction) || 0
  wage.advance_recovery = Number(wage.advance_recovery) || 0
  wage.other_benefit    = Number(wage.other_benefit) || 0
  wage.net_salary       = Math.round((wage.gross_salary - (wage.epf_deduction + wage.esic_deduction + wage.other_deduction + wage.advance_recovery) + wage.other_benefit) * 100) / 100
}

// ─── Save wages ───────────────────────────────────────────────────────────────
const saveWages = async () => {
  if (!selectedMonth.value || !paymentDetails.paid_date) {
    notify('Please select a month and payment date', 'error'); return
  }
  loading.value = true
  try {
    const toDelete  = wageRecords.value.filter(w => w.markedForDeletion).map(w => w._id)
    const toUpdate  = wageRecords.value.filter(w => !w.markedForDeletion).map(w => ({
      ...w, salary_month: new Date(selectedMonth.value),
      paid_date: paymentDetails.paid_date,
      cheque_no: paymentDetails.cheque_no,
      paid_from_bank_ac: paymentDetails.paid_from_bank_ac
    }))

    const response = await api.put('/api/wages/bulk', { wages: toUpdate, deleteIds: toDelete })
    if (response.success) {
      notify(`Successfully updated ${response.updatedCount || toUpdate.length} wage records.`)
      await loadWageRecords()
    } else {
      notify(response.message || 'Failed to save wage changes', 'error')
    }
  } catch (e: any) {
    console.error('Error saving wages:', e)
    notify('Failed to save wages. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

// ─── Advances ─────────────────────────────────────────────────────────────────
const checkEmployeesForAdvances = async () => {
  try {
    const employeeIds = wageRecords.value.filter(w => w.masterRollId).map(w => w.masterRollId)
    if (!employeeIds.length) return
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 15_000)
    const response = await api.post('/api/employee-advances/background-check', { employeeIds }, { signal: controller.signal })
    clearTimeout(tid)
    if (response.success && response.data) {
      response.data.forEach((ad: any) => {
        const idx = wageRecords.value.findIndex(w => w.masterRollId === ad.employeeId)
        if (idx < 0) return
        wageRecords.value[idx].hasAdvances    = ad.hasAdvances
        wageRecords.value[idx].totalOutstanding = ad.totalOutstanding
        wageRecords.value[idx].advanceCount   = ad.advanceCount
        if (ad.hasAdvances && ad.firstAdvance?.repaymentTerms?.installmentAmount) {
          const amt = Math.min(ad.firstAdvance.repaymentTerms.installmentAmount, ad.firstAdvance.remainingBalance)
          wageRecords.value[idx].advance_recovery  = amt
          wageRecords.value[idx].selectedAdvanceId = ad.firstAdvance._id
          calculateWage(idx)
        }
      })
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') console.warn('Advance check failed:', e.message)
  }
}

const showAdvancesModal_open = async (employeeId: string, index: number) => {
  currentEmployeeId.value   = employeeId
  currentEmployeeIndex.value = index
  currentEmployeeName.value = wageRecords.value[index].employeeName
  showAdvancesModal.value   = true
  loadingAdvances.value     = true
  employeeAdvances.value    = []
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8_000)
    const response = await api.get(`/api/employee-advances/by-employee/${employeeId}`, { signal: controller.signal })
    clearTimeout(tid)
    if (response.success && response.advances) {
      employeeAdvances.value                          = response.advances
      wageRecords.value[index].hasAdvances            = response.advances.length > 0
    }
  } catch (e: any) {
    const msg = e.name === 'AbortError' ? 'Request timed out. Please try again.'
      : e.statusCode === 503 ? 'Database service temporarily unavailable. Please try again.'
      : 'Failed to load advances. Please try again.'
    notify(msg, 'error')
  } finally {
    loadingAdvances.value = false
  }
}

// Alias for mobile/desktop to call the same function
const showAdvances = showAdvancesModal_open

const closeAdvancesModal = () => {
  showAdvancesModal.value    = false
  currentEmployeeId.value    = ''
  currentEmployeeIndex.value = -1
  employeeAdvances.value     = []
}

const applyAdvanceRecovery = (advance: any) => {
  if (currentEmployeeIndex.value < 0) return
  const wage = wageRecords.value[currentEmployeeIndex.value]
  const gross = Number(wage.pDayWage) * Number(wage.wage_Days)
  const calcs = calculateWithCurrentRules(gross)
  const netBefore = gross - (calcs.employeeEpf + calcs.employeeEsic + (Number(wage.other_deduction) || 0)) + (Number(wage.other_benefit) || 0)
  wage.advance_recovery  = Math.min(advance.remainingBalance, Math.max(0, netBefore))
  wage.selectedAdvanceId = advance._id
  calculateWage(c-urrentEmployeeIndex.value)
  closeAdvancesModal()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  try { await fetchLedgers('bank') } catch (e) { console.error('Error fetching bank ledgers:', e) }
})
</script>