<template>
  <div class="w-full mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
      Employee Wages Management
    </h1>

    <!-- ── Controls Bar ──────────────────────────────────────────────── -->
    <UCard class="mb-4 sm:mb-6">
      <div class="flex flex-col lg:flex-row gap-3 lg:items-end flex-wrap">

        <!-- Month -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Month</label>
          <UInput type="month" v-model="selectedMonth" :max="new Date().toISOString().slice(0, 7)" class="w-full" @change="loadEmployees" />
        </div>

        <!-- Payment Date -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Date</label>
          <UInput type="date" v-model="paymentDetails.paid_date" class="w-full" />
        </div>

        <!-- Cheque Number -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cheque Number</label>
          <UInput v-model="paymentDetails.cheque_no" placeholder="Enter cheque number" class="w-full" />
        </div>

        <!-- Select Bank -->
        <div class="w-full lg:w-56">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Bank</label>
          <div class="flex items-center gap-1">
            <USelect v-model="selectedBankId" :items="bankItems" :disabled="loadingLedgers" class="flex-1" />
            <UButton size="xs" color="success" icon="i-lucide-plus" title="Add New Bank" @click="showAddBankModal = true" />
          </div>
        </div>

        <!-- Filter by Project -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Project</label>
          <USelect v-model="selectedProject" :items="projectItems" class="w-full" />
        </div>

        <!-- Filter by Site -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Site</label>
          <USelect v-model="selectedSite" :items="siteItems" class="w-full" />
        </div>

        <!-- Filter by Bank -->
        <div class="w-full lg:w-36">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Bank</label>
          <USelect v-model="selectedBank" :items="bankFilterItems" class="w-full" />
        </div>

        <!-- Paid from Bank AC (readonly) -->
        <div class="w-full lg:w-40">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Paid From Bank Account</label>
          <UInput v-model="paymentDetails.paid_from_bank_ac" placeholder="Auto-filled" readonly class="w-full" />
        </div>

        <!-- Actions -->
        <div class="w-full lg:w-auto">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 invisible">Action</label>
          <div class="flex gap-1 flex-wrap">
            <UButton size="xs" color="primary" :disabled="!employeeWages.length || loading" @click="calculateAll">
              Calculate All
            </UButton>
            <UButton size="xs" color="info" icon="i-lucide-eye" :disabled="!employeeWages.length || loading || selectedEmployeesCount === 0" title="Preview wages before saving" @click="showPreviewModal = true">
              Preview
            </UButton>
            <UButton size="xs" color="secondary" icon="i-lucide-file-text" :disabled="!selectedMonth || loading" title="Preview PF & ESIC for selected month" @click="showPfEsicPreviewModal = true">
              PF/ESIC
            </UButton>
            <UButton size="xs" color="success" :loading="loading" :disabled="!employeeWages.length || loading" @click="saveWages">
              {{ loading ? 'Processing…' : 'Save Wages' }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ── Summary ────────────────────────────────────────────────────── -->
    <UCard v-if="employeeWages.length && selectedEmployeesCount > 0" class="mb-4 sm:mb-6">
      <template #header>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Summary</h2>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <div v-for="stat in summaryStats" :key="stat.label" class="bg-gray-50 dark:bg-gray-800 p-2 rounded-md">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ stat.label }}</p>
          <p class="text-base font-semibold" :class="stat.class ?? 'text-gray-900 dark:text-white'">{{ stat.value }}</p>
        </div>
      </div>
    </UCard>

    <!-- ── Search ─────────────────────────────────────────────────────── -->
    <div v-if="employeeWages.length" class="mb-4">
      <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Search by Sl. No., name, bank, branch, account, or IFSC…" class="w-full" />
      <div v-if="searchQuery" class="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        Showing {{ employeeWages.length }} of {{ allEmployeeWages.length }} employees
        <UButton size="xs" variant="ghost" color="primary" @click="searchQuery = ''">Clear</UButton>
      </div>
    </div>

    <!-- ── Mobile cards ───────────────────────────────────────────────── -->
    <div v-if="employeeWages.length" class="md:hidden space-y-3 mb-4">
      <UCard v-for="(wage, index) in employeeWages" :key="wage.masterRollId" class="border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <div class="font-medium text-sm">
            <UBadge color="neutral" variant="soft" size="xs" class="mr-1">#{{ wage.slNo }}</UBadge>
            {{ wage.employeeName }}
          </div>
          <UCheckbox v-model="wage.selected" color="primary" />
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs mb-3">
          <div><span class="font-medium">Bank:</span> {{ wage.bank }}</div>
          <div><span class="font-medium">Branch:</span> {{ wage.branch }}</div>
          <div><span class="font-medium">Account:</span> {{ wage.accountNo }}</div>
          <div><span class="font-medium">IFSC:</span> {{ wage.ifsc }}</div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <UFormField label="Per Day Wage">
            <UInput type="number" v-model="wage.pDayWage" size="xs" class="w-full" @change="calculateWage(index, true)" />
          </UFormField>
          <UFormField label="Days">
            <UInput type="number" v-model="wage.wage_Days" size="xs" class="w-full" @change="calculateWage(index, true)" />
          </UFormField>
          <UFormField label="Other Deduction">
            <UInput type="number" v-model="wage.other_deduction" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
          <UFormField label="Advance Recovery">
            <div class="flex items-center gap-1">
              <UInput
                type="number"
                v-model="wage.advance_recovery"
                size="xs"
                :color="wage.hasAdvances && wage.selectedAdvanceId ? 'success' : undefined"
                class="w-full"
                @change="calculateWage(index)"
              />
              <UButton v-if="wage.masterRollId" size="xs" variant="ghost" :color="wage.hasAdvances ? 'error' : 'primary'" icon="i-lucide-eye" @click="showAdvances(wage.masterRollId, index)" />
            </div>
          </UFormField>
          <UFormField label="Other Benefit">
            <UInput type="number" v-model="wage.other_benefit" size="xs" class="w-full" @change="calculateWage(index)" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div><span class="font-medium">Gross:</span> ₹{{ formatIndianCurrency(wage.gross_salary) }}</div>
          <div><span class="font-medium">Net:</span> <span class="font-bold text-indigo-700 dark:text-indigo-300">₹{{ formatIndianCurrency(wage.net_salary) }}</span></div>
        </div>
      </UCard>
    </div>

    <!-- ── Desktop table ──────────────────────────────────────────────── -->
    <UCard v-if="employeeWages.length" class="hidden md:block overflow-hidden mb-4">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600">
            <tr>
              <th class="px-1 py-2 text-left text-xs font-medium text-white uppercase">
                <UCheckbox v-model="selectAll" color="neutral" @change="toggleSelectAll" />
              </th>
              <th v-for="col in tableColumns" :key="col.key"
                class="px-2 py-2 text-left text-xs font-medium text-white uppercase tracking-wider"
                :class="col.sortable ? 'cursor-pointer hover:bg-indigo-700' : ''"
                :title="col.title"
                @click="col.sortable ? sortEmployeeWages(col.key) : undefined"
              >
                <div class="flex items-center gap-1">
                  {{ col.label }}
                  <UIcon v-if="col.sortable && sortColumn === col.key" :name="sortDirection === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-3 w-3" />
                  <UIcon v-else-if="col.sortable" name="i-lucide-chevrons-up-down" class="h-3 w-3 opacity-50" />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-white uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(wage, index) in employeeWages" :key="wage.masterRollId" class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td class="px-1 py-2">
                <UCheckbox v-model="wage.selected" color="primary" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap text-xs font-medium">{{ wage.slNo }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.employeeName }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.bank }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.branch }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.accountNo }}</td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">{{ wage.ifsc }}</td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.pDayWage" size="xs" class="w-16" @change="calculateWage(index, true)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.wage_Days" size="xs" class="w-12" @change="calculateWage(index, true)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap text-xs">₹{{ formatIndianCurrency(wage.gross_salary) }}</td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.epf_deduction" size="xs" class="w-16" @change="calculateWage(index)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.esic_deduction" size="xs" class="w-16" @change="calculateWage(index)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.other_deduction" size="xs" class="w-16" @change="calculateWage(index)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap">
                <div class="flex items-center gap-1">
                  <UInput
                    type="number"
                    v-model="wage.advance_recovery"
                    size="xs"
                    :color="wage.hasAdvances && wage.selectedAdvanceId ? 'success' : undefined"
                    class="w-16"
                    :title="wage.hasAdvances && wage.selectedAdvanceId ? 'Prefilled with installment amount' : ''"
                    @change="calculateWage(index)"
                  />
                  <UButton v-if="wage.masterRollId" size="xs" variant="ghost" :color="wage.hasAdvances ? 'error' : 'primary'" icon="i-lucide-eye" :title="wage.hasAdvances ? `${wage.advanceCount} advances, ₹${formatIndianCurrency(wage.totalOutstanding)} outstanding` : 'View advances'" @click="showAdvances(wage.masterRollId, index)" />
                </div>
              </td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UInput type="number" v-model="wage.other_benefit" size="xs" class="w-16" @change="calculateWage(index)" />
              </td>
              <td class="px-2 py-2 whitespace-nowrap text-xs font-medium">₹{{ formatIndianCurrency(wage.net_salary) }}</td>
              <td class="px-2 py-2 whitespace-nowrap">
                <UButton size="xs" variant="ghost" color="primary" @click="calculateWage(index, true)">Calculate</UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Loading / empty states -->
    <UCard v-else-if="loading" class="mt-6 text-center py-10">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-loader-circle" class="h-10 w-10 animate-spin text-indigo-500" />
        <p class="text-gray-600 dark:text-gray-400">Loading employee data…</p>
      </div>
    </UCard>
    <UCard v-else-if="selectedMonth" class="mt-6 text-center py-10">
      <p class="text-gray-500 dark:text-gray-400">No employee data available for the selected month. Please select a different month or add employees to the Master Roll.</p>
    </UCard>
    <UCard v-else class="mt-6 text-center py-10">
      <p class="text-gray-500 dark:text-gray-400">Please select a month to load employee data.</p>
    </UCard>

    <!-- ── Firestore Processing Overlay ──────────────────────────────── -->
    <div v-if="isProcessingFirestore" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <UCard class="max-w-md w-full mx-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Processing Firestore Updates</h3>
        <div class="mb-4">
          <div class="flex justify-between mb-1">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ firestoreProgress.current }} / {{ firestoreProgress.total }}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div class="bg-blue-600 h-2.5 rounded-full transition-all" :style="{ width: (firestoreProgress.total > 0 ? firestoreProgress.current / firestoreProgress.total * 100 : 0) + '%' }"></div>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ firestoreProgress.status }}</p>
        <p v-if="firestoreProgress.retryCount > 0" class="text-sm text-yellow-600">Retry attempt: {{ firestoreProgress.retryCount }}</p>
      </UCard>
    </div>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADD BANK MODAL                                                 -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showAddBankModal" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">Add New Bank</h3>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="showAddBankModal = false" />
            </div>
          </template>
          <div class="p-6 space-y-4">
            <UFormField label="Bank Name" required>
              <UInput v-model="newBankData.name" placeholder="Enter bank name" class="w-full" />
            </UFormField>
            <UFormField label="Account Number" required>
              <UInput v-model="newBankData.bankDetails.accountNumber" placeholder="Enter account number" class="w-full" />
            </UFormField>
            <UFormField label="IFSC Code">
              <UInput v-model="newBankData.bankDetails.ifscCode" placeholder="Enter IFSC code" class="w-full" />
            </UFormField>
            <UFormField label="Branch">
              <UInput v-model="newBankData.bankDetails.branch" placeholder="Enter branch name" class="w-full" />
            </UFormField>
            <UFormField label="Bank Name (Full)">
              <UInput v-model="newBankData.bankDetails.bankName" placeholder="Enter full bank name" class="w-full" />
            </UFormField>
            <UFormField label="Opening Balance">
              <UInput type="number" v-model="newBankData.openingBalance" placeholder="Enter opening balance" class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="px-6 py-4 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="soft" @click="showAddBankModal = false">Cancel</UButton>
              <UButton color="success" @click="addNewBank">Add Bank</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADVANCES MODAL                                                 -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showAdvancesModal" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h3 class="text-lg font-semibold text-white">Outstanding Advances</h3>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="closeAdvancesModal" />
            </div>
          </template>
          <div class="p-4">
            <div v-if="loadingAdvances" class="py-6 text-center text-gray-500">
              <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin mx-auto mb-2" />Loading advances…
            </div>
            <div v-else-if="employeeAdvances.length === 0" class="py-6 text-center text-gray-500">
              No outstanding advances found for this employee.
            </div>
            <div v-else>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Employee: <span class="font-medium text-gray-900 dark:text-white">{{ currentEmployeeName }}</span>
              </p>
              <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="advance in employeeAdvances" :key="advance._id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ formatDate(advance.date) }}</td>
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.amount }}</td>
                      <td class="px-4 py-2 whitespace-nowrap text-xs">{{ advance.remainingBalance }}</td>
                      <td class="px-4 py-2 whitespace-nowrap">
                        <UButton size="xs" variant="ghost" color="primary" :disabled="advance.remainingBalance <= 0" @click="applyAdvanceRecovery(advance)">Apply</UButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <template #footer>
            <div class="px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="soft" @click="closeAdvancesModal">Close</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- WAGES PREVIEW MODAL                                            -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showPreviewModal" :ui="{ content: 'sm:max-w-[95vw]' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h3 class="text-lg font-semibold text-white">Wages Preview — {{ formatMonthYear(selectedMonth) }}</h3>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" class="text-white hover:bg-white/10" @click="showPreviewModal = false" />
            </div>
          </template>

          <div class="p-4 space-y-4">
            <!-- Payment Details -->
            <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Payment Details</h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><span class="font-medium text-gray-700 dark:text-gray-300">Payment Date:</span> <span class="ml-2">{{ formatDate(paymentDetails.paid_date) || 'Not specified' }}</span></div>
                <div><span class="font-medium text-gray-700 dark:text-gray-300">Cheque Number:</span> <span class="ml-2">{{ paymentDetails.cheque_no || 'Not specified' }}</span></div>
                <div><span class="font-medium text-gray-700 dark:text-gray-300">Bank Account:</span> <span class="ml-2">{{ paymentDetails.paid_from_bank_ac || 'Not specified' }}</span></div>
              </div>
            </div>

            <!-- Preview Filters -->
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end">
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-bold text-gray-500 uppercase tracking-widest">Project</label>
                  <USelect v-model="previewFilters.project" :items="previewProjectItems" size="sm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-bold text-gray-500 uppercase tracking-widest">Site</label>
                  <USelect v-model="previewFilters.site" :items="previewSiteItems" size="sm" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-bold text-gray-500 uppercase tracking-widest">Bank</label>
                  <USelect v-model="previewFilters.bank" :items="previewBankItems" size="sm" class="w-full" />
                </div>
                <div class="flex items-end">
                  <UButton size="sm" color="neutral" variant="soft" block @click="clearPreviewFilters">Clear Filters</UButton>
                </div>
              </div>
            </div>

            <!-- Validation Errors -->
            <div v-if="previewValidationErrors.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <h4 class="text-sm font-medium text-red-800 dark:text-red-300 mb-2">⚠️ Validation Issues</h4>
              <ul class="text-sm text-red-700 dark:text-red-400 space-y-1">
                <li v-for="err in previewValidationErrors" :key="err" class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-alert" class="h-4 w-4 flex-shrink-0" />
                  {{ err }}
                </li>
              </ul>
            </div>

            <!-- Summary totals -->
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Summary ({{ filteredWagesForPreview.length }} of {{ selectedEmployeesCount }} employees)
                <span v-if="filteredWagesForPreview.length !== selectedEmployeesCount" class="text-xs text-blue-600 font-normal ml-1">— Filtered View</span>
              </h4>
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
                <div v-for="stat in previewStats" :key="stat.label" class="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                  <p class="text-xs text-gray-500">{{ stat.label }}</p>
                  <p class="font-semibold" :class="stat.class ?? ''">{{ stat.value }}</p>
                </div>
              </div>
            </div>

            <!-- Employee table -->
            <div>
              <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Employee Wage Details ({{ filteredWagesForPreview.length }} employees)</h4>
                <UButton size="sm" color="success" icon="i-lucide-file-down" @click="exportPreviewToExcel">Export to Excel</UButton>
              </div>
              <div class="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sl.</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project/Site</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank Details</th>
                      <th class="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Per Day</th>
                      <th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">EPF</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">ESIC</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Other Ded.</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Advance</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Benefits</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="(wage, index) in filteredWagesForPreview" :key="wage.masterRollId" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td class="px-2 py-2 text-xs text-center">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-sm">
                        <div class="font-medium text-gray-900 dark:text-white">{{ wage.employeeName }}</div>
                        <div class="text-xs text-gray-500">{{ wage.ifsc }}</div>
                      </td>
                      <td class="px-3 py-2 text-sm">
                        <div class="text-gray-900 dark:text-white">{{ wage.project || 'N/A' }}</div>
                        <div class="text-xs text-gray-500">{{ wage.site || 'N/A' }}</div>
                      </td>
                      <td class="px-3 py-2 text-sm">
                        <div class="text-gray-900 dark:text-white">{{ wage.bank }}</div>
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
          </div>

          <template #footer>
            <div class="px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="soft" @click="showPreviewModal = false">Close Preview</UButton>
              <UButton color="success" icon="i-lucide-save" :loading="loading" :disabled="previewValidationErrors.length > 0 || loading" @click="proceedToSave">
                {{ loading ? 'Processing…' : 'Proceed to Save' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- PF/ESIC Preview Modal (child component — props/events unchanged) -->
    <WagesPfEsicPreviewModal
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

<script setup lang="ts">
import { usePageTitle } from '~/composables/ui/usePageTitle'
import { useLedgers } from '~/composables/expenses/useLedgers'
import { useEpfEsicRules } from '~/composables/business/useEpfEsicRules'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'
// PfEsicPreviewModal auto-imported from ~/components/wages/

// ─── Page setup ───────────────────────────────────────────────────────────────
definePageMeta({ requiresAuth: true })
usePageTitle('Wages Management', 'Manage employee wages and payments')

// Hoist all composables — MUST NOT be called inside functions in Nuxt v4
const api   = useApiWithAuth()
const toast = useToast()
const { bankLedgers, fetchLedgers, isLoading: loadingLedgers, createLedger } = useLedgers()
const { calculateWithCurrentRules, getCurrentRules, startBackgroundUpdate, fetchLatestRules, loadStoredRulesIfNeeded } = useEpfEsicRules()

// ─── State ────────────────────────────────────────────────────────────────────
const selectedMonth     = ref('')
const employeeWages     = ref<any[]>([])
const allEmployeeWages  = ref<any[]>([])
const selectAll         = ref(true)
const loading           = ref(false)
const paymentDetails    = reactive({ paid_date: '', cheque_no: '', paid_from_bank_ac: '' })

const selectedBankId    = ref('')
const showAddBankModal  = ref(false)

const refreshingAiRules = ref(false)
const newBankData       = reactive({ name: '', openingBalance: 0, bankDetails: { accountNumber: '', ifscCode: '', branch: '', bankName: '' } })

const isProcessingFirestore = ref(false)
const firestoreProgress = reactive({ current: 0, total: 0, status: '', retryCount: 0 })

const sortColumn     = ref('')
const sortDirection  = ref<'asc' | 'desc'>('asc')
const searchQuery    = ref('')
const selectedProject = ref('')
const selectedSite   = ref('')
const selectedBank   = ref('')

const showAdvancesModal  = ref(false)
const loadingAdvances    = ref(false)
const employeeAdvances   = ref<any[]>([])
const currentEmployeeIndex = ref(-1)
const currentEmployeeId  = ref('')
const currentEmployeeName = ref('')

const showPreviewModal      = ref(false)
const showPfEsicPreviewModal = ref(false)
const pfEsicData            = ref<any[]>([])
const loadingPfEsicData     = ref(false)

const previewFilters = reactive({ project: '', site: '', bank: '' })
const pfEsicFilters  = reactive({ project: '', site: '', status: '', employeeStatus: 'active' })

// ─── Table column definitions ─────────────────────────────────────────────────
const tableColumns = computed(() => [
  { key: 'slNo',            label: 'Sl.',       sortable: true },
  { key: 'employeeName',    label: 'Employee',   sortable: true },
  { key: 'bank',            label: 'Bank',       sortable: false },
  { key: 'branch',          label: 'Branch',     sortable: false },
  { key: 'accountNo',       label: 'Account',    sortable: false },
  { key: 'ifsc',            label: 'IFSC',       sortable: false },
  { key: 'pDayWage',        label: 'Per Day',    sortable: true },
  { key: 'wage_Days',       label: 'Days',       sortable: true },
  { key: 'gross_salary',    label: 'Gross',      sortable: true },
  { key: 'epf_deduction',   label: `🤖 EPF (${getCurrentRules.value?.epf?.employeeRate ? (getCurrentRules.value.epf.employeeRate * 100).toFixed(1) + '%' : 'N/A'})`, sortable: true,
    title: `EPF rate: ${getCurrentRules.value?.epf?.employeeRate ? (getCurrentRules.value.epf.employeeRate * 100).toFixed(1) + '% (AI-fetched)' : 'Not available'}` },
  { key: 'esic_deduction',  label: `🤖 ESIC (${getCurrentRules.value?.esic?.employeeRate ? (getCurrentRules.value.esic.employeeRate * 100).toFixed(2) + '%' : 'N/A'})`, sortable: true,
    title: `ESIC rate: ${getCurrentRules.value?.esic?.employeeRate ? (getCurrentRules.value.esic.employeeRate * 100).toFixed(2) + '% (AI-fetched)' : 'Not available'}` },
  { key: 'other_deduction', label: 'Other Ded.', sortable: true },
  { key: 'advance_recovery',label: 'Advance',    sortable: true },
  { key: 'other_benefit',   label: 'Benefit',    sortable: true },
  { key: 'net_salary',      label: 'Net Salary', sortable: true },
])

// ─── Computed ─────────────────────────────────────────────────────────────────
const uniqueProjects = computed(() => [...new Set(allEmployeeWages.value.map(w => w.project).filter(Boolean))])
const uniqueSites    = computed(() => [...new Set(allEmployeeWages.value.map(w => w.site).filter(Boolean))])
const uniqueBanks    = computed(() => [...new Set(allEmployeeWages.value.map(w => w.bank).filter(Boolean))])

const bankItems = computed(() => [
  { label: '-- Select Bank --', value: null },
  ...bankLedgers.value.map((b: any) => ({ label: `${b.name} - ${b.bankDetails?.accountNumber || 'N/A'}`, value: b.id }))
])
const projectItems    = computed(() => [{ label: 'All Projects', value: null }, ...uniqueProjects.value.map(p => ({ label: p, value: p }))])
const siteItems       = computed(() => [{ label: 'All Sites', value: null }, ...uniqueSites.value.map(s => ({ label: s, value: s }))])
const bankFilterItems = computed(() => [{ label: 'All Banks', value: null }, ...uniqueBanks.value.map(b => ({ label: b, value: b }))])

const selectedEmployeesCount = computed(() => employeeWages.value.filter(w => w.selected).length)
const totalGrossSalary    = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.gross_salary || 0), 0).toFixed(2))
const totalEpf            = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.epf_deduction || 0), 0).toFixed(2))
const totalEsic           = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.esic_deduction || 0), 0).toFixed(2))
const totalOtherDeduction = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.other_deduction || 0), 0).toFixed(2))
const totalAdvanceRecovery = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.advance_recovery || 0), 0).toFixed(2))
const totalOtherBenefit   = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.other_benefit || 0), 0).toFixed(2))
const totalNetSalary      = computed(() => employeeWages.value.filter(w => w.selected).reduce((s, w) => s + Number(w.net_salary || 0), 0).toFixed(2))

const summaryStats = computed(() => [
  { label: 'Selected Employees', value: selectedEmployeesCount.value },
  { label: 'Total Gross Salary',    value: `₹${formatIndianCurrency(totalGrossSalary.value)}` },
  { label: 'Total EPF',             value: `₹${formatIndianCurrency(totalEpf.value)}` },
  { label: 'Total ESIC',            value: `₹${formatIndianCurrency(totalEsic.value)}` },
  { label: 'Total Other Deduction', value: `₹${formatIndianCurrency(totalOtherDeduction.value)}` },
  { label: 'Total Advance Recovery',value: `₹${formatIndianCurrency(totalAdvanceRecovery.value)}` },
  { label: 'Total Other Benefit',   value: `₹${formatIndianCurrency(totalOtherBenefit.value)}` },
  { label: 'Total Net Salary',      value: `₹${formatIndianCurrency(totalNetSalary.value)}`, class: 'text-indigo-600 dark:text-indigo-400 font-bold' },
])

// Preview computed
const selectedWagesForPreview = computed(() => employeeWages.value.filter(w => w.selected))
const filteredWagesForPreview = computed(() => {
  let f = selectedWagesForPreview.value
  if (previewFilters.project) f = f.filter(w => w.project === previewFilters.project)
  if (previewFilters.site)    f = f.filter(w => w.site === previewFilters.site)
  if (previewFilters.bank)    f = f.filter(w => w.bank === previewFilters.bank)
  return f
})
const uniqueProjectsInPreview = computed(() => [...new Set(selectedWagesForPreview.value.map(w => w.project).filter(Boolean))].sort())
const uniqueSitesInPreview    = computed(() => [...new Set(selectedWagesForPreview.value.map(w => w.site).filter(Boolean))].sort())
const uniqueBanksInPreview    = computed(() => [...new Set(selectedWagesForPreview.value.map(w => w.bank).filter(Boolean))].sort())
const previewProjectItems     = computed(() => [{ label: 'All Projects', value: null }, ...uniqueProjectsInPreview.value.map(p => ({ label: p, value: p }))])
const previewSiteItems        = computed(() => [{ label: 'All Sites', value: null }, ...uniqueSitesInPreview.value.map(s => ({ label: s, value: s }))])
const previewBankItems        = computed(() => [{ label: 'All Banks', value: null }, ...uniqueBanksInPreview.value.map(b => ({ label: b, value: b }))])

const previewTotal = (key: string) => filteredWagesForPreview.value.reduce((s, w) => s + Number(w[key] || 0), 0).toFixed(2)
const previewStats = computed(() => [
  { label: 'Total Gross',    value: `₹${formatIndianCurrency(previewTotal('gross_salary'))}` },
  { label: 'Total EPF',      value: `₹${formatIndianCurrency(previewTotal('epf_deduction'))}` },
  { label: 'Total ESIC',     value: `₹${formatIndianCurrency(previewTotal('esic_deduction'))}` },
  { label: 'Other Deduction',value: `₹${formatIndianCurrency(previewTotal('other_deduction'))}` },
  { label: 'Advance Recovery',value: `₹${formatIndianCurrency(previewTotal('advance_recovery'))}` },
  { label: 'Other Benefit',  value: `₹${formatIndianCurrency(previewTotal('other_benefit'))}` },
  { label: 'Net Payable',    value: `₹${formatIndianCurrency(previewTotal('net_salary'))}`, class: 'text-green-600 font-bold' },
  { label: 'Bank Transfer',  value: `₹${formatIndianCurrency(previewTotal('net_salary'))}`, class: 'text-blue-600 font-bold' },
])

const previewValidationErrors = computed(() => {
  const errors: string[] = []
  if (!selectedMonth.value) errors.push('Please select a month')
  if (!paymentDetails.paid_date) errors.push('Please specify payment date')
  if (!paymentDetails.paid_from_bank_ac) errors.push('Please select a bank account')
  if (selectedEmployeesCount.value === 0) errors.push('Please select at least one employee')
  const invalid = selectedWagesForPreview.value.filter(w => w.net_salary <= 0)
  if (invalid.length > 0) errors.push(`${invalid.length} employee(s) have zero or negative net salary`)
  return errors
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
const notify = (msg: string, type: 'success' | 'error' | 'warning' = 'success') =>
  toast.add({ title: type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error', description: msg, color: type })

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

const formatIndianCurrency = (amount: any) =>
  parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

const formatMonthYear = (monthString: string) => {
  if (!monthString) return 'Not selected'
  const [year, month] = monthString.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

const triggerBlobDownload = (data: any, filename: string) => {
  const url  = window.URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href  = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(searchQuery,       filterEmployees)
watch(selectedProject,   filterEmployees)
watch(selectedSite,      filterEmployees)
watch(selectedBank,      filterEmployees)
watch(selectedBankId,    handleBankSelection)
watch(() => employeeWages.value.map(w => w.selected), () => {
  selectAll.value = employeeWages.value.length > 0 && employeeWages.value.every(w => w.selected)
}, { deep: true })
watch(showPfEsicPreviewModal, (v) => { if (v && selectedMonth.value) fetchPfEsicData() })

// ─── Filtering / Sorting ──────────────────────────────────────────────────────
function filterEmployees() {
  const q    = searchQuery.value.toLowerCase().trim()
  employeeWages.value = allEmployeeWages.value.filter(w => {
    const searchMatch   = !q || [w.slNo, w.employeeName, w.bank, w.branch, w.accountNo, w.ifsc].some(v => String(v).toLowerCase().includes(q))
    const projectMatch  = !selectedProject.value || w.project === selectedProject.value
    const siteMatch     = !selectedSite.value    || w.site    === selectedSite.value
    const bankMatch     = !selectedBank.value    || w.bank    === selectedBank.value
    return searchMatch && projectMatch && siteMatch && bankMatch
  })
  if (sortColumn.value) applySorting()
}

function applySorting() {
  if (sortColumn.value === 'employeeName') {
    employeeWages.value.sort((a, b) => {
      const r = a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase())
      return sortDirection.value === 'asc' ? r : -r
    })
  } else {
    employeeWages.value.sort((a, b) => {
      let va = a[sortColumn.value], vb = b[sortColumn.value]
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) { va = Number(va); vb = Number(vb) }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase() }
      if (va < vb) return sortDirection.value === 'asc' ? -1 : 1
      if (va > vb) return sortDirection.value === 'asc' ? 1 : -1
      return 0
    })
  }
}

function sortEmployeeWages(column: string) {
  sortDirection.value = sortColumn.value === column ? (sortDirection.value === 'asc' ? 'desc' : 'asc') : 'asc'
  sortColumn.value = column
  applySorting()
}

function handleBankSelection() {
  if (!selectedBankId.value) { paymentDetails.paid_from_bank_ac = ''; return }
  const bank = bankLedgers.value.find((b: any) => b.id === selectedBankId.value)
  if (bank) paymentDetails.paid_from_bank_ac = bank.bankDetails?.accountNumber || ''
}

// ─── Wage calculation ─────────────────────────────────────────────────────────
const calculateWage = (index: number, fullRecalc = false) => {
  const wage = employeeWages.value[index]
  if (!wage) return
  if (fullRecalc) {
    wage.gross_salary  = Number(wage.pDayWage) * Number(wage.wage_Days)
    const calcs        = calculateWithCurrentRules(wage.gross_salary)
    wage.epf_deduction = calcs.employeeEpf
    wage.esic_deduction = calcs.employeeEsic
    wage.calculationDetails = { rulesUsed: calcs.rulesUsed, epfApplicableWage: calcs.epfApplicableWage, esicApplicableWage: calcs.esicApplicableWage, totalEmployerContribution: calcs.totalEmployerContribution }
  }
  wage.other_deduction  = Number(wage.other_deduction) || 0
  wage.advance_recovery = Number(wage.advance_recovery) || 0
  wage.other_benefit    = Number(wage.other_benefit) || 0
  wage.epf_deduction    = Number(wage.epf_deduction) || 0
  wage.esic_deduction   = Number(wage.esic_deduction) || 0
  wage.net_salary = Math.round((wage.gross_salary - (wage.epf_deduction + wage.esic_deduction + wage.other_deduction + wage.advance_recovery) + wage.other_benefit) * 100) / 100
}

const calculateAll = () => employeeWages.value.forEach((_, i) => calculateWage(i, true))

// ─── Toggle select all ────────────────────────────────────────────────────────
const toggleSelectAll = () => employeeWages.value.forEach(w => { w.selected = selectAll.value })

// ─── Load employees ───────────────────────────────────────────────────────────
const getLastWageDaysForEmployees = async (employeeIds: string[]): Promise<Record<string, number>> => {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10_000)
    const response = await api.post('/api/wages/employee-history-bulk', { employeeIds }, { signal: controller.signal })
    clearTimeout(tid)
    const map: Record<string, number> = {}
    if (response.success && response.data) {
      response.data.forEach((h: any) => { map[h.employeeId] = h.lastWageDays })
    }
    return map
  } catch {
    return {}
  }
}

const loadEmployees = async () => {
  if (!selectedMonth.value) return
  loading.value = true
  employeeWages.value = []
  try {
    const [year, month] = selectedMonth.value.split('-')
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0)

    const response      = await api.get('/api/master-roll')
    const activeEmployees = response.employees.filter((emp: any) => {
      const join = emp.dateOfJoining ? new Date(emp.dateOfJoining) : null
      return emp.status === 'active' && join && join <= lastDayOfMonth
    })

    const allWagesData = await api.get('/api/wages')
    let shouldShowAll  = false

    if (allWagesData?.wages) {
      const monthExists = allWagesData.wages.some((w: any) => new Date(w.salary_month).toISOString().substring(0, 7) === selectedMonth.value)
      const wageDates   = allWagesData.wages.map((w: any) => new Date(w.salary_month))
      const lastWageMonth = wageDates.length > 0 ? new Date(Math.max(...wageDates)).toISOString().substring(0, 7) : null
      shouldShowAll = !monthExists && (!lastWageMonth || selectedMonth.value > lastWageMonth)
    } else {
      shouldShowAll = true
    }

    let employeesToShow: any[]
    if (shouldShowAll) {
      employeesToShow = [...activeEmployees]
    } else {
      const wagesData    = await api.get('/api/wages', { params: { month: selectedMonth.value } })
      const paidIds      = new Set((wagesData?.wages || []).map((w: any) => w.masterRollId).filter(Boolean))
      employeesToShow    = activeEmployees.filter((emp: any) => !paidIds.has(emp._id))
    }

    const lastWageDaysMap = await getLastWageDaysForEmployees(employeesToShow.map((e: any) => e._id))

    const transformed = employeesToShow.map((emp: any, i: number) => ({
      slNo: i + 1, masterRollId: emp._id, employeeName: emp.employeeName,
      bank: emp.bank, branch: emp.branch || '', accountNo: emp.accountNo, ifsc: emp.ifsc,
      pDayWage: Number(emp.pDayWage) || 0, wage_Days: lastWageDaysMap[emp._id] || 26,
      project: emp.project || '', site: emp.site || '',
      gross_salary: 0, epf_deduction: 0, esic_deduction: 0,
      other_deduction: 0, advance_recovery: 0, selectedAdvanceId: null,
      other_benefit: 0, net_salary: 0,
      hasAdvances: false, totalOutstanding: 0, advanceCount: 0, selected: true
    }))

    employeeWages.value    = transformed
    allEmployeeWages.value = [...transformed]
    searchQuery.value      = ''
    sortColumn.value       = 'employeeName'
    sortDirection.value    = 'asc'
    employeeWages.value.sort((a, b) => a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase()))

    calculateAll()

    try { await checkEmployeesForAdvances() } catch { /* non-blocking */ }

    applySorting()
  } catch (e) {
    console.error('Error loading employees:', e)
    notify('Failed to load employee data. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

const checkEmployeesForAdvances = async () => {
  const employeeIds = employeeWages.value.filter(w => w.masterRollId).map(w => w.masterRollId)
  if (!employeeIds.length) return
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 15_000)
    const response = await api.post('/api/employee-advances/background-check', { employeeIds }, { signal: controller.signal })
    clearTimeout(tid)
    if (response.success && response.data) {
      response.data.forEach((ad: any) => {
        const idx = employeeWages.value.findIndex(w => w.masterRollId === ad.employeeId)
        if (idx < 0) return
        employeeWages.value[idx].hasAdvances    = ad.hasAdvances
        employeeWages.value[idx].totalOutstanding = ad.totalOutstanding
        employeeWages.value[idx].advanceCount   = ad.advanceCount
        if (ad.hasAdvances && ad.firstAdvance?.repaymentTerms?.installmentAmount) {
          const amt = Math.min(ad.firstAdvance.repaymentTerms.installmentAmount, ad.firstAdvance.remainingBalance)
          employeeWages.value[idx].advance_recovery  = amt
          employeeWages.value[idx].selectedAdvanceId = ad.firstAdvance._id
          calculateWage(idx)
        }
      })
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') console.error('Advance background check error:', e.message)
  }
}

// ─── Save wages ───────────────────────────────────────────────────────────────
const saveWages = async () => {
  if (!selectedMonth.value || !paymentDetails.paid_date) {
    notify('Please select a month and payment date', 'error'); return
  }
  const selectedWages = employeeWages.value.filter(w => w.selected).map(w => ({ ...w, salary_month: new Date(selectedMonth.value), paid_date: paymentDetails.paid_date, cheque_no: paymentDetails.cheque_no, paid_from_bank_ac: paymentDetails.paid_from_bank_ac }))
  if (!selectedWages.length) { notify('Please select at least one employee', 'error'); return }
  loading.value = true
  try {
    const masterRollResp = await api.get('/api/master-roll')
    const pDayWageMap: Record<string, number> = {}
    masterRollResp.employees?.forEach((emp: any) => { pDayWageMap[emp._id] = Number(emp.pDayWage) || 0 })
    selectedWages.forEach(w => { w.pDayWageChanged = Number(w.pDayWage) !== (pDayWageMap[w.masterRollId] || 0) })

    const response = await api.post('/api/wages', { wages: selectedWages })
    if (response.success) {
      notify(`Successfully saved wages for ${response.count} employees${response.updatedMasterRoll ? ` and updated ${response.updatedMasterRoll} employee wage rates` : ''}`)

      if (selectedBankId.value) {
        notify('Wages saved. Firestore updates will begin in 5 seconds.', 'warning')
        setTimeout(async () => {
          const wagesForFirestore = (response.savedWages || [])
            .filter((w: any) => w._id && w.employeeName && selectedBankId.value)
            .map((w: any) => ({ _id: String(w._id), employeeName: w.employeeName, net_salary: w.net_salary || 0, paid_date: w.paid_date || new Date(), salary_month: w.salary_month || new Date(), ledgerId: selectedBankId.value, cheque_no: w.cheque_no || '', project: w.project || 'KIR_NON_CORE' }))
          if (wagesForFirestore.length) await processBatchedFirestoreUpdates(wagesForFirestore)
        }, 5000)
      }

      await loadEmployees()
    }
  } catch (e) {
    console.error('Error saving wages:', e)
    notify('Failed to save wages. Please try again.', 'error')
    loading.value = false
  }
}

const processBatchedFirestoreUpdates = async (wages: any[]): Promise<boolean> => {
  const CHUNK = 10, RETRIES = 3, DELAY = 2000
  firestoreProgress.total = wages.length; firestoreProgress.current = 0
  firestoreProgress.status = 'Starting Firestore updates…'; isProcessingFirestore.value = true
  try {
    const totalChunks = Math.ceil(wages.length / CHUNK)
    for (let ci = 0; ci < totalChunks; ci++) {
      let ok = false, retries = 0
      while (!ok && retries < RETRIES) {
        try {
          firestoreProgress.status = `Processing chunk ${ci + 1}/${totalChunks}…`
          const resp = await api.post('/api/wages/batch-add-to-firestore', { wages, chunkSize: CHUNK, chunkIndex: ci })
          if (resp.success) { firestoreProgress.current += resp.processedCount; ok = true }
          else throw new Error('Chunk failed')
        } catch { retries++; firestoreProgress.retryCount = retries; if (retries < RETRIES) await new Promise(r => setTimeout(r, DELAY * retries)) }
      }
      if (!ok) throw new Error(`Chunk ${ci + 1} failed after ${RETRIES} retries`)
    }
    firestoreProgress.status = 'Firestore updates completed successfully'; return true
  } catch (e: any) {
    firestoreProgress.status = `Error: ${e.message}`; return false
  } finally {
    isProcessingFirestore.value = false
  }
}

// ─── Advances modal ───────────────────────────────────────────────────────────
const showAdvances = async (employeeId: string, index: number) => {
  currentEmployeeId.value    = employeeId
  currentEmployeeIndex.value = index
  currentEmployeeName.value  = employeeWages.value[index].employeeName
  showAdvancesModal.value    = true
  loadingAdvances.value      = true
  employeeAdvances.value     = []
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8_000)
    const response = await api.get(`/api/employee-advances/by-employee/${employeeId}`, { signal: controller.signal })
    clearTimeout(tid)
    if (response.success && response.advances) {
      employeeAdvances.value                           = response.advances
      employeeWages.value[index].hasAdvances           = response.advances.length > 0
    }
  } catch (e: any) {
    const msg = e.name === 'AbortError' ? 'Request timed out. Please try again.'
      : e.statusCode === 503 ? 'Database service temporarily unavailable.'
      : 'Failed to load advances. Please try again.'
    notify(msg, 'error')
  } finally {
    loadingAdvances.value = false
  }
}

const closeAdvancesModal = () => {
  showAdvancesModal.value    = false
  currentEmployeeId.value    = ''
  currentEmployeeIndex.value = -1
  employeeAdvances.value     = []
}

const applyAdvanceRecovery = (advance: any) => {
  if (currentEmployeeIndex.value < 0) return
  const wage = employeeWages.value[currentEmployeeIndex.value]
  const gross = Number(wage.pDayWage) * Number(wage.wage_Days)
  const calcs = calculateWithCurrentRules(gross)
  const netBefore = gross - (calcs.employeeEpf + calcs.employeeEsic + (Number(wage.other_deduction) || 0)) + (Number(wage.other_benefit) || 0)
  wage.advance_recovery  = Math.min(advance.remainingBalance, Math.max(0, netBefore))
  wage.selectedAdvanceId = advance._id
  calculateWage(currentEmployeeIndex.value)
  closeAdvancesModal()
}

// ─── Preview helpers ──────────────────────────────────────────────────────────
const clearPreviewFilters = () => { previewFilters.project = ''; previewFilters.site = ''; previewFilters.bank = '' }

const exportPreviewToExcel = async () => {
  try {
    const exportData = { wages: filteredWagesForPreview.value.map(w => ({ ...w, salary_month: new Date(selectedMonth.value), paid_date: paymentDetails.paid_date, cheque_no: paymentDetails.cheque_no, paid_from_bank_ac: paymentDetails.paid_from_bank_ac })), month: selectedMonth.value, paymentDetails, filters: previewFilters }
    const response   = await api.post('/api/wages/export-preview', exportData, { responseType: 'blob' })
    const filterSuffix = (previewFilters.project || previewFilters.site || previewFilters.bank) ? '_Filtered' : ''
    triggerBlobDownload(response, `Wages_Preview_${formatMonthYear(selectedMonth.value).replace(' ', '_')}${filterSuffix}.xlsx`)
    notify('Excel file downloaded successfully!')
  } catch (e) {
    notify('Failed to export Excel file. Please try again.', 'error')
  }
}

const proceedToSave = async () => { showPreviewModal.value = false; await saveWages() }

// ─── Bank modal ───────────────────────────────────────────────────────────────
const addNewBank = async () => {
  if (!newBankData.name || !newBankData.bankDetails.accountNumber) { notify('Bank name and account number are required', 'error'); return }
  try {
    const newBank = await createLedger({ name: newBankData.name, type: 'bank', openingBalance: Number(newBankData.openingBalance) || 0, bankDetails: { ...newBankData.bankDetails } })
    selectedBankId.value = newBank.id
    showAddBankModal.value = false
    Object.assign(newBankData, { name: '', openingBalance: 0, bankDetails: { accountNumber: '', ifscCode: '', branch: '', bankName: '' } })
  } catch (e) {
    console.error('Error creating bank ledger:', e)
    notify('Failed to create bank ledger. Please try again.', 'error')
  }
}

// ─── PF/ESIC ──────────────────────────────────────────────────────────────────
const calculateCompleteEpfEsic = (grossSalary: number) => calculateWithCurrentRules(grossSalary)

const fetchPfEsicData = async () => {
  if (!selectedMonth.value) { notify('Please select a month first', 'warning'); return }
  loadingPfEsicData.value = true
  try {
    const [year, month]  = selectedMonth.value.split('-')
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0)
    const masterRoll     = await api.get('/api/master-roll')
    const wagesResp      = await api.get(`/api/wages?month=${selectedMonth.value}`)
    const monthWages     = wagesResp.wages || []

    const active = (masterRoll.employees || []).filter((emp: any) => {
      const join = emp.dateOfJoining ? new Date(emp.dateOfJoining) : null
      const exit = emp.dateOfExit ? new Date(emp.dateOfExit) : null
      return emp.status === 'active' && join && join <= lastDayOfMonth && (!exit || exit >= new Date(parseInt(year), parseInt(month) - 1, 1))
    })

    pfEsicData.value = active.map((emp: any) => {
      const wageRecord = monthWages.find((w: any) => w.masterRollId === emp._id)
      let wageDays = 26, grossSalary: number
      if (wageRecord) {
        wageDays    = Number(wageRecord.wage_Days)
        grossSalary = Number(wageRecord.gross_salary)
      } else {
        const uiWage = employeeWages.value.find(w => w.masterRollId === emp._id)
        if (uiWage) wageDays = Number(uiWage.wage_Days) || 26
        grossSalary = (Number(emp.pDayWage) || 0) * wageDays
      }
      const calcs = calculateCompleteEpfEsic(grossSalary)
      return {
        employeeId: emp._id, employeeName: emp.employeeName, project: emp.project || 'N/A', site: emp.site || 'N/A',
        category: emp.category || 'UNSKILLED', uan: emp.uan || 'N/A', esicNo: emp.esicNo || 'N/A',
        pDayWage: Number(emp.pDayWage) || 0, isPaid: !!wageRecord, wageDays, grossSalary,
        netSalary: wageRecord ? Number(wageRecord.net_salary) : grossSalary - calcs.totalEmployeeDeduction,
        epfApplicableWage: calcs.epfApplicableWage, employeeEpf: calcs.employeeEpf, employerEpf: calcs.employerEpf,
        employerEps: calcs.employerEps, edli: calcs.edli, adminCharges: calcs.adminCharges,
        totalEmployerEpfContribution: calcs.totalEmployerEpfContribution, totalEpfContribution: calcs.totalEpfContribution,
        esicApplicableWage: calcs.esicApplicableWage, employeeEsic: calcs.employeeEsic, employerEsic: calcs.employerEsic,
        totalEsicContribution: calcs.totalEsicContribution,
        epfDeduction: calcs.employeeEpf, esicDeduction: calcs.employeeEsic,
        totalEmployeeDeduction: calcs.totalEmployeeDeduction, totalEmployerContribution: calcs.totalEmployerContribution,
        employeeStatus: emp.status, paymentStatus: wageRecord ? 'paid' : 'unpaid'
      }
    })
  } catch (e) {
    console.error('Error fetching PF/ESIC data:', e)
    notify('Failed to fetch PF/ESIC data. Please try again.', 'error')
  } finally {
    loadingPfEsicData.value = false
  }
}

const updateEmployeeInPfEsicData = (updated: any) => {
  const idx = pfEsicData.value.findIndex(e => e.employeeId === updated.employeeId)
  if (idx !== -1) pfEsicData.value[idx] = updated
}

// ─── AI rules refresh (used by PF/ESIC modal) ────────────────────────────────
const refreshAiRules = async () => {
  refreshingAiRules.value = true
  try {
    await fetchLatestRules(true)
    calculateAll()
    notify('EPF/ESIC rules updated successfully from AI system!')
  } catch {
    notify('Failed to refresh EPF/ESIC rules. Using cached values.', 'error')
  } finally {
    refreshingAiRules.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    loadStoredRulesIfNeeded()
    startBackgroundUpdate()
    await fetchLedgers('bank')
  } catch (e) {
    console.error('Error on mount:', e)
  }
})
</script>