<template>
  <UModal :model-value="show" @update:model-value="$emit('close')">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            Export Master Roll
          </h3>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="$emit('close')" />
        </div>
      </template>
      <div class="p-4">
        <p class="text-sm text-gray-500 mb-4">
          Exporting {{ employees.length }} employees with current filters.
        </p>
        <UButton color="primary" @click="handleExport">Export to Excel</UButton>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  employees: any[]
  currentFilters: any
  searchTerm: string
  uniqueProjects: string[]
  uniqueSites: string[]
}>()

const emit = defineEmits(['close', 'export-complete'])

const handleExport = () => {
  // Mock export logic
  emit('export-complete', { success: true })
  emit('close')
}
</script>
