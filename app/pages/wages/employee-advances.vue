<template>
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Employee Advances</h1>
      <UButton color="primary" icon="i-lucide-plus" @click="openAddModal">
        Add New Advance
      </UButton>
    </div>

    <!-- ── Advances Table ────────────────────────────────────────────── -->
    <UCard class="overflow-hidden mb-4">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Employee</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Amount</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Purpose</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Remaining</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="loading">
              <td colspan="7" class="px-6 py-8 text-center">
                <div class="flex justify-center items-center gap-2 text-gray-500">
                  <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              </td>
            </tr>
            <tr v-else-if="advances.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">No advances found</td>
            </tr>
            <tr v-for="advance in advances" :key="advance._id" class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ advance.employeeName }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">₹{{ advance.amount.toFixed(2) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">{{ formatDate(advance.date) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">{{ advance.purpose }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <UBadge :color="statusColor(advance.status)" variant="soft" size="sm">
                  {{ formatStatus(advance.status) }}
                </UBadge>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">₹{{ advance.remainingBalance.toFixed(2) }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <UButton size="xs" variant="ghost" color="primary" @click="viewAdvance(advance)">View</UButton>
                  <UButton v-if="advance.status === 'pending' || advance.status === 'approved'" size="xs" variant="ghost" color="success" @click="editAdvance(advance)">Edit</UButton>
                  <UButton v-if="advance.status === 'pending'" size="xs" variant="ghost" color="error" @click="deleteAdvance(advance._id)">Delete</UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- ── Pagination ─────────────────────────────────────────────────── -->
    <div class="flex justify-between items-center">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Showing {{ advances.length }} of {{ pagination.total }} advances
      </p>
      <div class="flex gap-2">
        <UButton size="sm" variant="outline" :disabled="pagination.page === 1" @click="changePage(pagination.page - 1)">Previous</UButton>
        <UButton size="sm" variant="outline" :disabled="pagination.page === pagination.pages" @click="changePage(pagination.page + 1)">Next</UButton>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADD / EDIT ADVANCE MODAL                                       -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showAddModal" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h2 class="text-xl font-bold text-white">{{ editingAdvance._id ? 'Edit Advance' : 'Add New Advance' }}</h2>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="showAddModal = false" />
            </div>
          </template>

          <div class="p-6 space-y-4">
            <!-- Employee search -->
            <UFormField label="Employee" required>
              <div ref="employeeDropdownRef" class="relative">
                <UInput
                  v-model="searchEmployeeName"
                  placeholder="Search employee by name"
                  class="w-full"
                  @input="filterEmployeeList"
                  @focus="showEmployeeDropdown = true"
                  @blur="handleBlur"
                  @keydown="handleKeyDown"
                />
                <!-- Selected employee chip -->
                <div v-if="editingAdvance.masterRollId" class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
                  <div class="font-medium text-blue-800 dark:text-blue-300">{{ selectedEmployeeName }}</div>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <UBadge color="success" variant="soft" size="xs">{{ getEmployeeById(editingAdvance.masterRollId)?.category || 'N/A' }}</UBadge>
                    <UBadge v-if="getEmployeeById(editingAdvance.masterRollId)?.project" color="secondary" variant="soft" size="xs">
                      Project: {{ getEmployeeById(editingAdvance.masterRollId)?.project }}
                    </UBadge>
                    <UBadge v-if="getEmployeeById(editingAdvance.masterRollId)?.site" color="warning" variant="soft" size="xs">
                      Site: {{ getEmployeeById(editingAdvance.masterRollId)?.site }}
                    </UBadge>
                  </div>
                </div>
                <!-- Dropdown list -->
                <div
                  v-if="showEmployeeDropdown && filteredEmployeeList.length > 0"
                  ref="dropdownContainerRef"
                  class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 overflow-auto border border-gray-200 dark:border-gray-700"
                >
                  <div
                    v-for="(employee, idx) in filteredEmployeeList"
                    :key="employee._id"
                    :ref="el => { if (highlightedIndex === idx) highlightedItemRef = el as HTMLElement }"
                    class="cursor-pointer px-4 py-2 border-l-4 transition-colors"
                    :class="[getEmployeeBorderColor(employee), highlightedIndex === idx ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700']"
                    @click="selectEmployee(employee)"
                    @mouseover="highlightedIndex = idx"
                  >
                    <div class="font-medium text-sm text-gray-900 dark:text-white">{{ employee.employeeName }}</div>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <UBadge color="success" variant="soft" size="xs">{{ employee.category || 'N/A' }}</UBadge>
                      <UBadge v-if="employee.project" color="secondary" variant="soft" size="xs">{{ employee.project }}</UBadge>
                      <UBadge v-if="employee.site" color="warning" variant="soft" size="xs">{{ employee.site }}</UBadge>
                    </div>
                  </div>
                </div>
                <!-- No results -->
                <div v-if="showEmployeeDropdown && searchEmployeeName && filteredEmployeeList.length === 0"
                     class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-3 px-4 text-center text-gray-500 text-sm border border-gray-200 dark:border-gray-700">
                  No employees found matching "{{ searchEmployeeName }}"
                </div>
              </div>
              <p v-if="!editingAdvance.masterRollId" class="text-xs text-red-500 mt-1">Please select an employee from the list</p>
            </UFormField>

            <UFormField label="Amount (₹)" required>
              <UInput type="number" v-model="editingAdvance.amount" min="1" step="0.01" class="w-full" />
            </UFormField>

            <UFormField label="Date" required>
              <UInput type="date" v-model="editingAdvance.date" class="w-full" />
            </UFormField>

            <UFormField label="Purpose" required>
              <UInput v-model="editingAdvance.purpose" class="w-full" />
            </UFormField>

            <UFormField label="Monthly Installment (₹)" required>
              <UInput type="number" v-model="editingAdvance.repaymentTerms.installmentAmount" min="1" step="0.01" class="w-full" />
            </UFormField>

            <UFormField label="Duration (Months)" required>
              <UInput type="number" v-model="editingAdvance.repaymentTerms.durationMonths" min="1" class="w-full" />
            </UFormField>

            <UFormField v-if="editingAdvance._id" label="Status" required>
              <USelect v-model="editingAdvance.status" :items="statusItems(editingAdvance)" class="w-full" />
            </UFormField>
          </div>

          <template #footer>
            <div class="bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-4 flex justify-end gap-2 rounded-b-xl">
              <UButton color="error" variant="soft" icon="i-lucide-x" @click="showAddModal = false">Cancel</UButton>
              <UButton color="primary" icon="i-lucide-check" @click="saveAdvance">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- VIEW ADVANCE MODAL                                             -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showViewModal" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h2 class="text-xl font-bold text-white">Advance Details</h2>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="showViewModal = false" />
            </div>
          </template>

          <div v-if="selectedAdvance" class="p-6">
            <!-- Detail grid -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div v-for="field in advanceDetailFields" :key="field.label">
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ field.label }}</p>
                <p class="font-medium text-gray-900 dark:text-white text-sm mt-0.5">
                  <template v-if="field.type === 'badge'">
                    <UBadge :color="statusColor(selectedAdvance.status)" variant="soft" size="sm">
                      {{ formatStatus(selectedAdvance.status) }}
                    </UBadge>
                  </template>
                  <template v-else>{{ field.value }}</template>
                </p>
              </div>
            </div>

            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Recovery History</h3>

            <div v-if="recoveries.length === 0" class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500 text-sm">
              No recoveries recorded yet
            </div>

            <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="recovery in recoveries" :key="recovery._id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td class="px-4 py-2 whitespace-nowrap text-xs">{{ formatDate(recovery.recoveryDate) }}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-xs">₹{{ recovery.recoveryAmount.toFixed(2) }}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-xs">{{ formatRecoveryMethod(recovery.recoveryMethod) }}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-xs">{{ recovery.remarks || '—' }}</td>
                    <td class="px-4 py-2 whitespace-nowrap">
                      <UButton size="xs" variant="ghost" color="error" @click="deleteRecovery(recovery._id)">Delete</UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-4 flex gap-2">
              <UButton color="success" icon="i-lucide-plus" :disabled="selectedAdvance.remainingBalance === 0" @click="showAddRecoveryModal = true">
                Add Recovery
              </UButton>
              <UButton color="primary" icon="i-lucide-refresh-cw" :loading="recalculateLoading" @click="recalculateAdvanceBalance">
                {{ recalculateLoading ? 'Recalculating…' : 'Recalculate Balance' }}
              </UButton>
            </div>
          </div>

          <template #footer>
            <div class="px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="soft" @click="showViewModal = false">Close</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADD RECOVERY MODAL                                             -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showAddRecoveryModal" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h2 class="text-xl font-bold text-white">Add Recovery</h2>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="showAddRecoveryModal = false" />
            </div>
          </template>

          <div class="p-6 space-y-4">
            <UFormField label="Recovery Amount (₹)" required :hint="`Maximum: ₹${selectedAdvance?.remainingBalance.toFixed(2)}`">
              <UInput type="number" v-model="newRecovery.recoveryAmount" min="1" :max="selectedAdvance?.remainingBalance" step="0.01" class="w-full" />
            </UFormField>

            <UFormField label="Recovery Date" required>
              <UInput type="date" v-model="newRecovery.recoveryDate" class="w-full" />
            </UFormField>

            <UFormField label="Recovery Method" required>
              <USelect v-model="newRecovery.recoveryMethod" :items="recoveryMethodItems" class="w-full" />
            </UFormField>

            <UFormField label="Remarks">
              <UTextarea v-model="newRecovery.remarks" :rows="2" class="w-full" />
            </UFormField>
          </div>

          <template #footer>
            <div class="bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-4 flex justify-end gap-2 rounded-b-xl">
              <UButton color="error" variant="soft" icon="i-lucide-x" @click="showAddRecoveryModal = false">Cancel</UButton>
              <UButton color="primary" icon="i-lucide-check" @click="saveRecovery">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

// ─── Page setup ───────────────────────────────────────────────────────────────
const api   = useApiWithAuth()
const toast = useToast()

// ─── State ────────────────────────────────────────────────────────────────────
const advances              = ref<any[]>([])
const employees             = ref<any[]>([])
const loading               = ref(true)
const recalculateLoading    = ref(false)
const showAddModal          = ref(false)
const showViewModal         = ref(false)
const showAddRecoveryModal  = ref(false)
const selectedAdvance       = ref<any>(null)
const recoveries            = ref<any[]>([])
const selectedEmployeeName  = ref('')
const searchEmployeeName    = ref('')
const filteredEmployeeList  = ref<any[]>([])
const showEmployeeDropdown  = ref(false)
const highlightedIndex      = ref(-1)
const dropdownContainerRef  = ref<HTMLElement | null>(null)
let   highlightedItemRef: HTMLElement | null = null
const employeeDropdownRef   = ref<HTMLElement | null>(null)

const pagination = reactive({ total: 0, page: 1, limit: 10, pages: 1 })

const editingAdvance = reactive<any>({
  _id: '', masterRollId: '', amount: 0,
  date: new Date().toISOString().split('T')[0],
  purpose: '', repaymentTerms: { installmentAmount: 0, durationMonths: 1 },
  status: 'pending', remainingBalance: 0
})

const newRecovery = reactive({
  recoveryAmount: 0,
  recoveryDate: new Date().toISOString().split('T')[0],
  recoveryMethod: 'salary_deduction',
  remarks: ''
})

// ─── Static option lists ──────────────────────────────────────────────────────
const recoveryMethodItems = [
  { label: 'Salary Deduction', value: 'salary_deduction' },
  { label: 'Direct Payment',   value: 'direct_payment' },
]

const statusItems = (advance: any) => [
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Paid',     value: 'paid' },
  ...(advance.amount !== advance.remainingBalance ? [{ label: 'Partially Recovered', value: 'partially_recovered' }] : []),
  ...(advance.remainingBalance === 0 ? [{ label: 'Fully Recovered', value: 'fully_recovered' }] : []),
]

// ─── Computed ─────────────────────────────────────────────────────────────────
const advanceDetailFields = computed(() => {
  if (!selectedAdvance.value) return []
  const a = selectedAdvance.value
  return [
    { label: 'Employee',          value: a.employeeName },
    { label: 'Amount',            value: `₹${a.amount.toFixed(2)}` },
    { label: 'Date',              value: formatDate(a.date) },
    { label: 'Purpose',           value: a.purpose },
    { label: 'Status',            value: '', type: 'badge' },
    { label: 'Remaining Balance', value: `₹${a.remainingBalance.toFixed(2)}` },
    { label: 'Monthly Installment', value: `₹${a.repaymentTerms.installmentAmount.toFixed(2)}` },
    { label: 'Duration',          value: `${a.repaymentTerms.durationMonths} months` },
  ]
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
const notify = (msg: string, type: 'success' | 'error' | 'warning' = 'success') =>
  toast.add({ title: type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error', description: msg, color: type })

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

const formatStatus = (status: string) => {
  const map: Record<string, string> = { pending: 'Pending', approved: 'Approved', paid: 'Paid', partially_recovered: 'Partially Recovered', fully_recovered: 'Fully Recovered' }
  return map[status] ?? status
}

const formatRecoveryMethod = (method: string) => method === 'salary_deduction' ? 'Salary Deduction' : method === 'direct_payment' ? 'Direct Payment' : method

const statusColor = (status: string) => {
  const map: Record<string, string> = { pending: 'warning', approved: 'primary', paid: 'secondary', partially_recovered: 'warning', fully_recovered: 'success' }
  return map[status] ?? 'neutral'
}

const getEmployeeBorderColor = (employee: any) => {
  const cat = employee.category?.toLowerCase() ?? ''
  if (cat.includes('helper'))     return 'border-blue-500'
  if (cat.includes('mason'))      return 'border-green-500'
  if (cat.includes('carpenter'))  return 'border-yellow-500'
  if (cat.includes('labour'))     return 'border-red-500'
  if (cat.includes('supervisor')) return 'border-purple-500'
  const c = employee.employeeName.charCodeAt(0)
  if (c < 101) return 'border-pink-500'
  if (c < 106) return 'border-orange-500'
  if (c < 111) return 'border-teal-500'
  if (c < 116) return 'border-indigo-500'
  return 'border-gray-500'
}

const getEmployeeById = (id: string) => employees.value.find(e => e._id === id) ?? null

// ─── Employee dropdown ────────────────────────────────────────────────────────
const filterEmployeeList = () => {
  if (!searchEmployeeName.value) { filteredEmployeeList.value = employees.value.slice(0, 10); return }
  const s = searchEmployeeName.value.toLowerCase()
  filteredEmployeeList.value = employees.value.filter(e =>
    e.employeeName.toLowerCase().includes(s) ||
    (e.project && e.project.toLowerCase().includes(s)) ||
    (e.site && e.site.toLowerCase().includes(s))
  ).slice(0, 10)
  highlightedIndex.value = -1
}

const handleBlur = () => setTimeout(() => { showEmployeeDropdown.value = false }, 200)

const handleKeyDown = (event: KeyboardEvent) => {
  if (!showEmployeeDropdown.value) {
    if (event.key === 'ArrowDown') { showEmployeeDropdown.value = true; event.preventDefault() }
    return
  }
  const len = filteredEmployeeList.value.length
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = highlightedIndex.value < len - 1 ? highlightedIndex.value + 1 : 0
      ensureHighlightedVisible(); break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value = highlightedIndex.value > 0 ? highlightedIndex.value - 1 : len - 1
      ensureHighlightedVisible(); break
    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0) selectEmployee(filteredEmployeeList.value[highlightedIndex.value]); break
    case 'Escape':
      event.preventDefault()
      showEmployeeDropdown.value = false; break
  }
}

const ensureHighlightedVisible = () => {
  setTimeout(() => {
    if (highlightedItemRef && dropdownContainerRef.value) {
      const c = dropdownContainerRef.value.getBoundingClientRect()
      const i = highlightedItemRef.getBoundingClientRect()
      if (i.bottom > c.bottom) dropdownContainerRef.value.scrollTop += i.bottom - c.bottom
      else if (i.top < c.top) dropdownContainerRef.value.scrollTop -= c.top - i.top
    }
  }, 0)
}

const selectEmployee = (employee: any) => {
  editingAdvance.masterRollId   = employee._id
  selectedEmployeeName.value    = employee.employeeName
  searchEmployeeName.value      = employee.employeeName
  showEmployeeDropdown.value    = false
  highlightedIndex.value        = -1
}

const handleClickOutside = (event: MouseEvent) => {
  if (employeeDropdownRef.value && !employeeDropdownRef.value.contains(event.target as Node)) {
    showEmployeeDropdown.value = false
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchAdvances = async () => {
  loading.value = true
  try {
    const data = await api.get(`/api/employee-advances?page=${pagination.page}&limit=${pagination.limit}`)
    advances.value       = data.advances
    pagination.total     = data.pagination.total
    pagination.pages     = data.pagination.pages
  } catch {
    notify('Error loading advances. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

const fetchEmployeesMasterRoll = async () => {
  try {
    const data = await api.get('/api/master-roll')
    if (data?.employees) {
      employees.value          = data.employees
      filteredEmployeeList.value = employees.value.slice(0, 10)
    } else {
      notify('No employees found. Please add employees first.', 'warning')
    }
  } catch {
    notify('Error loading employees. Please try again.', 'error')
  }
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.pages) return
  pagination.page = page
  fetchAdvances()
}

const openAddModal = () => {
  Object.assign(editingAdvance, { _id: '', masterRollId: '', amount: 0, date: new Date().toISOString().split('T')[0], purpose: '', repaymentTerms: { installmentAmount: 0, durationMonths: 1 }, status: 'pending', remainingBalance: 0 })
  selectedEmployeeName.value   = ''
  searchEmployeeName.value     = ''
  showEmployeeDropdown.value   = false
  highlightedIndex.value       = -1
  filteredEmployeeList.value   = employees.value.slice(0, 10)
  showAddModal.value           = true
}

const editAdvance = (advance: any) => {
  Object.assign(editingAdvance, {
    _id: advance._id, masterRollId: advance.masterRollId, amount: advance.amount,
    date: new Date(advance.date).toISOString().split('T')[0],
    purpose: advance.purpose,
    repaymentTerms: { installmentAmount: advance.repaymentTerms.installmentAmount, durationMonths: advance.repaymentTerms.durationMonths },
    status: advance.status, remainingBalance: advance.remainingBalance
  })
  const emp = employees.value.find(e => e._id === advance.masterRollId)
  selectedEmployeeName.value = emp?.employeeName ?? ''
  searchEmployeeName.value   = emp?.employeeName ?? ''
  showEmployeeDropdown.value = false
  filteredEmployeeList.value = employees.value.slice(0, 10)
  showAddModal.value         = true
}

const saveAdvance = async () => {
  if (!editingAdvance.masterRollId) { notify('Please select a valid employee from the list', 'error'); return }
  try {
    const data = editingAdvance._id
      ? await api.put(`/api/employee-advances/${editingAdvance._id}`, editingAdvance)
      : await api.post('/api/employee-advances', editingAdvance)
    if (data.success) {
      showAddModal.value = false
      await fetchAdvances()
      openAddModal()  // resets form state
      showAddModal.value = false
    } else {
      notify(data.message || 'Failed to save advance', 'error')
    }
  } catch {
    notify('An error occurred while saving the advance. Please try again.', 'error')
  }
}

const deleteAdvance = async (id: string) => {
  if (!confirm('Are you sure you want to delete this advance?')) return
  try {
    const data = await api.delete(`/api/employee-advances/${id}`)
    if (data.success) await fetchAdvances()
    else notify(data.message || 'Failed to delete advance', 'error')
  } catch {
    notify('An error occurred while deleting the advance. Please try again.', 'error')
  }
}

const viewAdvance = async (advance: any) => {
  selectedAdvance.value = advance
  showViewModal.value   = true
  try {
    const data = await api.get(`/api/employee-advances/${advance._id}`)
    selectedAdvance.value = data.advance
    recoveries.value      = data.recoveries
  } catch {
    notify('Error loading advance details. Please try again.', 'error')
  }
}

const saveRecovery = async () => {
  try {
    const data = await api.post('/api/employee-advances/recoveries', { ...newRecovery, advanceId: selectedAdvance.value._id })
    if (data.success) {
      showAddRecoveryModal.value              = false
      selectedAdvance.value.remainingBalance  = data.remainingBalance
      selectedAdvance.value.status            = data.status
      await viewAdvance(selectedAdvance.value)
      await fetchAdvances()
      Object.assign(newRecovery, { recoveryAmount: 0, recoveryDate: new Date().toISOString().split('T')[0], recoveryMethod: 'salary_deduction', remarks: '' })
    } else {
      notify(data.message || 'Failed to save recovery', 'error')
    }
  } catch {
    notify('An error occurred while saving the recovery. Please try again.', 'error')
  }
}

const deleteRecovery = async (id: string) => {
  if (!confirm('Are you sure you want to delete this recovery?')) return
  try {
    const data = await api.delete(`/api/employee-advances/recoveries/${id}`)
    if (data.success) {
      selectedAdvance.value.remainingBalance = data.remainingBalance
      selectedAdvance.value.status           = data.status
      await viewAdvance(selectedAdvance.value)
      await fetchAdvances()
    } else {
      notify(data.message || 'Failed to delete recovery', 'error')
    }
  } catch {
    notify('An error occurred while deleting the recovery. Please try again.', 'error')
  }
}

const recalculateAdvanceBalance = async () => {
  if (!selectedAdvance.value?._id) return
  recalculateLoading.value = true
  try {
    const data = await api.post(`/api/employee-advances/recalculate/${selectedAdvance.value._id}`)
    if (data.success) {
      selectedAdvance.value = data.advance
      notify(`Balance recalculated. Previous: ₹${data.previousBalance.toFixed(2)} → New: ₹${data.newBalance.toFixed(2)}`)
      await viewAdvance(selectedAdvance.value)
      await fetchAdvances()
    } else {
      notify(data.message || 'Failed to recalculate balance', 'error')
    }
  } catch {
    notify('An error occurred while recalculating the balance. Please try again.', 'error')
  } finally {
    recalculateLoading.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchAdvances(), fetchEmployeesMasterRoll()])
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>