<template>
  <div class="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

    <!-- ── Page Header ─────────────────────────────────────────────── -->
    <div class="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-3">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
        Employee Master Roll Management
      </h1>

      <div class="flex flex-wrap gap-2">
        <UButton color="primary" icon="i-lucide-user-plus" @click="showAddModal = true">
          Add Employee
        </UButton>

        <UButton color="warning" icon="i-lucide-square-pen" @click="showBulkEditModal = true">
          Bulk Edit
        </UButton>

        <UButton color="success" variant="solid" @click="downloadTemplate">
          <template #leading><ExcelIcon class="h-4 w-4" /></template>
          Download Template
        </UButton>

        <UButton color="teal" variant="solid" @click="downloadMasterRoll">
          <template #leading><ExcelIcon class="h-4 w-4" /></template>
          Download Master Roll
        </UButton>

        <UButton color="secondary" icon="i-lucide-file-down" @click="showExportModal = true">
          Filtered Export
        </UButton>

        <!-- File upload — label wraps a presentational UButton span -->
        <label class="cursor-pointer">
          <UButton as="span" color="indigo" variant="solid" class="pointer-events-none">
            <template #leading><ExcelIcon class="h-4 w-4" /></template>
            Upload Excel
          </UButton>
          <input type="file" @change="handleFileUpload" accept=".xlsx,.xls" class="sr-only" />
        </label>
      </div>
    </div>

    <!-- ── Search + Active-filter reset ────────────────────────────── -->
    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <UInput
        v-model="searchTerm"
        placeholder="Search employees…"
        icon="i-lucide-search"
        class="flex-1"
      />
      <UButton
        v-if="hasActiveFilters"
        color="error"
        variant="soft"
        icon="i-lucide-x"
        @click="resetAllFilters"
      >
        Reset All Filters
      </UButton>
    </div>

    <!-- ── Desktop Table ────────────────────────────────────────────── -->
    <div class="hidden md:block rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
      <div class="h-[70vh] overflow-y-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">

          <!-- Sticky gradient header -->
          <thead class="bg-gradient-to-r from-teal-500 to-indigo-600 sticky top-0 z-10">
            <tr>
              <!-- Sl. No. -->
              <th class="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider w-12">
                Sl.
              </th>

              <!-- Sortable + Filterable columns -->
              <th
                v-for="col in tableColumns"
                :key="col.key"
                class="px-4 py-3 text-left text-xs text-white uppercase tracking-wider"
              >
                <div class="flex items-center gap-0.5">
                  <!-- Sort button -->
                  <UButton
                    variant="ghost"
                    size="xs"
                    :trailing-icon="
                      sortField === col.key
                        ? (sortDirection === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down')
                        : 'i-lucide-chevrons-up-down'
                    "
                    class="text-white hover:text-white hover:bg-white/10 font-semibold uppercase tracking-wider text-xs px-1 gap-0.5"
                    @click="toggleSort(col.key)"
                  >
                    {{ col.label }}
                  </UButton>

                  <!-- Per-column filter popover -->
                  <UPopover :content="{ align: 'start' }">
                    <UButton
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-filter"
                      class="hover:bg-white/10 px-1"
                      :class="columnFilters[col.key]?.length > 0 ? 'text-yellow-300' : 'text-blue-200'"
                    />
                    <template #content>
                      <div class="p-2 min-w-52">
                        <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                          <UButton
                            size="xs"
                            variant="ghost"
                            color="primary"
                            @click="clearColumnFilter(col.key)"
                          >
                            Clear
                          </UButton>
                          <UButton
                            size="xs"
                            color="error"
                            variant="soft"
                            @click="resetAllFilters"
                          >
                            Reset All
                          </UButton>
                        </div>
                        <div class="max-h-48 overflow-y-auto space-y-1.5">
                          <UCheckbox
                            v-for="option in filterOptions[col.key]"
                            :key="option"
                            :model-value="columnFilters[col.key].includes(option)"
                            :label="option"
                            @update:model-value="applyFilter(col.key, option)"
                          />
                        </div>
                      </div>
                    </template>
                  </UPopover>
                </div>
              </th>

              <!-- Actions -->
              <th class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="(employee, index) in filteredEmployees"
              :key="employee._id"
              class="hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
            >
              <td class="px-3 py-3 text-center text-sm font-medium text-gray-500">{{ index + 1 }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ employee.employeeName }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ employee.fatherHusbandName }}</td>
              <td
                class="px-4 py-3 whitespace-nowrap text-sm"
                :class="!isValidPhoneNumber(employee.phoneNo) && employee.phoneNo ? 'text-red-600 font-semibold' : 'text-gray-700 dark:text-gray-300'"
              >
                {{ employee.phoneNo }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ formatDate(employee.dateOfJoining) }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge :color="statusColor(employee.status)" variant="soft" size="sm">
                  {{ employee.status || 'Active' }}
                </UBadge>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ employee.category }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ employee.project || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{{ employee.site || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UButton
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-pencil"
                  color="primary"
                  @click="editEmployee(employee)"
                >
                  Edit
                </UButton>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-if="filteredEmployees.length === 0">
              <td colspan="10" class="px-4 py-12 text-center text-sm text-gray-400">
                <UIcon name="i-lucide-users" class="h-8 w-8 mx-auto mb-2 opacity-40" />
                No employees found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Mobile Card View ─────────────────────────────────────────── -->
    <div class="md:hidden space-y-3">
      <div
        v-for="(employee, index) in filteredEmployees"
        :key="employee._id"
        class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
      >
        <div class="flex justify-between items-start mb-3">
          <div>
            <UBadge color="teal" variant="soft" size="xs" class="mb-1">#{{ index + 1 }}</UBadge>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ employee.employeeName }}</h3>
          </div>
          <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="editEmployee(employee)">
            Edit
          </UButton>
        </div>
        <div class="grid grid-cols-2 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
          <div><span class="text-gray-400">Father/Husband: </span>{{ employee.fatherHusbandName }}</div>
          <div>
            <span class="text-gray-400">Phone: </span>
            <span :class="!isValidPhoneNumber(employee.phoneNo) && employee.phoneNo ? 'text-red-600 font-semibold' : ''">
              {{ employee.phoneNo }}
            </span>
          </div>
          <div><span class="text-gray-400">Joined: </span>{{ formatDate(employee.dateOfJoining) }}</div>
          <div class="flex items-center gap-1">
            <span class="text-gray-400">Status: </span>
            <UBadge :color="statusColor(employee.status)" variant="soft" size="xs">{{ employee.status || 'Active' }}</UBadge>
          </div>
          <div><span class="text-gray-400">Category: </span>{{ employee.category }}</div>
          <div><span class="text-gray-400">Project: </span>{{ employee.project || '—' }}</div>
          <div><span class="text-gray-400">Site: </span>{{ employee.site || '—' }}</div>
        </div>
      </div>

      <div v-if="filteredEmployees.length === 0" class="text-center text-gray-400 py-12 text-sm">
        No employees found.
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- EDIT MODAL                                                      -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showEditModal" :ui="{ content: 'sm:max-w-5xl' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">

          <!-- Header -->
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 class="text-xl font-bold text-white">Edit Employee</h2>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="sm"
                class="text-white hover:text-red-200 hover:bg-white/10"
                @click="showEditModal = false"
              />
            </div>
          </template>

          <!-- Body -->
          <div class="overflow-y-auto max-h-[65vh] p-4 md:p-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

              <UFormField label="Employee Name">
                <UInput v-model="editingEmployee.employeeName" class="w-full" />
              </UFormField>

              <UFormField label="Father/Husband Name">
                <UInput v-model="editingEmployee.fatherHusbandName" class="w-full" />
              </UFormField>

              <UFormField label="Date of Birth">
                <UInput
                  type="date"
                  :value="formatDateForInput(editingEmployee.dateOfBirth)"
                  class="w-full"
                  @input="(e: Event) => editingEmployee.dateOfBirth = (e.target as HTMLInputElement).value"
                />
              </UFormField>

              <UFormField label="Date of Joining">
                <UInput
                  type="date"
                  :value="formatDateForInput(editingEmployee.dateOfJoining)"
                  class="w-full"
                  @input="(e: Event) => editingEmployee.dateOfJoining = (e.target as HTMLInputElement).value"
                />
              </UFormField>

              <UFormField label="Aadhar">
                <UInput v-model="editingEmployee.aadhar" class="w-full" />
              </UFormField>

              <UFormField label="PAN">
                <UInput v-model="editingEmployee.pan" class="w-full" />
              </UFormField>

              <UFormField label="Address">
                <UInput v-model="editingEmployee.address" class="w-full" />
              </UFormField>

              <UFormField
                label="Phone Number"
                :error="!isValidPhoneNumber(editingEmployee.phoneNo) && editingEmployee.phoneNo ? 'Invalid phone number format' : undefined"
              >
                <UInput
                  v-model="editingEmployee.phoneNo"
                  class="w-full"
                  :color="!isValidPhoneNumber(editingEmployee.phoneNo) && editingEmployee.phoneNo ? 'error' : undefined"
                />
              </UFormField>

              <UFormField label="Bank">
                <UInput v-model="editingEmployee.bank" class="w-full" />
              </UFormField>

              <UFormField label="Branch">
                <UInput v-model="editingEmployee.branch" class="w-full" />
              </UFormField>

              <UFormField label="Account Number">
                <UInput v-model="editingEmployee.accountNo" class="w-full" />
              </UFormField>

              <UFormField label="IFSC">
                <UInput v-model="editingEmployee.ifsc" class="w-full" />
              </UFormField>

              <UFormField label="UAN">
                <UInput v-model="editingEmployee.uan" class="w-full" />
              </UFormField>

              <UFormField label="ESIC Number">
                <UInput v-model="editingEmployee.esicNo" class="w-full" />
              </UFormField>

              <UFormField label="S Kalyan Number">
                <UInput v-model="editingEmployee.sKalyanNo" class="w-full" />
              </UFormField>

              <UFormField label="Per Day Wage">
                <UInput type="number" v-model="editingEmployee.pDayWage" class="w-full" />
              </UFormField>

              <UFormField label="Project">
                <UInput v-model="editingEmployee.project" class="w-full" />
              </UFormField>

              <UFormField label="Site">
                <UInput v-model="editingEmployee.site" class="w-full" />
              </UFormField>

              <UFormField label="Category">
                <USelect v-model="editingEmployee.category" :items="categoryOptions" class="w-full" />
              </UFormField>

              <UFormField label="Status">
                <USelect v-model="editingEmployee.status" :items="statusOptions" class="w-full" />
              </UFormField>

              <UFormField label="Date of Exit">
                <UInput
                  type="date"
                  :value="formatDateForInput(editingEmployee.dateOfExit)"
                  class="w-full"
                  @input="(e: Event) => editingEmployee.dateOfExit = (e.target as HTMLInputElement).value"
                />
              </UFormField>

              <UFormField label="Exit Remarks">
                <UInput v-model="editingEmployee.doeRem" class="w-full" />
              </UFormField>

            </div>

            <!-- Wage History -->
            <transition name="slide-fade">
              <div v-if="showWageHistory" class="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wage History</h3>
                <EmployeeWageHistory
                  :wage-history="wageHistory"
                  :loading="loadingWageHistory"
                  :employee-name="editingEmployee.employeeName"
                />
              </div>
            </transition>
          </div>

          <!-- Footer -->
          <template #footer>
            <div class="bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-4 flex flex-wrap justify-end gap-2 rounded-b-xl">

              <!-- Appointment Letter dropdown -->
              <UDropdownMenu :items="letterFormatItems">
                <UButton
                  color="warning"
                  icon="i-lucide-file-text"
                  :loading="isGeneratingDocument"
                >
                  {{ isGeneratingDocument ? 'Generating…' : 'Appointment Letter' }}
                </UButton>
              </UDropdownMenu>

              <UButton
                color="violet"
                icon="i-lucide-chart-bar"
                @click="toggleWageHistory"
              >
                {{ showWageHistory ? 'Hide Wage History' : 'Show Wage History' }}
              </UButton>

              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-x"
                @click="showEditModal = false"
              >
                Cancel
              </UButton>

              <UButton
                color="primary"
                icon="i-lucide-check"
                @click="updateEmployee"
              >
                Save
              </UButton>
            </div>
          </template>

        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADD EMPLOYEE MODAL                                             -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showAddModal" :ui="{ content: 'sm:max-w-5xl' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">

          <!-- Header -->
          <template #header>
            <div class="bg-gradient-to-r from-teal-500 to-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 class="text-xl font-bold text-white">Add New Employee</h2>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="sm"
                class="text-white hover:text-red-200 hover:bg-white/10"
                @click="showAddModal = false"
              />
            </div>
          </template>

          <!-- Body -->
          <div class="overflow-y-auto max-h-[65vh] p-4 md:p-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

              <UFormField label="Employee Name" required>
                <UInput v-model="newEmployee.employeeName" class="w-full" placeholder="Enter employee name" />
              </UFormField>

              <UFormField label="Father/Husband Name" required>
                <UInput v-model="newEmployee.fatherHusbandName" class="w-full" placeholder="Enter father/husband name" />
              </UFormField>

              <UFormField label="Date of Birth" required>
                <UInput type="date" v-model="newEmployee.dateOfBirth" class="w-full" />
              </UFormField>

              <UFormField label="Date of Joining" required>
                <UInput type="date" v-model="newEmployee.dateOfJoining" class="w-full" />
              </UFormField>

              <UFormField label="Aadhar" required>
                <UInput v-model="newEmployee.aadhar" class="w-full" placeholder="Enter Aadhar number" />
              </UFormField>

              <UFormField label="PAN">
                <UInput v-model="newEmployee.pan" class="w-full" placeholder="Enter PAN number" />
              </UFormField>

              <UFormField label="Address" required>
                <UInput v-model="newEmployee.address" class="w-full" placeholder="Enter address" />
              </UFormField>

              <UFormField
                label="Phone Number"
                required
                :error="!isValidPhoneNumber(newEmployee.phoneNo) && newEmployee.phoneNo ? 'Invalid phone number format' : undefined"
                :hint="isValidPhoneNumber(newEmployee.phoneNo) && newEmployee.phoneNo ? '✓ Valid phone number' : undefined"
              >
                <UInput
                  v-model="newEmployee.phoneNo"
                  class="w-full"
                  placeholder="Enter phone number"
                  :color="newEmployee.phoneNo
                    ? (isValidPhoneNumber(newEmployee.phoneNo) ? 'success' : 'error')
                    : undefined"
                />
              </UFormField>

              <!-- IFSC with auto-fill -->
              <UFormField
                label="IFSC Code"
                required
                :error="ifscError || undefined"
                :hint="ifscValid && !fetchingBankDetails ? '✓ Valid IFSC — bank details auto-filled' : undefined"
              >
                <UInput
                  v-model="newEmployee.ifsc"
                  class="w-full"
                  placeholder="e.g. SBIN0000001"
                  :loading="fetchingBankDetails"
                  :color="ifscError ? 'error' : ifscValid ? 'success' : undefined"
                  @input="handleIfscInput"
                  @blur="validateIfsc"
                />
              </UFormField>

              <UFormField label="Bank Name" required>
                <UInput
                  v-model="newEmployee.bank"
                  class="w-full"
                  placeholder="Auto-filled from IFSC"
                  list="bankOptions"
                />
                <datalist id="bankOptions">
                  <option v-for="bank in uniqueBanks" :key="bank" :value="bank" />
                </datalist>
              </UFormField>

              <UFormField label="Branch Name">
                <UInput v-model="newEmployee.branch" class="w-full" placeholder="Auto-filled from IFSC" />
              </UFormField>

              <UFormField label="Account Number" required>
                <UInput v-model="newEmployee.accountNo" class="w-full" placeholder="Enter account number" />
              </UFormField>

              <UFormField label="UAN">
                <UInput v-model="newEmployee.uan" class="w-full" placeholder="Enter UAN number" />
              </UFormField>

              <UFormField label="ESIC Number">
                <UInput v-model="newEmployee.esicNo" class="w-full" placeholder="Enter ESIC number" />
              </UFormField>

              <UFormField label="S Kalyan Number">
                <UInput v-model="newEmployee.sKalyanNo" class="w-full" placeholder="Enter S Kalyan number" />
              </UFormField>

              <UFormField label="Per Day Wage">
                <UInput type="number" v-model="newEmployee.pDayWage" class="w-full" placeholder="Daily wage amount" />
              </UFormField>

              <UFormField label="Project">
                <UInput v-model="newEmployee.project" class="w-full" placeholder="Enter project name" list="projectOptions" />
                <datalist id="projectOptions">
                  <option v-for="project in uniqueProjects" :key="project" :value="project" />
                </datalist>
              </UFormField>

              <UFormField label="Site">
                <UInput v-model="newEmployee.site" class="w-full" placeholder="Enter site location" list="siteOptions" />
                <datalist id="siteOptions">
                  <option v-for="site in uniqueSites" :key="site" :value="site" />
                </datalist>
              </UFormField>

              <UFormField label="Category">
                <USelect v-model="newEmployee.category" :items="categoryOptions" class="w-full" />
              </UFormField>

              <UFormField label="Status">
                <USelect v-model="newEmployee.status" :items="statusOptions" class="w-full" />
              </UFormField>

              <UFormField label="Date of Exit">
                <UInput type="date" v-model="newEmployee.dateOfExit" class="w-full" />
              </UFormField>

              <UFormField label="Exit Remarks">
                <UInput v-model="newEmployee.doeRem" class="w-full" placeholder="Enter exit remarks" />
              </UFormField>

            </div>
          </div>

          <!-- IFSC footer notification -->
          <Transition name="slide-fade">
            <div
              v-if="showFooterNotification"
              class="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-white text-sm text-center font-medium"
            >
              {{ footerNotification }}
            </div>
          </Transition>

          <!-- Footer -->
          <template #footer>
            <div class="bg-gradient-to-r from-indigo-600 to-teal-500 px-6 py-4 flex justify-end gap-2 rounded-b-xl">
              <UButton color="error" variant="soft" icon="i-lucide-x" @click="showAddModal = false">
                Cancel
              </UButton>
              <UButton color="primary" icon="i-lucide-check" @click="addEmployee">
                Save
              </UButton>
            </div>
          </template>

        </UCard>
      </template>
    </UModal>

    <!-- ── Child modals (props/events unchanged) ────────────────────── -->
    <MasterRollExportModal
      :show="showExportModal"
      :employees="employees"
      :current-filters="columnFilters"
      :search-term="searchTerm"
      :unique-projects="uniqueProjects"
      :unique-sites="uniqueSites"
      @close="showExportModal = false"
      @export-complete="handleExportComplete"
    />

    <BulkEditModal
      :show="showBulkEditModal"
      :employees="filteredEmployees"
      :unique-categories="uniqueCategories"
      :unique-projects="uniqueProjects"
      :unique-sites="uniqueSites"
      @close="showBulkEditModal = false"
      @success="handleBulkEditSuccess"
    />

  </div>
</template>

<script setup lang="ts">
// ─── Imports (only what cannot be auto-imported) ──────────────────────────────
import ExcelIcon from '~/components/icons/ExcelIcon.vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'
import { usePageTitle } from '~/composables/ui/usePageTitle'
// EmployeeWageHistory, MasterRollExportModal, BulkEditModal → auto-imported from ~/components/

// ─── Page meta + composables ──────────────────────────────────────────────────
definePageMeta({
  requiresAuth: true,
  middleware: [
    function () {
      const { isLoggedIn } = useAuth()
      if (!isLoggedIn.value) {
        return navigateTo('/auth')
      }
    }
  ]
})

usePageTitle('Master Roll', 'Employee master roll management')

const api  = useApiWithAuth()
const toast = useToast()

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  _id: string
  employeeName: string
  fatherHusbandName: string
  dateOfBirth: string
  dateOfJoining: string
  dateOfExit: string
  doeRem: string
  aadhar: string
  phoneNo: string
  address: string
  bank: string
  branch: string
  accountNo: string
  ifsc: string
  category: string
  project: string
  site: string
  sKalyanNo: string
  pan: string
  uan: string
  esicNo: string
  pDayWage: string | number
  status: string
}

type FilterKey =
  | 'employeeName' | 'fatherHusbandName' | 'phoneNo' | 'dateOfJoining'
  | 'status' | 'category' | 'project' | 'site'

// ─── Static option lists ──────────────────────────────────────────────────────
const categoryOptions = [
  { label: 'HELPER',        value: 'HELPER' },
  { label: 'TECHNICIAN',    value: 'TECHNICIAN' },
  { label: 'ELECTRICIAN',   value: 'ELECTRICIAN' },
  { label: 'SEMI-SKILLED',  value: 'SEMI-SKILLED' },
  { label: 'HIGHLY-SKILLED',value: 'HIGHLY-SKILLED' },
]

const statusOptions = [
  { label: 'Active',       value: 'active' },
  { label: 'Inactive',     value: 'inactive' },
  { label: 'On Leave',     value: 'on Leave' },
  { label: 'Terminated',   value: 'terminated' },
  { label: 'Left Service', value: 'left' },
]

// Column definitions driving both the <th> loop and the filter/sort logic
const tableColumns: { key: FilterKey; label: string }[] = [
  { key: 'employeeName',      label: 'Employee Name' },
  { key: 'fatherHusbandName', label: 'Father/Husband Name' },
  { key: 'phoneNo',           label: 'Phone' },
  { key: 'dateOfJoining',     label: 'Date of Joining' },
  { key: 'status',            label: 'Status' },
  { key: 'category',          label: 'Category' },
  { key: 'project',           label: 'Project' },
  { key: 'site',              label: 'Site' },
]

// ─── Reactive state ───────────────────────────────────────────────────────────
const employees       = ref<Employee[]>([])
const showEditModal   = ref(false)
const showAddModal    = ref(false)
const showExportModal = ref(false)
const showBulkEditModal = ref(false)
const searchTerm      = ref('')

// Editing
const editingEmployee = reactive<Employee & { _id: string }>({
  _id: '', employeeName: '', fatherHusbandName: '', dateOfBirth: '',
  dateOfJoining: '', dateOfExit: '', doeRem: '', aadhar: '', phoneNo: '',
  address: '', bank: '', branch: '', accountNo: '', ifsc: '', category: '',
  project: '', site: '', sKalyanNo: '', pan: '', uan: '', esicNo: '',
  pDayWage: '', status: 'active',
})

// Sorting
const sortField     = ref<string>('dateOfJoining')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Filters
const emptyFilters = (): Record<FilterKey, string[]> => ({
  employeeName: [], fatherHusbandName: [], phoneNo: [], dateOfJoining: [],
  status: [], category: [], project: [], site: [],
})
const columnFilters = ref<Record<FilterKey, string[]>>(emptyFilters())
const filterOptions = ref<Record<FilterKey, string[]>>(emptyFilters())

// IFSC auto-fill
const fetchingBankDetails = ref(false)
const ifscError  = ref('')
const ifscValid  = ref(false)
const ifscTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Footer notification (for IFSC autofill feedback inside Add modal)
const footerNotification     = ref('')
const showFooterNotification = ref(false)
const footerNotificationTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Wage history
const showWageHistory    = ref(false)
const wageHistory        = ref<any[]>([])
const loadingWageHistory = ref(false)

// Appointment letter
const isGeneratingDocument = ref(false)

// ─── New employee defaults ────────────────────────────────────────────────────
const newEmployeeDefaults = {
  employeeName: '', fatherHusbandName: '', dateOfBirth: '', dateOfJoining: '',
  aadhar: '', pan: '', phoneNo: '', address: '', bank: '', branch: '',
  accountNo: '', ifsc: '', uan: '', esicNo: '', sKalyanNo: '',
  category: 'HELPER', pDayWage: 0, project: '', site: '',
  dateOfExit: '', doeRem: '', status: 'active',
}
const newEmployee = ref({ ...newEmployeeDefaults })

// ─── Computed ─────────────────────────────────────────────────────────────────
const hasActiveFilters = computed(() =>
  Object.values(columnFilters.value).some(f => f.length > 0)
)

const filteredEmployees = computed(() => {
  let result = employees.value

  // Global search
  if (searchTerm.value) {
    const s = searchTerm.value.toLowerCase()
    result = result.filter(e =>
      e.employeeName?.toLowerCase().includes(s) ||
      e.fatherHusbandName?.toLowerCase().includes(s) ||
      e.phoneNo?.toLowerCase().includes(s) ||
      e.category?.toLowerCase().includes(s) ||
      e.status?.toLowerCase().includes(s) ||
      e.project?.toLowerCase().includes(s) ||
      e.site?.toLowerCase().includes(s)
    )
  }

  // Per-column checkbox filters
  for (const col of tableColumns) {
    const active = columnFilters.value[col.key]
    if (active.length === 0) continue
    result = result.filter(e => {
      if (col.key === 'dateOfJoining') return active.includes(formatDate(e.dateOfJoining))
      return active.includes(e[col.key] as string)
    })
  }

  // Sort
  return [...result].sort((a, b) => {
    if (sortField.value === 'dateOfJoining') {
      const da = new Date(a.dateOfJoining || 0).getTime()
      const db = new Date(b.dateOfJoining || 0).getTime()
      return sortDirection.value === 'asc' ? da - db : db - da
    }
    const va = String(a[sortField.value as keyof Employee] ?? '').toLowerCase()
    const vb = String(b[sortField.value as keyof Employee] ?? '').toLowerCase()
    return sortDirection.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })
})

const uniqueBanks      = computed(() => [...new Set(employees.value.map(e => e.bank).filter(Boolean))].sort())
const uniqueCategories = computed(() => [...new Set(employees.value.map(e => e.category).filter(Boolean))].sort())
const uniqueProjects   = computed(() => [...new Set(employees.value.map(e => e.project).filter(Boolean))].sort())
const uniqueSites      = computed(() => [...new Set(employees.value.map(e => e.site).filter(Boolean))].sort())

// UDropdownMenu items for Appointment Letter
const letterFormatItems = computed(() => [[
  {
    label: 'PDF Format',
    icon: 'i-lucide-file-text',
    onSelect: () => generateAppointmentLetter(editingEmployee, 'pdf'),
  },
  {
    label: 'DOCX Format',
    icon: 'i-lucide-file',
    onSelect: () => generateAppointmentLetter(editingEmployee, 'docx'),
  },
]])

// ─── Helpers ──────────────────────────────────────────────────────────────────
const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  toast.add({
    title: type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error',
    description: message,
    color: type,
  })
}

const formatDate = (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`
}

const formatDateForInput = (date: string) => {
  if (!date) return ''
  try { return new Date(date).toISOString().split('T')[0] }
  catch { return '' }
}

const isValidPhoneNumber = (phoneNo: string) => {
  if (!phoneNo) return false
  const clean = phoneNo.toString().replace(/\D/g, '')
  const invalid = [/^(\d)\1{9}$/, /^123456789\d$/, /^987654321\d$/]
  if (invalid.some(p => p.test(clean))) return false
  if (clean.length === 10) return /^[6-9]/.test(clean)
  if (clean.length === 11) return /^\d/.test(clean)
  return false
}

const statusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':    return 'success'
    case 'inactive':  return 'warning'
    case 'on leave':  return 'info'
    case 'terminated':
    case 'left':      return 'error'
    default:          return 'neutral'
  }
}

// ─── Sort / Filter actions ────────────────────────────────────────────────────
const toggleSort = (field: string) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

const applyFilter = (column: FilterKey, value: string) => {
  const idx = columnFilters.value[column].indexOf(value)
  if (idx > -1) columnFilters.value[column].splice(idx, 1)
  else columnFilters.value[column].push(value)
}

const clearColumnFilter = (column: FilterKey) => { columnFilters.value[column] = [] }

const resetAllFilters = () => { columnFilters.value = emptyFilters() }

const updateFilterOptions = () => {
  const u: Record<FilterKey, string[]> = {
    employeeName:      [...new Set(employees.value.map(e => e.employeeName || '').filter(Boolean))],
    fatherHusbandName: [...new Set(employees.value.map(e => e.fatherHusbandName || '').filter(Boolean))],
    phoneNo:           [...new Set(employees.value.map(e => e.phoneNo || '').filter(Boolean))],
    dateOfJoining:     [...new Set(employees.value.map(e => formatDate(e.dateOfJoining)).filter(Boolean))],
    status:            [...new Set(employees.value.map(e => e.status || 'Active').filter(Boolean))],
    category:          [...new Set(employees.value.map(e => e.category || '').filter(Boolean))],
    project:           [...new Set(employees.value.map(e => e.project || '').filter(Boolean))],
    site:              [...new Set(employees.value.map(e => e.site || '').filter(Boolean))],
  }
  for (const k of Object.keys(u) as FilterKey[]) {
    if (k === 'dateOfJoining') {
      u[k].sort((a, b) =>
        new Date(a.split('-').reverse().join('-')).getTime() -
        new Date(b.split('-').reverse().join('-')).getTime()
      )
    } else {
      u[k].sort((a, b) => a.localeCompare(b))
    }
  }
  filterOptions.value = u
}

// ─── API functions ────────────────────────────────────────────────────────────
const fetchEmployees = async () => {
  try {
    const response = await api.get('/api/master-roll')
    console.log('API Response (/api/master-roll):', response)
    employees.value = response.employees as Employee[]
    updateFilterOptions()
  } catch (error) {
    console.error('Error fetching employees:', error)
    notify('Failed to load employees. Please refresh the page.', 'error')
  }
}

const editEmployee = (employee: Employee) => {
  Object.assign(editingEmployee, employee)
  showEditModal.value = true
  showWageHistory.value = false
  wageHistory.value = []
}

const updateEmployee = async () => {
  try {
    await api.put(`/api/master-roll/${editingEmployee._id}`, editingEmployee)
    showEditModal.value = false
    const response = await api.get('/api/master-roll')
    employees.value = response.employees as Employee[]
    updateFilterOptions()
    notify('Employee updated successfully')
  } catch (error) {
    console.error('Error updating employee:', error)
    notify('Failed to update employee', 'error')
  }
}

const deleteEmployee = async (id: string) => {
  if (!confirm('Are you sure you want to delete this employee?')) return
  try {
    await api.delete(`/api/master-roll/${id}`)
    const response = await api.get('/api/master-roll')
    employees.value = response.employees as Employee[]
    updateFilterOptions()
  } catch (error) {
    console.error('Error deleting employee:', error)
    notify('Failed to delete employee', 'error')
  }
}

const addEmployee = async () => {
  try {
    const response = await api.post('/api/master-roll', newEmployee.value)
    if (response.success) {
      employees.value.push(response.data)
      updateFilterOptions()
      showAddModal.value = false
      newEmployee.value = { ...newEmployeeDefaults }
      notify('Employee added successfully')
    } else {
      notify(response.message || 'Failed to add employee', 'error')
    }
  } catch (error: any) {
    notify(error.message || 'An error occurred', 'error')
  }
}

// ─── File upload / download ───────────────────────────────────────────────────
const triggerDownload = (blob: Blob, filename: string) => {
  const url  = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const downloadTemplate = async () => {
  toast.add({ title: 'Template Colour Scheme', description: 'Red headers = Required fields · Orange headers = Optional fields', color: 'info', duration: 6000 })
  try {
    const response = await api.fetchWithAuth('/api/master-roll/template', { method: 'GET' })
    triggerDownload(
      new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'MasterRollTemplate.xlsx'
    )
  } catch (error) {
    notify('Failed to download template', 'error')
  }
}

const downloadMasterRoll = async () => {
  try {
    const response = await api.fetchWithAuth('/api/master-roll/download', { method: 'GET', responseType: 'blob' })
    triggerDownload(
      new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'master_roll.xlsx'
    )
  } catch (error) {
    console.error('Error downloading master roll:', error)
    notify('Failed to download master roll', 'error')
  }
}

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    await api.fetchWithAuth('/api/master-roll/upload', { method: 'POST', body: formData })
    const updatedData = await api.get('/api/master-roll')
    employees.value = updatedData.employees as Employee[]
    updateFilterOptions()
    notify('Employees uploaded successfully')
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || 'Failed to upload employees'
    notify(msg, 'error')
  } finally {
    if (event.target) (event.target as HTMLInputElement).value = ''
  }
}

// ─── Wage history ─────────────────────────────────────────────────────────────
const toggleWageHistory = async () => {
  showWageHistory.value = !showWageHistory.value
  if (showWageHistory.value && wageHistory.value.length === 0 && !loadingWageHistory.value) {
    await fetchWageHistory()
  }
}

const fetchWageHistory = async () => {
  if (!editingEmployee._id) return
  loadingWageHistory.value = true
  try {
    const response = await api.get(`/api/wages/employee-history/${editingEmployee._id}`)
    if (response.success) wageHistory.value = response.wageHistory
    else notify('Failed to load wage history', 'error')
  } catch {
    notify('Failed to load wage history', 'error')
  } finally {
    loadingWageHistory.value = false
  }
}

// ─── IFSC auto-fill ───────────────────────────────────────────────────────────
const showFooterMessage = (message: string, duration = 10_000) => {
  if (footerNotificationTimeout.value) clearTimeout(footerNotificationTimeout.value)
  footerNotification.value      = message
  showFooterNotification.value  = true
  footerNotificationTimeout.value = setTimeout(() => {
    showFooterNotification.value = false
    footerNotification.value     = ''
  }, duration)
}

const handleIfscInput = (event: Event) => {
  const ifsc = (event.target as HTMLInputElement).value.toUpperCase()
  newEmployee.value.ifsc = ifsc
  ifscError.value = ''
  ifscValid.value = false
  if (ifscTimeout.value) clearTimeout(ifscTimeout.value)
  if (ifsc.length === 11) {
    ifscTimeout.value = setTimeout(() => fetchBankDetailsByIfsc(ifsc), 500)
  } else if (ifsc.length > 11) {
    ifscError.value = 'IFSC code must be exactly 11 characters'
  }
}

const validateIfsc = () => {
  if (newEmployee.value.ifsc && newEmployee.value.ifsc.length !== 11) {
    ifscError.value = 'IFSC code must be exactly 11 characters'
  }
}

const fetchBankDetailsByIfsc = async (ifsc: string) => {
  if (ifsc.length !== 11) return
  fetchingBankDetails.value = true
  ifscError.value = ''
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`)
    if (!res.ok) throw new Error('Invalid IFSC code')
    const data = await res.json()
    newEmployee.value.bank   = data.BANK   || ''
    newEmployee.value.branch = data.BRANCH || ''
    ifscValid.value = true
    showFooterMessage(`✅ Bank details auto-filled: ${data.BANK} — ${data.BRANCH}`)
  } catch (error: any) {
    ifscError.value = 'Invalid IFSC code or unable to fetch bank details'
    ifscValid.value = false
    showFooterMessage(`❌ Error: ${error.message}`, 5_000)
  } finally {
    fetchingBankDetails.value = false
  }
}

// ─── Appointment letter ───────────────────────────────────────────────────────
const generateAppointmentLetter = async (employee: any, format = 'pdf') => {
  isGeneratingDocument.value = true
  try {
    const url = format === 'docx'
      ? `/api/master-roll/generate-letter-docx?employeeId=${employee._id}`
      : `/api/master-roll/generate-letter?employeeId=${employee._id}`
    const link = document.createElement('a')
    link.href  = url
    const ext  = format === 'docx' ? 'docx' : 'pdf'
    link.setAttribute('download', `Appointment_Letter_${employee.employeeName.replace(/\s+/g, '_')}.${ext}`)
    document.body.appendChild(link)
    link.click()
    setTimeout(() => link.remove(), 100)
    notify(`Appointment letter generated in ${format.toUpperCase()} format`)
  } catch (error: any) {
    notify('Failed to generate appointment letter: ' + (error.message || 'Unknown error'), 'error')
  } finally {
    isGeneratingDocument.value = false
  }
}

// ─── Export / Bulk-edit completion handlers ───────────────────────────────────
const handleExportComplete = (result: { success: boolean; error?: string }) => {
  if (result.success) notify('Data exported successfully')
  else notify(result.error || 'Export failed', 'error')
}

const handleBulkEditSuccess = async (result: { updatedCount: number; fieldsUpdated: string[] }) => {
  try {
    await fetchEmployees()
    notify(`Successfully updated ${result.updatedCount} employees`)
    showBulkEditModal.value = false
  } catch {
    notify('Bulk edit completed but failed to refresh data. Please reload the page.', 'warning')
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => fetchEmployees())

onUnmounted(() => {
  if (ifscTimeout.value)             clearTimeout(ifscTimeout.value)
  if (footerNotificationTimeout.value) clearTimeout(footerNotificationTimeout.value)
})
</script>

<style scoped>
/* Wage-history slide transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
</style>