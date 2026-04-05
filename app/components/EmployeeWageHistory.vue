<template>
  <div>
    <div v-if="loading" class="flex justify-center py-4">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 text-gray-400" />
    </div>
    <div v-else-if="wageHistory.length === 0" class="text-center py-4 text-gray-500">
      No wage history found for {{ employeeName }}.
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="wage in wageHistory" :key="wage._id">
            <td class="px-4 py-2 whitespace-nowrap text-sm">{{ wage.salary_month }}</td>
            <td class="px-4 py-2 whitespace-nowrap text-sm">{{ wage.present_days }}</td>
            <td class="px-4 py-2 whitespace-nowrap text-sm">{{ wage.net_payable }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  wageHistory: any[]
  loading: boolean
  employeeName: string
}>()
</script>
