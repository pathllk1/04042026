<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'max-w-4xl lg:max-w-5xl h-[90vh]', overlay: { base: 'z-[1000]' }, wrapper: { base: 'z-[1000]' } }">
    <template #content>
      <UCard :ui="{ body: 'p-0 overflow-hidden', header: 'bg-indigo-50 dark:bg-indigo-950/20 p-4' }" class="h-full flex flex-col">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <h2 class="text-xl font-semibold text-indigo-700 dark:text-indigo-300">Enterprise Settings & Tools</h2>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="closePopup"
            />
          </div>
        </template>

        <div class="flex flex-col h-full overflow-hidden">
          <UTabs :items="tabItems" v-model="activeTab" class="w-full" :ui="{ list: 'rounded-none border-b border-gray-200 dark:border-gray-800' }" />
          
          <div class="flex-grow overflow-y-auto p-6">
            <!-- Tools Tab -->
            <div v-if="activeTab === 'tools'" class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <UCard
                  v-for="tool in tools"
                  :key="tool.id"
                  @click="navigateTo(tool.action || tool.path)"
                  class="cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all duration-200"
                  :ui="{ body: { padding: 'p-4' } }"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <UIcon :name="tool.uIcon || 'i-heroicons-wrench'" class="w-6 h-6" />
                    </div>
                    <h3 class="font-bold text-gray-900 dark:text-white">{{ tool.name }}</h3>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{{ tool.description }}</p>
                </UCard>
              </div>

              <!-- User Settings Backup/Restore -->
              <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
                <div class="flex items-center gap-2 mb-4">
                  <UIcon name="i-heroicons-circle-stack" class="w-5 h-5 text-indigo-500" />
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white">Settings Backup & Restore</h3>
                </div>

                <UAlert
                  icon="i-heroicons-exclamation-triangle"
                  color="amber"
                  variant="subtle"
                  title="Comprehensive Data Backup"
                  description="This feature exports/imports ALL your data from localStorage. Use this for complete backup/restore or when switching devices."
                  class="mb-6"
                />

                <!-- Data Summary -->
                <ClientOnly>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <UCard v-for="(val, key) in displayDataSummary" :key="key" :ui="{ body: { padding: 'p-3' } }">
                      <div class="text-xl font-bold text-indigo-600 dark:text-indigo-400">{{ val }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 capitalize">{{ key.replace(/([A-Z])/g, ' $1') }}</div>
                    </UCard>
                  </div>
                  <template #fallback>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 opacity-50">
                      <UCard v-for="i in 3" :key="i" :ui="{ body: { padding: 'p-3' } }">
                        <div class="text-xl font-bold text-gray-300">...</div>
                        <div class="text-xs text-gray-400">Loading...</div>
                      </UCard>
                    </div>
                  </template>
                </ClientOnly>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Export All Settings -->
                  <UCard :ui="{ body: { padding: 'p-4' } }">
                    <template #header>
                      <h4 class="font-bold text-sm text-green-700 dark:text-green-400">Export All Data</h4>
                    </template>
                    <div class="space-y-3 mb-4">
                      <UCheckbox v-model="userDataExportOptions.includeAuthTokens" label="Include Auth Tokens (⚠️)" />
                      <UCheckbox v-model="userDataExportOptions.includeSensitiveData" label="Include API Keys (⚠️)" />
                      <UCheckbox v-model="userDataExportOptions.includeTemporaryData" label="Include Cache Data" />
                    </div>
                    <UButton
                      block
                      color="green"
                      icon="i-heroicons-arrow-up-tray"
                      :loading="userDataExportLoading"
                      @click="handleExportAllSettings"
                    >
                      Export Backup
                    </UButton>
                  </UCard>

                  <!-- Import Settings -->
                  <UCard :ui="{ body: { padding: 'p-4' } }">
                    <template #header>
                      <h4 class="font-bold text-sm text-purple-700 dark:text-purple-400">Restore from Backup</h4>
                    </template>
                    <div class="space-y-3 mb-4 text-xs">
                      <UCheckbox v-model="userDataImportOptions.mergeWithExisting" label="Merge with existing" />
                      <UCheckbox v-model="userDataImportOptions.importSensitiveData" label="Import API Keys" />
                    </div>
                    <input ref="userDataFileInput" type="file" accept=".json" class="hidden" @change="handleUserDataFileSelect" />
                    <div class="flex gap-2">
                      <UButton
                        class="flex-1"
                        variant="outline"
                        color="purple"
                        icon="i-heroicons-document-plus"
                        @click="$refs.userDataFileInput?.click()"
                      >
                        {{ selectedUserDataFile ? selectedUserDataFile.name : 'Choose File' }}
                      </UButton>
                      <UButton
                        class="flex-1"
                        color="purple"
                        icon="i-heroicons-arrow-down-tray"
                        :disabled="!selectedUserDataFile"
                        :loading="userDataImportLoading"
                        @click="handleImportAllSettings"
                      >
                        Restore
                      </UButton>
                    </div>
                  </UCard>
                </div>

                <UAlert
                  v-if="userDataMessage"
                  :color="userDataSuccess ? 'green' : 'red'"
                  variant="subtle"
                  class="mt-4"
                  :title="userDataMessage"
                />
              </div>
            </div>

            <!-- General Settings Tab -->
            <div v-if="activeTab === 'settings'" class="space-y-8">
              <section>
                <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <UIcon name="i-heroicons-paint-brush" class="w-5 h-5 text-indigo-500" />
                  <h3 class="text-lg font-bold">Appearance</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UFormField label="Theme" description="Choose your preferred visual theme">
                    <USelect v-model="settings.theme" :options="themeOptions" />
                  </UFormField>
                  <UFormField label="Font Size" description="Adjust application text scaling">
                    <USelect v-model="settings.fontSize" :options="fontSizeOptions" />
                  </UFormField>
                </div>
              </section>

              <section>
                <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <UIcon name="i-heroicons-bell" class="w-5 h-5 text-indigo-500" />
                  <h3 class="text-lg font-bold">Preferences</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UCard :ui="{ body: { padding: 'p-4' } }">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-bold text-sm">Notifications</div>
                        <div class="text-xs text-gray-500">Enable in-app desktop notifications</div>
                      </div>
                      <USwitch v-model="settings.notifications" />
                    </div>
                  </UCard>
                  <UCard :ui="{ body: { padding: 'p-4' } }">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-bold text-sm">Sound Effects</div>
                        <div class="text-xs text-gray-500">Enable audio feedback for actions</div>
                      </div>
                      <USwitch v-model="settings.sounds" />
                    </div>
                  </UCard>
                </div>
              </section>

              <section v-if="isAuthenticated && canAccessAdmin">
                <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-indigo-500" />
                  <h3 class="text-lg font-bold">Default AI Engine</h3>
                </div>
                <UFormField label="Default AI Model" description="Used globally for quick actions">
                  <USelect v-model="settings.aiModel" :options="aiModelOptions" />
                </UFormField>
              </section>

              <section>
                <div class="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <UIcon name="i-heroicons-view-columns" class="w-5 h-5 text-indigo-500" />
                  <h3 class="text-lg font-bold">Dashboard Customization</h3>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <UCard v-for="(visible, toolId) in settings.visibleTools" :key="toolId" :ui="{ body: { padding: 'p-3' } }">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium capitalize">{{ toolId.replace(/([A-Z])/g, ' $1') }}</span>
                      <USwitch v-model="settings.visibleTools[toolId]" size="xs" />
                    </div>
                  </UCard>
                </div>
              </section>
            </div>

            <!-- AI Settings Tab -->
            <div v-if="activeTab === 'ai'" class="space-y-6">
              <UAlert
                icon="i-heroicons-information-circle"
                color="blue"
                variant="subtle"
                title="AI Provider Configuration"
                description="Your API keys are stored securely in your browser's local storage and are never transmitted to our servers."
              />

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Provider Sidebar -->
                <div class="lg:col-span-4 space-y-4">
                  <h4 class="font-bold text-sm uppercase tracking-wider text-gray-500">Providers</h4>
                  <div class="space-y-2">
                    <div
                      v-for="provider in providers"
                      :key="provider.id"
                      @click="handleProviderChange(provider.id)"
                      class="p-3 rounded-lg border cursor-pointer transition-all duration-200"
                      :class="aiConfig.provider === provider.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-sm">{{ provider.name }}</span>
                        <UIcon v-if="hasApiKeyForProvider(provider.id)" name="i-heroicons-key-solid" class="text-green-500 w-4 h-4" />
                      </div>
                      <p class="text-[10px] text-gray-500 mt-1">{{ provider.description }}</p>
                    </div>

                    <div v-if="getActiveCustomProviders().length > 0" class="pt-4">
                      <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom Providers</h4>
                      <div
                        v-for="customProvider in getActiveCustomProviders()"
                        :key="customProvider.id"
                        @click="handleProviderChange(customProvider.id)"
                        class="p-3 rounded-lg border cursor-pointer transition-all duration-200 mb-2"
                        :class="aiConfig.provider === customProvider.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
                      >
                        <div class="flex items-center justify-between">
                          <span class="font-bold text-sm">🔧 {{ customProvider.name }}</span>
                          <UIcon v-if="hasApiKeyForProvider(customProvider.id)" name="i-heroicons-key-solid" class="text-green-500 w-4 h-4" />
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1 truncate">{{ customProvider.baseUrl }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Model & Key Config -->
                <div class="lg:col-span-8 space-y-6">
                  <div v-if="currentProvider" class="space-y-6">
                    <UCard>
                      <template #header>
                        <div class="flex items-center justify-between">
                          <h4 class="font-bold">API Configuration</h4>
                          <UBadge v-if="isConfigured" color="green" variant="subtle">Active</UBadge>
                        </div>
                      </template>
                      
                      <UFormField label="API Key" :error="aiError">
                        <div class="flex gap-2">
                          <UInput
                            v-model="tempApiKey"
                            :type="showApiKey ? 'text' : 'password'"
                            :placeholder="`Enter ${currentProvider.name} key`"
                            class="flex-grow"
                            @input="handleApiKeyChange($event)"
                          >
                            <template #trailing>
                              <UButton
                                color="neutral"
                                variant="ghost"
                                :icon="showApiKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                                @click="toggleApiKeyVisibility"
                              />
                            </template>
                          </UInput>
                          <UButton
                            color="indigo"
                            :loading="testingApiKey"
                            @click="testApiKey"
                          >
                            Test
                          </UButton>
                        </div>
                        <template #help>
                          <span v-if="apiKeyValid" class="text-green-500 flex items-center gap-1">
                            <UIcon name="i-heroicons-check-circle" /> Valid API Key
                          </span>
                        </template>
                      </UFormField>

                      <div class="mt-6">
                        <UFormField label="Available Models">
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div
                              v-for="model in availableModels"
                              :key="model.id"
                              @click="handleModelChange(model.id)"
                              class="p-3 rounded-lg border cursor-pointer transition-all"
                              :class="aiConfig.model === model.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50'"
                            >
                              <div class="font-bold text-sm">{{ model.name }}</div>
                              <div class="text-[10px] text-gray-500 line-clamp-1">{{ model.description }}</div>
                            </div>
                          </div>
                        </UFormField>
                      </div>

                      <ClientOnly>
                        <div v-if="currentModel" class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                          <div class="flex items-center justify-between">
                            <h5 class="text-xs font-bold uppercase tracking-wider text-gray-500">Model Advanced Settings</h5>
                            <UBadge variant="subtle" size="xs" color="indigo">{{ currentModel.name }}</UBadge>
                          </div>
                          
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <UFormField label="Temperature" :help="`Current: ${aiConfig.temperature || 0.7}`">
                              <USlider
                                v-model="aiConfigExtended.temperature"
                                :min="0"
                                :max="1"
                                :step="0.1"
                                size="sm"
                                color="indigo"
                              />
                              <div class="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>Precise (0)</span>
                                <span>Creative (1)</span>
                              </div>
                            </UFormField>

                            <UFormField label="Max Tokens" :help="`Output limit: ${aiConfig.maxTokens || 4096}`">
                              <UInput
                                v-model="aiConfigExtended.maxTokens"
                                type="number"
                                size="sm"
                                :min="1"
                                :max="currentModel.maxTokens"
                                icon="i-heroicons-chat-bubble-bottom-center-text"
                              />
                              <div class="text-[10px] text-gray-400 mt-1">
                                Max allowed: {{ currentModel.maxTokens }}
                              </div>
                            </UFormField>
                          </div>
                          
                          <div v-if="aiConfig.provider === 'groq' && (aiConfig.maxTokens || 0) > 4000" class="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 flex gap-2 items-start">
                            <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-amber-500 mt-0.5" />
                            <p class="text-[10px] text-amber-700 dark:text-amber-400">
                              <strong>Note:</strong> Groq has strict TPM limits. Setting Max Tokens above 4000 may cause "Content Too Large" errors on some models.
                            </p>
                          </div>
                        </div>
                      </ClientOnly>
                    </UCard>

                    <ClientOnly>
                      <CustomProviderManager />
                      <AIUsageMonitor v-if="isConfigured" />
                    </ClientOnly>
                  </div>
                  <div v-else class="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <UIcon name="i-heroicons-arrow-left-circle" class="w-12 h-12 mb-2" />
                    <p>Select a provider to configure</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes Tab -->
            <div v-if="activeTab === 'notes'" class="h-full overflow-hidden flex flex-col">
              <NotesTab class="flex-grow overflow-y-auto" />
            </div>

            <!-- Shortcuts Tab -->
            <div v-if="activeTab === 'shortcuts'" class="space-y-6">
              <UCard>
                <template #header>
                  <h3 class="font-bold">Enterprise Productivity Shortcuts</h3>
                </template>
                <div class="divide-y divide-gray-100 dark:divide-gray-800">
                  <div v-for="sc in shortcutList" :key="sc.key" class="py-4 flex items-center justify-between">
                    <div>
                      <div class="font-bold text-sm">{{ sc.name }}</div>
                      <div class="text-xs text-gray-500">{{ sc.description }}</div>
                    </div>
                    <div class="flex gap-1">
                      <UKbd v-for="k in sc.keys" :key="k">{{ k }}</UKbd>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>

            <!-- About Tab -->
            <div v-if="activeTab === 'about'" class="h-full flex flex-col items-center justify-center space-y-8 text-center py-10">
              <div class="relative">
                <div class="absolute -inset-4 bg-indigo-500/20 blur-2xl rounded-full animate-pulse"></div>
                <div class="relative w-24 h-24 bg-white dark:bg-gray-900 rounded-3xl shadow-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
                  <UIcon name="i-heroicons-shield-check" class="w-16 h-16 text-indigo-600" />
                </div>
              </div>
              
              <div>
                <h3 class="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Enterprise Suite</h3>
                <p class="text-indigo-600 dark:text-indigo-400 font-bold">Version 1.0.0 Stable</p>
              </div>

              <UCard class="max-w-md w-full" :ui="{ body: { padding: 'p-6' } }">
                <h4 class="font-bold mb-4">Enterprise Data Policy</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Your enterprise environment is designed with privacy-first architecture. 
                  All local data is automatically purged upon session termination to ensure zero-footprint operation on shared workstations.
                </p>
                <div class="mt-6 flex justify-center gap-3">
                  <UButton color="indigo" variant="solid">Documentation</UButton>
                  <UButton color="neutral" variant="ghost">Release Notes</UButton>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
            <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
              System Status: <span class="text-green-500">Optimal</span>
            </div>
            <div class="flex gap-3">
              <UButton variant="ghost" color="neutral" @click="closePopup">Cancel</UButton>
              <UButton color="indigo" icon="i-heroicons-check-circle" @click="saveSettings">Commit Changes</UButton>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup>
// Nuxt v4 handles auto-imports for Vue, Nuxt, and project components/composables
import { showAccessDenied } from '~~/utils/accessDenied';
import { AI_PROVIDERS } from '~/types/ai';

// Explicitly import components as they are not being auto-resolved correctly
import NotesTab from '~/components/tools/NotesTab.vue';
import AIUsageMonitor from '~/components/tools/AIUsageMonitor.vue';
import CustomProviderManager from '~/components/tools/CustomProviderManager.vue';

// Explicitly import composables from subdirectories as they are not auto-imported by default
import useUserRole from '~/composables/auth/useUserRole';
import { useAIConfig } from '~/composables/ai/useAIConfig';
import { useUserDataManager } from '~/composables/utils/useUserDataManager';

// Props for v-model binding
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:isOpen']);

const router = useRouter();
const isOpen = computed({
  get: () => props.isOpen,
  set: (value) => emit('update:isOpen', value)
});

const activeTab = ref('tools');
const tabItems = [
  { label: 'Tools', icon: 'i-heroicons-command-line', value: 'tools' },
  { label: 'Settings', icon: 'i-heroicons-adjustments-horizontal', value: 'settings' },
  { label: 'AI Settings', icon: 'i-heroicons-sparkles', value: 'ai' },
  { label: 'Notes', icon: 'i-heroicons-pencil-square', value: 'notes' },
  { label: 'Shortcuts', icon: 'i-heroicons-bolt', value: 'shortcuts' },
  { label: 'About', icon: 'i-heroicons-information-circle', value: 'about' }
];

// Authentication state
const { user, isLoggedIn } = useAuth();
const isAuthenticated = computed(() => isLoggedIn.value);

// Get user role information
const { isAdmin, isSubContractor, isManager, hasRolePrivilege, ROLES } = useUserRole();
const isAdminUser = computed(() => isAdmin());
const canAccessAdmin = computed(() => hasRolePrivilege(ROLES.ADMIN));

// AI Configuration
const {
  aiConfig,
  currentProvider,
  currentModel,
  availableModels,
  isConfigured,
  providers,
  updateProvider,
  updateModel,
  updateApiKey,
  validateApiKey,
  isLoading: aiLoading,
  error: aiError,
  getCurrentApiKey,
  hasApiKeyForProvider,
  hasApiKeyForModel,
  getActiveCustomProviders,
  exportToFile,
  importFromFile
} = useAIConfig();

// Extended AI config for advanced settings
const aiConfigExtended = computed({
  get: () => ({
    temperature: aiConfig.value?.temperature || 0.7,
    maxTokens: aiConfig.value?.maxTokens || 4096
  }),
  set: (val) => {
    if (val.temperature !== undefined) aiConfig.value.temperature = val.temperature;
    if (val.maxTokens !== undefined) aiConfig.value.maxTokens = val.maxTokens;
  }
});

const {
  exportToFile: exportUserDataToFile,
  importFromFile: importUserDataFromFile,
  getDataSummary
} = useUserDataManager();

// State
const showApiKey = ref(false);
const testingApiKey = ref(false);
const apiKeyValid = ref(false);
const tempApiKey = ref('');
const userDataExportLoading = ref(false);
const userDataImportLoading = ref(false);
const selectedUserDataFile = ref(null);
const userDataMessage = ref('');
const userDataSuccess = ref(false);

const userDataExportOptions = ref({
  includeAuthTokens: false,
  includeSensitiveData: false,
  includeTemporaryData: false
});

const userDataImportOptions = ref({
  mergeWithExisting: true,
  importAuthTokens: false,
  importSensitiveData: false,
  importTemporaryData: false
});

const displayDataSummary = computed(() => {
  const s = getDataSummary();
  return {
    total: s.totalItems,
    AI: s.categories.aiSettings,
    App: s.categories.appSettings,
    User: s.categories.userData,
    Keys: s.categories.apiKeys
  };
});

const defaultSettings = {
  theme: 'light',
  fontSize: 'medium',
  notifications: true,
  sounds: false,
  aiModel: 'gemini-2.5-flash',
  visibleTools: {
    calculator: true,
    pdfTools: true,
    taskManager: true,
    todoList: true,
    weather: true,
    translator: true,
    news: true,
    notes: true,
    imageEditor: true
  }
};

const ensureValidSettings = (obj) => {
  const res = { ...defaultSettings, ...obj };
  res.visibleTools = { ...defaultSettings.visibleTools, ...obj?.visibleTools };
  return res;
};

const settings = ref(ensureValidSettings({}));

const themeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System Default', value: 'system' }
];

const fontSizeOptions = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' }
];

const aiModelOptions = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' }
];

const allTools = [
  {
    id: 'ai',
    name: 'AI Assistant',
    description: 'Create professional documents and guidance',
    uIcon: 'i-heroicons-sparkles',
    path: '/ai/documents',
    requiredRole: 'authenticated'
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Financial and quick calculations',
    uIcon: 'i-heroicons-calculator',
    action: 'openCalculator'
  },
  {
    id: 'pdf-tools',
    name: 'PDF Suite',
    description: 'Compress, merge, and convert documents',
    uIcon: 'i-heroicons-document-duplicate',
    action: 'openPdfTools'
  },
  {
    id: 'task-manager',
    name: 'Workflow',
    description: 'Manage tasks and project priorities',
    uIcon: 'i-heroicons-briefcase',
    action: 'openTaskManager',
    requiredRole: 'authenticated'
  },
  {
    id: 'todo-list',
    name: 'Checklist',
    description: 'Daily operational tasks',
    uIcon: 'i-heroicons-list-bullet',
    action: 'openTodoList',
    requiredRole: 'authenticated'
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Global forecast and conditions',
    uIcon: 'i-heroicons-cloud',
    action: 'openWeather'
  },
  {
    id: 'translator',
    name: 'Translator',
    description: 'Real-time multi-language translation',
    uIcon: 'i-heroicons-language',
    action: 'openTranslator'
  },
  {
    id: 'text-to-image',
    name: 'Creative AI',
    description: 'Generate visuals from text prompts',
    uIcon: 'i-heroicons-photo',
    action: 'openTextToImage'
  },
  {
    id: 'news',
    name: 'Global News',
    description: 'Latest headlines and RSS feeds',
    uIcon: 'i-heroicons-newspaper',
    action: 'openNews'
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Secure personal knowledge base',
    uIcon: 'i-heroicons-book-open',
    action: 'openNotes',
    requiredRole: 'authenticated'
  },
  {
    id: 'admin',
    name: 'Console',
    description: 'System-wide administration',
    uIcon: 'i-heroicons-command-line',
    path: '/admin',
    requiredRole: 'admin'
  }
];

const tools = computed(() => {
  return allTools.filter(tool => {
    if (tool.requiredRole === 'authenticated' && !isAuthenticated.value) return false;
    if (tool.requiredRole === 'admin' && !canAccessAdmin.value) return false;
    if (settings.value.visibleTools?.[tool.id] === false) return false;
    return true;
  });
});

const shortcutList = [
  { name: 'Open Settings', description: 'Global preferences', keys: ['Ctrl', ','] },
  { name: 'AI Assistant', description: 'Switch to AI docs', keys: ['Ctrl', 'A'] },
  { name: 'Admin Console', description: 'System management', keys: ['Ctrl', 'Shift', 'A'] },
  { name: 'Close Modal', description: 'Escape current view', keys: ['Esc'] }
];

const openPopup = () => { isOpen.value = true; };
const closePopup = () => { isOpen.value = false; };

const handleProviderChange = (providerId) => {
  updateProvider(providerId);
  const savedKey = getCurrentApiKey();
  tempApiKey.value = savedKey || '';
  apiKeyValid.value = !!savedKey;
};

const handleModelChange = (modelId) => {
  updateModel(modelId);
  const savedKey = getCurrentApiKey();
  tempApiKey.value = savedKey || '';
  apiKeyValid.value = !!savedKey;
};

const handleApiKeyChange = (event) => {
  const val = typeof event === 'string' ? event : event?.target?.value;
  if (typeof val !== 'string') return;
  tempApiKey.value = val;
  updateApiKey(val);
  apiKeyValid.value = false;
};

const testApiKey = async () => {
  if (!tempApiKey.value) return;
  testingApiKey.value = true;
  try {
    apiKeyValid.value = await validateApiKey(tempApiKey.value.trim());
    if (apiKeyValid.value) updateApiKey(tempApiKey.value.trim());
  } finally {
    testingApiKey.value = false;
  }
};

const toggleApiKeyVisibility = () => { showApiKey.value = !showApiKey.value; };

const handleExportAllSettings = async () => {
  userDataExportLoading.value = true;
  try {
    const res = await exportUserDataToFile(userDataExportOptions.value);
    showStatus(res.message, res.success);
  } finally {
    userDataExportLoading.value = false;
  }
};

const handleUserDataFileSelect = (ev) => {
  const file = ev.target.files?.[0];
  if (file) selectedUserDataFile.value = file;
};

const handleImportAllSettings = async () => {
  if (!selectedUserDataFile.value) return;
  userDataImportLoading.value = true;
  try {
    const res = await importUserDataFromFile(selectedUserDataFile.value, userDataImportOptions.value);
    showStatus(res.message, res.success);
    if (res.success) {
      selectedUserDataFile.value = null;
      const savedKey = getCurrentApiKey();
      if (savedKey) { tempApiKey.value = savedKey; apiKeyValid.value = true; }
    }
  } finally {
    userDataImportLoading.value = false;
  }
};

const showStatus = (msg, success) => {
  userDataMessage.value = msg;
  userDataSuccess.value = success;
  setTimeout(() => { userDataMessage.value = ''; }, 5000);
};

const saveSettings = () => {
  const valid = ensureValidSettings(settings.value);
  localStorage.setItem('app_settings', JSON.stringify(valid));
  applySettings();
  closePopup();
};

const applySettings = () => {
  document.documentElement.classList.remove('light-theme', 'dark-theme');
  document.documentElement.classList.add(`${settings.value.theme}-theme`);
  
  const sizes = ['text-sm', 'text-base', 'text-lg'];
  document.documentElement.classList.remove(...sizes);
  const map = { small: 'text-sm', medium: 'text-base', large: 'text-lg' };
  document.documentElement.classList.add(map[settings.value.fontSize]);
};

const navigateTo = (pathOrAction) => {
  const events = {
    openCalculator: 'open-calculator',
    openPdfTools: 'open-pdf-tools',
    openTaskManager: 'open-task-manager',
    openTodoList: 'open-todo-list',
    openTextToImage: 'open-text-to-image',
    openNews: 'open-news',
    openWeather: 'open-weather',
    openTranslator: 'open-translator',
    openChat: 'open-chat'
  };

  if (events[pathOrAction]) {
    window.dispatchEvent(new CustomEvent(events[pathOrAction]));
    if (pathOrAction === 'openChat') closePopup();
    return;
  }

  if (pathOrAction === 'openNotes') {
    activeTab.value = 'notes';
    return;
  }

  router.push(pathOrAction);
  closePopup();
};

// Handle set-settings-tab event
const handleSetSettingsTab = (event) => {
  if (event.detail && tabItems.some(tab => tab.value === event.detail)) {
    activeTab.value = event.detail;
  }
};

// Handle opening global settings from external components
const handleOpenGlobalSettings = (event) => {
  if (event.detail?.activeTab) {
    activeTab.value = event.detail.activeTab;
  }
  isOpen.value = true;
};

onMounted(() => {
  window.addEventListener('set-settings-tab', handleSetSettingsTab);
  window.addEventListener('open-global-settings', handleOpenGlobalSettings);

  const saved = localStorage.getItem('app_settings');
  if (saved) {
    try {
      settings.value = ensureValidSettings(JSON.parse(saved));
      applySettings();
    } catch (e) {}
  }

  const savedKey = getCurrentApiKey();
  if (savedKey) { tempApiKey.value = savedKey; apiKeyValid.value = true; }
});

onUnmounted(() => {
  window.removeEventListener('set-settings-tab', handleSetSettingsTab);
  window.removeEventListener('open-global-settings', handleOpenGlobalSettings);
});

defineExpose({ openPopup, closePopup });
</script>

<style scoped>
.flex-grow { flex-grow: 1; }
</style>
