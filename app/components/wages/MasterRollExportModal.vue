<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-4xl' }">
    <template #content>
      <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">
        <template #header>
          <div class="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 rounded-t-xl flex justify-between items-center text-white text-shadow">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <UIcon name="i-lucide-file-down" class="h-6 w-6" />
              </div>
              <h2 class="text-xl font-black uppercase tracking-tighter">Export Master Roll Data</h2>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="text-white hover:text-red-200"
              @click="open = false"
            />
          </div>
        </template>

        <div class="p-6 overflow-y-auto max-h-[75vh]">
          <div class="mb-8">
            <label class="block text-xs font-black text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-widest">Export Format</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div v-for="fmt in formats" :key="fmt.id" class="relative">
                <div
                  class="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all h-full"
                  :class="exportOptions.format === fmt.id ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
                  @click="exportOptions.format = fmt.id"
                >
                  <span class="text-3xl mb-2">{{ fmt.icon }}</span>
                  <span class="font-bold uppercase text-xs tracking-widest">{{ fmt.label }}</span>
                  <span class="text-[10px] text-gray-500 mt-1">{{ fmt.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-8">
            <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-blue-800 pb-2">
              <UIcon name="i-lucide-filter" class="text-primary h-5 w-5" />
              <h3 class="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Filter Options</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <UFormField label="Joining Date Range">
                <div class="flex flex-col gap-2">
                  <UInput v-model="exportOptions.filters.dateFrom" type="date" icon="i-lucide-calendar" class="w-full" />
                  <UInput v-model="exportOptions.filters.dateTo" type="date" icon="i-lucide-calendar" class="w-full" />
                </div>
              </UFormField>
              <UFormField label="Employee Status">
                <USelect v-model="exportOptions.filters.status" :items="statusOptions" class="w-full" />
              </UFormField>
              <UFormField label="Category">
                <USelect v-model="exportOptions.filters.category" :items="categoryOptions" class="w-full" />
              </UFormField>
              <UFormField label="Project Scope">
                <USelect v-model="exportOptions.filters.project" :items="[{ label: 'All Projects', value: 'all' }, ...uniqueProjects.map(p => ({ label: p, value: p }))]" class="w-full" />
              </UFormField>
              <UFormField label="Site Location">
                <USelect v-model="exportOptions.filters.site" :items="[{ label: 'All Sites', value: 'all' }, ...uniqueSites.map(s => ({ label: s, value: s }))]" class="w-full" />
              </UFormField>
              <UFormField label="Phone Validation">
                <USelect v-model="exportOptions.filters.phoneValidation" :items="phoneStatusOptions" class="w-full" />
              </UFormField>
            </div>
          </div>

          <div class="mb-8">
            <div class="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-blue-800 pb-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-columns" class="text-primary h-5 w-5" />
                <h3 class="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Columns to Export</h3>
              </div>
              <div class="flex gap-2">
                <UButton size="xs" variant="ghost" label="Select All" @click="selectAllColumns" />
                <UButton size="xs" variant="ghost" label="Deselect All" @click="deselectAllColumns" />
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl">
              <div v-for="column in availableColumns" :key="column.key" class="flex items-center">
                <UCheckbox 
                  :model-value="exportOptions.selectedColumns.includes(column.key)" 
                  :label="column.label" 
                  @update:model-value="(checked) => {
                    if (checked) {
                      if (!exportOptions.selectedColumns.includes(column.key)) {
                        exportOptions.selectedColumns.push(column.key)
                      }
                    } else {
                      exportOptions.selectedColumns = exportOptions.selectedColumns.filter(c => c !== column.key)
                    }
                  }"
                />
              </div>
            </div>
          </div>

          <div class="mb-8">
            <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-blue-800 pb-2">
              <UIcon name="i-lucide-settings-2" class="text-primary h-5 w-5" />
              <h3 class="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Output Settings</h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UCheckbox v-model="exportOptions.respectCurrentFilters" label="Apply Current Table Filters" />
              <UCheckbox v-model="exportOptions.includeSummary" label="Include Summary Tab" :disabled="exportOptions.format === 'csv'" />
            </div>
          </div>

          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="bg-blue-500 text-white p-2 rounded-lg">
                  <UIcon name="i-lucide-info" class="h-5 w-5" />
                </div>
                <div>
                  <h4 class="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest">Impact Analysis</h4>
                  <p class="text-sm font-bold text-blue-700 dark:text-blue-400">
                    Targeting <span class="font-black text-blue-900 dark:text-white text-lg">{{ filteredRecordCount }}</span> records with <span class="font-black text-blue-900 dark:text-white text-lg">{{ exportOptions.selectedColumns.length }}</span> columns
                  </p>
                </div>
              </div>
              <div class="text-4xl grayscale opacity-30">{{ currentFormatIcon }}</div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 rounded-b-xl border-t dark:border-gray-800 flex justify-end gap-3">
            <UButton color="neutral" variant="soft" label="Cancel" @click="open = false" />
            <UButton color="primary" icon="i-lucide-download" :loading="isExporting" :disabled="exportOptions.selectedColumns.length === 0 || filteredRecordCount === 0" label="Generate Export" @click="handleExport" />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

const props = withDefaults(defineProps<{
  employees: any[]
  currentFilters: any
  searchTerm: string
  uniqueProjects: string[]
  uniqueSites: string[]
}>(), {
  employees: () => [],
  currentFilters: () => ({}),
  searchTerm: '',
  uniqueProjects: () => [],
  uniqueSites: () => []
})

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits(['export-complete'])

const isExporting = ref(false)
const api = useApiWithAuth()
const toast = useToast()

const formats = [
  { id: 'excel', label: 'Excel', icon: '📊', description: 'Formatted spreadsheet' },
  { id: 'csv', label: 'CSV', icon: '📄', description: 'Comma separated values' },
  { id: 'pdf', label: 'PDF', icon: '📋', description: 'Printable document' }
]

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'On Leave', value: 'on Leave' },
  { label: 'Terminated', value: 'terminated' },
  { label: 'Left Service', value: 'left' }
]

const categoryOptions = [
  { label: 'All Categories', value: 'all' },
  { label: 'HELPER', value: 'HELPER' },
  { label: 'TECHNICIAN', value: 'TECHNICIAN' },
  { label: 'ELECTRICIAN', value: 'ELECTRICIAN' },
  { label: 'SEMI-SKILLED', value: 'SEMI-SKILLED' },
  { label: 'HIGHLY-SKILLED', value: 'HIGHLY-SKILLED' },
  { label: 'UNSKILLED', value: 'UNSKILLED' }
]

const phoneStatusOptions = [
  { label: 'All Phone Numbers', value: 'all' },
  { label: 'Valid Phone Numbers', value: 'valid' },
  { label: 'Invalid Phone Numbers', value: 'invalid' }
]

const exportOptions = ref({
  format: 'excel' as 'excel' | 'csv' | 'pdf',
  filters: { 
    dateFrom: '', 
    dateTo: '', 
    status: 'all', 
    category: 'all', 
    project: 'all', 
    site: 'all', 
    phoneValidation: 'all' 
  },
  selectedColumns: ['employeeName', 'fatherHusbandName', 'phoneNo', 'dateOfJoining', 'status', 'category', 'project', 'site'],
  respectCurrentFilters: true,
  includeSummary: true
})

const availableColumns = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'fatherHusbandName', label: 'Father/Husband Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'dateOfJoining', label: 'Date of Joining' },
  { key: 'aadhar', label: 'Aadhar' },
  { key: 'pan', label: 'PAN' },
  { key: 'phoneNo', label: 'Phone Number' },
  { key: 'address', label: 'Address' },
  { key: 'bank', label: 'Bank' },
  { key: 'branch', label: 'Branch' },
  { key: 'accountNo', label: 'Account Number' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'uan', label: 'UAN' },
  { key: 'esicNo', label: 'ESIC Number' },
  { key: 'sKalyanNo', label: 'S Kalyan Number' },
  { key: 'pDayWage', label: 'Per Day Wage' },
  { key: 'project', label: 'Project' },
  { key: 'site', label: 'Site' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'dateOfExit', label: 'Date of Exit' },
  { key: 'doeRem', label: 'Exit Remarks' }
]

const currentFormatIcon = computed(() => formats.find(f => f.id === exportOptions.value.format)?.icon || '📊')

const isValidPhoneNumber = (phoneNo: any) => {
  if (!phoneNo) return false
  const cleanPhone = phoneNo.toString().replace(/\D/g, '')
  if (cleanPhone.length === 10) return /^[6-9]/.test(cleanPhone)
  if (cleanPhone.length === 11) return /^[0-9]/.test(cleanPhone)
  return false
}

const filteredRecordCount = computed(() => {
  try {
    let filtered = [...(props.employees || [])]
    if (exportOptions.value.respectCurrentFilters) {
      if (props.searchTerm) {
        const search = props.searchTerm.toLowerCase()
        filtered = filtered.filter(employee => 
          employee && (
            employee.employeeName?.toLowerCase().includes(search) ||
            employee.fatherHusbandName?.toLowerCase().includes(search) ||
            employee.phoneNo?.toLowerCase().includes(search) ||
            employee.category?.toLowerCase().includes(search) ||
            employee.status?.toLowerCase().includes(search) ||
            employee.project?.toLowerCase().includes(search) ||
            employee.site?.toLowerCase().includes(search)
          )
        )
      }
      if (props.currentFilters && typeof props.currentFilters === 'object') {
        Object.keys(props.currentFilters).forEach(column => {
          const activeFilters = props.currentFilters[column]
          if (activeFilters && Array.isArray(activeFilters) && activeFilters.length > 0) {
            filtered = filtered.filter(employee => {
              if (!employee) return false
              if (column === 'dateOfJoining') {
                const dateVal = employee[column]
                if (!dateVal) return false
                const dateObj = new Date(dateVal)
                const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`
                return activeFilters.includes(formattedDate)
              }
              return activeFilters.includes(employee[column])
            })
          }
        })
      }
    }
    const filters = exportOptions.value.filters
    if (filters.dateFrom) filtered = filtered.filter(emp => emp && emp.dateOfJoining && new Date(emp.dateOfJoining) >= new Date(filters.dateFrom))
    if (filters.dateTo) filtered = filtered.filter(emp => emp && emp.dateOfJoining && new Date(emp.dateOfJoining) <= new Date(filters.dateTo))
    if (filters.status && filters.status !== 'all') filtered = filtered.filter(emp => emp && emp.status === filters.status)
    if (filters.category && filters.category !== 'all') filtered = filtered.filter(emp => emp && emp.category === filters.category)
    if (filters.project && filters.project !== 'all') filtered = filtered.filter(emp => emp && emp.project === filters.project)
    if (filters.site && filters.site !== 'all') filtered = filtered.filter(emp => emp && emp.site === filters.site)
    if (filters.phoneValidation && filters.phoneValidation !== 'all') {
      if (filters.phoneValidation === 'valid') filtered = filtered.filter(emp => emp && isValidPhoneNumber(emp.phoneNo))
      else if (filters.phoneValidation === 'invalid') filtered = filtered.filter(emp => emp && !isValidPhoneNumber(emp.phoneNo))
    }
    return filtered.length
  } catch (error) {
    console.error('Error in filteredRecordCount computed property:', error)
    return 0
  }
})

const selectAllColumns = () => { exportOptions.value.selectedColumns = availableColumns.map(col => col.key) }
const deselectAllColumns = () => { exportOptions.value.selectedColumns = [] }

const handleExport = async () => {
  if (isExporting.value || exportOptions.value.selectedColumns.length === 0) return
  try {
    isExporting.value = true
    const exportParams = {
      format: exportOptions.value.format,
      filters: exportOptions.value.filters,
      selectedColumns: exportOptions.value.selectedColumns,
      respectCurrentFilters: exportOptions.value.respectCurrentFilters,
      includeSummary: exportOptions.value.includeSummary,
      currentFilters: exportOptions.value.respectCurrentFilters ? props.currentFilters : {},
      searchTerm: exportOptions.value.respectCurrentFilters ? props.searchTerm : ''
    }
    const response = await api.post('/api/master-roll/export', exportParams, { responseType: 'blob' })
    const blob = response instanceof Blob ? response : new Blob([response])
    const url = window.URL.createObjectURL(blob)
    const link = document.body.appendChild(document.createElement('a'))
    link.href = url
    const date = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `master_roll_export_${date}.${exportOptions.value.format === 'excel' ? 'xlsx' : exportOptions.value.format}`)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    if (toast && typeof toast.add === 'function') {
      toast.add({ title: 'Export Complete', color: 'success' })
    }
    
    emit('export-complete', { success: true })
    open.value = false
  } catch (error: any) {
    if (toast && typeof toast.add === 'function') {
      toast.add({ title: 'Export Failed', description: error.message, color: 'error' })
    }
    emit('export-complete', { success: false, error: error.message })
  } finally {
    isExporting.value = false
  }
}

watch(() => exportOptions.value.format, (newFormat) => { if (newFormat === 'csv') exportOptions.value.includeSummary = false })
</script>

<style scoped>
.text-shadow { text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
</style>
