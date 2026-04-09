<template>
  <div class="container mx-auto px-4 py-4 pb-12">

    <!-- ── Hero Section ────────────────────────────────────────────── -->
    <div class="bg-gradient-to-br from-emerald-500 to-teal-600 py-12 px-6 rounded-2xl shadow-xl mb-12 relative overflow-hidden">
      <div class="absolute inset-0 bg-pattern opacity-10"></div>
      <div class="max-w-3xl mx-auto text-center relative z-10">
        <h1 class="text-4xl font-extrabold text-white sm:text-5xl tracking-tight">
          Document Management
        </h1>
        <p class="mt-4 text-xl text-teal-50 max-w-2xl mx-auto">
          Manage your important documents and track their validity
        </p>
      </div>
    </div>

    <!-- ── Document Management Interface ──────────────────────────── -->
    <UCard class="mb-8">
      <!-- Header row: title + action buttons -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-slate-800 dark:text-white">Your Documents</h2>
        <div class="flex gap-3 flex-wrap">
          <UButton
            color="primary"
            icon="i-lucide-bell"
            @click="triggerNotifications"
          >
            Send Notifications
          </UButton>

          <UButton
            color="success"
            icon="i-lucide-plus"
            @click="showAddDocumentModal = true"
          >
            Add Document
          </UButton>

          <UButton
            color="warning"
            icon="i-lucide-download"
            @click="downloadDocuments"
          >
            Download
          </UButton>
        </div>
      </div>

      <!-- Warning Banner for Expiring Documents -->
      <div
        v-if="expiringDocuments.length > 0"
        class="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-3 sm:p-4 mb-4 sm:mb-6"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-amber-500" />
          </div>
          <div class="ml-3">
            <p class="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
              <span class="font-medium">Warning:</span> You have {{ expiringDocuments.length }} document(s) expiring
              soon.
            </p>
          </div>
        </div>
      </div>

      <!-- Search Controls — always visible -->
      <div class="flex flex-col md:flex-row justify-between items-center mb-4 space-y-3 md:space-y-0 gap-3">
        <!-- Search input — ref kept for focus-restore after fetch -->
        <div class="w-full md:w-64">
          <UInput
            ref="searchInput"
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search documents…"
            class="w-full"
          />
        </div>

        <div class="flex gap-2 w-full md:w-auto">
          <!-- Sort field select -->
          <USelect
            v-model="sortBy"
            :items="sortByItems"
            class="w-full md:w-auto"
          />

          <!-- Sort direction toggle -->
          <UButton
            variant="outline"
            color="neutral"
            :icon="sortDirection === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
            :title="sortDirection === 'asc' ? 'Ascending — click to switch to descending' : 'Descending — click to switch to ascending'"
            @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
          />

          <!-- Clear search button — only visible when search is active -->
          <UButton
            v-if="searchQuery"
            variant="outline"
            color="neutral"
            icon="i-lucide-x"
            title="Clear search"
            @click="clearSearch"
          />
        </div>
      </div>

      <!-- ── Loading state ─────────────────────────────────────────── -->
      <div v-if="isLoading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-emerald-500" />
      </div>

      <!-- ── Empty states (search vs truly empty) ─────────────────── -->
      <div v-else-if="documents.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <UIcon name="i-lucide-file-x" class="mx-auto h-12 w-12 text-gray-400" />

        <!-- No results for active search -->
        <div v-if="searchQuery">
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents found</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No documents match your search for "{{ searchQuery }}"
          </p>
          <div class="mt-6 flex justify-center gap-3 flex-wrap">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-x"
              @click="clearSearch"
            >
              Clear Search
            </UButton>
            <UButton
              color="success"
              icon="i-lucide-plus"
              @click="showAddDocumentModal = true"
            >
              Add Document
            </UButton>
          </div>
        </div>

        <!-- No documents at all -->
        <div v-else>
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new document.</p>
          <div class="mt-6">
            <UButton
              color="success"
              icon="i-lucide-plus"
              @click="showAddDocumentModal = true"
            >
              Add Document
            </UButton>
          </div>
        </div>
      </div>

      <!-- ── Documents Table ───────────────────────────────────────── -->
      <div v-else>
        <div class="overflow-x-auto -mx-4 sm:-mx-0">
          <div class="inline-block min-w-full py-2 px-4 sm:px-0 align-middle">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Name
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Reference Number
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Start Date
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Value
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="doc in documents" :key="doc._id" class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">

                  <!-- Document Name -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    <div class="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{{ doc.name }}</div>
                  </td>

                  <!-- Reference Number -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 hidden sm:table-cell">
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-words max-w-[200px]">{{ doc.ref_no }}</div>
                  </td>

                  <!-- Description -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 hidden md:table-cell">
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-words max-w-[300px]">{{ doc.description || 'N/A' }}</div>
                  </td>

                  <!-- Start Date -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ formatDate(doc.startDate) }}</div>
                  </td>

                  <!-- Expiry Date -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ formatDate(doc.expiryDate) }}</div>
                  </td>

                  <!-- Value -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden md:table-cell">
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ doc.value ? formatCurrency(doc.value) : 'N/A' }}</div>
                  </td>

                  <!-- Expiry Status Badge -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    <UBadge
                      :color="getExpiryBadgeColor(doc)"
                      variant="soft"
                      size="sm"
                    >
                      {{ getExpiryStatus(doc) }}
                    </UBadge>
                  </td>

                  <!-- Actions -->
                  <td class="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right">
                    <div class="flex items-center justify-end gap-2 sm:gap-3">
                      <!-- View/Download File button — only shown if file exists -->
                      <UButton
                        v-if="doc.file"
                        :to="doc.file"
                        target="_blank"
                        external
                        variant="ghost"
                        color="success"
                        icon="i-lucide-file-down"
                        size="xs"
                        title="View/Download File"
                      />

                      <!-- Edit button -->
                      <UButton
                        variant="ghost"
                        color="primary"
                        icon="i-lucide-pencil"
                        size="xs"
                        title="Edit Document"
                        @click="editDocument(doc)"
                      />

                      <!-- Delete button -->
                      <UButton
                        variant="ghost"
                        color="error"
                        icon="i-lucide-trash-2"
                        size="xs"
                        title="Delete Document"
                        @click="confirmDeleteDocument(doc)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Pagination Controls ─────────────────────────────────── -->
        <div class="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
          <div class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 order-2 sm:order-1">
            Showing
            <span class="font-medium">{{ paginationStart }}</span>
            to
            <span class="font-medium">{{ paginationEnd }}</span>
            of
            <span class="font-medium">{{ totalDocumentsCount }}</span>
            documents
          </div>
          <div class="flex gap-2 order-1 sm:order-2">
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="currentPage === 1"
              @click="goToPreviousPage"
            >
              Previous
            </UButton>
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="currentPage >= totalPages"
              @click="goToNextPage"
            >
              Next
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- ADD / EDIT DOCUMENT MODAL                                      -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal
      v-model:open="showDocumentModal"
      :ui="{ content: 'sm:max-w-6xl' }"
    >
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">

          <!-- Modal Header -->
          <template #header>
            <div class="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-green-400 via-blue-500 to-green-400 text-white flex justify-between items-center rounded-t-xl">
              <h3 class="text-base sm:text-lg font-medium">
                {{ showEditDocumentModal ? 'Edit Document' : 'Add New Document' }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="sm"
                class="text-white hover:bg-white/10"
                @click="cancelDocumentForm"
              />
            </div>
          </template>

          <!-- Modal Body / Form -->
          <div class="px-4 sm:px-6 py-4 overflow-y-auto max-h-[75vh]">

            <!-- Document Name -->
            <div class="mb-4">
              <UFormField label="Document Name" required>
                <UInput
                  id="documentName"
                  v-model="documentForm.name"
                  type="text"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Reference Number -->
            <div class="mb-4">
              <UFormField label="Reference Number" required>
                <UInput
                  id="ref_no"
                  v-model="documentForm.ref_no"
                  type="text"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Description -->
            <div class="mb-4">
              <UFormField label="Description" required>
                <UTextarea
                  id="description"
                  v-model="documentForm.description"
                  :rows="3"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
              <!-- Left column: Start Date + Closed Date -->
              <div>
                <!-- Start Date -->
                <div class="mb-4">
                  <UFormField label="Start Date">
                    <UInput
                      id="startDate"
                      v-model="documentForm.startDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Closed Date -->
                <div class="mb-4">
                  <UFormField label="Closed Date">
                    <UInput
                      id="closedDate"
                      v-model="documentForm.closedDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Right column: Original Expiry Date + Extended Expiry Date -->
              <div>
                <!-- Original Expiry Date -->
                <div class="mb-4">
                  <UFormField label="Original Expiry Date" required>
                    <UInput
                      id="oExpiryDate"
                      v-model="documentForm.oExpiryDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Extended Expiry Date -->
                <div class="mb-4">
                  <UFormField label="Extended Expiry Date" required>
                    <UInput
                      id="expiryDate"
                      v-model="documentForm.expiryDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
              <!-- Value -->
              <div>
                <div class="mb-4">
                  <UFormField label="Value" required>
                    <UInput
                      id="value"
                      v-model="documentForm.value"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Status -->
              <div>
                <div class="mb-4">
                  <UFormField label="Status">
                    <USelect
                      id="status"
                      v-model="documentForm.status"
                      :items="documentStatusItems"
                      placeholder="Select status"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>

            <!-- File Upload -->
            <div class="mb-4">
              <UFormField label="File Upload">
                <!-- Native file input hidden, triggered by UButton -->
                <input
                  id="fileUpload"
                  type="file"
                  ref="fileInput"
                  class="sr-only"
                  @change="handleFileUpload"
                />
                <UButton
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-upload"
                  type="button"
                  @click="fileInput?.click()"
                >
                  Choose File
                </UButton>
              </UFormField>

              <!-- Current File Information (edit mode) -->
              <div
                v-if="documentForm.file"
                class="mt-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Current File</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs">
                      File ID: {{ documentForm.fileId || 'Not available' }}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <UButton
                      :to="documentForm.file"
                      target="_blank"
                      external
                      variant="soft"
                      color="success"
                      icon="i-lucide-eye"
                      size="xs"
                    >
                      View
                    </UButton>
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Uploading a new file will replace the current one.
                </p>
              </div>

              <!-- Selected File Information (new file chosen) -->
              <div
                v-if="selectedFile"
                class="mt-3 p-3 border border-green-200 dark:border-green-700 rounded-md bg-green-50 dark:bg-green-900/20"
              >
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">New File Selected</h4>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
                </p>
              </div>
            </div>

          </div>

          <!-- Modal Footer -->
          <template #footer>
            <div class="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-green-400 via-blue-500 to-green-400 flex justify-end gap-3 rounded-b-xl">
              <UButton
                type="button"
                color="warning"
                variant="solid"
                class="bg-gradient-to-r from-orange-400 to-red-500 hover:opacity-90 border-0"
                @click="cancelDocumentForm"
              >
                Cancel
              </UButton>

              <UButton
                type="button"
                color="primary"
                variant="solid"
                :loading="isSubmitting"
                :disabled="isSubmitting"
                class="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 border-0 min-w-[80px]"
                @click="showEditDocumentModal ? updateDocument() : addDocument()"
              >
                {{ showEditDocumentModal ? 'Update' : 'Add' }}
              </UButton>
            </div>
          </template>

        </UCard>
      </template>
    </UModal>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- DELETE CONFIRMATION MODAL                                      -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <UModal v-model:open="showDeleteModal" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <UCard :ui="{ header: 'p-0 border-0', footer: 'p-0 border-0' }">

          <!-- Header -->
          <template #header>
            <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Confirm Deletion</h3>
            </div>
          </template>

          <!-- Body -->
          <div class="px-4 sm:px-6 py-3 sm:py-4">
            <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
          </div>

          <!-- Footer -->
          <template #footer>
            <div class="px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
              <UButton
                variant="outline"
                color="neutral"
                @click="showDeleteModal = false"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                @click="deleteDocument"
              >
                Delete
              </UButton>
            </div>
          </template>

        </UCard>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import downloadExcel from '~/composables/utils/downloadExcel'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'
import { usePageTitle } from '~/composables/ui/usePageTitle'

// ─── Page setup ───────────────────────────────────────────────────────────────
definePageMeta({
  middleware: [
    function () {
      const { isLoggedIn } = useAuth()
      if (!isLoggedIn.value) {
        return navigateTo('/auth')
      }
    }
  ]
})

// ─── Composables — all hoisted to top level (Nuxt v4 requirement) ─────────────
const router = useRouter()
const toast  = useToast()

// Hoist api instance — MUST NOT be called inside functions in Nuxt v4
const api = useApiWithAuth()

usePageTitle('Documents', 'Manage your important documents and track their validity')

// ─── State ────────────────────────────────────────────────────────────────────
const documents             = ref<any[]>([])
const isLoading             = ref(true)
const isSubmitting          = ref(false)
const totalDocumentsCount   = ref(0)
const showAddDocumentModal  = ref(false)
const showEditDocumentModal = ref(false)
const showDeleteModal       = ref(false)
const documentToDelete      = ref<any>(null)
const documentToEdit        = ref<any>(null)
const searchQuery           = ref('')
const sortBy                = ref('expiryDate')
const sortDirection         = ref<'asc' | 'desc'>('asc')
const currentPage           = ref(1)
const itemsPerPage          = ref(10)
const selectedFile          = ref<File | null>(null)
const searchDebounceTimer   = ref<ReturnType<typeof setTimeout> | null>(null)

// Document form
const documentForm = ref({
  id:          null as string | null,
  name:        '',
  ref_no:      '',
  description: 'No description provided',
  startDate:   '',
  expiryDate:  '',
  oExpiryDate: '',
  closedDate:  '',
  value:       0 as number | null,
  status:      '',
  file:        '',
  fileId:      '', // Google Drive file ID
})

// ─── Computed — modal open state ──────────────────────────────────────────────
// Single computed ref combines Add + Edit flags into one v-model:open target
const showDocumentModal = computed({
  get: () => showAddDocumentModal.value || showEditDocumentModal.value,
  set: (val: boolean) => {
    if (!val) {
      showAddDocumentModal.value  = false
      showEditDocumentModal.value = false
    }
  },
})

// ─── Static option lists ──────────────────────────────────────────────────────
const sortByItems = [
  { label: 'Sort by Name',        value: 'name'       },
  { label: 'Sort by Reference',   value: 'ref_no'     },
  { label: 'Sort by Expiry Date', value: 'expiryDate' },
  { label: 'Sort by Start Date',  value: 'startDate'  },
  { label: 'Sort by Value',       value: 'value'      },
]

const documentStatusItems = [
  { label: 'OPEN',       value: 'OPEN'       },
  { label: 'RUNNING',    value: 'RUNNING'    },
  { label: 'CLOSED',     value: 'CLOSED'     },
  { label: 'TERMINATED', value: 'TERMINATED' },
]

// ─── Computed — pagination ────────────────────────────────────────────────────
const totalPages = computed(() => {
  // If we have data from the server, use that for total pages calculation
  if (totalDocumentsCount.value > 0) {
    // Ensure we always have at least 1 page, even if there are no documents
    return Math.max(1, Math.ceil(totalDocumentsCount.value / itemsPerPage.value))
  }
  // Fallback to client-side calculation (should rarely be used now)
  return Math.max(1, Math.ceil(documents.value.length / itemsPerPage.value))
})

const paginationStart = computed(() => {
  // If we have no documents, start from 0
  if (totalDocumentsCount.value === 0 || documents.value.length === 0) {
    return 0
  }
  // Otherwise, calculate the start index based on current page
  return (currentPage.value - 1) * itemsPerPage.value + 1
})

const paginationEnd = computed(() => {
  // If we have no documents, end at 0
  if (totalDocumentsCount.value === 0 || documents.value.length === 0) {
    return 0
  }
  // For server-side pagination, calculate based on current page and actual documents returned
  const calculatedEnd = (currentPage.value - 1) * itemsPerPage.value + documents.value.length
  // Return the minimum of calculated end and total documents
  return Math.min(calculatedEnd, totalDocumentsCount.value)
})

const expiringDocuments = computed(() => {
  const today            = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  return documents.value.filter(doc => {
    if (!doc.expiryDate) return false
    const expiryDate = new Date(doc.expiryDate)
    return expiryDate > today && expiryDate <= thirtyDaysFromNow
  })
})

// ─── Debounced search ─────────────────────────────────────────────────────────
const debouncedSearch = () => {
  // Clear any existing timer
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }

  // Set a new timer
  searchDebounceTimer.value = setTimeout(() => {
    currentPage.value = 1
    fetchDocuments()
  }, 500) // 500ms delay
}

const clearSearch = () => {
  searchQuery.value = ''
  currentPage.value = 1
  // fetchDocuments will be called automatically by the watch on searchQuery
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
// Watch for changes in search query to reset pagination and fetch new data
watch(searchQuery, () => {
  debouncedSearch()
})

// Watch for changes in sort options to fetch new data
watch([sortBy, sortDirection], () => {
  fetchDocuments()
})

// ─── Pagination navigation ────────────────────────────────────────────────────
function goToPreviousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchDocuments()
  }
}

function goToNextPage() {
  // Calculate the maximum safe page number
  const maxPage = Math.max(1, Math.ceil(totalDocumentsCount.value / itemsPerPage.value))

  // Only go to next page if we're not already at the last page
  if (currentPage.value < maxPage) {
    currentPage.value++
    fetchDocuments()
  } else {
    // If we're trying to go beyond the last page, show a message
    toast.add({ title: 'Info', description: 'You are already on the last page', color: 'info' })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

// Format file size in bytes to a human-readable format
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k     = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i     = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function isExpired(doc: any) {
  if (!doc.expiryDate) return false
  return new Date(doc.expiryDate) < new Date()
}

function isExpiringSoon(doc: any) {
  if (!doc.expiryDate) return false

  const today            = new Date()
  const expiryDate       = new Date(doc.expiryDate)
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  return expiryDate > today && expiryDate <= thirtyDaysFromNow
}

function getExpiryStatus(doc: any) {
  if (isExpired(doc))     return 'Expired'
  if (isExpiringSoon(doc)) return 'Expiring Soon'
  return 'Valid'
}

// Returns the Nuxt UI UBadge color string for a document's expiry state
function getExpiryBadgeColor(doc: any): string {
  if (isExpired(doc))     return 'error'
  if (isExpiringSoon(doc)) return 'warning'
  return 'success'
}

// Replaces the old showToastNotification + custom toast state entirely
function notify(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
  const titleMap: Record<string, string> = {
    success: 'Success',
    error:   'Error',
    warning: 'Warning',
    info:    'Info',
  }
  toast.add({
    title:       titleMap[type] ?? 'Notice',
    description: message,
    color:       type,
  })
}

// ─── Methods ──────────────────────────────────────────────────────────────────
async function triggerNotifications() {
  try {
    // Use the hoisted api instance
    const responseData = await api.post('/api/documents/sndmlnot')
    
    // Check if there's a warning about email not being configured
    if (responseData.warning) {
      notify(responseData.warning, 'warning')
    } else {
      notify(responseData.message || 'Notifications sent successfully', 'success')
    }
  } catch (error: any) {
    console.error('Error sending notifications:', error)
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to send notifications'
    if (error.message?.includes('Missing credentials')) {
      errorMessage = 'Email service not configured. Please contact administrator.'
    } else if (error.message?.includes('already sent today')) {
      errorMessage = 'Notification already sent today. You can only send one per day.'
    } else if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    notify(errorMessage, 'error')
  }
}

async function fetchDocuments() {
  isLoading.value = true

  try {
    // Create query parameters for pagination, search, and sorting
    const queryParams = new URLSearchParams({
      page:          String(currentPage.value),
      limit:         String(itemsPerPage.value),
      search:        searchQuery.value,
      sortBy:        sortBy.value,
      sortDirection: sortDirection.value,
    }).toString()

    // Make the authenticated request with automatic token refresh and pagination
    const data = await api.get(`/api/documents?${queryParams}`)

    // Map API response to match frontend field names
    if (data.documents) {
      documents.value = data.documents.map((doc: any) => ({
        ...doc,
        ref_no: doc.ref_no,
      }))

      // Update pagination data if available
      if (data.pagination) {
        const totalPagesFromServer = data.pagination.totalPages
        if (totalPagesFromServer > 0) {
          // Only update if we have valid data
          itemsPerPage.value        = data.pagination.limit
          totalDocumentsCount.value = data.pagination.total

          // If the server adjusted our page number (e.g., we requested page 3 but there are only 2 pages),
          // update our local page number to match
          if (data.pagination.requestedPage !== data.pagination.page) {
            currentPage.value = data.pagination.page
          }

          // If we still got an empty result but we're not on the first page,
          // go back to the previous page and try again
          if (documents.value.length === 0 && currentPage.value > 1) {
            currentPage.value--
            // Call fetchDocuments again with a slight delay to avoid infinite loops
            setTimeout(() => fetchDocuments(), 100)
            return
          }
        }
      }
    } else {
      documents.value = []
    }
  } catch (error) {
    notify('Failed to load documents', 'error')
  } finally {
    isLoading.value = false
  }
}

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Check if file size exceeds 500KB (512000 bytes)
  if (file.size > 512000) {
    notify('File size exceeds maximum limit of 500KB. Please select a smaller file.', 'error')
    // Reset the file input
    ;(event.target as HTMLInputElement).value = ''
    return
  }

  selectedFile.value = file
}

function resetDocumentForm() {
  documentForm.value = {
    id:          null,
    name:        '',
    ref_no:      '',
    description: 'No description provided',
    startDate:   '',
    expiryDate:  '',
    oExpiryDate: '',
    closedDate:  '',
    value:       0,
    status:      '',
    file:        '',
    fileId:      '',
  }
}

function cancelDocumentForm() {
  resetDocumentForm()
  showAddDocumentModal.value  = false
  showEditDocumentModal.value = false
  // Reset the file input and selected file
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  selectedFile.value = null
}

function editDocument(doc: any) {
  documentToEdit.value = doc
  documentForm.value = {
    id:          doc._id,
    name:        doc.name,
    ref_no:      doc.ref_no,
    description: doc.description || '',
    startDate:   doc.startDate   ? doc.startDate.slice(0, 10)   : '',
    expiryDate:  doc.expiryDate  ? doc.expiryDate.slice(0, 10)  : '',
    oExpiryDate: doc.oExpiryDate ? doc.oExpiryDate.slice(0, 10) : '',
    closedDate:  doc.closedDate  ? doc.closedDate.slice(0, 10)  : '',
    value:       doc.value || null,
    status:      doc.status,
    file:        doc.file   || null,
    fileId:      doc.fileId || '', // Include the Google Drive file ID
  }
  showEditDocumentModal.value = true
}

function confirmDeleteDocument(doc: any) {
  documentToDelete.value = doc
  showDeleteModal.value  = true
}

async function addDocument() {
  isSubmitting.value = true
  try {
    // First upload the file to Google Drive if a file is selected
    let fileUrl = ''
    let fileId  = '' // Define fileId outside the if block

    if (selectedFile.value) {
      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append('file', selectedFile.value)

      // Use the special uploadFile method that handles FormData correctly
      const uploadResponse = await api.post('/api/documents/uplddoc', formData, {
        // Set isFormData to true to handle FormData correctly
        isFormData: true,
      })

      // Get the file URL and fileId from the response
      // The uplddoc endpoint returns the URL in the fileName field
      fileUrl = uploadResponse.fileName || uploadResponse.fileUrl
      fileId  = uploadResponse.fileId   || ''
    }

    // Then create the document with the file URL and fileId
    const documentData = {
      ...documentForm.value,
      file:        fileUrl || documentForm.value.file,       // Use the uploaded file URL or keep existing one
      fileId:      fileId  || documentForm.value.fileId,     // Store the Google Drive file ID
      value:       documentForm.value.value       || 0,      // Ensure value is always a number
      description: documentForm.value.description || 'No description provided', // Ensure description is always set
    }

    // Make the authenticated POST request
    const newDocument = await api.post('/api/documents', documentData)

    // Add the new document to the array
    documents.value.push(newDocument)

    notify('Document added successfully', 'success')
    cancelDocumentForm()
    // Refresh documents list
    await fetchDocuments()
  } catch (error: any) {
    console.error('Error adding document:', error)
    // Provide more detailed error message
    let errorMessage = 'Failed to add document'
    if (error.message) {
      errorMessage = error.message
    } else if (error.data && error.data.message) {
      errorMessage = error.data.message
    }
    notify(errorMessage, 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function updateDocument() {
  isSubmitting.value = true
  try {
    // Keep track of existing file info
    let fileUrl = documentForm.value.file   // Keep existing file URL by default
    let fileId  = documentForm.value.fileId // Keep existing file ID by default

    // If a new file is selected, delete the old file first (if it exists)
    if (selectedFile.value && documentForm.value.fileId) {
      try {
        // Delete the old file from Google Drive
        await api.post('/api/documents/delete-file', {
          fileId: documentForm.value.fileId,
        })
      } catch (deleteError) {
        console.error('Error deleting old file:', deleteError)
        // Continue with the update even if deletion fails
      }
    }

    if (selectedFile.value) {
      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append('file', selectedFile.value)

      // Use the special uploadFile method that handles FormData correctly
      const uploadResponse = await api.post('/api/documents/uplddoc', formData, {
        // Set isFormData to true to handle FormData correctly
        isFormData: true,
      })

      // Get the file URL and fileId from the response
      // The uplddoc endpoint returns the URL in the fileName field
      fileUrl = uploadResponse.fileName || uploadResponse.fileUrl
      fileId  = uploadResponse.fileId   || fileId // Use the new fileId or keep the existing one
    }

    // Update document data with file URL and fileId
    const documentData = {
      ...documentForm.value,
      file:        fileUrl,                                    // Use the uploaded file URL or keep existing one
      fileId:      fileId,                                     // Store the Google Drive file ID
      value:       documentForm.value.value       || 0,       // Ensure value is always a number
      description: documentForm.value.description || 'No description provided', // Ensure description is always set
    }

    // Make the authenticated PUT request
    const updatedDocument = await api.put(`/api/documents/${documentForm.value.id}`, documentData)

    // Update the document in the array
    const index = documents.value.findIndex(doc => doc._id === updatedDocument._id)
    if (index !== -1) {
      documents.value[index] = updatedDocument
    }

    notify('Document updated successfully', 'success')
    cancelDocumentForm()
  } catch (error: any) {
    console.error('Error updating document:', error)
    // Provide more detailed error message
    let errorMessage = 'Failed to update document'
    if (error.message) {
      errorMessage = error.message
    } else if (error.data && error.data.message) {
      errorMessage = error.data.message
    }
    notify(errorMessage, 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function deleteDocument() {
  try {
    // If the document has a file in Google Drive, delete it first
    if (documentToDelete.value.fileId) {
      try {
        // Delete the file from Google Drive
        await api.post('/api/documents/delete-file', {
          fileId: documentToDelete.value.fileId,
        })
      } catch (deleteError) {
        console.error('Error deleting file from Google Drive:', deleteError)
        // Continue with document deletion even if file deletion fails
      }
    }

    // Make the authenticated DELETE request to remove the document from the database
    await api.delete(`/api/documents/${documentToDelete.value._id}`)

    // Remove the document from the array
    documents.value = documents.value.filter(doc => doc._id !== documentToDelete.value._id)

    notify('Document deleted successfully', 'success')
    showDeleteModal.value = false
  } catch (error) {
    console.error('Error deleting document:', error)
    notify('Failed to delete document', 'error')
  }
}

const downloadDocuments = async () => {
  await downloadExcel()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  console.log('Documents: Component mounted - initializing')

  // Fetch documents
  await fetchDocuments()
  await triggerNotifications()
})

// Clean up timers when component is unmounted
onUnmounted(() => {
  console.log('Documents: Component unmounting - cleaning up')

  // Clear search debounce timer if it exists
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
    searchDebounceTimer.value = null
  }
})
</script>

<style>
.bg-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6z'%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>