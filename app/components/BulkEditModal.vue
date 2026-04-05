<template>
  <UModal :model-value="show" @update:model-value="$emit('close')">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            Bulk Edit Employees
          </h3>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="$emit('close')" />
        </div>
      </template>
      <div class="p-4">
        <p class="text-sm text-gray-500 mb-4">
          Bulk editing {{ employees.length }} employees.
        </p>
        <!-- Mock form -->
        <UButton color="primary" @click="handleBulkUpdate">Update All</UButton>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  employees: any[]
  uniqueCategories: string[]
  uniqueProjects: string[]
  uniqueSites: string[]
}>()

const emit = defineEmits(['close', 'success'])

const handleBulkUpdate = () => {
  // Mock bulk update logic
  emit('success', { updatedCount: props.employees.length, fieldsUpdated: ['status'] })
  emit('close')
}
</script>
