<template>
  <div class="space-y-6">
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-6 border-b border-blue-100 dark:border-blue-800 pb-3">
        <UIcon name="i-lucide-settings-2" class="text-blue-600 dark:text-blue-400 h-6 w-6" />
        <h3 class="text-xl font-bold text-blue-900 dark:text-blue-300">Choose Edit Type</h3>
      </div>
      
      <div class="grid grid-cols-1 gap-4">
        <!-- Personal Details Edit Option -->
        <div 
          class="group relative border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
          :class="selectedEditType === 'individual' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700'"
          @click="selectedEditType = 'individual'"
        >
          <div class="flex items-start">
            <div class="mt-1">
              <input 
                type="radio"
                v-model="selectedEditType" 
                value="individual"
                class="w-4 h-4 text-blue-600 cursor-pointer"
              />
            </div>
            <div class="ml-4 flex-1">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-user-cog" class="h-5 w-5" :class="selectedEditType === 'individual' ? 'text-blue-600' : 'text-gray-400'" />
                <div class="text-lg font-bold text-gray-900 dark:text-white">Personal Details Edit</div>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                Edit individual details in table format
              </div>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Personal info
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Banking details
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Government IDs
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-blue-500 font-bold uppercase tracking-wider">
                  <UIcon name="i-lucide-info" class="h-3 w-3" />
                  Unique values kept
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Employment Bulk Update Option -->
        <div 
          class="group relative border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
          :class="selectedEditType === 'bulk' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-green-300 dark:hover:border-green-700'"
          @click="selectedEditType = 'bulk'"
        >
          <div class="flex items-start">
            <div class="mt-1">
              <input 
                type="radio"
                v-model="selectedEditType" 
                value="bulk"
                class="w-4 h-4 text-green-600 cursor-pointer"
              />
            </div>
            <div class="ml-4 flex-1">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-users-2" class="h-5 w-5" :class="selectedEditType === 'bulk' ? 'text-green-600' : 'text-gray-400'" />
                <div class="text-lg font-bold text-gray-900 dark:text-white">Employment Bulk Update</div>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                Apply same employment details to all selected employees
              </div>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Status & Category
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Project & Site
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
                  <UIcon name="i-lucide-check-circle-2" class="text-green-500 h-3 w-3" />
                  Daily Wage
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-green-500 font-bold uppercase tracking-wider">
                  <UIcon name="i-lucide-zap" class="h-3 w-3" />
                  Massive operations
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mixed Edit Option -->
        <div 
          class="group relative border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
          :class="selectedEditType === 'mixed' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-purple-300 dark:hover:border-purple-700'"
          @click="selectedEditType = 'mixed'"
        >
          <div class="flex items-start">
            <div class="mt-1">
              <input 
                type="radio"
                v-model="selectedEditType" 
                value="mixed"
                class="w-4 h-4 text-purple-600 cursor-pointer"
              />
            </div>
            <div class="ml-4 flex-1">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="h-5 w-5" :class="selectedEditType === 'mixed' ? 'text-purple-600' : 'text-gray-400'" />
                <div class="text-lg font-bold text-gray-900 dark:text-white">Mixed Edit (Advanced)</div>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                Combine both personal and employment editing
              </div>
              <div class="mt-3">
                <div class="flex items-center gap-1.5 text-[11px] text-purple-500 font-bold uppercase tracking-wider">
                  <UIcon name="i-lucide-sparkles" class="h-3 w-3" />
                  Best of both worlds: Individual table + Bulk updates
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Selection Summary -->
      <div class="mt-8 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-dashed border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-orange-500 text-white p-2 rounded-lg">
            <UIcon name="i-lucide-users" class="h-5 w-5" />
          </div>
          <div>
            <div class="text-sm font-bold text-orange-900 dark:text-orange-300 uppercase tracking-widest">Target Group</div>
            <div class="text-xs text-orange-700 dark:text-orange-400 font-medium">
              <span class="text-lg font-black">{{ selectedEmployeesCount }}</span> employees selected
            </div>
          </div>
        </div>
        <div v-if="selectedEditType" class="text-right">
          <div class="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-widest">Active Mode</div>
          <UBadge color="warning" variant="soft" class="font-bold">
            {{ getEditTypeLabel(selectedEditType) }}
          </UBadge>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedEmployeesCount: number
}>()

const emit = defineEmits<{
  'update:editType': [type: string]
}>()

const selectedEditType = ref('')

const getEditTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    individual: 'Personal Details',
    bulk: 'Employment Bulk', 
    mixed: 'Advanced Mixed'
  }
  return labels[type] || ''
}

// Watch for changes and emit to parent
watch(selectedEditType, (newType) => {
  emit('update:editType', newType)
})
</script>
