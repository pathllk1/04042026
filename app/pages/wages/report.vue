<template>
  <div class="container mx-auto p-3 sm:p-4">
    <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Employee Wages Reports & Analytics</h1>

    <!-- Filter Section -->
    <div class="bg-white p-3 sm:p-4 rounded-lg shadow mb-3 sm:mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center col-span-full mb-3 sm:mb-4 gap-2 sm:gap-4">
          <div class="flex flex-wrap gap-2 sm:gap-4">
            <button
              @click="exportToExcel"
              class="flex items-center px-3 py-2 text-xs sm:text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="loading"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
              <span v-else>
                <DocumentArrowDownIcon class="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Generate PF ESIC Report
              </span>
            </button>
            <button
              @click="generateBankStatement"
              class="flex items-center px-3 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="loading || !hasChequeSelected"
              :title="!hasChequeSelected ? 'Please select a cheque number first' : 'Generate bank statement for selected cheque'"
            >
              <span v-if="loading && hasChequeSelected" class="flex items-center">
                <svg class="animate-spin w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
              <span v-else>
                <DocumentArrowDownIcon class="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Generate Bank Statement
              </span>
            </button>
            <button
              @click="generateSalarySlips"
              class="flex items-center px-3 py-2 text-xs sm:text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="loading || !selectedMonth"
              :title="!selectedMonth ? 'Please select a month first' : 'Generate salary slips for all employees'"
            >
              <span v-if="loading && generatingSalarySlips" class="flex items-center">
                <svg class="animate-spin w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
              <span v-else>
                <DocumentArrowDownIcon class="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Generate Salary Slips
              </span>
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Month</label>
          <input
            type="month"
            v-model="selectedMonth"
            :max="new Date().toISOString().slice(0, 7)"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm"
            @change="loadWages"
          />
        </div>
        <div>
          <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Cheque No
            <span v-if="!hasChequeSelected" class="text-xs text-orange-500 ml-1">(required for bank statement)</span>
          </label>
          <select
            v-model="chequeFilter"
            :class="[
              'mt-1 block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm',
              !hasChequeSelected ? 'border-orange-300' : 'border-gray-300'
            ]"
          >
            <option value="">All</option>
            <option v-for="cheque in uniqueChequeNumbers" :key="cheque" :value="cheque">
              {{ cheque }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Employee Name</label>
          <input
            type="text"
            v-model="employeeFilter"
            placeholder="Filter by name"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm"
          />
        </div>
        <div>
          <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Project</label>
          <input
            type="text"
            v-model="projectFilter"
            placeholder="Filter by project"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm"
          />
        </div>
      </div>
    </div>

    <!-- Summary Section -->
    <div class="bg-white p-3 sm:p-4 rounded-lg shadow mb-3 sm:mb-4">
      <h2 class="text-lg sm:text-xl font-semibold mb-2">Summary</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div class="p-2 sm:p-3 bg-blue-50 rounded">
          <div class="text-xs sm:text-sm text-gray-600">Total Employees</div>
          <div class="text-base sm:text-xl font-bold">{{ filteredWages.length }}</div>
        </div>
        <div class="p-2 sm:p-3 bg-green-50 rounded">
          <div class="text-xs sm:text-sm text-gray-600">Total Gross Salary</div>
          <div class="text-base sm:text-xl font-bold">{{ formatCurrency(totalGrossSalary) }}</div>
        </div>
        <div class="p-2 sm:p-3 bg-red-50 rounded">
          <div class="text-xs sm:text-sm text-gray-600">Total Deductions</div>
          <div class="text-base sm:text-xl font-bold">{{ formatCurrency(totalDeductions) }}</div>
        </div>
        <div class="p-2 sm:p-3 bg-orange-50 rounded">
          <div class="text-xs sm:text-sm text-gray-600">Total Advance Recovery</div>
          <div class="text-base sm:text-xl font-bold">{{ formatCurrency(totalAdvanceRecovery) }}</div>
        </div>
        <div class="p-2 sm:p-3 bg-purple-50 rounded">
          <div class="text-xs sm:text-sm text-gray-600">Total Net Salary</div>
          <div class="text-base sm:text-xl font-bold">{{ formatCurrency(totalNetSalary) }}</div>
        </div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="bg-white p-3 sm:p-4 rounded-lg shadow mb-3 sm:mb-4">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          v-model="searchQuery"
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Search across all fields..."
        />
      </div>
      <div v-if="searchQuery" class="mt-2 text-sm text-gray-600">
        Showing {{ filteredWages.length }} of {{ wages.length }} wage records
        <button @click="searchQuery = ''" class="ml-2 text-indigo-600 hover:text-indigo-800">Clear</button>
      </div>
    </div>

    <!-- Wages Table -->
    <div v-if="filteredWages.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600 shadow-md">
            <tr>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Sl. No.</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Employee Name</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Project</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Site</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Days</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Per Day</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Gross</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Deductions</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Advance</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell">Benefits</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Net</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Payment Date</th>
              <th class="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="wage in filteredWages" :key="wage._id" class="hover:bg-gray-50">
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">{{ wage.slNo }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">{{ wage.employeeName }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">{{ wage.project }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm hidden md:table-cell">{{ wage.site }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm">{{ wage.wage_Days }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm">₹{{ wage.pDayWage }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm">₹{{ (wage.gross_salary || 0).toLocaleString() }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-red-600 text-xs sm:text-sm hidden sm:table-cell">
                ₹{{ ((wage.epf_deduction || 0) + (wage.esic_deduction || 0) + (wage.other_deduction || 0)).toLocaleString() }}
              </td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-red-600 text-xs sm:text-sm hidden sm:table-cell">
                <span :class="(wage.advance_recovery || 0) > 0 ? 'text-red-600' : 'text-gray-400'">
                  ₹{{ (wage.advance_recovery || 0).toLocaleString() }}
                </span>
              </td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-green-600 text-xs sm:text-sm hidden sm:table-cell">
                ₹{{ (wage.other_benefit || 0).toLocaleString() }}
              </td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right font-medium text-xs sm:text-sm">
                ₹{{ (wage.net_salary || 0).toLocaleString() }}
              </td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm hidden md:table-cell">{{ wage.paid_date ? new Date(wage.paid_date).toLocaleDateString() : '-' }}</td>
              <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-center">
                <button
                  @click="generateSingleSalarySlip(wage._id)"
                  class="inline-flex items-center px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  :disabled="loading"
                  title="Generate salary slip"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Slip
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
      <div class="flex flex-col items-center justify-center py-4">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
        <p class="text-gray-600 text-sm sm:text-base">Loading wage data...</p>
      </div>
    </div>

    <!-- No Data Message -->
    <div v-else class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
      <p class="text-gray-500 text-sm sm:text-base">No wage records found for the selected month.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePageTitle } from '~/composables/ui/usePageTitle';
import { DocumentArrowDownIcon } from '@heroicons/vue/24/outline';

// Set page title
usePageTitle('Wages Report', 'View and export employee wage reports');

import useApiWithAuth from '~/composables/auth/useApiWithAuth'

definePageMeta({})

const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const employeeFilter = ref('')
const projectFilter = ref('')
const chequeFilter = ref('')
const searchQuery = ref('') // General search query
const wages = ref([])
const loading = ref(false)
const generatingSalarySlips = ref(false) // Flag for salary slip generation

// Get unique cheque numbers
const uniqueChequeNumbers = computed(() => {
  const chequeNos = wages.value.map(wage => wage.cheque_no).filter(Boolean)
  return [...new Set(chequeNos)].sort()
})

// Filter wages based on search criteria
const filteredWages = computed(() => {
  return wages.value.filter(wage => {
    // Apply specific filters
    const nameMatch = wage.employeeName.toLowerCase().includes(employeeFilter.value.toLowerCase())
    const projectMatch = wage.project.toLowerCase().includes(projectFilter.value.toLowerCase())
    const chequeMatch = !chequeFilter.value || wage.cheque_no === chequeFilter.value

    // Apply general search query across multiple fields
    let searchMatch = true
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      searchMatch =
        wage.employeeName.toLowerCase().includes(query) ||
        wage.project.toLowerCase().includes(query) ||
        (wage.site && wage.site.toLowerCase().includes(query)) ||
        String(wage.wage_Days).includes(query) ||
        String(wage.pDayWage).includes(query) ||
        String(wage.gross_salary).includes(query) ||
        String(wage.net_salary).includes(query) ||
        (wage.bank && wage.bank.toLowerCase().includes(query)) ||
        (wage.accountNo && String(wage.accountNo).includes(query))
    }

    return nameMatch && projectMatch && chequeMatch && searchMatch
  }).map((wage, index) => ({
    ...wage,
    slNo: index + 1 // Add serial number to each wage record
  }))
})

// Check if a cheque number is selected
const hasChequeSelected = computed(() => {
  return !!chequeFilter.value && chequeFilter.value.trim() !== ''
})

// Load wages data
const loadWages = async () => {
  // Set loading state to true
  loading.value = true;
  wages.value = []; // Clear previous data

  try {
    const api = useApiWithAuth();
    const data = await api.get('/api/wages', {
      params: { month: selectedMonth.value }
    });

    if (data?.success) {
      wages.value = data.wages;
    }
  } catch (error) {
    // Error is handled by setting loading to false
  } finally {
    // Set loading state to false when done
    loading.value = false;
  }
}

// Calculate summary values
const totalGrossSalary = computed(() => {
  return filteredWages.value.reduce((sum, wage) => sum + wage.gross_salary, 0)
})

const totalDeductions = computed(() => {
  return filteredWages.value.reduce((sum, wage) => {
    return sum + wage.epf_deduction + wage.esic_deduction + wage.other_deduction
  }, 0)
})

const totalAdvanceRecovery = computed(() => {
  return filteredWages.value.reduce((sum, wage) => sum + (wage.advance_recovery || 0), 0)
})

const totalNetSalary = computed(() => {
  return filteredWages.value.reduce((sum, wage) => sum + wage.net_salary, 0)
})

// Format currency in Indian format
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

// Load wages on component mount
onMounted(() => {
  loadWages()
})

const exportToExcel = async () => {
  // Set loading state to true
  loading.value = true;

  try {
    const api = useApiWithAuth();

    // API call to export data

    const response = await api.fetchWithAuth('/api/wages/export', {
      method: 'POST',
      body: {
        month: selectedMonth.value
      },
      responseType: 'blob'
    });

    // Create a URL for the blob
    const url = window.URL.createObjectURL(new Blob([response]));

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wages-report-${selectedMonth.value}.xlsx`);
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export data. Please try again.');
  } finally {
    // Set loading state to false when done
    loading.value = false;
  }
}

const generateBankStatement = async () => {
  try {
    // Validate cheque number selection
    if (!hasChequeSelected.value) {
      alert('Please select a cheque number to generate bank statement');
      return;
    }

    // Set loading state to true
    loading.value = true;

    const api = useApiWithAuth();

    // Call the bank-statement API endpoint
    const response = await api.fetchWithAuth('/api/wages/bank-statement', {
      method: 'POST',
      body: {
        month: selectedMonth.value,
        chequeNo: chequeFilter.value
      },
      responseType: 'blob'
    });

    // Create a URL for the blob
    const url = window.URL.createObjectURL(new Blob([response]));

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bank-statement-${chequeFilter.value}-${selectedMonth.value}.xlsx`);
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating bank statement:', error);
    alert('Error generating bank statement. Please try again.');
  } finally {
    // Set loading state to false when done
    loading.value = false;
  }
}

// Generate salary slips for all employees
const generateSalarySlips = async () => {
  if (!selectedMonth.value) {
    alert('Please select a month first')
    return
  }

  try {
    loading.value = true
    generatingSalarySlips.value = true

    const api = useApiWithAuth()

    // Call the API to generate salary slips
    const response = await api.fetchWithAuth('/api/wages/salary-slips-batch', {
      method: 'POST',
      body: {
        month: selectedMonth.value
      },
      responseType: 'blob'
    })

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `salary-slips-${selectedMonth.value}.zip`)
    document.body.appendChild(link)
    link.click()

    // Clean up
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Error generating salary slips:', error)
    alert('Error generating salary slips')
  } finally {
    loading.value = false
    generatingSalarySlips.value = false
  }
}

// Generate salary slip for a single employee
const generateSingleSalarySlip = async (wageId) => {
  try {
    loading.value = true

    const api = useApiWithAuth()

    // Call the API to generate a single salary slip
    const response = await api.fetchWithAuth('/api/wages/salary-slip', {
      method: 'POST',
      body: {
        wageId
      },
      responseType: 'blob'
    })

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url

    // Get employee name from wages array
    const wage = wages.value.find(w => w._id === wageId)
    const employeeName = wage ? wage.employeeName.replace(/\s+/g, '_') : 'employee'

    link.setAttribute('download', `salary-slip-${employeeName}.docx`)
    document.body.appendChild(link)
    link.click()

    // Clean up
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Error generating salary slip:', error)
    alert('Error generating salary slip')
  } finally {
    loading.value = false
  }
}
</script>