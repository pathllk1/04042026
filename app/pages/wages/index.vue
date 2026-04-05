<template>
  <div class="w-full mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
    <div class="sm:px-0">
      <div class="flex justify-between items-center mb-4 sm:mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Employee Wages Management</h1>
      </div>

      <!-- Month Selection and Controls -->
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6 overflow-x-auto">
        <div class="flex flex-col lg:flex-row space-y-3 lg:space-y-0 lg:space-x-4 items-end">
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Select Month</label>
            <input
              type="month"
              v-model="selectedMonth"
              :max="new Date().toISOString().slice(0, 7)"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              @change="loadEmployees"
            >
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              v-model="paymentDetails.paid_date"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Cheque Number</label>
            <input
              type="text"
              v-model="paymentDetails.cheque_no"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter cheque number"
            >
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Select Bank</label>
            <div class="flex items-center">
              <select
                v-model="selectedBankId"
                class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                :disabled="loadingLedgers"
              >
                <option value="">-- Select Bank --</option>
                <option v-for="bank in bankLedgers" :key="bank.id" :value="bank.id">
                  {{ bank.name }} - {{ bank.bankDetails?.accountNumber || 'N/A' }}
                </option>
              </select>
              <button
                @click="showAddBankModal = true"
                class="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                title="Add New Bank"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Filter by Project</label>
            <select v-model="selectedProject" @change="filterEmployees" class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="">All Projects</option>
              <option v-for="project in uniqueProjects" :key="project" :value="project">{{ project }}</option>
            </select>
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Filter by Site</label>
            <select v-model="selectedSite" @change="filterEmployees" class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="">All Sites</option>
              <option v-for="site in uniqueSites" :key="site" :value="site">{{ site }}</option>
            </select>
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Filter by Bank</label>
            <select v-model="selectedBank" @change="filterEmployees" class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="">All Banks</option>
              <option v-for="bank in uniqueBanks" :key="bank" :value="bank">{{ bank }}</option>
            </select>
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Paid From Bank Account</label>
            <input
              type="text"
              v-model="paymentDetails.paid_from_bank_ac"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Auto-filled with account number"
              readonly
            >
          </div>
          <div class="w-full lg:w-1/6">
            <label class="block text-xs font-medium text-gray-700 mb-1">Action</label>
            <div class="flex space-x-1">
              <button
                @click="calculateAll"
                class="flex-1 px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!employeeWages.length || loading"
              >
                Calculate All
              </button>
              <button
                @click="showPreviewModal = true"
                class="flex-1 px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!employeeWages.length || loading || selectedEmployeesCount === 0"
                title="Preview wages before saving"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
              <button
                @click="showPfEsicPreviewModal = true"
                class="flex-1 px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!selectedMonth || loading"
                title="Preview PF & ESIC for selected month"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PF/ESIC
              </button>
              <button
                @click="saveWages"
                class="flex-1 px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!employeeWages.length || loading"
              >
                <span v-if="loading" class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
                <span v-else>Save Wages</span>
              </button>
            </div>
          </div>

          <!-- AI Rules Refresh Button is now only shown in the PF/ESIC modal -->

        </div>
      </div>

      <!-- Summary Section -->
      <div v-if="employeeWages.length && selectedEmployeesCount > 0" class="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6 overflow-x-auto">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Selected Employees</p>
            <p class="text-base font-semibold">{{ selectedEmployeesCount }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total Gross Salary</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalGrossSalary) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total EPF</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalEpf) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total ESIC</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalEsic) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total Other Deduction</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalOtherDeduction) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total Advance Recovery</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalAdvanceRecovery) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total Other Benefit</p>
            <p class="text-base font-semibold">₹{{ formatIndianCurrency(totalOtherBenefit) }}</p>
          </div>
          <div class="bg-gray-50 p-2 rounded-md">
            <p class="text-xs text-gray-500">Total Net Salary</p>
            <p class="text-base font-bold text-indigo-600">₹{{ formatIndianCurrency(totalNetSalary) }}</p>
          </div>
        </div>
      </div>

      <!-- Data Table -->
      <div v-if="employeeWages.length" class="mt-4 sm:mt-8 flex flex-col">
        <!-- Search Bar -->
        <div class="mb-4 px-4 sm:px-6 lg:px-8">
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
              placeholder="Search by Sl. No., name, bank, branch, account, or IFSC..."
            />
          </div>
          <div v-if="searchQuery" class="mt-2 text-sm text-gray-600">
            Showing {{ employeeWages.length }} of {{ allEmployeeWages.length }} employees
            <button @click="searchQuery = ''" class="ml-2 text-indigo-600 hover:text-indigo-800">Clear</button>
          </div>
        </div>

        <div class="-my-2 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
          <div class="py-2 align-middle inline-block min-w-full px-4 sm:px-6 lg:px-8">
            <div class="shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg max-w-full">
              <div class="block md:hidden bg-white p-4">
                <!-- Mobile view - cards instead of table -->
                <div v-for="(wage, index) in employeeWages" :key="wage.masterRollId" class="mb-4 p-3 border rounded-lg shadow-sm">
                  <div class="flex justify-between items-center mb-2">
                    <div class="font-medium">
                      <span class="inline-block bg-gray-100 text-gray-800 text-xs font-semibold mr-2 px-2 py-1 rounded">
                        #{{ wage.slNo }}
                      </span>
                      {{ wage.employeeName }}
                    </div>
                    <input
                      type="checkbox"
                      v-model="wage.selected"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    >
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span class="font-medium">Bank:</span> {{ wage.bank }}</div>
                    <div><span class="font-medium">Branch:</span> {{ wage.branch }}</div>
                    <div><span class="font-medium">Account:</span> {{ wage.accountNo }}</div>
                    <div><span class="font-medium">IFSC:</span> {{ wage.ifsc }}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Per Day Wage</label>
                      <input
                        type="number"
                        v-model="wage.pDayWage"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index, true)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Days</label>
                      <input
                        type="number"
                        v-model="wage.wage_Days"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index, true)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Other Deduction</label>
                      <input
                        type="number"
                        v-model="wage.other_deduction"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Advance Recovery</label>
                      <div class="flex items-center">
                        <input
                          type="number"
                          v-model="wage.advance_recovery"
                          :class="[
                            'w-full text-xs rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                            wage.hasAdvances && wage.selectedAdvanceId ? 'border-green-500 bg-green-50' : 'border-gray-300'
                          ]"
                          :title="wage.hasAdvances && wage.selectedAdvanceId ? 'Prefilled with installment amount' : ''"
                          @change="calculateWage(index)"
                        >
                        <button
                          v-if="wage.masterRollId"
                          @click="showAdvances(wage.masterRollId, index)"
                          :class="wage.hasAdvances ? 'ml-1 text-xs text-red-600 hover:text-red-800' : 'ml-1 text-xs text-blue-600 hover:text-blue-800'"
                          :title="wage.hasAdvances ? `${wage.advanceCount} advances, ₹${formatIndianCurrency(wage.totalOutstanding)} outstanding` : 'View advances'"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <!-- Show advance count badge if employee has advances -->
                        <span v-if="wage.hasAdvances && wage.advanceCount > 0"
                              class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                              :title="`${wage.advanceCount} outstanding advances`">
                          {{ wage.advanceCount }}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Other Benefit</label>
                      <input
                        type="number"
                        v-model="wage.other_benefit"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span class="font-medium">Gross Salary:</span> ₹{{ formatIndianCurrency(wage.gross_salary) }}</div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">🤖 EPF ({{ getCurrentRules.epf?.employeeRate ? (getCurrentRules.epf.employeeRate * 100).toFixed(1) + '%' : 'N/A' }})</label>
                      <input
                        type="number"
                        v-model="wage.epf_deduction"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">🤖 ESIC ({{ getCurrentRules.esic?.employeeRate ? (getCurrentRules.esic.employeeRate * 100).toFixed(2) + '%' : 'N/A' }})</label>
                      <input
                        type="number"
                        v-model="wage.esic_deduction"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div><span class="font-medium">Advance Recovery:</span> ₹{{ formatIndianCurrency(wage.advance_recovery) }}</div>
                    <div><span class="font-medium">Net Salary:</span> <span class="font-bold">₹{{ formatIndianCurrency(wage.net_salary) }}</span></div>
                  </div>

                  <button
                    @click="calculateWage(index, true)"
                    class="w-full mt-2 text-xs bg-indigo-100 text-indigo-700 py-2 px-3 rounded-md hover:bg-indigo-200"
                  >
                    Calculate
                  </button>
                </div>
              </div>

              <table class="hidden md:table min-w-full divide-y divide-gray-200 table-auto">
                <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
                  <tr>
                    <th class="px-1 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-8">
                      <input
                        type="checkbox"
                        v-model="selectAll"
                        @change="toggleSelectAll"
                        class="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      >
                    </th>
                    <th
                      @click="sortEmployeeWages('slNo')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-12 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Sl. No.
                        <span v-if="sortColumn === 'slNo'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('employeeName')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-32 lg:w-40 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Employee Name
                        <span v-if="sortColumn === 'employeeName'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('bank')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-28 lg:w-32 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Bank
                        <span v-if="sortColumn === 'bank'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('branch')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 lg:w-28 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Branch
                        <span v-if="sortColumn === 'branch'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('accountNo')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-28 lg:w-32 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Account No
                        <span v-if="sortColumn === 'accountNo'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('ifsc')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 lg:w-28 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        IFSC
                        <span v-if="sortColumn === 'ifsc'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('pDayWage')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-20 lg:w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Per Day Wage
                        <span v-if="sortColumn === 'pDayWage'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('wage_Days')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-16 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Days
                        <span v-if="sortColumn === 'wage_Days'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('gross_salary')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Gross Salary
                        <span v-if="sortColumn === 'gross_salary'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('epf_deduction')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-20 cursor-pointer hover:bg-indigo-700"
                      :title="`EPF rate: ${getCurrentRules.epf?.employeeRate ? (getCurrentRules.epf.employeeRate * 100).toFixed(1) + '% (AI-fetched)' : 'Not available - please refresh EPF/ESIC rates'}`"
                    >
                      <div class="flex items-center">
                        🤖 EPF ({{ getCurrentRules.epf?.employeeRate ? (getCurrentRules.epf.employeeRate * 100).toFixed(1) + '%' : 'N/A' }})
                        <span v-if="sortColumn === 'epf_deduction'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('esic_deduction')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-20 cursor-pointer hover:bg-indigo-700"
                      :title="`ESIC rate: ${getCurrentRules.esic?.employeeRate ? (getCurrentRules.esic.employeeRate * 100).toFixed(2) + '% (AI-fetched)' : 'Not available - please refresh EPF/ESIC rates'}`"
                    >
                      <div class="flex items-center">
                        🤖 ESIC ({{ getCurrentRules.esic?.employeeRate ? (getCurrentRules.esic.employeeRate * 100).toFixed(2) + '%' : 'N/A' }})
                        <span v-if="sortColumn === 'esic_deduction'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('other_deduction')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Other Deduction
                        <span v-if="sortColumn === 'other_deduction'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('advance_recovery')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Advance Recovery
                        <span v-if="sortColumn === 'advance_recovery'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('other_benefit')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Other Benefit
                        <span v-if="sortColumn === 'other_benefit'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th
                      @click="sortEmployeeWages('net_salary')"
                      class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-24 cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Net Salary
                        <span v-if="sortColumn === 'net_salary'" class="ml-1">
                          <svg v-if="sortDirection === 'asc'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider w-20">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(wage, index) in employeeWages" :key="wage.masterRollId" class="hover:bg-gray-50">
                    <td class="px-1 py-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        v-model="wage.selected"
                        class="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs font-medium">{{ wage.slNo }}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.employeeName }}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.bank }}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.branch }}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.accountNo }}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.ifsc }}</td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.pDayWage"
                        class="w-16 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index, true)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.wage_Days"
                        class="w-12 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index, true)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap text-xs">₹{{ formatIndianCurrency(wage.gross_salary) }}</td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.epf_deduction"
                        class="w-16 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.esic_deduction"
                        class="w-16 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.other_deduction"
                        class="w-16 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="number"
                          v-model="wage.advance_recovery"
                          :class="[
                            'w-16 text-xs rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                            wage.hasAdvances && wage.selectedAdvanceId ? 'border-green-500 bg-green-50' : 'border-gray-300'
                          ]"
                          :title="wage.hasAdvances && wage.selectedAdvanceId ? 'Prefilled with installment amount' : ''"
                          @change="calculateWage(index)"
                        >
                        <button
                          v-if="wage.masterRollId"
                          @click="showAdvances(wage.masterRollId, index)"
                          :class="wage.hasAdvances ? 'ml-1 text-xs text-red-600 hover:text-red-800' : 'ml-1 text-xs text-blue-600 hover:text-blue-800'"
                          :title="wage.hasAdvances ? 'Employee has outstanding advances' : 'View advances'"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.other_benefit"
                        class="w-16 text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap font-medium text-xs">₹{{ formatIndianCurrency(wage.net_salary) }}</td>
                    <td class="px-2 py-2 whitespace-nowrap">
                      <button
                        @click="calculateWage(index, true)"
                        class="text-xs text-indigo-600 hover:text-indigo-900"
                      >
                        Calculate
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
        <div class="flex flex-col items-center justify-center py-4">
          <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
          <p class="text-gray-600 text-sm sm:text-base">Loading employee data...</p>
        </div>
      </div>

      <!-- No Data Message -->
      <div v-else-if="selectedMonth" class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
        <p class="text-gray-500 text-sm sm:text-base">No employee data available for the selected month. Please select a different month or add employees to the Master Roll.</p>
      </div>

      <!-- Firestore Processing Overlay -->
      <div v-if="isProcessingFirestore" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Processing Firestore Updates</h3>

          <div class="mb-4">
            <div class="flex justify-between mb-1">
              <span class="text-sm font-medium text-gray-700">Progress</span>
              <span class="text-sm font-medium text-gray-700">{{ firestoreProgress.current }} / {{ firestoreProgress.total }}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: (firestoreProgress.current / firestoreProgress.total * 100) + '%' }"></div>
            </div>
          </div>

          <p class="text-sm text-gray-600 mb-2">{{ firestoreProgress.status }}</p>

          <p v-if="firestoreProgress.retryCount > 0" class="text-sm text-yellow-600 mb-4">
            Retry attempt: {{ firestoreProgress.retryCount }}
          </p>
        </div>
      </div>

      <!-- Initial Message -->
      <div v-else class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
        <p class="text-gray-500 text-sm sm:text-base">Please select a month to load employee data.</p>
      </div>
    </div>

    <!-- Add Bank Modal -->
    <div v-if="showAddBankModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-gray-900">Add New Bank</h3>
          <button @click="showAddBankModal = false" class="text-gray-400 hover:text-gray-500">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name*</label>
            <input
              type="text"
              v-model="newBankData.name"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter bank name"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Account Number*</label>
            <input
              type="text"
              v-model="newBankData.bankDetails.accountNumber"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter account number"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
            <input
              type="text"
              v-model="newBankData.bankDetails.ifscCode"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter IFSC code"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <input
              type="text"
              v-model="newBankData.bankDetails.branch"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter branch name"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name (Full)</label>
            <input
              type="text"
              v-model="newBankData.bankDetails.bankName"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter full bank name"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
            <input
              type="number"
              v-model="newBankData.openingBalance"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter opening balance"
            >
          </div>
        </div>

        <div class="mt-6 flex justify-end space-x-3">
          <button
            @click="showAddBankModal = false"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            @click="addNewBank"
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Add Bank
          </button>
        </div>
      </div>
    </div>

    <!-- Advances Modal -->
    <div v-if="showAdvancesModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative mx-auto p-5 border w-full max-w-md sm:max-w-lg md:max-w-xl shadow-lg rounded-md bg-white">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-gray-900">Outstanding Advances</h3>
          <button @click="closeAdvancesModal" class="text-gray-400 hover:text-gray-500">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="loadingAdvances" class="py-4 text-center">
          <p class="text-gray-500">Loading advances...</p>
        </div>

        <div v-else-if="employeeAdvances.length === 0" class="py-4 text-center">
          <p class="text-gray-500">No outstanding advances found for this employee.</p>
        </div>

        <div v-else>
          <div class="mb-4">
            <p class="text-sm text-gray-600">Employee: <span class="font-medium">{{ currentEmployeeName }}</span></p>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="advance in employeeAdvances" :key="advance._id" class="hover:bg-gray-50">
                  <td class="px-4 py-2 whitespace-nowrap text-xs">{{ formatDate(advance.date) }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.amount }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.remainingBalance }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-xs">
                    <button
                      @click="applyAdvanceRecovery(advance)"
                      class="text-blue-600 hover:text-blue-800"
                      :disabled="advance.remainingBalance <= 0"
                    >
                      Apply
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 flex justify-end">
            <button @click="closeAdvancesModal" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Wages Preview Modal -->
    <div v-if="showPreviewModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="showPreviewModal = false">
      <div class="relative top-4 mx-auto p-5 border w-[95%] max-w-[95%] shadow-lg rounded-md bg-white" @click.stop>
        <div class="mt-3">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-4 border-b">
            <h3 class="text-lg font-semibold text-gray-900">Wages Preview - {{ formatMonthYear(selectedMonth) }}</h3>
            <button @click="showPreviewModal = false" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Payment Details Summary -->
          <div class="mt-4 bg-gray-50 p-4 rounded-lg">
            <h4 class="text-md font-medium text-gray-900 mb-3">Payment Details</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span class="font-medium text-gray-700">Payment Date:</span>
                <span class="ml-2">{{ formatDate(paymentDetails.paid_date) || 'Not specified' }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Cheque Number:</span>
                <span class="ml-2">{{ paymentDetails.cheque_no || 'Not specified' }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Bank Account:</span>
                <span class="ml-2">{{ paymentDetails.paid_from_bank_ac || 'Not specified' }}</span>
              </div>
            </div>
          </div>

          <!-- Filters Section -->
          <div class="mt-4 bg-blue-50 p-4 rounded-lg">
            <div class="flex flex-wrap items-center gap-4">
              <h4 class="text-md font-medium text-gray-900">Filters:</h4>
              <div class="flex items-center space-x-2">
                <label class="text-sm font-medium text-gray-700">Project:</label>
                <select v-model="previewFilters.project" class="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">All Projects</option>
                  <option v-for="project in uniqueProjectsInPreview" :key="project" :value="project">{{ project }}</option>
                </select>
              </div>
              <div class="flex items-center space-x-2">
                <label class="text-sm font-medium text-gray-700">Site:</label>
                <select v-model="previewFilters.site" class="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">All Sites</option>
                  <option v-for="site in uniqueSitesInPreview" :key="site" :value="site">{{ site }}</option>
                </select>
              </div>
              <div class="flex items-center space-x-2">
                <label class="text-sm font-medium text-gray-700">Bank:</label>
                <select v-model="previewFilters.bank" class="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">All Banks</option>
                  <option v-for="bank in uniqueBanksInPreview" :key="bank" :value="bank">{{ bank }}</option>
                </select>
              </div>
              <button
                @click="clearPreviewFilters"
                class="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <!-- Validation Warnings -->
          <div v-if="previewValidationErrors.length > 0" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 class="text-md font-medium text-red-800 mb-2">⚠️ Validation Issues</h4>
            <ul class="text-sm text-red-700 space-y-1">
              <li v-for="error in previewValidationErrors" :key="error" class="flex items-center">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                {{ error }}
              </li>
            </ul>
          </div>

          <!-- Summary Totals -->
          <div class="mt-4 bg-blue-50 p-4 rounded-lg">
            <h4 class="text-md font-medium text-gray-900 mb-3">
              Summary ({{ filteredWagesForPreview.length }} of {{ selectedEmployeesCount }} employees)
              <span v-if="filteredWagesForPreview.length !== selectedEmployeesCount" class="text-sm text-blue-600 font-normal">- Filtered View</span>
            </h4>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Total Gross</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalGrossSalary) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Total EPF</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalEpf) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Total ESIC</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalEsic) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Other Deduction</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalOtherDeduction) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Advance Recovery</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalAdvanceRecovery) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Other Benefit</p>
                <p class="font-semibold">₹{{ formatIndianCurrency(previewTotalOtherBenefit) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Net Payable</p>
                <p class="font-bold text-green-600">₹{{ formatIndianCurrency(previewTotalNetSalary) }}</p>
              </div>
              <div class="bg-white p-2 rounded border">
                <p class="text-xs text-gray-500">Bank Transfer</p>
                <p class="font-bold text-blue-600">₹{{ formatIndianCurrency(previewTotalNetSalary) }}</p>
              </div>
            </div>
          </div>

          <!-- Employee Details Table -->
          <div class="mt-4">
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-md font-medium text-gray-900">Employee Wage Details ({{ filteredWagesForPreview.length }} employees)</h4>
              <button
                @click="exportPreviewToExcel"
                class="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </button>
            </div>
            <div class="max-h-96 overflow-y-auto border rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sl.</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project/Site</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank Details</th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Per Day</th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">EPF</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ESIC</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Other Ded.</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Advance</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Benefits</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(wage, index) in filteredWagesForPreview" :key="wage.masterRollId" class="hover:bg-gray-50">
                    <td class="px-2 py-2 text-xs text-center">{{ index + 1 }}</td>
                    <td class="px-3 py-2 text-sm">
                      <div class="font-medium text-gray-900">{{ wage.employeeName }}</div>
                      <div class="text-xs text-gray-500">{{ wage.ifsc }}</div>
                    </td>
                    <td class="px-3 py-2 text-sm">
                      <div class="text-gray-900">{{ wage.project || 'N/A' }}</div>
                      <div class="text-xs text-gray-500">{{ wage.site || 'N/A' }}</div>
                    </td>
                    <td class="px-3 py-2 text-sm">
                      <div class="text-gray-900">{{ wage.bank }}</div>
                      <div class="text-xs text-gray-500">{{ wage.accountNo }}</div>
                    </td>
                    <td class="px-2 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.pDayWage) }}</td>
                    <td class="px-2 py-2 text-sm text-center">{{ wage.wage_Days }}</td>
                    <td class="px-3 py-2 text-sm text-right font-medium">₹{{ formatIndianCurrency(wage.gross_salary) }}</td>
                    <td class="px-3 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.epf_deduction) }}</td>
                    <td class="px-3 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.esic_deduction) }}</td>
                    <td class="px-3 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.other_deduction) }}</td>
                    <td class="px-3 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.advance_recovery) }}</td>
                    <td class="px-3 py-2 text-sm text-right">₹{{ formatIndianCurrency(wage.other_benefit) }}</td>
                    <td class="px-3 py-2 text-sm text-right font-semibold text-green-600">₹{{ formatIndianCurrency(wage.net_salary) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Modal Actions -->
          <div class="mt-6 flex justify-end space-x-3 pt-4 border-t">
            <button
              @click="showPreviewModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close Preview
            </button>
            <button
              @click="proceedToSave"
              :disabled="previewValidationErrors.length > 0 || loading"
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
              <span v-else>Proceed to Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PF/ESIC Preview Modal -->
    <PfEsicPreviewModal
      :show="showPfEsicPreviewModal"
      :selected-month="selectedMonth"
      :pf-esic-data="pfEsicData"
      :loading="loadingPfEsicData"
      :filters="pfEsicFilters"
      @close="showPfEsicPreviewModal = false"
      @refresh="fetchPfEsicData"
      @update-employee="updateEmployeeInPfEsicData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { usePageTitle } from '~/composables/ui/usePageTitle';
import PfEsicPreviewModal from '~/components/wages/PfEsicPreviewModal.vue';

// Set page title
usePageTitle('Wages Management', 'Manage employee wages and payments');

import { useCookie, useFetch } from 'nuxt/app'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'
import { useLedgers } from '~/composables/expenses/useLedgers'
import { useEpfEsicRules } from '~/composables/business/useEpfEsicRules'

// Define page meta
definePageMeta({
  requiresAuth: true
});

// State variables
const selectedMonth = ref('');
const employeeWages = ref([]);
const allEmployeeWages = ref([]); // Store original data for filtering
const selectAll = ref(true);
const loading = ref(false); // Loading state for data fetching
const paymentDetails = reactive({
  paid_date: '',
  cheque_no: '',
  paid_from_bank_ac: ''
});

// Bank ledgers state
const { bankLedgers, fetchLedgers, isLoading: loadingLedgers, createLedger } = useLedgers();
const selectedBankId = ref('');
const showAddBankModal = ref(false);

// EPF/ESIC rules composable
const { calculateWithCurrentRules, getCurrentRules, startBackgroundUpdate, fetchLatestRules, loadStoredRulesIfNeeded } = useEpfEsicRules();

// AI rules refresh state
const refreshingAiRules = ref(false);

// Manual refresh of AI rules
const refreshAiRules = async () => {
  try {
    refreshingAiRules.value = true;
    console.log('🔄 Manually refreshing EPF/ESIC rules from AI...');

    await fetchLatestRules(true); // Force update

    // Recalculate all wages with new rules
    calculateAll();

    // Show success notification
    showFooterNotification('✅ EPF/ESIC rules updated successfully from AI system!', 'success');
  } catch (error) {
    console.error('Error refreshing AI rules:', error);
    showFooterNotification('❌ Failed to refresh EPF/ESIC rules. Using cached values.', 'error');
  } finally {
    refreshingAiRules.value = false;
  }
};
const newBankData = reactive({
  name: '',
  openingBalance: 0,
  bankDetails: {
    accountNumber: '',
    ifscCode: '',
    branch: '',
    bankName: ''
  }
});

// Firestore processing state
const isProcessingFirestore = ref(false);
const firestoreProgress = reactive({
  current: 0,
  total: 0,
  status: '',
  retryCount: 0
});

// Sorting and filtering state
const sortColumn = ref('');
const sortDirection = ref('asc'); // 'asc' or 'desc'
const searchQuery = ref(''); // For filtering employees
const selectedProject = ref('');
const selectedSite = ref('');
const selectedBank = ref('');

// Computed properties for filter dropdowns
const uniqueProjects = computed(() => {
  const projects = allEmployeeWages.value.map(wage => wage.project).filter(Boolean);
  return [...new Set(projects)];
});

const uniqueSites = computed(() => {
  const sites = allEmployeeWages.value.map(wage => wage.site).filter(Boolean);
  return [...new Set(sites)];
});

const uniqueBanks = computed(() => {
  const banks = allEmployeeWages.value.map(wage => wage.bank).filter(Boolean);
  return [...new Set(banks)];
});

// Filter employees based on search query
const filterEmployees = () => {
  const query = searchQuery.value.toLowerCase().trim();
  employeeWages.value = allEmployeeWages.value.filter(wage => {
    const searchMatch = !query || (
      wage.slNo.toString().includes(query) ||
      wage.employeeName.toLowerCase().includes(query) ||
      wage.bank.toLowerCase().includes(query) ||
      wage.branch.toLowerCase().includes(query) ||
      wage.accountNo.toString().includes(query) ||
      wage.ifsc.toLowerCase().includes(query)
    );

    const projectMatch = !selectedProject.value || wage.project === selectedProject.value;
    const siteMatch = !selectedSite.value || wage.site === selectedSite.value;
    const bankMatch = !selectedBank.value || wage.bank === selectedBank.value;

    return searchMatch && projectMatch && siteMatch && bankMatch;
  });

  // Re-apply current sort if any
  if (sortColumn.value) {
    applySorting();
  }
};

// Watch for changes in search query
watch(searchQuery, filterEmployees);
watch(selectedProject, filterEmployees);
watch(selectedSite, filterEmployees);
watch(selectedBank, filterEmployees);

// Apply sorting to the current employee wages array
const applySorting = () => {
  // For employee name, use localeCompare for proper string sorting
  if (sortColumn.value === 'employeeName') {
    employeeWages.value.sort((a, b) => {
      const nameA = a.employeeName.toLowerCase();
      const nameB = b.employeeName.toLowerCase();

      // Use localeCompare for proper alphabetical sorting
      const compareResult = nameA.localeCompare(nameB);

      // Apply sort direction properly
      return sortDirection.value === 'asc' ? compareResult : -compareResult;
    });
  } else {
    // For other columns, use the existing logic
    employeeWages.value.sort((a, b) => {
      let valueA = a[sortColumn.value];
      let valueB = b[sortColumn.value];

      // Handle numeric values
      if (!isNaN(Number(valueA)) && !isNaN(Number(valueB))) {
        valueA = Number(valueA);
        valueB = Number(valueB);
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        // Case-insensitive string comparison
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      // Compare the values
      if (valueA < valueB) {
        return sortDirection.value === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortDirection.value === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
};

// Sort the employee wages
const sortEmployeeWages = (column) => {
  // If clicking the same column, toggle direction
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }

  // Apply the sorting
  applySorting();
};

// Selected employees count and financial summaries
const selectedEmployeesCount = computed(() => {
  return employeeWages.value.filter(wage => wage.selected).length;
});

const totalGrossSalary = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.gross_salary || 0), 0)
    .toFixed(2);
});

const totalEpf = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.epf_deduction || 0), 0)
    .toFixed(2);
});

const totalEsic = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.esic_deduction || 0), 0)
    .toFixed(2);
});

const totalOtherDeduction = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.other_deduction || 0), 0)
    .toFixed(2);
});

const totalAdvanceRecovery = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.advance_recovery || 0), 0)
    .toFixed(2);
});

const totalOtherBenefit = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.other_benefit || 0), 0)
    .toFixed(2);
});

const totalNetSalary = computed(() => {
  return employeeWages.value
    .filter(wage => wage.selected)
    .reduce((sum, wage) => sum + Number(wage.net_salary || 0), 0)
    .toFixed(2);
});

// Advance recovery state
const showAdvancesModal = ref(false);
const loadingAdvances = ref(false);
const employeeAdvances = ref([]);
const currentEmployeeIndex = ref(-1);
const currentEmployeeId = ref('');
const currentEmployeeName = ref('');

// Preview modal state
const showPreviewModal = ref(false);

// PF/ESIC Preview modal state
const showPfEsicPreviewModal = ref(false);
const pfEsicData = ref([]);
const loadingPfEsicData = ref(false);

// Preview filters
const previewFilters = reactive({
  project: '',
  site: '',
  bank: ''
});

// PF/ESIC Preview filters
const pfEsicFilters = reactive({
  project: '',
  site: '',
  status: '', // 'paid', 'unpaid', or '' for all
  employeeStatus: 'active' // 'active', 'inactive', or '' for all
});

// Computed properties for preview
const selectedWagesForPreview = computed(() => {
  return employeeWages.value.filter(wage => wage.selected);
});

// Filtered wages for preview based on filters
const filteredWagesForPreview = computed(() => {
  let filtered = selectedWagesForPreview.value;

  if (previewFilters.project) {
    filtered = filtered.filter(wage => wage.project === previewFilters.project);
  }

  if (previewFilters.site) {
    filtered = filtered.filter(wage => wage.site === previewFilters.site);
  }

  if (previewFilters.bank) {
    filtered = filtered.filter(wage => wage.bank === previewFilters.bank);
  }

  return filtered;
});

// Unique values for filter dropdowns
const uniqueProjectsInPreview = computed(() => {
  const projects = selectedWagesForPreview.value
    .map(wage => wage.project)
    .filter(project => project && project.trim() !== '');
  return [...new Set(projects)].sort();
});

const uniqueSitesInPreview = computed(() => {
  const sites = selectedWagesForPreview.value
    .map(wage => wage.site)
    .filter(site => site && site.trim() !== '');
  return [...new Set(sites)].sort();
});

const uniqueBanksInPreview = computed(() => {
  const banks = selectedWagesForPreview.value
    .map(wage => wage.bank)
    .filter(bank => bank && bank.trim() !== '');
  return [...new Set(banks)].sort();
});

// Preview totals based on filtered data
const previewTotalGrossSalary = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.gross_salary || 0), 0)
    .toFixed(2);
});

const previewTotalEpf = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.epf_deduction || 0), 0)
    .toFixed(2);
});

const previewTotalEsic = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.esic_deduction || 0), 0)
    .toFixed(2);
});

const previewTotalOtherDeduction = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.other_deduction || 0), 0)
    .toFixed(2);
});

const previewTotalAdvanceRecovery = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.advance_recovery || 0), 0)
    .toFixed(2);
});

const previewTotalOtherBenefit = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.other_benefit || 0), 0)
    .toFixed(2);
});

const previewTotalNetSalary = computed(() => {
  return filteredWagesForPreview.value
    .reduce((sum, wage) => sum + Number(wage.net_salary || 0), 0)
    .toFixed(2);
});

const previewValidationErrors = computed(() => {
  const errors = [];

  if (!selectedMonth.value) {
    errors.push('Please select a month');
  }

  if (!paymentDetails.paid_date) {
    errors.push('Please specify payment date');
  }

  if (!paymentDetails.paid_from_bank_ac) {
    errors.push('Please select a bank account');
  }

  if (selectedEmployeesCount.value === 0) {
    errors.push('Please select at least one employee');
  }

  // Check for employees with zero or negative net salary
  const invalidSalaries = selectedWagesForPreview.value.filter(wage =>
    wage.net_salary <= 0
  );

  if (invalidSalaries.length > 0) {
    errors.push(`${invalidSalaries.length} employee(s) have zero or negative net salary`);
  }

  return errors;
});

// Get last wage days for employees from their previous wage records
const getLastWageDaysForEmployees = async (employeeIds) => {
  try {
    const api = useApiWithAuth();
    const lastWageDaysMap = {};

    // Fetch last wage record for all employees using bulk API
    try {
      console.log(`🔄 Fetching wage history for ${employeeIds.length} employees using bulk API...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await api.post('/api/wages/employee-history-bulk', {
        employeeIds: employeeIds
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.success && response.data) {
        console.log(`✅ Bulk wage history completed: ${response.employeesWithHistory}/${response.totalEmployees} employees have history`);
        console.log('📊 Sample wage history data:', response.data.slice(0, 3));

        // Process the bulk response
        response.data.forEach(historyData => {
          lastWageDaysMap[historyData.employeeId] = historyData.lastWageDays;
          console.log(`📋 Employee ${historyData.employeeId}: wage days = ${historyData.lastWageDays}`);
        });

        console.log('🗂️ Final lastWageDaysMap sample:', Object.entries(lastWageDaysMap).slice(0, 3));
      }
    } catch (error) {
      console.warn('⚠️ Bulk wage history failed, using default values:', error.message);
      // Set default values for all employees if bulk API fails
      employeeIds.forEach(employeeId => {
        lastWageDaysMap[employeeId] = 26;
      });
    }
    return lastWageDaysMap;
  } catch (error) {
    console.error('Error fetching last wage days:', error);
    // Return empty map, will use default values
    return {};
  }
};

// Load employees from MasterRoll when month is selected
const loadEmployees = async () => {
  if (!selectedMonth.value) return;

  // Set loading state to true
  loading.value = true;
  employeeWages.value = []; // Clear previous data

  try {
    // Parse the selected month
    const [year, month] = selectedMonth.value.split('-');
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);

    // Get all employees from master roll first using authenticated API
    const api = useApiWithAuth();
    const response = await api.get('/api/master-roll');

    // Filter by status - only active employees
    const activeEmployees = response.employees.filter(emp => {
      const joinDate = emp.dateOfJoining ? new Date(emp.dateOfJoining) : null;
      return emp.status === 'active' && joinDate && joinDate <= lastDayOfMonth;
    });

    // First, get all wages to determine if this month has entries and what the latest month is
    const allWagesData = await api.get('/api/wages');

    let shouldShowAllEmployees = false;

    if (allWagesData && allWagesData.wages) {
      // Check if the selected month exists in wages records
      const selectedMonthExists = allWagesData.wages.some(wage => {
        const wageMonth = new Date(wage.salary_month).toISOString().substring(0, 7);
        return wageMonth === selectedMonth.value;
      });

      // Get the last month with wage records
      const wageDates = allWagesData.wages.map(wage => new Date(wage.salary_month));
      const lastWageDate = wageDates.length > 0 ? new Date(Math.max(...wageDates)) : null;
      const lastWageMonth = lastWageDate ? lastWageDate.toISOString().substring(0, 7) : null;


      // Implement the exact logic:
      // "If selected month is not present in wages model salary_month AND
      // selected month is greater than last month in wages model salary_month, then show all employees"
      shouldShowAllEmployees = !selectedMonthExists &&
                               (!lastWageMonth || selectedMonth.value > lastWageMonth);
    } else {
      // No wages records at all, show all employees
      shouldShowAllEmployees = true;
    }


    let employeesToShow = [];

    if (shouldShowAllEmployees) {
      // Show all active employees
      employeesToShow = [...activeEmployees];
    } else {
      // Check which employees already have wages for this month
      const wagesData = await api.get('/api/wages', {
        params: {
          month: selectedMonth.value
        }
      });

      // Create a set of employee IDs who have wages for this month
      const paidEmployeeIds = new Set();
      if (wagesData && wagesData.wages) {
        wagesData.wages.forEach(wage => {
          if (wage.masterRollId) {
            paidEmployeeIds.add(wage.masterRollId);
          }
        });
      }


      // Filter out employees who already have wages for this month
      employeesToShow = activeEmployees.filter(emp => !paidEmployeeIds.has(emp._id));
    }


    // Fetch last wage days for each employee
    const lastWageDaysMap = await getLastWageDaysForEmployees(employeesToShow.map(emp => emp._id));
    console.log('🎯 Final wage days mapping for employees:', Object.entries(lastWageDaysMap).slice(0, 5));

    // Transform remaining employees to wage format with proper wage days prefilling
    const transformedEmployees = employeesToShow.map((emp, index) => {
      const wageDays = lastWageDaysMap[emp._id] || 26;
      console.log('👤 Employee ' + emp.employeeName + ' (' + emp._id + '): wage_Days = ' + wageDays);

      return {
        slNo: index + 1,
        masterRollId: emp._id,
        employeeName: emp.employeeName,
        bank: emp.bank,
        branch: emp.branch || '',
        accountNo: emp.accountNo,
        ifsc: emp.ifsc,
        pDayWage: Number(emp.pDayWage) || 0,
        wage_Days: wageDays,
        project: emp.project || '',
        site: emp.site || '',
        gross_salary: 0,
        epf_deduction: 0,
        esic_deduction: 0,
        other_deduction: 0,
        advance_recovery: 0,
        selectedAdvanceId: null,
        other_benefit: 0,
        net_salary: 0,
        hasAdvances: false,
        totalOutstanding: 0,
        advanceCount: 0,
        selected: true
      };
    });

    // Store both in the reactive refs
    employeeWages.value = transformedEmployees;
    allEmployeeWages.value = [...transformedEmployees]; // Make a copy for filtering

    // Reset search query when loading new data
    searchQuery.value = '';

    // Apply default sort by employee name in ascending order (A to Z) first
    sortColumn.value = 'employeeName';
    sortDirection.value = 'asc';

    // Apply sorting directly for initial load
    employeeWages.value.sort((a, b) => {
      const nameA = a.employeeName.toLowerCase();
      const nameB = b.employeeName.toLowerCase();
      return nameA.localeCompare(nameB); // Always ascending for initial sort
    });

    // Calculate initial values
    calculateAll();

    // Check for outstanding advances for each employee (with error protection)
    try {
      await checkEmployeesForAdvances();
    } catch (error) {
      console.warn('Advances checking failed, continuing without advance data:', error);
      // Continue without advance data rather than failing the entire operation
    }

    // Re-apply the sort after all async operations to ensure it stays in the correct order
    applySorting();
  } catch (error) {
    console.error('Error loading employees:', error);
    alert('Failed to load employee data. Please try again.');
  } finally {
    // Set loading state to false when done, regardless of success or failure
    loading.value = false;
  }
};

// Check which employees have outstanding advances using background job API
const checkEmployeesForAdvances = async () => {
  // Don't show a separate loading state for this operation
  // as it's part of the main data loading process
  try {
    const api = useApiWithAuth();

    // Get all employee IDs that need to be checked
    const employeeIds = employeeWages.value
      .filter(wage => wage.masterRollId)
      .map(wage => wage.masterRollId);

    if (employeeIds.length === 0) {
      return; // No employees to check
    }

    console.log(`🔄 Checking advances for ${employeeIds.length} employees using background job...`);
    console.log('📋 Employee IDs being checked:', employeeIds.slice(0, 5), '...'); // Show first 5 IDs for debugging

    // Single API call to get all advance data
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for background job

    const response = await api.post('/api/employee-advances/background-check', {
      employeeIds: employeeIds
    }, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.success && response.data) {
      console.log(`✅ Background job completed: ${response.employeesWithAdvances}/${response.totalEmployees} employees have advances`);
      console.log('📊 Advance data sample:', response.data.filter(d => d.hasAdvances).slice(0, 3)); // Show first 3 employees with advances

      // Process the background job response
      response.data.forEach(advanceData => {
        // Find the employee in our wages array
        const employeeIndex = employeeWages.value.findIndex(
          wage => wage.masterRollId === advanceData.employeeId
        );

        if (employeeIndex >= 0) {
          // Set advance information
          employeeWages.value[employeeIndex].hasAdvances = advanceData.hasAdvances;
          employeeWages.value[employeeIndex].totalOutstanding = advanceData.totalOutstanding;
          employeeWages.value[employeeIndex].advanceCount = advanceData.advanceCount;

          // If there's a first advance with repayment terms, prefill the recovery amount
          if (advanceData.hasAdvances && advanceData.firstAdvance) {
            const firstAdvance = advanceData.firstAdvance;

            if (firstAdvance.repaymentTerms && firstAdvance.repaymentTerms.installmentAmount) {
              // Make sure we don't exceed the remaining balance
              const installmentAmount = Math.min(
                firstAdvance.repaymentTerms.installmentAmount,
                firstAdvance.remainingBalance
              );

              // Set the advance recovery amount and the selected advance ID
              employeeWages.value[employeeIndex].advance_recovery = installmentAmount;
              employeeWages.value[employeeIndex].selectedAdvanceId = firstAdvance._id;

              // Recalculate the wage to update net salary
              calculateWage(employeeIndex);
            }
          }
        }
      });
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('⏰ Advance check background job timed out - continuing without advance data');
    } else {
      console.error('❌ Error in advance check background job:', error.message);
    }
    // Don't throw the error to prevent disrupting the main flow
  }
};

// Toggle select all employees
const toggleSelectAll = () => {
  employeeWages.value.forEach(wage => {
    wage.selected = selectAll.value;
  });
};

// Watch for changes in individual selections
watch(
  () => employeeWages.value.map(w => w.selected),
  () => {
    selectAll.value = employeeWages.value.length > 0 &&
      employeeWages.value.every(w => w.selected);
  },
  { deep: true }
);

// Calculate wage for a single employee using AI-fetched EPF/ESIC rules
const calculateWage = (index, fullRecalc = false) => {
  const wage = employeeWages.value[index];
  if (!wage) return;

  if (fullRecalc) {
    // Calculate gross salary
    wage.gross_salary = Number(wage.pDayWage) * Number(wage.wage_Days);

    // Use AI-fetched EPF/ESIC rules for accurate calculations
    const calculations = calculateWithCurrentRules(wage.gross_salary);

    // Apply the AI-calculated deductions. This is the initial calculation.
    // Manual edits will be preserved unless a full recalculation is triggered.
    wage.epf_deduction = calculations.employeeEpf;
    wage.esic_deduction = calculations.employeeEsic;

    // Store additional calculation details for reference
    wage.calculationDetails = {
      rulesUsed: calculations.rulesUsed,
      epfApplicableWage: calculations.epfApplicableWage,
      esicApplicableWage: calculations.esicApplicableWage,
      totalEmployerContribution: calculations.totalEmployerContribution
    };
  }

  // Ensure values are numbers before calculation
  wage.other_deduction = Number(wage.other_deduction) || 0;
  wage.advance_recovery = Number(wage.advance_recovery) || 0;
  wage.other_benefit = Number(wage.other_benefit) || 0;
  wage.epf_deduction = Number(wage.epf_deduction) || 0;
  wage.esic_deduction = Number(wage.esic_deduction) || 0;

  // Calculate net salary
  wage.net_salary = wage.gross_salary - (wage.epf_deduction + wage.esic_deduction + wage.other_deduction + wage.advance_recovery) + wage.other_benefit;
  
  // Round to 2 decimal places
  wage.net_salary = Math.round(wage.net_salary * 100) / 100;
};

// Calculate wages for all employees
const calculateAll = () => {
  employeeWages.value.forEach((_, index) => {
    calculateWage(index, true);
  });
};

// Save wages to database
const saveWages = async () => {
  if (!selectedMonth.value || !paymentDetails.paid_date) {
    alert('Please select a month and payment date');
    return;
  }

  // Get selected wages only
  const selectedWages = employeeWages.value
    .filter(wage => wage.selected)
    .map(wage => ({
      ...wage,
      salary_month: new Date(selectedMonth.value),
      paid_date: paymentDetails.paid_date,
      cheque_no: paymentDetails.cheque_no,
      paid_from_bank_ac: paymentDetails.paid_from_bank_ac
    }));

  if (selectedWages.length === 0) {
    alert('Please select at least one employee');
    return;
  }

  // Set loading state to true
  loading.value = true;

  try {
    const api = useApiWithAuth();

    // First, fetch current master roll data to compare pDayWage values
    const masterRollResponse = await api.get('/api/master-roll');

    // Create a map of employee ID to current pDayWage for quick lookup
    const currentPDayWageMap = {};
    if (masterRollResponse && masterRollResponse.employees) {
      masterRollResponse.employees.forEach(emp => {
        currentPDayWageMap[emp._id] = Number(emp.pDayWage) || 0;
      });
    }

    // Check for pDayWage changes and add a flag to track them
    selectedWages.forEach(wage => {
      const currentPDayWage = currentPDayWageMap[wage.masterRollId] || 0;
      wage.pDayWageChanged = Number(wage.pDayWage) !== currentPDayWage;
    });

    // Save wages with the update flag information
    const response = await api.post('/api/wages', {
      wages: selectedWages
    });

    if (response.success) {
      alert(`Successfully saved wages for ${response.count} employees${response.updatedMasterRoll ? ` and updated ${response.updatedMasterRoll} employee wage rates` : ''}`);

      // Schedule Firestore update after 5 seconds
      if (selectedBankId.value) {
        // Show a message to the user that Firestore updates will start soon
        alert('Wages saved successfully. Firestore updates will start in 5 seconds.');

        setTimeout(async () => {
          try {
            // Get the saved wages from the response to ensure we have the MongoDB IDs
            const savedWages = response.savedWages || [];

            // If no saved wages, log and return
            if (!savedWages || savedWages.length === 0) {
              console.log('No saved wages found in response, skipping Firestore update');
              return;
            }

            // Prepare data for Firestore update with validation
            const wagesForFirestore = savedWages
              .map(wage => {
                // Ensure all required fields are present
                if (!wage._id || !wage.employeeName || !selectedBankId.value) {
                  console.warn('Skipping wage record missing required fields:',
                    { id: wage._id, name: wage.employeeName, ledgerId: selectedBankId.value });
                  return null;
                }

                return {
                  _id: wage._id.toString(), // Ensure ID is a string
                  employeeName: wage.employeeName,
                  net_salary: wage.net_salary || 0,
                  paid_date: wage.paid_date || new Date(),
                  salary_month: wage.salary_month || new Date(),
                  ledgerId: selectedBankId.value,
                  cheque_no: wage.cheque_no || '',
                  project: wage.project || 'KIR_NON_CORE'
                };
              })
              .filter(wage => wage !== null); // Remove any invalid records

            // Only proceed if we have valid records
            if (wagesForFirestore.length === 0) {
              console.log('No valid wage records for Firestore, skipping update');
              return;
            }

            // Process wages in batches using the new endpoint
            const success = await processBatchedFirestoreUpdates(wagesForFirestore);

            if (success) {
              console.log('Successfully added wages to Firestore');
              alert(`Successfully added ${wagesForFirestore.length} wage records to Firestore.`);
            } else {
              console.error('Some errors occurred while adding wages to Firestore');
              alert('Some errors occurred while adding wages to Firestore. Please check the console for details.');
            }
          } catch (error) {
            console.error('Error adding wages to Firestore:', error);
            alert('Error adding wages to Firestore. Please check the console for details.');
          }
        }, 5000);
      }

      // Reload employees to get updated data
      await loadEmployees();
    }
  } catch (error) {
    console.error('Error saving wages:', error);
    alert('Failed to save wages. Please try again.');
    // Set loading state to false in case of error
    loading.value = false;
  }
};

// Show advances modal for an employee
const showAdvances = async (employeeId, index) => {
  currentEmployeeId.value = employeeId;
  currentEmployeeIndex.value = index;
  currentEmployeeName.value = employeeWages.value[index].employeeName;

  showAdvancesModal.value = true;
  loadingAdvances.value = true;
  employeeAdvances.value = [];

  try {
    const api = useApiWithAuth();

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await api.get(`/api/employee-advances/by-employee/${employeeId}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.success && response.advances) {
      employeeAdvances.value = response.advances;

      // Update the hasAdvances flag based on the response
      employeeWages.value[index].hasAdvances = response.advances.length > 0;
    }
  } catch (error) {
    console.error('Error loading advances for employee:', employeeId, error);

    // Provide more specific error messages
    if (error.name === 'AbortError') {
      alert('Request timed out. Please try again.');
    } else if (error.statusCode === 503) {
      alert('Database service temporarily unavailable. Please try again in a moment.');
    } else {
      alert('Failed to load advances. Please try again.');
    }
  } finally {
    loadingAdvances.value = false;
  }
};

// Close advances modal
const closeAdvancesModal = () => {
  showAdvancesModal.value = false;
  currentEmployeeId.value = '';
  currentEmployeeIndex.value = -1;
  employeeAdvances.value = [];
};

// Apply advance recovery
const applyAdvanceRecovery = (advance) => {
  if (currentEmployeeIndex.value < 0) return;

  const wage = employeeWages.value[currentEmployeeIndex.value];

  // Calculate gross salary and deductions first (without advance recovery)
  const grossSalary = Number(wage.pDayWage) * Number(wage.wage_Days);
  const calculations = calculateWithCurrentRules(grossSalary);

  // Calculate net salary before advance recovery
  const netSalaryBeforeAdvance = grossSalary - (calculations.employeeEpf + calculations.employeeEsic + (Number(wage.other_deduction) || 0)) + (Number(wage.other_benefit) || 0);

  // Calculate recovery amount based on available net salary and remaining balance
  const recoveryAmount = Math.min(advance.remainingBalance, Math.max(0, netSalaryBeforeAdvance));

  wage.advance_recovery = recoveryAmount;
  wage.selectedAdvanceId = advance._id;

  // Recalculate the wage with the new advance recovery
  calculateWage(currentEmployeeIndex.value);

  // Close the modal
  closeAdvancesModal();
};

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Format amount in Indian currency format (adds commas for thousands)
const formatIndianCurrency = (amount) => {
  // Parse the amount to a float first (it may be a string)
  const num = parseFloat(amount);

  // Format the number with Indian number system (lakhs and crores)
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
};

// Process wages in Firestore with batching and retry logic
const processBatchedFirestoreUpdates = async (wages) => {
  const CHUNK_SIZE = 10;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds
  const api = useApiWithAuth();

  firestoreProgress.total = wages.length;
  firestoreProgress.current = 0;
  firestoreProgress.status = 'Starting Firestore updates...';
  isProcessingFirestore.value = true;

  try {
    const totalChunks = Math.ceil(wages.length / CHUNK_SIZE);
    console.log(`Processing ${wages.length} wages in ${totalChunks} chunks`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      let success = false;
      let retryCount = 0;

      while (!success && retryCount < MAX_RETRIES) {
        try {
          firestoreProgress.status = `Processing chunk ${chunkIndex + 1}/${totalChunks}...`;

          const response = await api.post('/api/wages/batch-add-to-firestore', {
            wages,
            chunkSize: CHUNK_SIZE,
            chunkIndex
          });

          if (response.success) {
            firestoreProgress.current += response.processedCount;
            success = true;
            console.log(`Successfully processed chunk ${chunkIndex + 1}/${totalChunks}: ${response.successCount} succeeded, ${response.failureCount} failed`);
          } else {
            throw new Error('Chunk processing failed');
          }
        } catch (error) {
          retryCount++;
          firestoreProgress.retryCount = retryCount;
          console.error(`Error processing chunk ${chunkIndex + 1}, attempt ${retryCount}:`, error);

          if (retryCount < MAX_RETRIES) {
            firestoreProgress.status = `Retrying chunk ${chunkIndex + 1} (Attempt ${retryCount}/${MAX_RETRIES})...`;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
          }
        }
      }

      if (!success) {
        throw new Error(`Failed to process chunk ${chunkIndex + 1} after ${MAX_RETRIES} attempts`);
      }
    }

    firestoreProgress.status = 'Firestore updates completed successfully';
    return true;
  } catch (error) {
    console.error('Error in Firestore processing:', error);
    firestoreProgress.status = `Error: ${error.message}`;
    return false;
  } finally {
    isProcessingFirestore.value = false;
  }
};

// Fetch bank ledgers and initialize PF/ESIC rules on component mount
onMounted(async () => {
  try {
    // Load stored PF/ESIC rules for wages management
    loadStoredRulesIfNeeded();

    // Start background update for PF/ESIC rules (only for wages management)
    startBackgroundUpdate();

    await fetchLedgers('bank');
  } catch (error) {
    console.error('Error fetching bank ledgers:', error);
  }
});

// Handle bank selection
const handleBankSelection = () => {
  if (!selectedBankId.value) {
    paymentDetails.paid_from_bank_ac = '';
    return;
  }

  const selectedBank = bankLedgers.value.find(bank => bank.id === selectedBankId.value);
  if (selectedBank) {
    // Use only the account number as requested
    const accountNumber = selectedBank.bankDetails?.accountNumber || '';
    paymentDetails.paid_from_bank_ac = accountNumber;
  }
};

// Watch for changes in selected bank
watch(selectedBankId, handleBankSelection);

// Reset add bank form
const resetAddBankForm = () => {
  newBankData.name = '';
  newBankData.openingBalance = 0;
  newBankData.bankDetails.accountNumber = '';
  newBankData.bankDetails.ifscCode = '';
  newBankData.bankDetails.branch = '';
  newBankData.bankDetails.bankName = '';
};

// Add new bank ledger
const addNewBank = async () => {
  if (!newBankData.name || !newBankData.bankDetails.accountNumber) {
    alert('Bank name and account number are required');
    return;
  }

  try {
    // Create bank ledger data
    const bankData = {
      name: newBankData.name,
      type: 'bank',
      openingBalance: Number(newBankData.openingBalance) || 0,
      bankDetails: {
        accountNumber: newBankData.bankDetails.accountNumber,
        ifscCode: newBankData.bankDetails.ifscCode || '',
        branch: newBankData.bankDetails.branch || '',
        bankName: newBankData.bankDetails.bankName || ''
      }
    };

    // Create the bank ledger
    const newBank = await createLedger(bankData);

    // Select the newly created bank
    selectedBankId.value = newBank.id;

    // Close the modal and reset form
    showAddBankModal.value = false;
    resetAddBankForm();

  } catch (error) {
    console.error('Error creating bank ledger:', error);
    alert('Failed to create bank ledger. Please try again.');
  }
};

// Helper functions for preview modal
const formatMonthYear = (monthString) => {
  if (!monthString) return 'Not selected';
  const [year, month] = monthString.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

// Clear preview filters
const clearPreviewFilters = () => {
  previewFilters.project = '';
  previewFilters.site = '';
  previewFilters.bank = '';
};

// Export preview to Excel
const exportPreviewToExcel = async () => {
  try {
    const api = useApiWithAuth();

    // Prepare the data for export
    const exportData = {
      wages: filteredWagesForPreview.value.map(wage => ({
        ...wage,
        salary_month: new Date(selectedMonth.value),
        paid_date: paymentDetails.paid_date,
        cheque_no: paymentDetails.cheque_no,
        paid_from_bank_ac: paymentDetails.paid_from_bank_ac
      })),
      month: selectedMonth.value,
      paymentDetails: paymentDetails,
      filters: previewFilters
    };

    // Call the export API
    const response = await api.post('/api/wages/export-preview', exportData, {
      responseType: 'blob'
    });

    // Create download link
    const blob = new Blob([response], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename
    const monthYear = formatMonthYear(selectedMonth.value).replace(' ', '_');
    const filterSuffix = previewFilters.project || previewFilters.site || previewFilters.bank
      ? '_Filtered'
      : '';
    link.download = `Wages_Preview_${monthYear}${filterSuffix}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Show success message in footer (as per user preference)
    showFooterNotification('Excel file downloaded successfully!', 'success');

  } catch (error) {
    console.error('Error exporting to Excel:', error);
    showFooterNotification('Failed to export Excel file. Please try again.', 'error');
  }
};

// Footer notification function (as per user preference)
const showFooterNotification = (message, type = 'info') => {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    'bg-blue-500 text-white'
  }`;
  notification.textContent = message;

  // Add blinking animation
  notification.style.animation = 'blink 0.5s ease-in-out 20'; // Blink for 10 seconds

  // Add CSS for blinking animation if not exists
  if (!document.getElementById('blink-style')) {
    const style = document.createElement('style');
    style.id = 'blink-style';
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
};

// Proceed to save from preview modal
const proceedToSave = async () => {
  showPreviewModal.value = false;
  await saveWages();
};

// Fetch PF/ESIC data for the selected month
const fetchPfEsicData = async () => {
  if (!selectedMonth.value) {
    alert('Please select a month first');
    return;
  }

  try {
    loadingPfEsicData.value = true;
    const api = useApiWithAuth();

    // Fetch all employees from master roll
    const masterRollResponse = await api.get('/api/master-roll');
    const allEmployees = masterRollResponse.employees || [];

    // Fetch wages for the selected month
    const wagesResponse = await api.get(`/api/wages?month=${selectedMonth.value}`);
    const monthWages = wagesResponse.wages || [];

    // Parse the selected month
    const [year, month] = selectedMonth.value.split('-');
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);

    // Filter active employees who were employed during the selected month
    const activeEmployees = allEmployees.filter(emp => {
      const joinDate = emp.dateOfJoining ? new Date(emp.dateOfJoining) : null;
      const exitDate = emp.dateOfExit ? new Date(emp.dateOfExit) : null;

      // Employee should be active and joined before or during the month
      return emp.status === 'active' &&
             joinDate &&
             joinDate <= lastDayOfMonth &&
             (!exitDate || exitDate >= new Date(parseInt(year), parseInt(month) - 1, 1));
    });

    // Create PF/ESIC data by combining employee info with wage data
    const pfEsicDataArray = activeEmployees.map(employee => {
      const wageRecord = monthWages.find(wage => wage.masterRollId === employee._id);

      // For unpaid employees, check if they exist in the current UI wage list to get their wage days
      let wageDays = 26; // Default
      let grossSalary;

      if (wageRecord) {
        // Employee is paid - use actual wage data
        wageDays = Number(wageRecord.wage_Days);
        grossSalary = Number(wageRecord.gross_salary);
      } else {
        // Employee is unpaid - check if they're in the current UI wage list
        const uiWageRecord = employeeWages.value.find(wage => wage.masterRollId === employee._id);
        if (uiWageRecord) {
          // Use wage days from UI
          wageDays = Number(uiWageRecord.wage_Days) || 26;
        }
        grossSalary = (Number(employee.pDayWage) || 0) * wageDays;
      }

      // Calculate complete EPF/ESIC details
      const calculations = calculateCompleteEpfEsic(grossSalary);

      return {
        employeeId: employee._id,
        employeeName: employee.employeeName,
        project: employee.project || 'N/A',
        site: employee.site || 'N/A',
        category: employee.category || 'UNSKILLED',
        uan: employee.uan || 'N/A',
        esicNo: employee.esicNo || 'N/A',
        pDayWage: Number(employee.pDayWage) || 0,
        // Wage data (if paid)
        isPaid: !!wageRecord,
        wageDays: wageDays,
        grossSalary,
        netSalary: wageRecord ? Number(wageRecord.net_salary) : grossSalary - calculations.totalEmployeeDeduction,

        // Complete EPF Details
        epfApplicableWage: calculations.epfApplicableWage,
        employeeEpf: calculations.employeeEpf,
        employerEpf: calculations.employerEpf,
        employerEps: calculations.employerEps,
        edli: calculations.edli,
        adminCharges: calculations.adminCharges,
        totalEmployerEpfContribution: calculations.totalEmployerEpfContribution,
        totalEpfContribution: calculations.totalEpfContribution,

        // Complete ESIC Details
        esicApplicableWage: calculations.esicApplicableWage,
        employeeEsic: calculations.employeeEsic,
        employerEsic: calculations.employerEsic,
        totalEsicContribution: calculations.totalEsicContribution,

        // Legacy fields for backward compatibility
        epfDeduction: calculations.employeeEpf,
        esicDeduction: calculations.employeeEsic,

        // Summary
        totalEmployeeDeduction: calculations.totalEmployeeDeduction,
        totalEmployerContribution: calculations.totalEmployerContribution,

        // Additional fields
        employeeStatus: employee.status,
        paymentStatus: wageRecord ? 'paid' : 'unpaid'
      };
    });

    pfEsicData.value = pfEsicDataArray;
  } catch (error) {
    console.error('Error fetching PF/ESIC data:', error);
    alert('Failed to fetch PF/ESIC data. Please try again.');
  } finally {
    loadingPfEsicData.value = false;
  }
};

// Enhanced PF/ESIC calculations with current government rules
const calculateCompleteEpfEsic = (grossSalary) => {
  // Use the dynamic rules from the composable
  return calculateWithCurrentRules(grossSalary);
};

// Legacy helper functions for backward compatibility
const calculateEpf = (grossSalary) => {
  const calculations = calculateCompleteEpfEsic(grossSalary);
  return calculations.employeeEpf;
};

const calculateEsic = (grossSalary) => {
  const calculations = calculateCompleteEpfEsic(grossSalary);
  return calculations.employeeEsic;
};

// Update employee data in PF/ESIC preview
const updateEmployeeInPfEsicData = (updatedEmployee) => {
  const index = pfEsicData.value.findIndex(emp => emp.employeeId === updatedEmployee.employeeId);
  if (index !== -1) {
    pfEsicData.value[index] = updatedEmployee;
  }
};

// Watch for PF/ESIC modal opening to fetch data
watch(showPfEsicPreviewModal, (newValue) => {
  if (newValue && selectedMonth.value) {
    fetchPfEsicData();
  }
});

// No unused variables
</script>
