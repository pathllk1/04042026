<template>
  <div>
    <div v-if="loading" class="flex justify-center items-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 text-primary" />
    </div>

    <div v-else-if="wageHistory.length === 0" class="text-center py-8 text-gray-500">
      No wage history found for this employee.
    </div>

    <div v-else>
      <!-- Export Button -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">
          {{ wageHistory.length }} wage record{{ wageHistory.length !== 1 ? 's' : '' }} found
        </div>
        <UButton
          color="success"
          icon="i-lucide-download"
          :loading="isExporting"
          label="Export to Excel"
          @click="exportToExcel"
          class="w-full sm:w-auto"
        />
      </div>

      <!-- Desktop/Tablet Table View -->
      <div class="hidden sm:block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div class="overflow-x-auto max-h-96 overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gradient-to-r from-teal-500 to-indigo-600 sticky top-0 z-10">
              <tr>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Month</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Payment Date</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Per Day Wage</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Days Worked</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Gross Salary</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden lg:table-cell">EPF</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden lg:table-cell">ESIC</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden xl:table-cell">Other Deduction</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden xl:table-cell">Advance Recovery</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Net Salary</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(wage, index) in wageHistory" :key="index" class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">{{ formatMonth(wage.salary_month) }}</td>
                <td class="px-3 py-3 whitespace-nowrap">
                  <UBadge v-if="wage.paid_date" color="success" variant="soft" size="sm">
                    {{ formatDate(wage.paid_date) }}
                  </UBadge>
                  <UBadge v-else color="error" variant="soft" size="sm">
                    Not Paid
                  </UBadge>
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">{{ formatCurrency(wage.pDayWage) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300 hidden md:table-cell">{{ wage.wage_Days }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ formatCurrency(wage.gross_salary) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">{{ formatCurrency(wage.epf_deduction) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">{{ formatCurrency(wage.esic_deduction) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden xl:table-cell">{{ formatCurrency(wage.other_deduction) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden xl:table-cell">{{ formatCurrency(wage.advance_recovery) }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{{ formatCurrency(wage.net_salary) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile Card View -->
      <div class="sm:hidden space-y-4 max-h-96 overflow-y-auto">
        <div v-for="(wage, index) in wageHistory" :key="index"
             class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div>
              <h4 class="font-bold text-gray-900 dark:text-white">{{ formatMonth(wage.salary_month) }}</h4>
              <div class="mt-1">
                <UBadge v-if="wage.paid_date" color="success" variant="soft" size="xs">
                  {{ formatDate(wage.paid_date) }}
                </UBadge>
                <UBadge v-else color="error" variant="soft" size="xs">
                  Not Paid
                </UBadge>
              </div>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(wage.net_salary) }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Net Salary</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="flex flex-col">
              <span class="text-gray-500 dark:text-gray-400 text-xs">Gross:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(wage.gross_salary) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-gray-500 dark:text-gray-400 text-xs">Days:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ wage.wage_Days }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-gray-500 dark:text-gray-400 text-xs">EPF:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(wage.epf_deduction) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-gray-500 dark:text-gray-400 text-xs">ESIC:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(wage.esic_deduction) }}</span>
            </div>
          </div>

          <div v-if="wage.other_deduction > 0 || wage.advance_recovery > 0" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div v-if="wage.other_deduction > 0" class="flex flex-col">
                <span class="text-gray-500 dark:text-gray-400 text-xs">Other:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(wage.other_deduction) }}</span>
              </div>
              <div v-if="wage.advance_recovery > 0" class="flex flex-col">
                <span class="text-gray-500 dark:text-gray-400 text-xs">Advance Rec:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(wage.advance_recovery) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

const props = defineProps<{
  wageHistory?: any[]
  loading?: boolean
  employeeName?: string
}>()

const isExporting = ref(false);
const toast = useToast();

// Format currency values
const formatCurrency = (value: number | null | undefined) => {
  if (value === undefined || value === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Format month for display
const formatMonth = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// Format date for display
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Export to Excel function
const exportToExcel = async () => {
  if (isExporting.value || !props.wageHistory || props.wageHistory.length === 0) return;

  try {
    isExporting.value = true;

    const api = useApiWithAuth();

    // Prepare export data
    const exportData = {
      wageHistory: props.wageHistory,
      employeeName: props.employeeName || 'Employee'
    };

    // Call the export API using the post method with blob response type
    const blob = await api.post('/api/wages/export-wage-history', exportData, {
      responseType: 'blob'
    });

    // Verify we got a valid blob
    if (!blob || !(blob instanceof Blob)) {
      throw new Error('Invalid response: Expected blob data');
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with employee name and current date
    const currentDate = new Date().toISOString().split('T')[0];
    const sanitizedEmployeeName = (props.employeeName || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Wage_History_${sanitizedEmployeeName}_${currentDate}.xlsx`;
    link.setAttribute('download', filename);

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.add({
      title: 'Export Success',
      description: `Wage history for ${props.employeeName} exported successfully.`,
      color: 'success'
    });

  } catch (error: any) {
    console.error('Error exporting wage history:', error);
    
    let errorMessage = 'Failed to export wage history. ';
    if (error.statusCode === 401) {
      errorMessage += 'Please log in again.';
    } else if (error.message) {
      errorMessage += error.message;
    }

    toast.add({
      title: 'Export Failed',
      description: errorMessage,
      color: 'error'
    });
  } finally {
    isExporting.value = false;
  }
};
</script>

<style scoped>
/* Custom scrollbar for table */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
