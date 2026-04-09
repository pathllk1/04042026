<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-[95vw] lg:max-w-[90vw]' }">
    <template #content>
      <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">
        <!-- Modal Header -->
        <template #header>
          <div class="bg-gradient-to-r from-orange-500 to-red-600 p-4 rounded-t-xl flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <UIcon name="i-lucide-users" class="text-white h-6 w-6" />
              </div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter text-shadow">Bulk Edit Employees</h2>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="text-white hover:text-red-200"
              @click="isOpen = false"
            />
          </div>
        </template>

        <!-- Modal Content -->
        <div class="flex-1 p-6 overflow-y-auto max-h-[75vh]">
          <!-- Step Indicator -->
          <div class="mb-8">
            <div class="flex items-center justify-between max-w-2xl mx-auto relative px-4">
              <!-- Connection Lines -->
              <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -translate-y-1/2 z-0"></div>
              <div 
                class="absolute top-1/2 left-0 h-0.5 bg-orange-500 -translate-y-1/2 z-0 transition-all duration-500"
                :style="{ width: ((currentStep - 1) / 3 * 100) + '%' }"
              ></div>

              <!-- Steps -->
              <div v-for="step in 4" :key="step" class="relative z-10 flex flex-col items-center">
                <div 
                  class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 shadow-sm border-4"
                  :class="[
                    currentStep >= step 
                      ? 'bg-orange-500 border-orange-100 dark:border-orange-900 text-white' 
                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'
                  ]"
                >
                  <UIcon v-if="currentStep > step" name="i-lucide-check" class="h-5 w-5" />
                  <span v-else>{{ step }}</span>
                </div>
                <span 
                  class="mt-2 text-[10px] font-black uppercase tracking-widest text-center"
                  :class="currentStep >= step ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'"
                >
                  {{ stepNames[step-1] }}
                </span>
              </div>
            </div>
          </div>

          <!-- Step 1: Employee Selection -->
          <div v-if="currentStep === 1" class="space-y-6">
            <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div class="flex items-center gap-2 mb-6 border-b border-blue-100 dark:border-blue-800 pb-3">
                <UIcon name="i-lucide-user-plus" class="text-blue-600 h-6 w-6" />
                <h3 class="text-xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tighter">Target Selection</h3>
              </div>

              <!-- Selection Methods -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <UFormField label="Selection Method">
                  <USelect 
                    v-model="selectionMethod"
                    :items="selectionMethodOptions"
                    class="w-full"
                  />
                </UFormField>
                <div v-if="selectionMethod === 'individual'">
                  <UFormField label="Search Employees">
                    <UInput 
                      v-model="employeeSearchTerm" 
                      placeholder="Type name to filter list..."
                      icon="i-lucide-search"
                      class="w-full" 
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Criteria Selection -->
              <div v-if="selectionMethod === 'criteria'" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <UFormField label="Status">
                  <USelect 
                    v-model="criteriaFilters.status"
                    :items="statusFilterOptions"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Category">
                  <USelect 
                    v-model="criteriaFilters.category"
                    :items="[{ label: 'All Categories', value: 'all' }, ...uniqueCategories.map(c => ({ label: c, value: c }))]"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Project">
                  <USelect 
                    v-model="criteriaFilters.project"
                    :items="[{ label: 'All Projects', value: 'all' }, ...uniqueProjects.map(p => ({ label: p, value: p }))]"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Employee List -->
              <div v-if="selectionMethod === 'individual'"
                class="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-950">
                <div class="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <UCheckbox 
                    :model-value="isAllFilteredSelected" 
                    @update:model-value="toggleAllFiltered"
                    color="warning"
                  >
                    <template #label>
                      <span class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                        Select All Filtered ({{ filteredEmployeesForSelection.length }})
                      </span>
                    </template>
                  </UCheckbox>
                </div>
                <div class="divide-y divide-gray-100 dark:divide-gray-800">
                  <label v-for="employee in filteredEmployeesForSelection" :key="employee._id"
                    class="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors">
                    <UCheckbox 
                      :model-value="selectedEmployeeIds.includes(employee._id)"
                      @update:model-value="(val) => handleEmployeeCheck(employee._id, val)"
                      color="warning"
                    />
                    <div class="ml-4 flex-1">
                      <div class="text-sm font-bold text-gray-900 dark:text-white">{{ employee.employeeName }}</div>
                      <div class="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        {{ employee.category }} · {{ employee.status || 'Active' }}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Selection Summary -->
              <div class="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-dashed border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="bg-orange-500 text-white p-2 rounded-lg">
                    <UIcon name="i-lucide-check-square" class="h-5 w-5" />
                  </div>
                  <div class="text-sm font-bold text-orange-900 dark:text-orange-300 uppercase tracking-widest">
                    {{ selectedEmployees.length }} employees chosen
                  </div>
                </div>
                <div v-if="selectedEmployees.length > 50" class="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-wider bg-red-50 dark:bg-red-900/30 px-3 py-1 rounded-full">
                  <UIcon name="i-lucide-zap" class="h-3 w-3" />
                  Chunk processing enabled
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Operation Type Selection -->
          <div v-if="currentStep === 2" class="space-y-6">
            <WagesBulkEditOperationTypeSelector 
              :selected-employees-count="selectedEmployees.length"
              @update:editType="handleEditTypeChange" 
            />
          </div>

          <!-- Step 3: Edit Interface Based on Type -->
          <div v-if="currentStep === 3" class="space-y-6">
            <!-- Personal Details Edit -->
            <WagesBulkEditPersonalDetailsTable 
              v-if="editType === 'individual'" 
              :employees="selectedEmployees"
              @update:changes="handlePersonalChanges" 
            />

            <!-- Employment Bulk Update -->
            <WagesBulkEditEmploymentBulkForm 
              v-if="editType === 'bulk'" 
              :selected-employees-count="selectedEmployees.length"
              :unique-categories="uniqueCategories" 
              :unique-projects="uniqueProjects" 
              :unique-sites="uniqueSites"
              @update:changes="handleBulkChanges" 
            />

            <!-- Mixed Edit Interface -->
            <div v-if="editType === 'mixed'" class="space-y-8">
              <WagesBulkEditPersonalDetailsTable 
                :employees="selectedEmployees" 
                @update:changes="handlePersonalChanges" 
              />
              <div class="border-t-4 border-dashed border-gray-100 dark:border-gray-800 my-8"></div>
              <WagesBulkEditEmploymentBulkForm 
                :selected-employees-count="selectedEmployees.length"
                :unique-categories="uniqueCategories" 
                :unique-projects="uniqueProjects" 
                :unique-sites="uniqueSites"
                @update:changes="handleBulkChanges" 
              />
            </div>

            <!-- Fallback message -->
            <div v-if="!editType" class="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 text-center">
              <UIcon name="i-lucide-alert-circle" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p class="text-gray-500 font-bold uppercase tracking-widest text-sm">Please select an edit mode from the previous step</p>
            </div>
          </div>

          <!-- Step 4: Preview & Execute -->
          <div v-if="currentStep === 4" class="space-y-6">
            <div class="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
              <div class="flex items-center gap-2 mb-6 border-b border-purple-100 dark:border-purple-800 pb-3">
                <UIcon name="i-lucide-eye" class="text-purple-600 h-6 w-6" />
                <h3 class="text-xl font-black text-purple-900 dark:text-purple-300 uppercase tracking-tighter">Validation & Preview</h3>
              </div>

              <!-- Summary Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-purple-100 dark:border-purple-900 shadow-sm">
                  <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Target Count</div>
                  <div class="text-3xl font-black text-purple-600">{{ selectedEmployees.length }}</div>
                </div>
                <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-purple-100 dark:border-purple-900 shadow-sm">
                  <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Mode</div>
                  <UBadge color="secondary" variant="soft" size="lg" class="font-black uppercase tracking-widest">
                    {{ editType }}
                  </UBadge>
                </div>
                <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-purple-100 dark:border-purple-900 shadow-sm">
                  <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Updates</div>
                  <div class="text-3xl font-black text-purple-600">{{ selectedFieldsCount }}</div>
                </div>
              </div>

              <!-- Changes Summary Panel -->
              <div class="bg-white dark:bg-gray-950 border-2 border-purple-100 dark:border-purple-900 rounded-xl overflow-hidden shadow-sm mb-8">
                <div class="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <h4 class="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Impact Analysis</h4>
                </div>
                <div class="p-6 space-y-6">
                  <!-- Personal Changes -->
                  <div v-if="personalChanges.length > 0" class="flex items-start gap-4">
                    <div class="bg-blue-100 text-blue-600 p-2 rounded-lg shrink-0">
                      <UIcon name="i-lucide-user-cog" class="h-5 w-5" />
                    </div>
                    <div>
                      <h5 class="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1">Individual Field Updates</h5>
                      <p class="text-xs text-gray-500 font-medium">
                        Modifying <span class="font-bold text-blue-600">{{ personalChanges.length }}</span> specific attributes across the selection group.
                      </p>
                    </div>
                  </div>

                  <!-- Bulk Changes -->
                  <div v-if="Object.keys(bulkChanges.selectedFields || {}).length > 0" class="flex items-start gap-4">
                    <div class="bg-green-100 text-green-600 p-2 rounded-lg shrink-0">
                      <UIcon name="i-lucide-zap" class="h-5 w-5" />
                    </div>
                    <div class="flex-1">
                      <h5 class="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">Global Bulk Updates</h5>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div v-for="(value, field) in bulkChanges.selectedFields" :key="field"
                          class="flex items-center justify-between text-[11px] bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                          <span class="text-gray-500 font-bold uppercase tracking-widest">{{ field }}</span>
                          <span class="text-green-600 font-black">{{ value || 'N/A' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Progress Tracking -->
              <div v-if="isProcessing" class="mt-8 bg-white dark:bg-gray-950 border-2 border-purple-500 rounded-xl p-6 shadow-xl animate-pulse">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 text-purple-600" />
                    <h4 class="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Execution in Progress</h4>
                  </div>
                  <div class="text-2xl font-black text-purple-600">{{ Math.round(overallProgress) }}%</div>
                </div>

                <div class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div class="bg-gradient-to-r from-purple-500 to-indigo-600 h-full transition-all duration-500 shadow-inner"
                    :style="{ width: overallProgress + '%' }"></div>
                </div>

                <div class="mt-6 grid grid-cols-2 gap-4">
                  <div class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    <span class="text-gray-500 font-bold uppercase tracking-widest block mb-1">Status</span>
                    <span class="text-gray-900 dark:text-white font-black">{{ currentStatus }}</span>
                  </div>
                  <div class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    <span class="text-gray-500 font-bold uppercase tracking-widest block mb-1">Processing</span>
                    <span class="text-gray-900 dark:text-white font-black">{{ processedRecords }} / {{ totalRecords }}</span>
                    <span v-if="failedRecords > 0" class="text-red-600 font-black ml-2 text-[10px]">[{{ failedRecords }} FAILED]</span>
                  </div>
                </div>

                <div class="mt-6 flex justify-center">
                  <UButton 
                    color="error" 
                    variant="soft" 
                    icon="i-lucide-octagon-x" 
                    label="Abort Operation"
                    :disabled="!canCancel"
                    @click="cancelProcessing" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <template #footer>
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-b-xl border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <UButton 
              v-if="currentStep > 1" 
              color="neutral" 
              variant="soft" 
              icon="i-lucide-arrow-left" 
              label="Back"
              :disabled="isProcessing"
              @click="previousStep" 
            />
            <div v-else></div>

            <div class="flex items-center gap-3">
              <UButton 
                color="neutral" 
                variant="ghost" 
                label="Cancel"
                :disabled="isProcessing"
                @click="isOpen = false" 
              />

              <UButton 
                v-if="currentStep < 4" 
                color="warning" 
                icon="i-lucide-arrow-right" 
                trailing
                label="Continue"
                :disabled="!canProceedToNextStep"
                @click="nextStep" 
              />

              <UButton 
                v-if="currentStep === 4 && !isProcessing" 
                color="success" 
                icon="i-lucide-zap" 
                label="Commit Changes"
                :disabled="!canExecute"
                @click="executeChanges" 
              />
            </div>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useBulkEdit } from '~/composables/business/useBulkEdit'

const props = defineProps<{
  show: boolean
  employees: any[]
  uniqueCategories?: string[]
  uniqueProjects?: string[]
  uniqueSites?: string[]
}>()

const emit = defineEmits<{
  'close': []
  'success': [result: any]
}>()

const isOpen = computed({
  get: () => props.show,
  set: (val) => { if (!val) emit('close') }
})

const {
  executeChanges: executeBulkChanges,
  isProcessing,
  overallProgress,
  currentStatus,
  processedRecords,
  totalRecords,
  failedRecords,
  canCancel,
  cancelProcessing
} = useBulkEdit()

const stepNames = ['Select', 'Mode', 'Configure', 'Execute']
const currentStep = ref(1)

const selectionMethod = ref('individual')
const selectionMethodOptions = [
  { label: 'Individual Select', value: 'individual' },
  { label: 'Match Criteria', value: 'criteria' },
  { label: 'Global (All)', value: 'all' }
]

const selectedEmployeeIds = ref<string[]>([])
const employeeSearchTerm = ref('')
const criteriaFilters = ref({
  status: '',
  category: '',
  project: '',
  site: ''
})

const statusFilterOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'On Leave', value: 'On Leave' },
  { label: 'Terminated', value: 'Terminated' }
]

const editType = ref('')
const personalChanges = ref<any[]>([])
const bulkChanges = ref<any>({})

const handleEditTypeChange = (type: string) => { editType.value = type }
const handlePersonalChanges = (changes: any[]) => { personalChanges.value = changes }
const handleBulkChanges = (changes: any) => { bulkChanges.value = changes }

const filteredEmployeesForSelection = computed(() => {
  if (!employeeSearchTerm.value) return props.employees
  const s = employeeSearchTerm.value.toLowerCase()
  return props.employees.filter(emp => emp.employeeName.toLowerCase().includes(s))
})

const selectedEmployees = computed(() => {
  if (selectionMethod.value === 'all') return props.employees
  if (selectionMethod.value === 'criteria') {
    return props.employees.filter(emp => {
      const sMatch = !criteriaFilters.value.status || emp.status === criteriaFilters.value.status
      const cMatch = !criteriaFilters.value.category || emp.category === criteriaFilters.value.category
      const pMatch = !criteriaFilters.value.project || emp.project === criteriaFilters.value.project
      const tMatch = !criteriaFilters.value.site || emp.site === criteriaFilters.value.site
      return sMatch && cMatch && pMatch && tMatch
    })
  }
  return props.employees.filter(emp => selectedEmployeeIds.value.includes(emp._id))
})

const isAllFilteredSelected = computed(() => {
  return filteredEmployeesForSelection.value.length > 0 &&
    filteredEmployeesForSelection.value.every(emp => selectedEmployeeIds.value.includes(emp._id))
})

const selectedFieldsCount = computed(() => {
  if (editType.value === 'individual' || editType.value === 'mixed') {
    return personalChanges.value.length
  } else if (editType.value === 'bulk') {
    return Object.keys(bulkChanges.value.selectedFields || {}).length
  }
  return 0
})

const canProceedToNextStep = computed(() => {
  if (currentStep.value === 1) return selectedEmployees.value.length > 0
  if (currentStep.value === 2) return !!editType.value
  if (currentStep.value === 3) return selectedFieldsCount.value > 0
  return true
})

const canExecute = computed(() => {
  return selectedEmployees.value.length > 0 && selectedFieldsCount.value > 0 && !isProcessing.value
})

const handleEmployeeCheck = (id: string, val: boolean) => {
  if (val) {
    if (!selectedEmployeeIds.value.includes(id)) selectedEmployeeIds.value.push(id)
  } else {
    selectedEmployeeIds.value = selectedEmployeeIds.value.filter(i => i !== id)
  }
}

const toggleAllFiltered = (val: boolean) => {
  const filteredIds = filteredEmployeesForSelection.value.map(emp => emp._id)
  if (val) {
    selectedEmployeeIds.value = [...new Set([...selectedEmployeeIds.value, ...filteredIds])]
  } else {
    selectedEmployeeIds.value = selectedEmployeeIds.value.filter(id => !filteredIds.includes(id))
  }
}

const nextStep = () => { if (canProceedToNextStep.value && currentStep.value < 4) currentStep.value++ }
const previousStep = () => { if (currentStep.value > 1) currentStep.value-- }

const executeChanges = async () => {
  try {
    let payload: any = {}
    if (editType.value === 'individual') {
      payload = { type: 'individual', updates: personalChanges.value }
    } else if (editType.value === 'bulk') {
      payload = {
        type: 'bulk',
        employeeIds: selectedEmployees.value.map(emp => emp._id),
        fieldsToUpdate: bulkChanges.value.selectedFields || {}
      }
    } else if (editType.value === 'mixed') {
      payload = {
        type: 'mixed',
        individualUpdates: personalChanges.value,
        bulkUpdates: bulkChanges.value.selectedFields || {},
        employeeIds: selectedEmployees.value.map(emp => emp._id)
      }
    }

    await executeBulkChanges(payload)
    
    emit('success', {
      updatedCount: selectedEmployees.value.length,
      editType: editType.value,
      personalChanges: personalChanges.value.length,
      bulkChanges: Object.keys(bulkChanges.value.selectedFields || {}).length
    })

    setTimeout(() => { isOpen.value = false }, 2000)
  } catch (error) {
    console.error('Bulk edit failed:', error)
  }
}

watch(selectionMethod, () => {
  selectedEmployeeIds.value = []
  criteriaFilters.value = { status: '', category: '', project: '', site: '' }
})

watch(() => props.show, (newShow) => {
  if (!newShow) {
    currentStep.value = 1
    selectedEmployeeIds.value = []
    selectionMethod.value = 'individual'
    employeeSearchTerm.value = ''
    criteriaFilters.value = { status: '', category: '', project: '', site: '' }
    editType.value = ''
    personalChanges.value = []
    bulkChanges.value = {}
  }
})
</script>

<style scoped>
.text-shadow {
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
