<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Employee Advances</h1>

    <div class="mb-4">
      <!-- Add New Advance Button -->
      <button
        @click="openAddModal"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
      >
        Add New Advance
      </button>
    </div>

    <!-- Advances Table -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="loading">
            <td colspan="7" class="px-6 py-4 text-center">Loading...</td>
          </tr>
          <tr v-else-if="advances.length === 0">
            <td colspan="7" class="px-6 py-4 text-center">No advances found</td>
          </tr>
          <tr v-for="advance in advances" :key="advance._id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">{{ advance.employeeName }}</td>
            <td class="px-6 py-4 whitespace-nowrap">₹{{ advance.amount.toFixed(2) }}</td>
            <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(advance.date) }}</td>
            <td class="px-6 py-4 whitespace-nowrap">{{ advance.purpose }}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusClass(advance.status)">
                {{ formatStatus(advance.status) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">₹{{ advance.remainingBalance.toFixed(2) }}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <button
                @click="viewAdvance(advance)"
                class="text-blue-600 hover:text-blue-900 mr-2"
              >
                View
              </button>
              <button
                v-if="advance.status === 'pending' || advance.status === 'approved'"
                @click="editAdvance(advance)"
                class="text-green-600 hover:text-green-900 mr-2"
              >
                Edit
              </button>
              <button
                v-if="advance.status === 'pending'"
                @click="deleteAdvance(advance._id)"
                class="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex justify-between items-center">
      <div>
        Showing {{ advances.length }} of {{ pagination.total }} advances
      </div>
      <div class="flex space-x-2">
        <button
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          class="px-3 py-1 rounded border"
          :class="pagination.page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'"
        >
          Previous
        </button>
        <button
          @click="changePage(pagination.page + 1)"
          :disabled="pagination.page === pagination.pages"
          class="px-3 py-1 rounded border"
          :class="pagination.page === pagination.pages ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Add/Edit Advance Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4">{{ editingAdvance._id ? 'Edit Advance' : 'Add New Advance' }}</h2>

        <form @submit.prevent="saveAdvance">
          <!-- Employee Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <div class="relative" ref="employeeDropdownRef">
              <input
                type="text"
                v-model="searchEmployeeName"
                class="w-full px-3 py-2 border rounded-md"
                placeholder="Search employee by name"
                @input="filterEmployees"
                @focus="handleInputFocus"
                @keydown="handleKeyDown"
                @blur="handleBlur"
              />

              <!-- Selected employee display -->
              <div v-if="editingAdvance.masterRollId" class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div class="font-medium text-blue-800">{{ selectedEmployeeName }}</div>
                <div class="flex mt-1 text-xs">
                  <div class="bg-green-100 text-green-800 px-2 py-1 rounded mr-2">
                    {{ getEmployeeById(editingAdvance.masterRollId)?.category || 'N/A' }}
                  </div>
                  <div v-if="getEmployeeById(editingAdvance.masterRollId)?.project" class="bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2">
                    Project: {{ getEmployeeById(editingAdvance.masterRollId)?.project }}
                  </div>
                  <div v-if="getEmployeeById(editingAdvance.masterRollId)?.site" class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Site: {{ getEmployeeById(editingAdvance.masterRollId)?.site }}
                  </div>
                </div>
              </div>

              <!-- Employee dropdown -->
              <div
                v-if="showEmployeeDropdown && filteredEmployees.length > 0"
                ref="dropdownContainerRef"
                class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm"
              >
                <div
                  v-for="(employee, index) in filteredEmployees"
                  :key="employee._id"
                  :ref="el => { if (highlightedIndex === index) highlightedItemRef = el }"
                  @click="selectEmployee(employee)"
                  @mouseover="highlightedIndex = index"
                  class="cursor-pointer transition-colors duration-150 ease-in-out"
                  :class="{ 'bg-blue-50': highlightedIndex === index, 'hover:bg-gray-100': highlightedIndex !== index }"
                >
                  <div class="px-4 py-2 border-l-4" :class="getEmployeeBorderColor(employee)">
                    <div class="font-medium">{{ employee.employeeName }}</div>
                    <div class="flex mt-1 text-xs">
                      <div class="bg-green-100 text-green-800 px-2 py-1 rounded mr-2">
                        {{ employee.category || 'N/A' }}
                      </div>
                      <div v-if="employee.project" class="bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2">
                        Project: {{ employee.project }}
                      </div>
                      <div v-if="employee.site" class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Site: {{ employee.site }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No results message -->
              <div
                v-if="showEmployeeDropdown && searchEmployeeName && filteredEmployees.length === 0"
                class="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-3 px-4 text-center text-gray-500"
              >
                No employees found matching "{{ searchEmployeeName }}"
              </div>
            </div>

            <!-- Error message -->
            <div v-if="!editingAdvance.masterRollId" class="text-xs text-red-500 mt-1">
              Please select an employee from the list
            </div>
          </div>

          <!-- Amount -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              v-model="editingAdvance.amount"
              class="w-full px-3 py-2 border rounded-md"
              required
              min="1"
              step="0.01"
            />
          </div>

          <!-- Date -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              v-model="editingAdvance.date"
              class="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <!-- Purpose -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <input
              type="text"
              v-model="editingAdvance.purpose"
              class="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <!-- Repayment Terms -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Installment (₹)</label>
            <input
              type="number"
              v-model="editingAdvance.repaymentTerms.installmentAmount"
              class="w-full px-3 py-2 border rounded-md"
              required
              min="1"
              step="0.01"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Duration (Months)</label>
            <input
              type="number"
              v-model="editingAdvance.repaymentTerms.durationMonths"
              class="w-full px-3 py-2 border rounded-md"
              required
              min="1"
            />
          </div>

          <!-- Status (only for editing) -->
          <div v-if="editingAdvance._id" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="editingAdvance.status"
              class="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option v-if="editingAdvance.amount !== editingAdvance.remainingBalance" value="partially_recovered">Partially Recovered</option>
              <option v-if="editingAdvance.remainingBalance === 0" value="fully_recovered">Fully Recovered</option>
            </select>
          </div>

          <!-- Buttons -->
          <div class="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              @click="showAddModal = false"
              class="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Advance Modal -->
    <div v-if="showViewModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
        <h2 class="text-xl font-bold mb-4">Advance Details</h2>

        <div v-if="selectedAdvance" class="mb-6">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p class="text-sm text-gray-500">Employee</p>
              <p class="font-medium">{{ selectedAdvance.employeeName }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Amount</p>
              <p class="font-medium">₹{{ selectedAdvance.amount.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Date</p>
              <p class="font-medium">{{ formatDate(selectedAdvance.date) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Purpose</p>
              <p class="font-medium">{{ selectedAdvance.purpose }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Status</p>
              <p class="font-medium">
                <span :class="getStatusClass(selectedAdvance.status)">
                  {{ formatStatus(selectedAdvance.status) }}
                </span>
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Remaining Balance</p>
              <p class="font-medium">₹{{ selectedAdvance.remainingBalance.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Monthly Installment</p>
              <p class="font-medium">₹{{ selectedAdvance.repaymentTerms.installmentAmount.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Duration</p>
              <p class="font-medium">{{ selectedAdvance.repaymentTerms.durationMonths }} months</p>
            </div>
          </div>

          <h3 class="text-lg font-semibold mb-2">Recovery History</h3>

          <div v-if="recoveries.length === 0" class="text-center py-4 bg-gray-50 rounded">
            No recoveries recorded yet
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="recovery in recoveries" :key="recovery._id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(recovery.recoveryDate) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">₹{{ recovery.recoveryAmount.toFixed(2) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">{{ formatRecoveryMethod(recovery.recoveryMethod) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">{{ recovery.remarks || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <button
                      @click="deleteRecovery(recovery._id)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 flex space-x-2">
            <button
              @click="showAddRecoveryModal = true"
              class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              :disabled="selectedAdvance.remainingBalance === 0"
            >
              Add Recovery
            </button>
            <button
              @click="recalculateAdvanceBalance"
              class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              :disabled="recalculateLoading"
            >
              {{ recalculateLoading ? 'Recalculating...' : 'Recalculate Balance' }}
            </button>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            @click="showViewModal = false"
            class="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Add Recovery Modal -->
    <div v-if="showAddRecoveryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4">Add Recovery</h2>

        <form @submit.prevent="saveRecovery">
          <!-- Amount -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Recovery Amount (₹)</label>
            <input
              type="number"
              v-model="newRecovery.recoveryAmount"
              class="w-full px-3 py-2 border rounded-md"
              required
              min="1"
              :max="selectedAdvance?.remainingBalance"
              step="0.01"
            />
            <p class="text-sm text-gray-500 mt-1">
              Maximum: ₹{{ selectedAdvance?.remainingBalance.toFixed(2) }}
            </p>
          </div>

          <!-- Date -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Recovery Date</label>
            <input
              type="date"
              v-model="newRecovery.recoveryDate"
              class="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <!-- Method -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Recovery Method</label>
            <select
              v-model="newRecovery.recoveryMethod"
              class="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="salary_deduction">Salary Deduction</option>
              <option value="direct_payment">Direct Payment</option>
            </select>
          </div>

          <!-- Remarks -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              v-model="newRecovery.remarks"
              class="w-full px-3 py-2 border rounded-md"
              rows="2"
            ></textarea>
          </div>

          <!-- Buttons -->
          <div class="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              @click="showAddRecoveryModal = false"
              class="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

// State variables
const advances = ref([]);
const employees = ref([]);
const loading = ref(true);
const recalculateLoading = ref(false);
const showAddModal = ref(false);
const showViewModal = ref(false);
const showAddRecoveryModal = ref(false);
const selectedAdvance = ref(null);
const recoveries = ref([]);
const selectedEmployeeName = ref('');
const searchEmployeeName = ref('');
const filteredEmployees = ref([]);
const showEmployeeDropdown = ref(false);
const highlightedIndex = ref(-1); // For keyboard navigation
const dropdownContainerRef = ref(null); // Reference to the dropdown container
let highlightedItemRef = null; // Reference to the highlighted item

// Pagination
const pagination = reactive({
  total: 0,
  page: 1,
  limit: 10,
  pages: 1
});

// Form data
const editingAdvance = reactive({
  _id: '',
  masterRollId: '',
  amount: 0,
  date: '',
  purpose: '',
  repaymentTerms: {
    installmentAmount: 0,
    durationMonths: 1
  },
  status: 'pending',
  remainingBalance: 0
});

const newRecovery = reactive({
  recoveryAmount: 0,
  recoveryDate: new Date().toISOString().split('T')[0],
  recoveryMethod: 'salary_deduction',
  remarks: ''
});

// Employee dropdown ref for click outside detection
const employeeDropdownRef = ref(null);

// Fetch data and setup event listeners
onMounted(async () => {
  await Promise.all([
    fetchAdvances(),
    fetchEmployees()
  ]);

  // Add click outside listener
  document.addEventListener('click', handleClickOutside);
});

// Remove event listeners
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Handle click outside to close employee dropdown
function handleClickOutside(event) {
  if (employeeDropdownRef.value && !employeeDropdownRef.value.contains(event.target)) {
    showEmployeeDropdown.value = false;
  }
}

// Fetch advances with pagination
async function fetchAdvances() {
  loading.value = true;
  try {
    const api = useApiWithAuth();
    const data = await api.get(`/api/employee-advances?page=${pagination.page}&limit=${pagination.limit}`);

    advances.value = data.advances;
    pagination.total = data.pagination.total;
    pagination.pages = data.pagination.pages;
  } catch (error) {
    // Show error notification
    alert('Error loading advances. Please try again.');
  } finally {
    loading.value = false;
  }
}

// Fetch employees for dropdown
async function fetchEmployees() {
  try {
    const api = useApiWithAuth();
    const data = await api.get('/api/master-roll');

    if (data && data.employees) {
      employees.value = data.employees;
      // Initialize filtered employees with first 10
      filteredEmployees.value = employees.value.slice(0, 10);
    } else {
      alert('No employees found. Please add employees first.');
    }
  } catch (error) {
    // Show error notification
    alert('Error loading employees. Please try again.');
  }
}

// Change page
function changePage(page) {
  if (page < 1 || page > pagination.pages) return;

  pagination.page = page;
  fetchAdvances();
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Format status
function formatStatus(status) {
  switch (status) {
    case 'pending': return 'Pending';
    case 'approved': return 'Approved';
    case 'paid': return 'Paid';
    case 'partially_recovered': return 'Partially Recovered';
    case 'fully_recovered': return 'Fully Recovered';
    default: return status;
  }
}

// Format recovery method
function formatRecoveryMethod(method) {
  switch (method) {
    case 'salary_deduction': return 'Salary Deduction';
    case 'direct_payment': return 'Direct Payment';
    default: return method;
  }
}

// Get status class for styling
function getStatusClass(status) {
  switch (status) {
    case 'pending': return 'px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800';
    case 'approved': return 'px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800';
    case 'paid': return 'px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800';
    case 'partially_recovered': return 'px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800';
    case 'fully_recovered': return 'px-2 py-1 rounded-full text-xs bg-green-100 text-green-800';
    default: return '';
  }
}

// View advance details
async function viewAdvance(advance) {
  selectedAdvance.value = advance;
  showViewModal.value = true;

  try {
    const api = useApiWithAuth();
    const data = await api.get(`/api/employee-advances/${advance._id}`);

    // Update with the latest data
    selectedAdvance.value = data.advance;
    recoveries.value = data.recoveries;
  } catch (error) {
    // Show error notification
    alert('Error loading advance details. Please try again.');
  }
}

// Edit advance
function editAdvance(advance) {
  // Reset form
  Object.assign(editingAdvance, {
    _id: advance._id,
    masterRollId: advance.masterRollId,
    amount: advance.amount,
    date: new Date(advance.date).toISOString().split('T')[0],
    purpose: advance.purpose,
    repaymentTerms: {
      installmentAmount: advance.repaymentTerms.installmentAmount,
      durationMonths: advance.repaymentTerms.durationMonths
    },
    status: advance.status,
    remainingBalance: advance.remainingBalance
  });

  // Find employee for the selected advance
  const employee = employees.value.find(emp => emp._id === advance.masterRollId);

  // Set employee selection values
  selectedEmployeeName.value = employee ? employee.employeeName : '';
  searchEmployeeName.value = employee ? employee.employeeName : '';
  showEmployeeDropdown.value = false;
  highlightedIndex.value = -1;

  // Initialize filtered employees with first 10
  filteredEmployees.value = employees.value.slice(0, 10);

  showAddModal.value = true;
}

// Save advance
async function saveAdvance() {
  try {
    // Validate that an employee is selected
    if (!editingAdvance.masterRollId) {
      alert('Please select a valid employee from the list');
      return;
    }

    const api = useApiWithAuth();
    let data;

    // If editing existing advance
    if (editingAdvance._id) {
      data = await api.put(`/api/employee-advances/${editingAdvance._id}`, editingAdvance);
    } else {
      data = await api.post('/api/employee-advances', editingAdvance);
    }

    if (data.success) {
      // Close modal and refresh data
      showAddModal.value = false;
      await fetchAdvances();

      // Reset form
      resetAdvanceForm();
      selectedEmployeeName.value = '';
      searchEmployeeName.value = '';
      showEmployeeDropdown.value = false;
      highlightedIndex.value = -1;
    } else {
      // Show error notification
      alert(data.message || 'Failed to save advance');
    }
  } catch (error) {
    // Show error notification
    alert('An error occurred while saving the advance. Please try again.');
  }
}

// Delete advance
async function deleteAdvance(id) {
  if (!confirm('Are you sure you want to delete this advance?')) return;

  try {
    const api = useApiWithAuth();
    const data = await api.delete(`/api/employee-advances/${id}`);

    if (data.success) {
      // Refresh data
      await fetchAdvances();
    } else {
      // Show error notification
      alert(data.message || 'Failed to delete advance');
    }
  } catch (error) {
    // Show error notification
    alert('An error occurred while deleting the advance. Please try again.');
  }
}

// Save recovery
async function saveRecovery() {
  try {
    const payload = {
      ...newRecovery,
      advanceId: selectedAdvance.value._id
    };

    const api = useApiWithAuth();
    const data = await api.post('/api/employee-advances/recoveries', payload);

    if (data.success) {
      // Close modal and refresh data
      showAddRecoveryModal.value = false;

      // Update the selected advance with new balance and status
      selectedAdvance.value.remainingBalance = data.remainingBalance;
      selectedAdvance.value.status = data.status;

      // Refresh recoveries list
      await viewAdvance(selectedAdvance.value);

      // Also refresh the main advances list
      await fetchAdvances();

      // Reset form
      resetRecoveryForm();
    } else {
      // Show error notification
      alert(data.message || 'Failed to save recovery');
    }
  } catch (error) {
    // Show error notification
    alert('An error occurred while saving the recovery. Please try again.');
  }
}

// Delete recovery
async function deleteRecovery(id) {
  if (!confirm('Are you sure you want to delete this recovery?')) return;

  try {
    const api = useApiWithAuth();
    const data = await api.delete(`/api/employee-advances/recoveries/${id}`);

    if (data.success) {
      // Update the selected advance with new balance and status
      selectedAdvance.value.remainingBalance = data.remainingBalance;
      selectedAdvance.value.status = data.status;

      // Refresh recoveries list
      await viewAdvance(selectedAdvance.value);

      // Also refresh the main advances list
      await fetchAdvances();
    } else {
      // Show error notification
      alert(data.message || 'Failed to delete recovery');
    }
  } catch (error) {
    // Show error notification
    alert('An error occurred while deleting the recovery. Please try again.');
  }
}

// Recalculate advance balance
async function recalculateAdvanceBalance() {
  if (!selectedAdvance.value || !selectedAdvance.value._id) return;

  recalculateLoading.value = true;

  try {
    const api = useApiWithAuth();
    const data = await api.post(`/api/employee-advances/recalculate/${selectedAdvance.value._id}`);

    if (data.success) {
      // Update the selected advance with recalculated balance
      selectedAdvance.value = data.advance;

      // Show success message with details
      const message = `Balance recalculated successfully.\nPrevious: ₹${data.previousBalance.toFixed(2)}\nNew: ₹${data.newBalance.toFixed(2)}\nTotal Recovered: ₹${data.totalRecovered.toFixed(2)}`;
      alert(message);

      // Refresh recoveries list
      await viewAdvance(selectedAdvance.value);

      // Also refresh the main advances list
      await fetchAdvances();
    } else {
      // Show error notification
      alert(data.message || 'Failed to recalculate balance');
    }
  } catch (error) {
    // Show error notification
    alert('An error occurred while recalculating the balance. Please try again.');
  } finally {
    recalculateLoading.value = false;
  }
}

// Reset forms
function resetAdvanceForm() {
  Object.assign(editingAdvance, {
    _id: '',
    masterRollId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    repaymentTerms: {
      installmentAmount: 0,
      durationMonths: 1
    },
    status: 'pending',
    remainingBalance: 0
  });
}

function resetRecoveryForm() {
  Object.assign(newRecovery, {
    recoveryAmount: 0,
    recoveryDate: new Date().toISOString().split('T')[0],
    recoveryMethod: 'salary_deduction',
    remarks: ''
  });
}



// Open add modal and reset form
function openAddModal() {
  // Reset the form first
  resetAdvanceForm();

  // Set default date to today
  editingAdvance.date = new Date().toISOString().split('T')[0];

  // Reset employee selection
  selectedEmployeeName.value = '';
  searchEmployeeName.value = '';
  showEmployeeDropdown.value = false;
  highlightedIndex.value = -1;

  // Initialize filtered employees with first 10
  filteredEmployees.value = employees.value.slice(0, 10);

  // Show the modal
  showAddModal.value = true;
}

// Filter employees based on search input
function filterEmployees() {
  if (!searchEmployeeName.value) {
    filteredEmployees.value = employees.value.slice(0, 10); // Show first 10 by default
    return;
  }

  const search = searchEmployeeName.value.toLowerCase();
  filteredEmployees.value = employees.value.filter(emp =>
    emp.employeeName.toLowerCase().includes(search) ||
    (emp.project && emp.project.toLowerCase().includes(search)) ||
    (emp.site && emp.site.toLowerCase().includes(search))
  ).slice(0, 10); // Limit to 10 results for performance

  // Reset highlighted index when filtering
  highlightedIndex.value = -1;
}

// Handle input focus
function handleInputFocus() {
  showEmployeeDropdown.value = true;
  // Reset highlighted index
  highlightedIndex.value = -1;
}

// Handle input blur
function handleBlur() {
  // Use setTimeout to allow click events to fire before hiding dropdown
  setTimeout(() => {
    showEmployeeDropdown.value = false;
  }, 200);
}

// Handle keyboard navigation
function handleKeyDown(event) {
  if (!showEmployeeDropdown.value) {
    if (event.key === 'ArrowDown' || event.key === 'Down') {
      showEmployeeDropdown.value = true;
      event.preventDefault();
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
    case 'Down':
      event.preventDefault();
      if (highlightedIndex.value < filteredEmployees.value.length - 1) {
        highlightedIndex.value++;
      } else {
        highlightedIndex.value = 0; // Wrap around to the first item
      }
      ensureHighlightedVisible();
      break;

    case 'ArrowUp':
    case 'Up':
      event.preventDefault();
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--;
      } else {
        highlightedIndex.value = filteredEmployees.value.length - 1; // Wrap around to the last item
      }
      ensureHighlightedVisible();
      break;

    case 'Enter':
      event.preventDefault();
      if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredEmployees.value.length) {
        selectEmployee(filteredEmployees.value[highlightedIndex.value]);
      }
      break;

    case 'Escape':
      event.preventDefault();
      showEmployeeDropdown.value = false;
      break;
  }
}

// Ensure the highlighted item is visible in the dropdown
function ensureHighlightedVisible() {
  // Wait for the next tick to ensure the DOM has been updated
  setTimeout(() => {
    if (highlightedItemRef && dropdownContainerRef.value) {
      const container = dropdownContainerRef.value;
      const item = highlightedItemRef;

      // Get container and item dimensions
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Check if item is not visible
      if (itemRect.bottom > containerRect.bottom) {
        // Item is below the visible area, scroll down
        container.scrollTop += (itemRect.bottom - containerRect.bottom);
      } else if (itemRect.top < containerRect.top) {
        // Item is above the visible area, scroll up
        container.scrollTop -= (containerRect.top - itemRect.top);
      }
    }
  }, 0);
}

// Select an employee from the dropdown
function selectEmployee(employee) {
  editingAdvance.masterRollId = employee._id;
  selectedEmployeeName.value = employee.employeeName;
  searchEmployeeName.value = employee.employeeName;
  showEmployeeDropdown.value = false;
  highlightedIndex.value = -1;
}

// Get employee by ID
function getEmployeeById(id) {
  return employees.value.find(emp => emp._id === id) || null;
}

// Get border color based on employee category
function getEmployeeBorderColor(employee) {
  const category = employee.category?.toLowerCase() || '';

  if (category.includes('helper')) return 'border-blue-500';
  if (category.includes('mason')) return 'border-green-500';
  if (category.includes('carpenter')) return 'border-yellow-500';
  if (category.includes('labour')) return 'border-red-500';
  if (category.includes('supervisor')) return 'border-purple-500';

  // Default color based on first letter of name
  const firstChar = employee.employeeName.charAt(0).toLowerCase();
  const charCode = firstChar.charCodeAt(0);

  if (charCode < 'e'.charCodeAt(0)) return 'border-pink-500';
  if (charCode < 'j'.charCodeAt(0)) return 'border-orange-500';
  if (charCode < 'o'.charCodeAt(0)) return 'border-teal-500';
  if (charCode < 't'.charCodeAt(0)) return 'border-indigo-500';

  return 'border-gray-500';
}
</script>
