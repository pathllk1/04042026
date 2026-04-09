<template>
  <div class="space-y-6">
    <div class="bg-green-50 dark:bg-blue-900/10 border border-green-200 dark:border-blue-800 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-6 border-b border-green-100 dark:border-blue-800 pb-3">
        <UIcon name="i-lucide-user-cog" class="text-green-600 dark:text-blue-400 h-6 w-6" />
        <h3 class="text-xl font-bold text-green-900 dark:text-blue-300">Edit Personal Details</h3>
      </div>
      
      <!-- Column Visibility Controls -->
      <div class="mb-6 bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <div class="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-300 font-bold uppercase text-xs tracking-widest">
          <UIcon name="i-lucide-columns" class="h-4 w-4" />
          Show/Hide Column Groups
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCheckbox 
            v-for="(group, key) in columnGroups" 
            :key="key"
            v-model="visibleGroups" 
            :value="key"
            :label="group.label"
            color="primary"
          />
        </div>
      </div>

      <!-- Search and Filter -->
      <div class="mb-6">
        <UInput
          v-model="searchTerm"
          icon="i-lucide-search"
          placeholder="Filter selected employees by name..."
          size="lg"
          class="w-full"
        />
      </div>

      <!-- Editable Table -->
      <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-950">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th scope="col" class="px-4 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-800">
                Employee
              </th>
              <th v-for="field in visibleFields" :key="field" scope="col" class="px-4 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                {{ getFieldLabel(field) }}
              </th>
              <th scope="col" class="px-4 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="employee in filteredEmployees" :key="employee._id" 
                class="transition-colors group"
                :class="isDirty(employee._id) ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'">
              
              <!-- Employee Name (Fixed Column) -->
              <td class="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-950 z-10 border-r border-gray-200 dark:border-gray-800">
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900 dark:text-white">{{ employee.employeeName }}</span>
                  <span class="text-[10px] text-gray-500 uppercase tracking-wider">{{ employee.category }}</span>
                </div>
              </td>
              
              <!-- Editable Fields -->
              <td v-for="field in visibleFields" :key="field" class="px-4 py-2 min-w-[180px]">
                <div class="relative">
                  <!-- Date Fields -->
                  <UInput
                    v-if="field === 'dateOfBirth' && editableData[employee._id]"
                    type="date"
                    v-model="editableData[employee._id][field]"
                    size="sm"
                    class="w-full"
                    :color="getInputColor(employee._id, field)"
                    @input="markDirty(employee._id, field)"
                  />
                  
                  <!-- Phone Number Field -->
                  <UInput
                    v-else-if="field === 'phoneNo' && editableData[employee._id]"
                    type="tel"
                    v-model="editableData[employee._id][field]"
                    size="sm"
                    maxlength="10"
                    placeholder="10-digit number"
                    icon="i-lucide-phone"
                    class="w-full"
                    :color="getInputColor(employee._id, field)"
                    @input="markDirty(employee._id, field)"
                  />

                  <!-- IFSC Field with Auto-lookup -->
                  <UInput
                    v-else-if="field === 'ifsc' && editableData[employee._id]"
                    v-model="editableData[employee._id][field]"
                    size="sm"
                    maxlength="11"
                    placeholder="ABCD0123456"
                    icon="i-lucide-landmark"
                    class="uppercase w-full"
                    :color="getInputColor(employee._id, field)"
                    @input="handleIFSCChange(employee._id, $event.target.value)"
                  />

                  <!-- UAN/ESIC Field -->
                  <UInput
                    v-else-if="(field === 'uan' || field === 'esicNo') && editableData[employee._id]"
                    v-model="editableData[employee._id][field]"
                    size="sm"
                    :maxlength="field === 'uan' ? 12 : 10"
                    :placeholder="`${field === 'uan' ? '12' : '10'}-digit number`"
                    class="w-full"
                    :color="getInputColor(employee._id, field)"
                    @input="markDirty(employee._id, field)"
                  />

                  <!-- Text Fields (Default) -->
                  <UInput
                    v-else-if="editableData[employee._id]"
                    v-model="editableData[employee._id][field]"
                    size="sm"
                    class="w-full"
                    :color="getInputColor(employee._id, field)"
                    @input="markDirty(employee._id, field)"
                  />

                  <!-- Loading placeholder if data not ready -->
                  <div v-else class="flex items-center gap-2 text-gray-400 text-xs">
                    <UIcon name="i-lucide-loader-2" class="animate-spin h-3 w-3" />
                    Initializing...
                  </div>
                  
                  <!-- Validation Error Tooltip -->
                  <div v-if="getValidationError(employee._id, field)" class="absolute -bottom-1 left-0 transform translate-y-full z-20">
                    <div class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap font-bold">
                      {{ getValidationError(employee._id, field) }}
                    </div>
                  </div>
                </div>
              </td>
              
              <!-- Action/Status Status -->
              <td class="px-4 py-3 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-2">
                  <template v-if="isDirty(employee._id)">
                    <UButton
                      size="xs"
                      color="success"
                      variant="soft"
                      icon="i-lucide-check"
                      :disabled="hasValidationErrors(employee._id)"
                      @click="saveEmployee(employee._id)"
                    />
                    <UButton
                      size="xs"
                      color="error"
                      variant="soft"
                      icon="i-lucide-rotate-ccw"
                      @click="resetEmployee(employee._id)"
                    />
                  </template>
                  <UIcon v-else name="i-lucide-check-circle-2" class="text-gray-200 dark:text-gray-800 h-5 w-5" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary -->
      <div class="mt-6 p-4 bg-primary-50 dark:bg-blue-900/20 border-2 border-dashed border-primary-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-primary-500 text-white p-2 rounded-lg">
            <UIcon name="i-lucide-info" class="h-5 w-5" />
          </div>
          <div>
            <div class="text-[10px] text-primary-600 dark:text-primary-400 font-black uppercase tracking-widest">Modification Tracking</div>
            <div class="text-sm font-bold text-primary-900 dark:text-primary-300">
              {{ dirtyEmployeesCount }} employees modified
            </div>
          </div>
        </div>
        <div v-if="totalValidationErrors > 0" class="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800">
          <UIcon name="i-lucide-alert-triangle" class="text-red-600 h-4 w-4" />
          <span class="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
            {{ totalValidationErrors }} Validation Errors
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  employees: any[]
}>()

const emit = defineEmits<{
  'update:changes': [changes: any[]]
}>()

// Column groups for visibility control
const columnGroups = {
  personal: { 
    label: 'Basic Info', 
    fields: ['dateOfBirth', 'phoneNo', 'fatherHusbandName', 'address'] 
  },
  identity: { 
    label: 'IDs & PAN', 
    fields: ['aadhar', 'pan'] 
  },
  banking: { 
    label: 'Bank Account', 
    fields: ['bank', 'branch', 'accountNo', 'ifsc'] 
  },
  government: { 
    label: 'Statutory', 
    fields: ['uan', 'esicNo', 'sKalyanNo'] 
  }
}

// Reactive state
const visibleGroups = ref(['personal', 'banking'])
const searchTerm = ref('')
const editableData = ref<Record<string, any>>({})
const dirtyFields = ref<Record<string, Set<string>>>({})
const validationErrors = ref<Record<string, Record<string, string>>>({})

// Initialize editable data
const initializeEditableData = () => {
  const data: Record<string, any> = {}
  props.employees.forEach(emp => {
    if (emp && emp._id) {
      data[emp._id] = {
        ...emp,
        dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
        phoneNo: emp.phoneNo || '',
        fatherHusbandName: emp.fatherHusbandName || '',
        address: emp.address || '',
        aadhar: emp.aadhar || '',
        pan: emp.pan || '',
        bank: emp.bank || '',
        branch: emp.branch || '',
        accountNo: emp.accountNo || '',
        ifsc: emp.ifsc || '',
        uan: emp.uan || '',
        esicNo: emp.esicNo || '',
        sKalyanNo: emp.sKalyanNo || ''
      }
    }
  })
  editableData.value = data
}

// Computed properties
const visibleFields = computed(() => {
  return visibleGroups.value.flatMap(groupKey => columnGroups[groupKey as keyof typeof columnGroups].fields)
})

const filteredEmployees = computed(() => {
  if (!searchTerm.value) return props.employees
  
  const search = searchTerm.value.toLowerCase()
  return props.employees.filter(emp => 
    emp.employeeName.toLowerCase().includes(search)
  )
})

const dirtyEmployeesCount = computed(() => {
  return Object.keys(dirtyFields.value).length
})

const totalValidationErrors = computed(() => {
  return Object.values(validationErrors.value).reduce((total, empErrors) => {
    return total + Object.keys(empErrors).length
  }, 0)
})

// Methods
const getFieldLabel = (field: string) => {
  const labels: Record<string, string> = {
    dateOfBirth: 'DOB',
    phoneNo: 'Phone',
    fatherHusbandName: 'Relation Name',
    address: 'Address',
    aadhar: 'Aadhar',
    pan: 'PAN',
    bank: 'Bank',
    branch: 'Branch',
    accountNo: 'Account No',
    ifsc: 'IFSC',
    uan: 'UAN',
    esicNo: 'ESIC',
    sKalyanNo: 'S.Kalyan'
  }
  return labels[field] || field
}

const markDirty = (employeeId: string, field: string) => {
  if (!dirtyFields.value[employeeId]) {
    dirtyFields.value[employeeId] = new Set()
  }
  dirtyFields.value[employeeId].add(field)
  
  validateField(employeeId, field)
  emitChanges()
}

const isDirty = (employeeId: string) => {
  return !!dirtyFields.value[employeeId] && dirtyFields.value[employeeId].size > 0
}

const validateField = (employeeId: string, field: string) => {
  const value = editableData.value[employeeId][field]
  let error = ''
  
  switch (field) {
    case 'phoneNo':
      if (value && !/^[6-9]\d{9}$/.test(value)) error = 'Invalid Phone'
      break
    case 'ifsc':
      if (value && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) error = 'Invalid IFSC'
      break
    case 'uan':
      if (value && !/^\d{12}$/.test(value)) error = 'Must be 12 digits'
      break
    case 'esicNo':
      if (value && !/^\d{10}$/.test(value)) error = 'Must be 10 digits'
      break
  }
  
  if (!validationErrors.value[employeeId]) validationErrors.value[employeeId] = {}
  
  if (error) {
    validationErrors.value[employeeId][field] = error
  } else {
    delete validationErrors.value[employeeId][field]
  }
}

const getValidationError = (employeeId: string, field: string) => {
  return validationErrors.value[employeeId]?.[field]
}

const hasValidationErrors = (employeeId: string) => {
  const empErrors = validationErrors.value[employeeId]
  return empErrors && Object.keys(empErrors).length > 0
}

const getInputColor = (employeeId: string, field: string) => {
  if (getValidationError(employeeId, field)) return 'error'
  if (dirtyFields.value[employeeId]?.has(field)) return 'warning'
  return 'neutral'
}

const handleIFSCChange = (employeeId: string, ifscCode: string) => {
  const code = ifscCode.toUpperCase()
  editableData.value[employeeId].ifsc = code
  markDirty(employeeId, 'ifsc')
}

const saveEmployee = (employeeId: string) => {
  if (hasValidationErrors(employeeId)) return
  delete dirtyFields.value[employeeId]
  emitChanges()
}

const resetEmployee = (employeeId: string) => {
  const originalEmployee = props.employees.find(emp => emp._id === employeeId)
  if (originalEmployee) {
    editableData.value[employeeId] = { 
      ...originalEmployee,
      dateOfBirth: originalEmployee.dateOfBirth ? new Date(originalEmployee.dateOfBirth).toISOString().split('T')[0] : ''
    }
  }
  delete dirtyFields.value[employeeId]
  delete validationErrors.value[employeeId]
  emitChanges()
}

const emitChanges = () => {
  const changes: any[] = []
  Object.keys(dirtyFields.value).forEach(employeeId => {
    const dirtyFieldsSet = dirtyFields.value[employeeId]
    dirtyFieldsSet.forEach(field => {
      changes.push({
        employeeId,
        field,
        value: editableData.value[employeeId][field]
      })
    })
  })
  emit('update:changes', changes)
}

onMounted(() => {
  initializeEditableData()
})

watch(() => props.employees, () => {
  initializeEditableData()
}, { deep: true })
</script>

<style scoped>
/* Table styles */
::-webkit-scrollbar {
  height: 8px;
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
