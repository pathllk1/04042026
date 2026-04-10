<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium text-gray-900">🔧 Custom AI Providers</h3>
        <p class="text-sm text-gray-500">Add any AI provider with OpenAI-compatible API</p>
      </div>
      <button
        @click="showAddProvider = true"
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <PlusIcon class="h-4 w-4 mr-1" />
        Add Provider
      </button>
    </div>

    <!-- Active Custom Providers -->
    <div v-if="activeCustomProviders.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-gray-700">Active Custom Providers</h4>
      <div class="grid gap-3">
        <div
          v-for="provider in activeCustomProviders"
          :key="provider.id"
          class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <h5 class="font-medium text-gray-900">{{ provider.name }}</h5>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {{ provider.requestFormat.toUpperCase() }}
                </span>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ provider.baseUrl }}</p>
              <p class="text-xs text-gray-400 mt-1">
                {{ provider.models.length }} models: {{ provider.models.slice(0, 3).join(', ') }}
                <span v-if="provider.models.length > 3">...</span>
              </p>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="editProvider(provider)"
                class="text-gray-400 hover:text-gray-600"
                title="Edit Provider"
              >
                <PencilIcon class="h-4 w-4" />
              </button>
              <button
                @click="toggleProvider(provider.id)"
                class="text-gray-400 hover:text-gray-600"
                title="Disable Provider"
              >
                <EyeSlashIcon class="h-4 w-4" />
              </button>
              <button
                @click="removeProvider(provider.id)"
                class="text-red-400 hover:text-red-600"
                title="Remove Provider"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Templates -->
    <div class="space-y-3">
      <h4 class="text-sm font-medium text-gray-700">🚀 Quick Setup Templates</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          v-for="template in customProviderTemplates"
          :key="template.id"
          class="border border-gray-200 rounded-lg p-3 hover:border-blue-300 cursor-pointer transition-colors"
          @click="addFromTemplate(template)"
        >
          <div class="flex items-center justify-between">
            <h5 class="font-medium text-gray-900">{{ template.name }}</h5>
            <PlusIcon class="h-4 w-4 text-gray-400" />
          </div>
          <p class="text-xs text-gray-500 mt-1">{{ template.baseUrl }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ template.models.length }} models</p>
        </div>
      </div>
    </div>

    <!-- Add/Edit Provider Modal -->
    <div v-if="showAddProvider || editingProvider" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            {{ editingProvider ? 'Edit Custom Provider' : 'Add Custom Provider' }}
          </h3>
          
          <form @submit.prevent="saveProvider" class="space-y-4">
            <!-- Provider Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Provider Name</label>
              <input
                v-model="providerForm.name"
                type="text"
                required
                placeholder="e.g., Groq, Local Ollama"
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Base URL -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Base URL</label>
              <input
                v-model="providerForm.baseUrl"
                type="url"
                required
                placeholder="https://api.groq.com/openai/v1"
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- API Key Configuration -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">API Key Header</label>
                <input
                  v-model="providerForm.apiKeyHeader"
                  type="text"
                  placeholder="Authorization"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">API Key Prefix</label>
                <input
                  v-model="providerForm.apiKeyPrefix"
                  type="text"
                  placeholder="Bearer "
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <!-- Request/Response Format -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Request Format</label>
                <select
                  v-model="providerForm.requestFormat"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="openai">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic Compatible</option>
                  <option value="google">Google Compatible</option>
                  <option value="custom">Custom Format</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Response Format</label>
                <select
                  v-model="providerForm.responseFormat"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="openai">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic Compatible</option>
                  <option value="google">Google Compatible</option>
                  <option value="custom">Custom Format</option>
                </select>
              </div>
            </div>

            <!-- Models -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Available Models</label>
              <textarea
                v-model="modelsText"
                rows="3"
                placeholder="Enter model names, one per line&#10;llama-3.1-70b-versatile&#10;mixtral-8x7b-32768"
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">Enter one model name per line</p>
            </div>

            <!-- Advanced Options -->
            <div class="space-y-3">
              <div class="flex items-center space-x-4">
                <label class="flex items-center">
                  <input
                    v-model="providerForm.supportsStreaming"
                    type="checkbox"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span class="ml-2 text-sm text-gray-700">Supports Streaming</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="providerForm.supportsSystemPrompt"
                    type="checkbox"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span class="ml-2 text-sm text-gray-700">Supports System Prompt</span>
                </label>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700">Max Tokens Limit</label>
                <input
                  v-model.number="providerForm.maxTokensLimit"
                  type="number"
                  min="1"
                  max="1000000"
                  placeholder="32768"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="cancelEdit"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {{ editingProvider ? 'Update Provider' : 'Add Provider' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { PlusIcon, PencilIcon, EyeSlashIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { CustomAIProvider } from '~/types/ai'
import { useAIConfig } from '~/composables/ai/useAIConfig'

const {
  getAllCustomProviders,
  getActiveCustomProviders,
  addCustomProvider,
  updateCustomProvider,
  removeCustomProvider,
  toggleCustomProvider,
  createProviderFromTemplate,
  customProviderTemplates
} = useAIConfig()

// State
const showAddProvider = ref(false)
const editingProvider = ref<CustomAIProvider | null>(null)

// Form state
const providerForm = ref({
  name: '',
  baseUrl: '',
  apiKeyHeader: 'Authorization',
  apiKeyPrefix: 'Bearer ',
  requestFormat: 'openai' as const,
  responseFormat: 'openai' as const,
  models: [] as string[],
  supportsStreaming: true,
  supportsSystemPrompt: true,
  maxTokensLimit: 32768
})

const modelsText = ref('')

// Computed
const activeCustomProviders = computed(() => getActiveCustomProviders())

// Watch models text to update form
watch(modelsText, (newValue) => {
  providerForm.value.models = newValue
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
})

// Methods
const addFromTemplate = (template: any) => {
  const provider = createProviderFromTemplate(template.id)
  addCustomProvider(provider)
}

const editProvider = (provider: CustomAIProvider) => {
  editingProvider.value = provider
  providerForm.value = {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKeyHeader: provider.apiKeyHeader,
    apiKeyPrefix: provider.apiKeyPrefix,
    requestFormat: provider.requestFormat,
    responseFormat: provider.responseFormat,
    models: [...provider.models],
    supportsStreaming: provider.supportsStreaming ?? true,
    supportsSystemPrompt: provider.supportsSystemPrompt ?? true,
    maxTokensLimit: provider.maxTokensLimit ?? 32768
  }
  modelsText.value = provider.models.join('\n')
}

const saveProvider = () => {
  const providerData: CustomAIProvider = {
    id: editingProvider.value?.id || `custom-${Date.now()}`,
    ...providerForm.value,
    isActive: true,
    createdAt: editingProvider.value?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  if (editingProvider.value) {
    updateCustomProvider(editingProvider.value.id, providerData)
  } else {
    addCustomProvider(providerData)
  }

  cancelEdit()
}

const cancelEdit = () => {
  showAddProvider.value = false
  editingProvider.value = null
  providerForm.value = {
    name: '',
    baseUrl: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    requestFormat: 'openai',
    responseFormat: 'openai',
    models: [],
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxTokensLimit: 32768
  }
  modelsText.value = ''
}

const toggleProvider = (providerId: string) => {
  toggleCustomProvider(providerId)
}

const removeProvider = (providerId: string) => {
  if (confirm('Are you sure you want to remove this custom provider?')) {
    removeCustomProvider(providerId)
  }
}
</script>
