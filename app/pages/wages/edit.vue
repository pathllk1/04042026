<template>
  <div class="max-w-10xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
    <div class="sm:px-0">
      <div class="flex justify-between items-center mb-4 sm:mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Edit Wages</h1>
      </div>

      <!-- Filters -->
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
            <input
              type="month"
              v-model="selectedMonth"
              :max="new Date().toISOString().slice(0, 7)"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              @change="loadWageRecords"
            >
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Cheque No</label>
            <select
              v-model="chequeFilter"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              @change="loadWageRecords"
            >
              <option value="">All</option>
              <option v-for="cheque in uniqueChequeNumbers" :key="cheque" :value="cheque">
                {{ cheque }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Select Bank</label>
            <select
              v-model="selectedBankId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              :disabled="loadingLedgers"
            >
              <option value="">-- Select Bank --</option>
              <option v-for="bank in bankLedgers" :key="bank.id" :value="bank.id">
                {{ bank.name }} - {{ bank.bankDetails?.accountNumber || 'N/A' }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              v-model="paymentDetails.paid_date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1 invisible">Action</label>
            <button
              @click="saveWages"
              class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!wageRecords.length || loading"
            >
              <span v-if="loading" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Data Table -->
      <div v-if="wageRecords.length" class="mt-4 sm:mt-8 flex flex-col">
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
            Showing {{ wageRecords.length }} of {{ allWages.length }} wage records
            <button @click="searchQuery = ''" class="ml-2 text-indigo-600 hover:text-indigo-800">Clear</button>
          </div>
        </div>

        <div class="-my-2 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
          <div class="py-2 align-middle inline-block min-w-full px-4 sm:px-6 lg:px-8">
            <div class="shadow overflow-x-auto overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <div class="block md:hidden bg-white p-4">
                <!-- Mobile view - cards instead of table -->
                <div v-for="(wage, index) in wageRecords" :key="wage._id" class="mb-4 p-3 border rounded-lg shadow-sm hover:shadow transition-shadow duration-200 border-gray-200 hover:border-indigo-200">
                  <div class="flex justify-between items-center mb-2">
                    <div class="font-medium text-indigo-700">
                      <span class="inline-block bg-gray-100 text-gray-800 text-xs font-semibold mr-2 px-2 py-1 rounded">
                        #{{ wage.slNo }}
                      </span>
                      {{ wage.employeeName }}
                    </div>
                    <button
                      @click="calculateWage(index)"
                      class="text-xs bg-indigo-100 text-indigo-700 py-1 px-2 rounded hover:bg-indigo-200 transition-colors"
                    >
                      Calculate
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs mb-3 bg-gray-50 p-2 rounded">
                    <div><span class="font-medium">Bank:</span> {{ wage.bank }}</div>
                    <div><span class="font-medium">Account:</span> {{ wage.accountNo }}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Per Day Wage</label>
                      <input
                        type="number"
                        v-model="wage.pDayWage"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Days</label>
                      <input
                        type="number"
                        v-model="wage.wage_Days"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Other Deduction</label>
                      <input
                        type="number"
                        v-model="wage.other_deduction"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">
                        <span>Advance Recovery</span>
                        <span v-if="wage.hasAdvances" class="text-red-600 text-xs ml-1">(Pending)</span>
                      </label>
                      <div class="flex items-center">
                        <input
                          type="number"
                          v-model="wage.advance_recovery"
                          :class="[
                            'w-full text-xs rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors',
                            wage.hasAdvances && wage.selectedAdvanceId ? 'border-green-500 bg-green-50 hover:border-green-600' : 'border-gray-300 hover:border-indigo-300'
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
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Other Benefit</label>
                      <input
                        type="number"
                        v-model="wage.other_benefit"
                        class="w-full text-xs rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span class="font-medium">Gross:</span> ₹{{ wage.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                    <div><span class="font-medium">EPF:</span> ₹{{ wage.epf_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                    <div><span class="font-medium">ESIC:</span> ₹{{ wage.esic_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                    <div>
                      <span class="font-medium">Advance:</span>
                      <span :class="wage.hasAdvances ? 'text-red-600 font-semibold' : ''">₹{{ wage.advance_recovery.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
                    </div>
                    <div class="col-span-2 bg-gray-50 p-2 rounded mt-1">
                      <span class="font-medium">Net Salary:</span>
                      <span class="font-bold text-indigo-700">₹{{ wage.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
                    </div>
                    <div class="col-span-2 mt-2 flex items-center bg-red-50 p-2 rounded border border-red-200">
                      <input
                        type="checkbox"
                        v-model="wage.markedForDeletion"
                        class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      >
                      <label class="ml-2 text-xs font-medium text-red-600">Mark for deletion</label>
                    </div>
                  </div>
                </div>
              </div>

              <table class="hidden md:table min-w-full divide-y divide-gray-200 table-auto">
                <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
                  <tr>
                    <th
                      @click="sortWageRecords('slNo')"
                      class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm cursor-pointer hover:bg-indigo-700"
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
                      @click="sortWageRecords('employeeName')"
                      class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Employee
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
                      @click="sortWageRecords('bank')"
                      class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm cursor-pointer hover:bg-indigo-700"
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
                      @click="sortWageRecords('accountNo')"
                      class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm cursor-pointer hover:bg-indigo-700"
                    >
                      <div class="flex items-center">
                        Account
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
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Per Day</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Wage</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">Days</th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Gross</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Salary</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>EPF</span>
                        <span class="text-xs opacity-80 normal-case font-normal">(12%)</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>ESIC</span>
                        <span class="text-xs opacity-80 normal-case font-normal">(0.75%)</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Other</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Deduction</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Advance</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Recovery</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Other</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Benefit</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Net</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Salary</span>
                      </div>
                    </th>
                    <th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider shadow-sm">
                      <div class="flex flex-col">
                        <span>Mark for</span>
                        <span class="text-xs opacity-80 normal-case font-normal">Deletion</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(wage, index) in wageRecords" :key="wage._id" class="hover:bg-gray-50">
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">{{ wage.slNo }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">{{ wage.employeeName }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">{{ wage.bank }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">{{ wage.accountNo }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.pDayWage"
                        class="w-16 sm:w-20 text-xs sm:text-sm rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.wage_Days"
                        class="w-12 sm:w-16 text-xs sm:text-sm rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">₹{{ wage.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">₹{{ wage.epf_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">₹{{ wage.esic_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.other_deduction"
                        class="w-16 sm:w-20 text-xs sm:text-sm rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="number"
                          v-model="wage.advance_recovery"
                          :class="[
                            'w-16 sm:w-20 text-xs sm:text-sm rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors',
                            wage.hasAdvances && wage.selectedAdvanceId ? 'border-green-500 bg-green-50 hover:border-green-600' : 'border-gray-300 hover:border-indigo-300'
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
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <input
                        type="number"
                        v-model="wage.other_benefit"
                        class="w-16 sm:w-20 text-xs sm:text-sm rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                        @change="calculateWage(index)"
                      >
                    </td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap font-medium text-xs sm:text-sm text-indigo-700">₹{{ wage.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          v-model="wage.markedForDeletion"
                          class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        >
                        <span class="ml-2 text-xs text-red-600" v-if="wage.markedForDeletion">Delete</span>
                      </div>
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
          <p class="text-gray-600 text-sm sm:text-base">Loading wage records...</p>
        </div>
      </div>

      <!-- No Data Message -->
      <div v-else-if="selectedMonth" class="mt-4 sm:mt-8 bg-white p-4 sm:p-6 rounded-lg shadow text-center">
        <p class="text-gray-500 text-sm sm:text-base">No wage records found for the selected month.</p>
      </div>

      <!-- Initial Message -->
      <div v-else class="mt-4 sm:mt-8 bg-white p-4 sm:py-6 rounded-lg shadow text-center">
        <p class="text-gray-500 text-sm sm:text-base">Please select a month to load wage records.</p>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { usePageTitle } from '~/composables/ui/usePageTitle';
import { useLedgers } from '~/composables/expenses/useLedgers';

// Set page title
usePageTitle('Edit Wages', 'Edit and update employee wage records');

import useApiWithAuth from '~/composables/auth/useApiWithAuth'

// Define page meta
definePageMeta({
  requiresAuth: true
});

// State variables
const selectedMonth = ref('');
const chequeFilter = ref('');
const wageRecords = ref([]);
const allWages = ref([]);
const originalWages = ref([]); // Store original wage values for comparison
const loading = ref(false);
const paymentDetails = reactive({
  paid_date: '',
  cheque_no: '',
  paid_from_bank_ac: ''
});

// Add bank ledgers state
const { bankLedgers, fetchLedgers, isLoading: loadingLedgers } = useLedgers();
const selectedBankId = ref('');

// Sorting and filtering state
const sortColumn = ref('employeeName');
const sortDirection = ref('asc'); // 'asc' or 'desc'
const searchQuery = ref(''); // For filtering employees
// Advance recovery state
const showAdvancesModal = ref(false);
const loadingAdvances = ref(false);
const employeeAdvances = ref([]);
const currentEmployeeIndex = ref(-1);
const currentEmployeeId = ref('');
const currentEmployeeName = ref('');

// Batch processing state
const processingStatus = ref('');
const processedCount = ref(0);
const totalCount = ref(0);
const isProcessing = ref(false);

// Firestore processing state
const isProcessingFirestore = ref(false);
const firestoreProgress = reactive({
  current: 0,
  total: 0,
  status: '',
  retryCount: 0
});

// Get unique cheque numbers
const uniqueChequeNumbers = computed(() => {
  const chequeNos = allWages.value.map(wage => wage.cheque_no).filter(Boolean)
  return [...new Set(chequeNos)].sort()
});

// Load wage records for selected month
const loadWageRecords = async () => {
  if (!selectedMonth.value) return;

  // Set loading state to true
  loading.value = true;
  wageRecords.value = []; // Clear previous data

  try {
    const api = useApiWithAuth();
    const response = await api.get('/api/wages', {
      params: { month: selectedMonth.value }
    });


    // Handle different response structures
    const responseData = response?.data?.value || response?.value || response;

    if (responseData?.wages?.length) {
      allWages.value = responseData.wages;

      // Store original wage values for comparison when updating
      originalWages.value = JSON.parse(JSON.stringify(responseData.wages));

      // Filter wages based on cheque number if selected
      const filteredWages = chequeFilter.value
        ? responseData.wages.filter(wage => wage.cheque_no === chequeFilter.value)
        : responseData.wages;

      wageRecords.value = filteredWages.map((wage, index) => {
        // Convert date strings to YYYY-MM-DD format for input fields
        const paid_date = wage.paid_date ? new Date(wage.paid_date).toISOString().split('T')[0] : '';

        return {
          ...wage,
          // Add serial number
          slNo: index + 1,
          // Ensure numeric fields are numbers
          pDayWage: Number(wage.pDayWage) || 0,
          wage_Days: Number(wage.wage_Days) || 0,
          gross_salary: Number(wage.gross_salary) || 0,
          epf_deduction: Number(wage.epf_deduction) || 0,
          esic_deduction: Number(wage.esic_deduction) || 0,
          other_deduction: Number(wage.other_deduction) || 0,
          advance_recovery: Number(wage.advance_recovery) || 0,
          selectedAdvanceId: wage.advance_recovery_id || null,
          hasAdvances: false, // Will be updated by checkEmployeesForAdvances
          other_benefit: Number(wage.other_benefit) || 0,
          net_salary: Number(wage.net_salary) || 0,
          // Format dates for input fields
          paid_date
        }
      });

      // Set payment details from first record if available
      if (wageRecords.value.length > 0) {
        paymentDetails.paid_date = wageRecords.value[0].paid_date || '';
        paymentDetails.cheque_no = wageRecords.value[0].cheque_no || '';
        paymentDetails.paid_from_bank_ac = wageRecords.value[0].paid_from_bank_ac || '';
      }

      // Apply default sort by employee name
      sortColumn.value = 'employeeName';
      sortDirection.value = 'asc';
      applySorting();

      // Check for outstanding advances for each employee
      await checkEmployeesForAdvances();
    } else {
      wageRecords.value = [];
    }
  } catch (error) {
    wageRecords.value = [];
  } finally {
    // Set loading state to false when done, regardless of success or failure
    loading.value = false;
  }
};

// Calculate wage for a single record using AI-fetched EPF/ESIC rules
const calculateWage = (index) => {
  const wage = wageRecords.value[index];

  // Calculate gross salary
  wage.gross_salary = Number(wage.pDayWage) * Number(wage.wage_Days);

  // Use AI-fetched EPF/ESIC rules for accurate calculations
  const { calculateWithCurrentRules } = useEpfEsicRules();
  const calculations = calculateWithCurrentRules(wage.gross_salary);

  // Apply the AI-calculated deductions
  wage.epf_deduction = calculations.employeeEpf;
  wage.esic_deduction = calculations.employeeEsic;

  wage.other_deduction = Number(wage.other_deduction) || 0;
  wage.advance_recovery = Number(wage.advance_recovery) || 0;
  wage.other_benefit = Number(wage.other_benefit) || 0;

  // Calculate net salary
  wage.net_salary = wage.gross_salary - (wage.epf_deduction + wage.esic_deduction + wage.other_deduction + wage.advance_recovery) + wage.other_benefit;
  // Round to 2 decimal places
  wage.net_salary = Math.round(wage.net_salary * 100) / 100;
};

// Function to process records in chunks
const processInChunks = async (records, chunkSize = 10) => {
  const db = getFirestore();
  totalCount.value = records.length;
  processedCount.value = 0;
  isProcessing.value = true;

  try {
    // Process records in chunks
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, Math.min(i + chunkSize, records.length));
      processingStatus.value = `Processing ${i + 1} to ${Math.min(i + chunkSize, records.length)} of ${records.length}...`;

      // Create a new batch for this chunk
      const batch = db.batch();

      for (const record of chunk) {
        // Add ledgerTransactions update
        const ledgerRef = db.collection('ledgerTransactions').doc();
        batch.set(ledgerRef, {
          amount: record.net_salary,
          balance: record.balance || 0,
          createdAt: new Date(),
          date: new Date(record.paid_date),
          description: `Salary payment to ${record.employeeName} for ${selectedMonth.value}`,
          expenseId: record._id,
          firmId: record.firmId,
          ledgerId: record.ledgerId,
          type: "debit",
          userId: record.userId
        });

        // Add expenses update
        const expenseRef = db.collection('expenses').doc();
        batch.set(expenseRef, {
          amount: -record.net_salary,
          category: "PAYMENT",
          createdAt: new Date(),
          date: new Date(record.paid_date),
          description: `Salary payment to ${record.employeeName} for ${selectedMonth.value}`,
          firmId: record.firmId,
          isTransfer: false,
          paidTo: record.employeeName,
          paidToGroup: "SALARY",
          paymentMode: {
            bankId: record.ledgerId,
            instrumentNo: record.cheque_no || "",
            type: "bank"
          },
          project: record.project || "KIR_NON_CORE",
          transferDetails: null,
          updatedAt: new Date(),
          userId: record.userId
        });
      }

      // Commit this chunk's batch
      await batch.commit();
      processedCount.value += chunk.length;

      // Add a small delay between chunks to prevent overloading
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    processingStatus.value = 'Completed successfully';
    return true;
  } catch (error) {
    console.error('Error in batch processing:', error);
    processingStatus.value = `Error: ${error.message}`;
    return false;
  } finally {
    isProcessing.value = false;
  }
};

// Process wages in Firestore with chunking and retry logic
const processFirestoreUpdates = async (wages) => {
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

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      let success = false;
      let retryCount = 0;

      while (!success && retryCount < MAX_RETRIES) {
        try {
          firestoreProgress.status = `Processing chunk ${chunkIndex + 1}/${totalChunks}...`;

          const response = await api.post('/api/wages/firestore-update', {
            wages,
            chunkSize: CHUNK_SIZE,
            chunkIndex
          });

          if (response.success) {
            firestoreProgress.current += response.processedCount;
            success = true;
          } else {
            throw new Error('Chunk processing failed');
          }
        } catch (error) {
          retryCount++;
          firestoreProgress.retryCount = retryCount;

          if (error.statusCode === 502 || error.statusCode === 504) {
            firestoreProgress.status = `Retrying chunk ${chunkIndex + 1} (Attempt ${retryCount}/${MAX_RETRIES})...`;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
          } else {
            throw error;
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

// Save updated wage records
const saveWages = async () => {
  if (!selectedMonth.value || !paymentDetails.paid_date) {
    alert('Please select a month and payment date');
    return;
  }

  // Set loading state to true
  loading.value = true;

  try {
    const api = useApiWithAuth();

    // Separate records to update and delete
    const recordsToUpdate = wageRecords.value
      .filter(record => !record.markedForDeletion)
      .map(record => ({
        ...record,
        paid_date: paymentDetails.paid_date,
        cheque_no: paymentDetails.cheque_no,
        paid_from_bank_ac: paymentDetails.paid_from_bank_ac
      }));

    const recordsToDelete = wageRecords.value
      .filter(record => record.markedForDeletion)
      .map(record => record._id);

    if (!recordsToUpdate.length && !recordsToDelete.length) {
      alert('No changes to save');
      return;
    }

    const response = await api.put('/api/wages', {
      wages: recordsToUpdate,
      deleteWages: recordsToDelete,
      month: selectedMonth.value
    });

    if (response.success) {
      alert('Successfully saved wages to MongoDB');
      await updateFirestore();
      await loadWageRecords();
    }
  } catch (error) {
    alert('Failed to save wage records. Please try again.');
  } finally {
    // Set loading state to false when done
    loading.value = false;
  }
};

// Update the updateFirestore function
const updateFirestore = async () => {
  if (isProcessingFirestore.value) return;

  if (!paymentDetails.paid_from_bank_ac) {
    alert('Please select a bank account for payment');
    return;
  }

  if (!selectedBankId.value) {
    alert('Please select a bank before updating Firestore');
    return;
  }

  // 1. Handle records to update
  const recordsToUpdate = wageRecords.value
    .filter(record => !record.markedForDeletion)
    .map(record => ({
      _id: record._id,
      employeeName: record.employeeName,
      net_salary: record.net_salary,
      paid_date: paymentDetails.paid_date,
      salary_month: new Date(selectedMonth.value),
      ledgerId: selectedBankId.value, // Use the selected bank's ID
      cheque_no: paymentDetails.cheque_no || '',
      project: record.project || 'KIR_NON_CORE',
      balance: record.balance || 0
    }));

  // 2. Handle records to delete
  const recordsToDelete = wageRecords.value
    .filter(record => record.markedForDeletion)
    .map(record => record._id);

  // Track overall success
  let overallSuccess = true;
  const api = useApiWithAuth();

  // 3. Process deletions if any
  if (recordsToDelete.length > 0) {
    console.log(`Scheduling deletion of ${recordsToDelete.length} wage records from Firestore...`);

    // Calculate total amount to adjust in ledger balance after deletions
    const deletedAmount = wageRecords.value
      .filter(record => record.markedForDeletion)
      .reduce((total, record) => total + record.net_salary, 0);

    // Schedule deletion with 5-second delay
    setTimeout(async () => {
      try {
        const deleteResponse = await api.post('/api/wages/delete-from-firestore', {
          wageIds: recordsToDelete
        });

        if (deleteResponse.success) {
          console.log(`Successfully deleted Firestore records: ${deleteResponse.message}`);

          // If we have deleted records, we need to adjust the ledger balance
          // by adding back the money (positive adjustment)
          if (deletedAmount > 0) {
            setTimeout(async () => {
              try {
                const adjustResponse = await api.post('/api/wages/update-firestore-ledger', {
                  ledgerId: selectedBankId.value,
                  adjustmentAmount: deletedAmount // Positive to add money back
                });

                if (adjustResponse.success) {
                  console.log(`Successfully adjusted ledger balance: ${adjustResponse.message}`);
                } else {
                  console.error('Error adjusting ledger balance after deletions');
                }
              } catch (error) {
                console.error('Error adjusting ledger balance after deletions:', error);
              }
            }, 5000); // 5-second delay for ledger adjustment
          }
        } else {
          console.error('Error deleting Firestore records');
          overallSuccess = false;
        }
      } catch (error) {
        console.error('Error deleting Firestore records:', error);
        overallSuccess = false;
      }
    }, 5000); // 5-second delay for deletion
  }

  // 4. Process updates if any
  if (recordsToUpdate.length > 0) {
    console.log(`Scheduling update of ${recordsToUpdate.length} wage records in Firestore...`);

    // Find the original wages that correspond to the updated wages
    const originalWagesToUpdate = originalWages.value.filter(ow =>
      recordsToUpdate.some(ru => ru._id === ow._id)
    );

    // Schedule update with 5-second delay
    setTimeout(async () => {
      try {
        // First update the Firestore records
        const success = await processFirestoreUpdates(recordsToUpdate);

        if (success) {
          console.log('Successfully updated Firestore records');

          // Now update the ledger balance based on the difference between old and new wages
          try {
            const ledgerResponse = await api.post('/api/wages/update-ledger-for-edits', {
              ledgerId: selectedBankId.value,
              oldWages: originalWagesToUpdate,
              newWages: recordsToUpdate
            });

            if (ledgerResponse.success) {
              console.log(`Successfully updated ledger balance: ${ledgerResponse.message}`);
              console.log(`Adjustment amount: ${ledgerResponse.adjustmentAmount}`);
            } else {
              console.error('Error updating ledger balance for wage edits');
              overallSuccess = false;
            }
          } catch (ledgerError) {
            console.error('Error updating ledger balance for wage edits:', ledgerError);
            overallSuccess = false;
          }
        } else {
          console.error('Error updating Firestore records');
          overallSuccess = false;
        }
      } catch (error) {
        console.error('Error updating Firestore records:', error);
        overallSuccess = false;
      }
    }, recordsToDelete.length > 0 ? 10000 : 5000); // 10-second delay if we also have deletions, otherwise 5-second
  }

  // Show a message to the user
  if (recordsToUpdate.length > 0 || recordsToDelete.length > 0) {
    alert(`Firestore updates scheduled:\n${recordsToUpdate.length} records to update\n${recordsToDelete.length} records to delete`);
  } else {
    alert('No records to update or delete in Firestore');
  }
};

// Check which employees have outstanding advances
const checkEmployeesForAdvances = async () => {
  try {
    const api = useApiWithAuth();

    // Process employees in batches to avoid too many concurrent requests
    const batchSize = 5;
    for (let i = 0; i < wageRecords.value.length; i += batchSize) {
      const batch = wageRecords.value.slice(i, i + batchSize);

      // Create an array of promises for concurrent execution
      const promises = batch.map(async (wage, batchIndex) => {
        const index = i + batchIndex;
        if (!wage.masterRollId) return;

        try {
          const response = await api.get(`/api/employee-advances/by-employee/${wage.masterRollId}`);

          if (response.success && response.advances && response.advances.length > 0) {
            // Set hasAdvances flag if there are outstanding advances
            wageRecords.value[index].hasAdvances = true;

            // Get the first advance with a remaining balance
            const firstAdvance = response.advances[0];

            // Prefill the advance recovery with the installment amount
            if (firstAdvance.repaymentTerms && firstAdvance.repaymentTerms.installmentAmount) {
              // Make sure we don't exceed the remaining balance
              const installmentAmount = Math.min(
                firstAdvance.repaymentTerms.installmentAmount,
                firstAdvance.remainingBalance
              );

              // Set the advance recovery amount and the selected advance ID
              wageRecords.value[index].advance_recovery = installmentAmount;
              wageRecords.value[index].selectedAdvanceId = firstAdvance._id;

              // Recalculate the wage to update net salary
              calculateWage(index);
            }
          } else {
            wageRecords.value[index].hasAdvances = false;
          }
        } catch (error) {
          // Silently fail - we don't want to interrupt the UI for this feature
          wageRecords.value[index].hasAdvances = false;
        }
      });

      // Wait for all promises in this batch to complete
      await Promise.all(promises);
    }
  } catch (error) {
    console.error('Error checking for advances:', error);
  }
};

// Show advances modal for an employee
const showAdvances = async (employeeId, index) => {
  currentEmployeeId.value = employeeId;
  currentEmployeeIndex.value = index;
  currentEmployeeName.value = wageRecords.value[index].employeeName;

  showAdvancesModal.value = true;
  loadingAdvances.value = true;
  employeeAdvances.value = [];

  try {
    const api = useApiWithAuth();
    const response = await api.get(`/api/employee-advances/by-employee/${employeeId}`);

    if (response.success && response.advances) {
      employeeAdvances.value = response.advances;

      // Update the hasAdvances flag based on the response
      wageRecords.value[index].hasAdvances = response.advances.length > 0;
    }
  } catch (error) {
    alert('Failed to load advances. Please try again.');
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

  const wage = wageRecords.value[currentEmployeeIndex.value];

  // Calculate gross salary and deductions first (without advance recovery)
  const grossSalary = Number(wage.pDayWage) * Number(wage.wage_Days);
  const { calculateWithCurrentRules } = useEpfEsicRules();
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

// Apply sorting to the current wage records array
const applySorting = () => {
  // For employee name, use localeCompare for proper string sorting
  if (sortColumn.value === 'employeeName') {
    wageRecords.value.sort((a, b) => {
      const nameA = a.employeeName.toLowerCase();
      const nameB = b.employeeName.toLowerCase();

      // Use localeCompare for proper alphabetical sorting
      const compareResult = nameA.localeCompare(nameB);

      // Apply sort direction properly
      return sortDirection.value === 'asc' ? compareResult : -compareResult;
    });
  } else {
    // For other columns, use the existing logic
    wageRecords.value.sort((a, b) => {
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

// Sort the wage records
const sortWageRecords = (column) => {
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

// Filter wage records based on search query
const filterWageRecords = () => {
  let filteredRecords;

  if (!searchQuery.value.trim()) {
    // If no search query, restore all records (filtered by cheque if applicable)
    filteredRecords = chequeFilter.value
      ? allWages.value.filter(wage => wage.cheque_no === chequeFilter.value)
      : [...allWages.value];
  } else {
    const query = searchQuery.value.toLowerCase().trim();
    filteredRecords = allWages.value.filter(wage => {
      // First apply cheque filter if needed
      if (chequeFilter.value && wage.cheque_no !== chequeFilter.value) {
        return false;
      }

      // Then apply search filter
      return (
        (wage.slNo && wage.slNo.toString().includes(query)) ||
        wage.employeeName.toLowerCase().includes(query) ||
        wage.bank.toLowerCase().includes(query) ||
        (wage.branch && wage.branch.toLowerCase().includes(query)) ||
        wage.accountNo.toString().includes(query) ||
        (wage.ifsc && wage.ifsc.toLowerCase().includes(query))
      );
    });
  }

  // Process filtered records to ensure they have proper slNo and formatting
  wageRecords.value = filteredRecords.map((wage, index) => {
    // Convert date strings to YYYY-MM-DD format for input fields
    const paid_date = wage.paid_date ? new Date(wage.paid_date).toISOString().split('T')[0] : '';

    return {
      ...wage,
      // Add serial number based on filtered index
      slNo: index + 1,
      // Ensure numeric fields are numbers
      pDayWage: Number(wage.pDayWage) || 0,
      wage_Days: Number(wage.wage_Days) || 0,
      gross_salary: Number(wage.gross_salary) || 0,
      epf_deduction: Number(wage.epf_deduction) || 0,
      esic_deduction: Number(wage.esic_deduction) || 0,
      other_deduction: Number(wage.other_deduction) || 0,
      advance_recovery: Number(wage.advance_recovery) || 0,
      selectedAdvanceId: wage.advance_recovery_id || null,
      hasAdvances: wage.hasAdvances || false,
      other_benefit: Number(wage.other_benefit) || 0,
      net_salary: Number(wage.net_salary) || 0,
      // Format dates for input fields
      paid_date
    }
  });

  // Re-apply current sort if any
  if (sortColumn.value) {
    applySorting();
  }
};

// Watch for changes in search query
watch(searchQuery, filterWageRecords);

// Add bank selection handler
const handleBankSelection = () => {
  if (!selectedBankId.value) {
    paymentDetails.paid_from_bank_ac = '';
    return;
  }

  const selectedBank = bankLedgers.value.find(bank => bank.id === selectedBankId.value);
  if (selectedBank) {
    paymentDetails.paid_from_bank_ac = selectedBank.bankDetails?.accountNumber || '';
  }
};

// Add watcher for bank selection
watch(selectedBankId, handleBankSelection);

// Add onMounted hook to fetch bank ledgers
onMounted(async () => {
  try {
    await fetchLedgers('bank');
  } catch (error) {
    console.error('Error fetching bank ledgers:', error);
  }
});
</script>
