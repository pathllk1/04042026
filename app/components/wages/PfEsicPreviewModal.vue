<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-[98vw]' }">
    <template #content>
      <UCard :ui="{ header: 'p-0 border-0', body: 'p-0', footer: 'p-0 border-0' }">
        <!-- Modal Header -->
        <template #header>
          <div class="bg-gradient-to-r from-purple-600 to-blue-700 p-4 rounded-t-xl flex justify-between items-center shadow-lg">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <UIcon name="i-lucide-file-spreadsheet" class="text-white h-6 w-6" />
              </div>
              <div>
                <h3 class="text-lg font-black text-white uppercase tracking-tighter">
                  PF & ESIC Preview
                </h3>
                <p class="text-[10px] text-purple-100 font-bold uppercase tracking-widest">
                  Period: {{ formatMonthYear(selectedMonth) }}
                </p>
              </div>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="text-white hover:text-red-200"
              @click="isOpen = false"
            />
          </div>
        </template>

        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto p-6 max-h-[80vh] bg-gray-50/50 dark:bg-gray-900/50">
          <!-- Loading State -->
          <div v-if="loading" class="flex flex-col justify-center items-center py-20 gap-4">
            <UIcon name="i-lucide-loader-2" class="animate-spin h-12 w-12 text-primary" />
            <span class="text-sm font-black text-gray-500 uppercase tracking-widest animate-pulse">Synchronizing PF & ESIC Data...</span>
          </div>

          <!-- Content -->
          <div v-else-if="pfEsicData.length > 0" class="space-y-8">
            
            <!-- Top Controls Row -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              <!-- AI Rules Card (Left) -->
              <div class="lg:col-span-7 space-y-4">
                <div v-if="!isConfigured" class="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-5">
                  <div class="flex items-start gap-4">
                    <div class="bg-green-500 text-white p-2 rounded-lg shrink-0">
                      <UIcon name="i-lucide-shield-check" class="h-6 w-6" />
                    </div>
                    <div>
                      <h3 class="text-sm font-black text-green-900 dark:text-green-300 uppercase tracking-widest mb-1">Fallback Statutory Rates Active</h3>
                      <p class="text-xs text-green-700 dark:text-green-400 font-medium leading-relaxed mb-4">
                        AI engine not configured. Using standard statutory rates (EPF: 12% max ₹1800, ESIC: 0.75%). Configure AI to fetch latest government rates.
                      </p>
                      <UButton
                        color="success"
                        size="xs"
                        icon="i-lucide-settings"
                        label="Configure AI Engine (Optional)"
                        @click="openAISettings"
                      />
                    </div>
                  </div>
                </div>

                <div v-else class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden group">
                  <!-- Decorative BG -->
                  <UIcon name="i-lucide-zap" class="absolute -right-4 -bottom-4 h-32 w-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                  
                  <div class="flex items-center justify-between mb-4 relative z-10">
                    <div class="flex items-center gap-2">
                      <div class="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                        <UIcon name="i-lucide-bot" class="h-5 w-5" />
                      </div>
                      <h4 class="text-sm font-black uppercase tracking-tighter">AI Statutory Intelligence</h4>
                    </div>
                    <div class="flex gap-2">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-refresh-cw"
                        :loading="refreshingAiRules"
                        class="text-white hover:bg-white/10"
                        @click="showAIGuidanceDialog = true"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-6 relative z-10">
                    <div class="space-y-3">
                      <div class="flex items-center gap-2 border-b border-white/10 pb-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-blue-200">EPF Rates</span>
                      </div>
                      <ul v-if="getCurrentRules.epf" class="text-[11px] space-y-1.5 font-bold text-blue-50">
                        <li class="flex justify-between"><span>Employee:</span> <span>{{ (getCurrentRules.epf.employeeRate * 100).toFixed(1) }}%</span></li>
                        <li class="flex justify-between"><span>Employer EPS:</span> <span>{{ (getCurrentRules.epf.employerEpsRate * 100).toFixed(2) }}%</span></li>
                        <li class="flex justify-between"><span>Wage Limit:</span> <span>₹{{ getCurrentRules.epf.wageLimit?.toLocaleString('en-IN') }}</span></li>
                      </ul>
                    </div>
                    <div class="space-y-3">
                      <div class="flex items-center gap-2 border-b border-white/10 pb-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-green-200">ESIC Rates</span>
                      </div>
                      <ul v-if="getCurrentRules.esic" class="text-[11px] space-y-1.5 font-bold text-green-50">
                        <li class="flex justify-between"><span>Employee:</span> <span>{{ (getCurrentRules.esic.employeeRate * 100).toFixed(2) }}%</span></li>
                        <li class="flex justify-between"><span>Employer:</span> <span>{{ (getCurrentRules.esic.employerRate * 100).toFixed(2) }}%</span></li>
                        <li class="flex justify-between"><span>Wage Limit:</span> <span>₹{{ getCurrentRules.esic.wageLimit?.toLocaleString('en-IN') }}</span></li>
                      </ul>
                    </div>
                  </div>
                  
                  <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center relative z-10">
                    <span class="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Provider: {{ getProviderName(aiConfig.provider) }}</span>
                    <span class="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Updated: {{ getCurrentRules.epf?.lastUpdated ? new Date(getCurrentRules.epf.lastUpdated).toLocaleDateString() : 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Filter Panel (Right) -->
              <div class="lg:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div class="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-300 font-black uppercase text-[10px] tracking-widest border-b dark:border-gray-800 pb-2">
                  <UIcon name="i-lucide-filter" class="h-4 w-4" />
                  Targeted Analysis Filters
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Project Scope">
                    <USelect v-model="filters.project" :items="[{ label: 'All Projects', value: 'all' }, ...uniqueProjects.map(p => ({ label: p, value: p }))]" size="sm" class="w-full" />
                  </UFormField>
                  <UFormField label="Site Location">
                    <USelect v-model="filters.site" :items="[{ label: 'All Sites', value: 'all' }, ...uniqueSites.map(s => ({ label: s, value: s }))]" size="sm" class="w-full" />
                  </UFormField>
                  <UFormField label="Payment State">
                    <USelect v-model="filters.status" :items="[{ label: 'All States', value: 'all' }, { label: 'Paid', value: 'paid' }, { label: 'Unpaid', value: 'unpaid' }]" size="sm" class="w-full" />
                  </UFormField>
                  <div class="flex items-end pb-1">
                    <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-rotate-ccw" label="Reset Filters" block @click="clearFilters" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Summary Totals Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- General Overview -->
              <div class="bg-white dark:bg-gray-950 border-2 border-blue-100 dark:border-blue-900 rounded-xl p-5 shadow-sm">
                <h4 class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Workforce Overview</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div class="text-[9px] font-bold text-blue-500 uppercase">Headcount</div>
                    <div class="text-xl font-black text-blue-900 dark:text-white">{{ filteredData.length }}</div>
                  </div>
                  <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div class="text-[9px] font-bold text-green-500 uppercase">Gross Salary</div>
                    <div class="text-sm font-black text-green-900 dark:text-white">₹{{ formatIndianCurrency(totalGrossSalary) }}</div>
                  </div>
                </div>
              </div>

              <!-- EPF Contribution Summary -->
              <div class="bg-white dark:bg-gray-950 border-2 border-indigo-100 dark:border-indigo-900 rounded-xl p-5 shadow-sm">
                <h4 class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">EPF Liability Analysis</h4>
                <div class="space-y-3">
                  <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-500 uppercase">Employee Contribution</span>
                    <span class="font-black text-indigo-600">₹{{ formatIndianCurrency(totalEmployeeEpf) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-500 uppercase">Employer Contribution</span>
                    <span class="font-black text-indigo-600">₹{{ formatIndianCurrency(totalEmployerEpfContribution) }}</span>
                  </div>
                  <div class="pt-2 border-t border-indigo-50 dark:border-indigo-900 flex justify-between items-center">
                    <span class="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase">Total EPF Flow</span>
                    <span class="text-lg font-black text-indigo-700">₹{{ formatIndianCurrency(totalEpfContribution) }}</span>
                  </div>
                </div>
              </div>

              <!-- ESIC Contribution Summary -->
              <div class="bg-white dark:bg-gray-950 border-2 border-teal-100 dark:border-teal-900 rounded-xl p-5 shadow-sm">
                <h4 class="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">ESIC Liability Analysis</h4>
                <div class="space-y-3">
                  <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-500 uppercase">Employee (0.75%)</span>
                    <span class="font-black text-teal-600">₹{{ formatIndianCurrency(totalEmployeeEsic) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-500 uppercase">Employer (3.25%)</span>
                    <span class="font-black text-teal-600">₹{{ formatIndianCurrency(totalEmployerEsic) }}</span>
                  </div>
                  <div class="pt-2 border-t border-teal-50 dark:border-teal-900 flex justify-between items-center">
                    <span class="text-[10px] font-black text-teal-900 dark:text-teal-300 uppercase">Total ESIC Flow</span>
                    <span class="text-lg font-black text-teal-700">₹{{ formatIndianCurrency(totalEsicContribution) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Employee Details Table -->
            <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div class="px-4 py-3 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-list" class="text-primary h-4 w-4" />
                  <span class="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Granular Employee Analysis</span>
                </div>
                <UButton
                  color="success"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-download"
                  label="Export Detailed Analysis"
                  @click="exportToExcel"
                />
              </div>
              
              <div class="overflow-x-auto max-h-[500px]">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 border-collapse">
                  <thead class="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr class="divide-x divide-gray-200 dark:divide-gray-800">
                      <th class="px-2 py-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-wider">Sl.</th>
                      <th class="px-3 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-wider min-w-[200px]">Employee Details</th>
                      <th class="px-3 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-wider min-w-[150px]">Project & Site</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-wider">Wage Days</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-wider">Gross Sal.</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-blue-600 uppercase tracking-wider">Emp. EPF</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-green-600 uppercase tracking-wider">Empr. EPF</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-amber-600 uppercase tracking-wider">Empr. EPS</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-blue-600 uppercase tracking-wider">Emp. ESIC</th>
                      <th class="px-2 py-3 text-right text-[10px] font-black text-green-600 uppercase tracking-wider">Empr. ESIC</th>
                      <th class="px-2 py-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
                    <tr v-for="(employee, index) in filteredData" :key="employee.employeeId"
                        class="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors divide-x divide-gray-100 dark:divide-gray-800"
                        :class="employee.paymentStatus === 'paid' ? 'bg-green-50/20' : 'bg-orange-50/20'">
                      
                      <td class="px-2 py-2 text-[10px] text-center font-bold text-gray-400">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <div class="text-sm font-black text-gray-900 dark:text-white">{{ employee.employeeName }}</div>
                        <div class="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex gap-2">
                          <span>UAN: {{ employee.uan || 'N/A' }}</span>
                          <span class="text-gray-300">|</span>
                          <span>{{ employee.category }}</span>
                        </div>
                      </td>
                      <td class="px-3 py-2">
                        <div class="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase">{{ employee.project }}</div>
                        <div class="text-[9px] text-gray-500 font-medium italic">{{ employee.site }}</div>
                      </td>
                      
                      <!-- Numeric Fields -->
                      <td class="px-2 py-2 text-right">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.wageDays" type="number" size="xs" class="w-16 ml-auto" />
                        <span v-else class="text-sm font-bold">{{ employee.wageDays || 0 }}</span>
                      </td>
                      <td class="px-2 py-2 text-right">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.grossSalary" type="number" size="xs" class="w-24 ml-auto" />
                        <span v-else class="text-sm font-black">₹{{ formatIndianCurrency(employee.grossSalary) }}</span>
                      </td>
                      
                      <!-- EPF Columns -->
                      <td class="px-2 py-2 text-right text-blue-600 dark:text-blue-400">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.employeeEpf" type="number" size="xs" class="w-20 ml-auto" />
                        <span v-else class="text-xs font-bold">{{ formatIndianCurrency(employee.employeeEpf) }}</span>
                      </td>
                      <td class="px-2 py-2 text-right text-green-600 dark:text-green-400">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.employerEpf" type="number" size="xs" class="w-20 ml-auto" />
                        <span v-else class="text-xs font-bold">{{ formatIndianCurrency(employee.employerEpf) }}</span>
                      </td>
                      <td class="px-2 py-2 text-right text-amber-600 dark:text-amber-400">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.employerEps" type="number" size="xs" class="w-20 ml-auto" />
                        <span v-else class="text-xs font-bold">{{ formatIndianCurrency(employee.employerEps) }}</span>
                      </td>
                      
                      <!-- ESIC Columns -->
                      <td class="px-2 py-2 text-right text-blue-600 dark:text-blue-400">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.employeeEsic" type="number" size="xs" class="w-20 ml-auto" />
                        <span v-else class="text-xs font-bold">{{ formatIndianCurrency(employee.employeeEsic) }}</span>
                      </td>
                      <td class="px-2 py-2 text-right text-green-600 dark:text-green-400">
                        <UInput v-if="editingEmployeeId === employee.employeeId" v-model="editingData.employerEsic" type="number" size="xs" class="w-20 ml-auto" />
                        <span v-else class="text-xs font-bold">{{ formatIndianCurrency(employee.employerEsic) }}</span>
                      </td>

                      <!-- Actions -->
                      <td class="px-2 py-2 text-center">
                        <div v-if="editingEmployeeId === employee.employeeId" class="flex justify-center gap-1">
                          <UButton color="success" size="xs" variant="soft" icon="i-lucide-check" @click="saveEditing" />
                          <UButton color="error" size="xs" variant="soft" icon="i-lucide-x" @click="cancelEditing" />
                        </div>
                        <UButton v-else color="primary" size="xs" variant="ghost" icon="i-lucide-pencil" @click="startEditing(employee)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center py-20 text-center">
            <div class="bg-gray-100 dark:bg-gray-800 p-6 rounded-full mb-4">
              <UIcon name="i-lucide-database-zap" class="h-12 w-12 text-gray-400" />
            </div>
            <h3 class="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Zero Statutory Data</h3>
            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">No employee records meet the current analysis criteria for this period.</p>
            <UButton
              color="primary"
              variant="soft"
              class="mt-8 uppercase font-black tracking-widest text-[10px]"
              icon="i-lucide-refresh-cw"
              label="Re-Sync Engine"
              @click="$emit('refresh')"
            />
          </div>
        </div>

        <!-- Modal Footer -->
        <template #footer>
          <div class="p-4 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-800 rounded-b-xl">
            <UButton
              color="neutral"
              variant="soft"
              label="Close Analysis"
              @click="isOpen = false"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- AI Guidance Dialog -->
  <UModal v-model:open="showAIGuidanceDialog" :ui="{ content: 'sm:max-w-2xl' }">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-bot" class="text-primary h-5 w-5" />
              <h3 class="text-lg font-black uppercase tracking-tighter">AI Statutory Intelligence</h3>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="showAIGuidanceDialog = false" />
          </div>
        </template>

        <div class="space-y-6">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
            Direct the AI engine to prioritize specific statutory circulars, time periods, or regional amendments.
          </p>

          <div class="bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 class="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
              Intelligence Guidance Tips
            </h4>
            <ul class="text-[11px] text-blue-700 dark:text-blue-400 space-y-2 font-medium">
              <li>• <span class="font-black">Regional:</span> "Check for West Bengal specific ESIC variations"</li>
              <li>• <span class="font-black">Timely:</span> "Prioritize FY 2024-25 EPFO notifications"</li>
              <li>• <span class="font-black">Sectors:</span> "Check startup exemptions for EPF admin charges"</li>
            </ul>
          </div>

          <UFormField label="Custom AI Instructions (Optional)">
            <UTextarea
              v-model="aiGuidanceText"
              rows="4"
              placeholder="e.g. Please verify the current wage ceiling limits for EPF and ESIC contributions from official gazettes issued after April 2024..."
              class="font-medium text-sm"
            />
          </UFormField>

          <div class="grid grid-cols-1 gap-2">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quick Presets</span>
            <UButton v-for="preset in quickPresets" :key="preset.id"
              variant="soft" color="neutral" size="xs" class="justify-start font-bold uppercase tracking-widest text-[9px]"
              @click="aiGuidanceText = preset.text">
              {{ preset.label }}
            </UButton>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="ghost" label="Abort" @click="showAIGuidanceDialog = false" />
            <UButton color="primary" icon="i-lucide-zap" label="Initialize Intelligence Sync" :loading="refreshingAiRules" @click="refreshAiRulesWithGuidance" />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AI_PROVIDERS } from '~/types/ai'
import { useEpfEsicRules } from '~/composables/business/useEpfEsicRules'
import { useAIApi } from '~/composables/ai/useAIApi'
import { useAIConfig } from '~/composables/ai/useAIConfig'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

const props = defineProps<{
  show: boolean
  selectedMonth: string
  pfEsicData: any[]
  loading: boolean
  filters: {
    project: string
    site: string
    status: string
    employeeStatus: string
  }
}>()

const emit = defineEmits(['close', 'refresh', 'update-employee'])

const isOpen = computed({
  get: () => props.show,
  set: (val) => { if (!val) emit('close') }
})

const { getCurrentRules, updateRulesDirectly } = useEpfEsicRules()
const { makeAIRequest, isConfigured } = useAIApi()
const { aiConfig } = useAIConfig()
const toast = useToast()

const refreshingAiRules = ref(false)
const showAIGuidanceDialog = ref(false)
const aiGuidanceText = ref('')

const editingEmployeeId = ref<string | null>(null)
const editingData = ref<any>({})

const quickPresets = [
  { id: 1, label: '📅 FY 2024-25 Rate Notifications', text: 'Please check for the latest EPF/ESIC rate notifications for 2024-25 financial year and verify if there are any recent changes or amendments.' },
  { id: 2, label: '🏢 Startup & SME Provisions', text: 'Please verify if there are any special EPF/ESIC rate provisions for startups, small businesses, or specific industries.' },
  { id: 3, label: '📋 Statutory Wage Ceilings', text: 'Please verify the current wage ceiling limits for EPF and ESIC contributions and check if there have been any recent revisions.' }
]

watch([() => editingData.value.wageDays, () => editingData.value.pDayWage], () => {
  if (editingData.value.wageDays && editingData.value.pDayWage) {
    editingData.value.grossSalary = Number(editingData.value.wageDays) * Number(editingData.value.pDayWage)
  }
}, { deep: true })

const refreshAiRulesWithGuidance = async () => {
  const guidance = aiGuidanceText.value.trim()
  showAIGuidanceDialog.value = false
  await refreshAiRules(guidance || null)
  aiGuidanceText.value = ''
}

const refreshAiRules = async (userGuidance: string | null = '') => {
  try {
    refreshingAiRules.value = true
    if (!isConfigured.value) {
      toast.add({ title: 'AI Error', description: 'AI configuration required.', color: 'error' })
      return
    }

    toast.add({ title: 'Sync Initialized', description: 'Statutory rules are being analyzed by AI...', color: 'info' })

    const response = await makeAIRequest('/api/ai/epf-esic-verify-background', {
      method: 'POST',
      body: { jobId: `epf_esic_verify_${Date.now()}`, userGuidance: userGuidance || null }
    })
    
    if (response.success) {
      const jobId = response.jobId
      const checkJobStatus = async () => {
        try {
          const statusResponse = await makeAIRequest(`/api/ai/epf-esic-verify-status?jobId=${jobId}`, { method: 'GET' })
          if (statusResponse.status === 'completed' && statusResponse.rules) {
            updateRulesDirectly(statusResponse.rules)
            emit('refresh')
            toast.add({ title: 'Sync Successful', description: 'AI has updated the statutory rates.', color: 'success' })
            refreshingAiRules.value = false
          } else if (statusResponse.status === 'failed') {
            toast.add({ title: 'Sync Failed', description: statusResponse.error?.message || 'AI engine failure', color: 'error' })
            refreshingAiRules.value = false
          } else {
            setTimeout(checkJobStatus, 5000)
          }
        } catch (e) {
          refreshingAiRules.value = false
        }
      }
      setTimeout(checkJobStatus, 3000)
    }
  } catch (error) {
    refreshingAiRules.value = false
  }
}

const getProviderName = (id: string) => AI_PROVIDERS.find(p => p.id === id)?.name || id

const openAISettings = () => {
  window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { activeTab: 'ai' } }))
}

const startEditing = (employee: any) => {
  editingEmployeeId.value = employee.employeeId
  editingData.value = { ...employee }
}

const cancelEditing = () => {
  editingEmployeeId.value = null
  editingData.value = {}
}

const saveEditing = () => {
  emit('update-employee', { ...editingData.value })
  toast.add({ title: 'Data Updated', description: `Modified record for ${editingData.value.employeeName}`, color: 'success' })
  cancelEditing()
}

const filteredData = computed(() => {
  let filtered = props.pfEsicData
  if (props.filters.project && props.filters.project !== 'all') filtered = filtered.filter(emp => emp.project === props.filters.project)
  if (props.filters.site && props.filters.site !== 'all') filtered = filtered.filter(emp => emp.site === props.filters.site)
  if (props.filters.status && props.filters.status !== 'all') filtered = filtered.filter(emp => emp.paymentStatus === props.filters.status)
  return filtered
})

const uniqueProjects = computed(() => [...new Set(props.pfEsicData.map(e => e.project).filter(p => p && p !== 'N/A'))].sort())
const uniqueSites = computed(() => [...new Set(props.pfEsicData.map(e => e.site).filter(s => s && s !== 'N/A'))].sort())

const totalGrossSalary = computed(() => filteredData.value.reduce((s, e) => s + Number(e.grossSalary || 0), 0).toFixed(2))
const totalEmployeeEpf = computed(() => filteredData.value.reduce((s, e) => s + Number(e.employeeEpf || 0), 0).toFixed(2))
const totalEmployerEpfContribution = computed(() => filteredData.value.reduce((s, e) => s + Number(e.totalEmployerEpfContribution || 0), 0).toFixed(2))
const totalEpfContribution = computed(() => filteredData.value.reduce((s, e) => s + Number(e.totalEpfContribution || 0), 0).toFixed(2))
const totalEmployeeEsic = computed(() => filteredData.value.reduce((s, e) => s + Number(e.employeeEsic || 0), 0).toFixed(2))
const totalEmployerEsic = computed(() => filteredData.value.reduce((s, e) => s + Number(e.employerEsic || 0), 0).toFixed(2))
const totalEsicContribution = computed(() => filteredData.value.reduce((s, e) => s + Number(e.totalEsicContribution || 0), 0).toFixed(2))
const totalEmployerEps = computed(() => filteredData.value.reduce((s, e) => s + Number(e.employerEps || 0), 0).toFixed(2))
const totalAdminCharges = computed(() => filteredData.value.reduce((s, e) => s + Number(e.adminCharges || 0), 0).toFixed(2))

const formatMonthYear = (s: string) => {
  if (!s) return 'N/A'
  const [y, m] = s.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
}

const formatIndianCurrency = (n: any) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const clearFilters = () => {
  props.filters.project = 'all'
  props.filters.site = 'all'
  props.filters.status = 'all'
}

const exportToExcel = async () => {
  try {
    const api = useApiWithAuth()
    const exportData = {
      month: props.selectedMonth,
      employees: filteredData.value,
      summary: { totalGrossSalary: totalGrossSalary.value, epf: totalEpfContribution.value, esic: totalEsicContribution.value },
      filters: props.filters
    }
    const response = await api.post('/api/wages/pf-esic-export', exportData, { responseType: 'blob' })
    const blob = response instanceof Blob ? response : new Blob([response])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `PF-ESIC-Report-${props.selectedMonth}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    toast.add({ title: 'Export Failed', color: 'error' })
  }
}
</script>

<style scoped>
.text-shadow { text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
</style>
