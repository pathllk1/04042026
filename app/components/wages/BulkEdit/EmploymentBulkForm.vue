<template>
  <div class="space-y-6">
    <div class="bg-green-50 dark:bg-blue-900/10 border border-green-200 dark:border-blue-800 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-6 border-b border-green-100 dark:border-blue-800 pb-3">
        <UIcon name="i-lucide-users-2" class="text-green-600 dark:text-blue-400 h-6 w-6" />
        <h3 class="text-xl font-bold text-green-900 dark:text-blue-300">Employment Bulk Update</h3>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Status Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.status" 
            label="Update Status"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <USelect 
            v-if="fieldsToEdit.status"
            v-model="editValues.status" 
            :items="statusOptions"
            class="w-full"
          />
        </div>

        <!-- Category Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.category" 
            label="Update Category"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <USelect 
            v-if="fieldsToEdit.category"
            v-model="editValues.category" 
            :items="categoryOptions"
            class="w-full"
          />
        </div>

        <!-- Project Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.project" 
            label="Update Project"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <USelect 
            v-if="fieldsToEdit.project"
            v-model="editValues.project" 
            :items="projectOptions"
            class="w-full"
          />
        </div>

        <!-- Site Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.site" 
            label="Update Site"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <USelect 
            v-if="fieldsToEdit.site"
            v-model="editValues.site" 
            :items="siteOptions"
            class="w-full"
          />
        </div>

        <!-- Daily Wage Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.pDayWage" 
            label="Update Daily Wage"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <UInput
            v-if="fieldsToEdit.pDayWage"
            v-model="editValues.pDayWage"
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
            icon="i-lucide-indian-rupee"
            class="w-full"
          />
        </div>

        <!-- Date of Exit Field -->
        <div class="flex flex-col gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <UCheckbox 
            v-model="fieldsToEdit.dateOfExit" 
            label="Update Exit Date"
            color="primary"
            class="font-bold uppercase text-[10px] tracking-widest mb-2"
          />
          <UInput
            v-if="fieldsToEdit.dateOfExit"
            v-model="editValues.dateOfExit"
            type="date"
            icon="i-lucide-calendar-x"
            class="w-full"
          />
        </div>
      </div>

      <!-- Warning Notice -->
      <div class="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
        <div class="flex items-start gap-3">
          <div class="bg-amber-500 text-white p-2 rounded-lg shrink-0">
            <UIcon name="i-lucide-alert-triangle" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest">
              Critical Action Warning
            </h3>
            <div class="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              These changes will be applied to <span class="font-black text-lg text-amber-900 dark:text-white px-1">{{ selectedEmployeesCount }}</span> employees simultaneously. 
              This operation cannot be easily undone.
            </div>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="mt-6 p-4 bg-primary-50 dark:bg-blue-900/20 border-2 border-primary-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
        <div class="flex flex-col">
          <div class="text-[10px] text-primary-600 dark:text-primary-400 font-black uppercase tracking-widest">Pending Updates</div>
          <div class="text-sm font-bold text-primary-900 dark:text-primary-300">
            {{ selectedFieldsCount }} fields targeted for bulk update
          </div>
          <div v-if="selectedFieldsCount > 0" class="mt-1 text-[10px] text-primary-500 dark:text-primary-400 italic">
            Targeting: {{ selectedFieldsList.join(' · ') }}
          </div>
        </div>
        <div v-if="selectedFieldsCount === 0" class="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-lg">
          <UIcon name="i-lucide-info" class="text-red-600 h-4 w-4" />
          <span class="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Action Required</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedEmployeesCount: number
  uniqueCategories?: string[]
  uniqueProjects?: string[]
  uniqueSites?: string[]
}>()

const emit = defineEmits<{
  'update:changes': [changes: any]
}>()

// Field configuration
const fieldsToEdit = ref({
  status: false,
  category: false,
  project: false,
  site: false,
  pDayWage: false,
  dateOfExit: false
})

const editValues = ref({
  status: 'Active',
  category: '',
  project: '',
  site: '',
  pDayWage: '',
  dateOfExit: ''
})

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'On Leave', value: 'On Leave' },
  { label: 'Terminated', value: 'Terminated' }
]

const categoryOptions = computed(() => [
  { label: 'Select Category', value: 'all' },
  ...(props.uniqueCategories || []).map(c => ({ label: c, value: c }))
])

const projectOptions = computed(() => [
  { label: 'Select Project', value: 'all' },
  ...(props.uniqueProjects || []).map(p => ({ label: p, value: p }))
])

const siteOptions = computed(() => [
  { label: 'Select Site', value: 'all' },
  ...(props.uniqueSites || []).map(s => ({ label: s, value: s }))
])

// Computed properties
const selectedFieldsCount = computed(() => {
  return Object.values(fieldsToEdit.value).filter(Boolean).length
})

const selectedFieldsList = computed(() => {
  const labels: Record<string, string> = {
    status: 'Status',
    category: 'Category',
    project: 'Project',
    site: 'Site',
    pDayWage: 'Daily Wage',
    dateOfExit: 'Exit Date'
  }
  
  return Object.keys(fieldsToEdit.value)
    .filter(key => fieldsToEdit.value[key as keyof typeof fieldsToEdit.value])
    .map(key => labels[key])
})

const selectedFieldsToEdit = computed(() => {
  const selected: Record<string, any> = {}
  Object.keys(fieldsToEdit.value).forEach(key => {
    if (fieldsToEdit.value[key as keyof typeof fieldsToEdit.value]) {
      selected[key] = editValues.value[key as keyof typeof editValues.value]
    }
  })
  return selected
})

// Watch for changes and emit to parent
watch([fieldsToEdit, editValues], () => {
  emit('update:changes', {
    fieldsToEdit: fieldsToEdit.value,
    editValues: editValues.value,
    selectedFields: selectedFieldsToEdit.value
  })
}, { deep: true })

// Reset function
const resetForm = () => {
  Object.keys(fieldsToEdit.value).forEach(key => {
    fieldsToEdit.value[key as keyof typeof fieldsToEdit.value] = false
  })
  
  editValues.value = {
    status: 'Active',
    category: '',
    project: '',
    site: '',
    pDayWage: '',
    dateOfExit: ''
  }
}

// Expose reset function to parent
defineExpose({
  resetForm
})
</script>
