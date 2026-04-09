<template>
  <div class="container mx-auto p-3 sm:p-4">
    <h1 class="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
      Employee Wages Reports & Analytics
    </h1>

    <!-- ── Filter / Action Bar ───────────────────────────────────────── -->
    <UCard class="mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

        <!-- Action buttons -->
        <div class="col-span-full flex flex-wrap gap-2">
          <UButton
            color="success"
            icon="i-lucide-file-down"
            :loading="loading"
            :disabled="loading"
            @click="exportToExcel"
          >
            Generate PF ESIC Report
          </UButton>

          <UButton
            color="primary"
            icon="i-lucide-file-down"
            :loading="loading && hasChequeSelected"
            :disabled="loading || !hasChequeSelected"
            :title="!hasChequeSelected ? 'Please select a cheque number first' : 'Generate bank statement for selected cheque'"
            @click="generateBankStatement"
          >
            Generate Bank Statement
          </UButton>

          <UButton
            color="secondary"
            icon="i-lucide-file-down"
            :loading="loading && generatingSalarySlips"
            :disabled="loading || !selectedMonth"
            :title="!selectedMonth ? 'Please select a month first' : 'Generate salary slips for all employees'"
            @click="generateSalarySlips"
          >
            Generate Salary Slips
          </UButton>
        </div>

        <!-- Month -->
        <UFormField label="Month">
          <UInput
            type="month"
            v-model="selectedMonth"
            :max="new Date().toISOString().slice(0, 7)"
            class="w-full"
            @change="loadWages"
          />
        </UFormField>

        <!-- Cheque No -->
        <UFormField>
          <template #label>
            Cheque No
            <span v-if="!hasChequeSelected" class="text-xs text-orange-500 ml-1">(required for bank statement)</span>
          </template>
          <USelect
            v-model="chequeFilter"
            :items="chequeItems"
            :color="!hasChequeSelected ? 'warning' : undefined"
            class="w-full"
          />
        </UFormField>

        <!-- Employee filter -->
        <UFormField label="Employee Name">
          <UInput v-model="employeeFilter" placeholder="Filter by name" class="w-full" />
        </UFormField>

        <!-- Project filter -->
        <UFormField label="Project">
          <UInput v-model="projectFilter" placeholder="Filter by project" class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <!-- ── Summary ────────────────────────────────────────────────────── -->
    <UCard class="mb-4">
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
      </template>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div class="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div class="text-xs text-gray-500">Total Employees</div>
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ filteredWages.length }}</div>
        </div>
        <div class="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
          <div class="text-xs text-gray-500">Total Gross Salary</div>
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalGrossSalary) }}</div>
        </div>
        <div class="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
          <div class="text-xs text-gray-500">Total Deductions</div>
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalDeductions) }}</div>
        </div>
        <div class="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
          <div class="text-xs text-gray-500">Total Advance Recovery</div>
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalAdvanceRecovery) }}</div>
        </div>
        <div class="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <div class="text-xs text-gray-500">Total Net Salary</div>
          <div class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalNetSalary) }}</div>
        </div>
      </div>
    </UCard>

    <!-- ── Search ─────────────────────────────────────────────────────── -->
    <UCard class="mb-4">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search across all fields…"
        class="w-full"
      />
      <div v-if="searchQuery" class="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        Showing {{ filteredWages.length }} of {{ wages.length }} wage records
        <UButton size="xs" variant="ghost" color="primary" @click="searchQuery = ''">Clear</UButton>
      </div>
    </UCard>

    <!-- ── Wages Table ────────────────────────────────────────────────── -->
    <UCard v-if="filteredWages.length > 0" class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Sl. No.</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Employee Name</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Project</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Site</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Days</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Per Day</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Gross</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Deductions</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Advance</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Benefits</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Net</th>
              <th class="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Payment Date</th>
              <th class="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="wage in filteredWages"
              :key="wage._id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td class="px-3 py-3 whitespace-nowrap text-xs font-medium">{{ wage.slNo }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-xs">{{ wage.employeeName }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-xs hidden sm:table-cell">{{ wage.project }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-xs hidden md:table-cell">{{ wage.site }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs">{{ wage.wage_Days }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs">₹{{ wage.pDayWage }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs font-medium">₹{{ (wage.gross_salary || 0).toLocaleString() }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs text-red-600 hidden sm:table-cell">
                ₹{{ ((wage.epf_deduction || 0) + (wage.esic_deduction || 0) + (wage.other_deduction || 0)).toLocaleString() }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs hidden sm:table-cell">
                <span :class="(wage.advance_recovery || 0) > 0 ? 'text-red-600' : 'text-gray-400'">
                  ₹{{ (wage.advance_recovery || 0).toLocaleString() }}
                </span>
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs text-green-600 hidden sm:table-cell">
                ₹{{ (wage.other_benefit || 0).toLocaleString() }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs font-semibold">
                ₹{{ (wage.net_salary || 0).toLocaleString() }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-right text-xs text-gray-600 hidden md:table-cell">
                {{ wage.paid_date ? new Date(wage.paid_date).toLocaleDateString() : '—' }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-center">
                <UButton
                  size="xs"
                  color="secondary"
                  icon="i-lucide-file-text"
                  :disabled="loading"
                  title="Generate salary slip"
                  @click="generateSingleSalarySlip(wage._id)"
                >
                  Slip
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Loading state -->
    <UCard v-else-if="loading" class="mt-6 text-center py-10">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-loader-circle" class="h-10 w-10 animate-spin text-indigo-500" />
        <p class="text-gray-600 dark:text-gray-400">Loading wage data…</p>
      </div>
    </UCard>

    <!-- No data -->
    <UCard v-else class="mt-6 text-center py-10">
      <UIcon name="i-lucide-inbox" class="h-10 w-10 mx-auto mb-2 text-gray-300" />
      <p class="text-gray-500 dark:text-gray-400">No wage records found for the selected month.</p>
    </UCard>

  </div>
</template>

<script setup lang="ts">
import { usePageTitle } from '~/composables/ui/usePageTitle'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

// ─── Page setup ───────────────────────────────────────────────────────────────
definePageMeta({})
usePageTitle('Wages Report', 'View and export employee wage reports')

const api   = useApiWithAuth()
const toast = useToast()

// ─── State ────────────────────────────────────────────────────────────────────
const selectedMonth         = ref(new Date().toISOString().slice(0, 7))
const employeeFilter        = ref('')
const projectFilter         = ref('')
const chequeFilter          = ref('')
const searchQuery           = ref('')
const wages                 = ref<any[]>([])
const loading               = ref(false)
const generatingSalarySlips = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────
const uniqueChequeNumbers = computed(() => {
  const nos = wages.value.map(w => w.cheque_no).filter(Boolean)
  return [...new Set(nos)].sort()
})

const chequeItems = computed(() => [
  { label: 'All', value: 'all' },
  ...uniqueChequeNumbers.value.map(c => ({ label: String(c), value: String(c) }))
])

const hasChequeSelected = computed(() => !!chequeFilter.value && chequeFilter.value !== 'all')

const filteredWages = computed(() =>
  wages.value.filter(wage => {
    const nameMatch    = wage.employeeName.toLowerCase().includes(employeeFilter.value.toLowerCase())
    const projectMatch = wage.project.toLowerCase().includes(projectFilter.value.toLowerCase())
    const chequeMatch  = !chequeFilter.value || chequeFilter.value === 'all' || wage.cheque_no === chequeFilter.value

    let searchMatch = true
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      searchMatch =
        wage.employeeName.toLowerCase().includes(q) ||
        wage.project.toLowerCase().includes(q) ||
        (wage.site && wage.site.toLowerCase().includes(q)) ||
        String(wage.wage_Days).includes(q) ||
        String(wage.pDayWage).includes(q) ||
        String(wage.gross_salary).includes(q) ||
        String(wage.net_salary).includes(q) ||
        (wage.bank && wage.bank.toLowerCase().includes(q)) ||
        (wage.accountNo && String(wage.accountNo).includes(q))
    }

    return nameMatch && projectMatch && chequeMatch && searchMatch
  }).map((wage, i) => ({ ...wage, slNo: i + 1 }))
)

const totalGrossSalary     = computed(() => filteredWages.value.reduce((s, w) => s + (w.gross_salary || 0), 0))
const totalDeductions      = computed(() => filteredWages.value.reduce((s, w) => s + (w.epf_deduction || 0) + (w.esic_deduction || 0) + (w.other_deduction || 0), 0))
const totalAdvanceRecovery = computed(() => filteredWages.value.reduce((s, w) => s + (w.advance_recovery || 0), 0))
const totalNetSalary       = computed(() => filteredWages.value.reduce((s, w) => s + (w.net_salary || 0), 0))

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)

const triggerBlobDownload = (data: any, filename: string) => {
  const url  = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// ─── API calls ────────────────────────────────────────────────────────────────
const loadWages = async () => {
  loading.value = true
  wages.value   = []
  try {
    const data = await api.get('/api/wages', { params: { month: selectedMonth.value } })
    if (data?.success) wages.value = data.wages
  } catch (e) {
    console.error('Error loading wages:', e)
  } finally {
    loading.value = false
  }
}

const exportToExcel = async () => {
  loading.value = true
  try {
    const res = await api.fetchWithAuth('/api/wages/export', { method: 'POST', body: { month: selectedMonth.value }, responseType: 'blob' })
    triggerBlobDownload(res, `wages-report-${selectedMonth.value}.xlsx`)
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to export data. Please try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

const generateBankStatement = async () => {
  if (!hasChequeSelected.value) {
    toast.add({ title: 'Warning', description: 'Please select a cheque number to generate bank statement', color: 'warning' })
    return
  }
  loading.value = true
  try {
    const res = await api.fetchWithAuth('/api/wages/bank-statement', { method: 'POST', body: { month: selectedMonth.value, chequeNo: chequeFilter.value }, responseType: 'blob' })
    triggerBlobDownload(res, `bank-statement-${chequeFilter.value}-${selectedMonth.value}.xlsx`)
  } catch (e) {
    toast.add({ title: 'Error', description: 'Error generating bank statement. Please try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

const generateSalarySlips = async () => {
  if (!selectedMonth.value) {
    toast.add({ title: 'Warning', description: 'Please select a month first', color: 'warning' })
    return
  }
  loading.value = true
  generatingSalarySlips.value = true
  try {
    const res = await api.fetchWithAuth('/api/wages/salary-slips-batch', { method: 'POST', body: { month: selectedMonth.value }, responseType: 'blob' })
    triggerBlobDownload(res, `salary-slips-${selectedMonth.value}.zip`)
  } catch (e) {
    toast.add({ title: 'Error', description: 'Error generating salary slips', color: 'error' })
  } finally {
    loading.value = false
    generatingSalarySlips.value = false
  }
}

const generateSingleSalarySlip = async (wageId: string) => {
  loading.value = true
  try {
    const res  = await api.fetchWithAuth('/api/wages/salary-slip', { method: 'POST', body: { wageId }, responseType: 'blob' })
    const wage = wages.value.find(w => w._id === wageId)
    const name = wage ? wage.employeeName.replace(/\s+/g, '_') : 'employee'
    triggerBlobDownload(res, `salary-slip-${name}.docx`)
  } catch (e) {
    toast.add({ title: 'Error', description: 'Error generating salary slip', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => loadWages())
</script>