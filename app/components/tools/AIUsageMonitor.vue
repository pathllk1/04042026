<template>
  <div class="bg-white rounded-lg border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-medium text-gray-900">AI Usage Monitor</h3>
      <div class="flex items-center space-x-2">
        <select
          v-model="selectedPeriod"
          @change="fetchUsageStats"
          class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <button
          @click="fetchUsageStats"
          :disabled="loading"
          class="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center">
        <svg class="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <span class="text-red-800 text-sm">{{ error }}</span>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1.586l-4 4z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-blue-600">Total Requests</p>
              <p class="text-2xl font-semibold text-blue-900">{{ usageStats.totalRequests.toLocaleString() }}</p>
            </div>
          </div>
        </div>

        <div class="bg-green-50 rounded-lg p-4">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-green-600">Total Tokens</p>
              <p class="text-2xl font-semibold text-green-900">{{ usageStats.totalTokens.toLocaleString() }}</p>
            </div>
          </div>
        </div>

        <div class="bg-yellow-50 rounded-lg p-4">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-yellow-600">Estimated Cost</p>
              <p class="text-2xl font-semibold text-yellow-900">${{ usageStats.totalCost.toFixed(2) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage by Provider -->
      <div v-if="Object.keys(usageStats.byProvider).length > 0">
        <h4 class="text-sm font-medium text-gray-900 mb-3">Usage by Provider</h4>
        <div class="space-y-2">
          <div
            v-for="(stats, provider) in usageStats.byProvider"
            :key="provider"
            class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center">
              <div class="w-3 h-3 rounded-full mr-3" :class="getProviderColor(provider)"></div>
              <span class="text-sm font-medium text-gray-900 capitalize">{{ provider }}</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">{{ stats.requests }} requests</div>
              <div class="text-xs text-gray-500">${{ stats.cost.toFixed(2) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage by Model -->
      <div v-if="Object.keys(usageStats.byModel).length > 0">
        <h4 class="text-sm font-medium text-gray-900 mb-3">Usage by Model</h4>
        <div class="space-y-2">
          <div
            v-for="(stats, model) in usageStats.byModel"
            :key="model"
            class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <span class="text-sm font-medium text-gray-900">{{ model }}</span>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">{{ stats.requests }} requests</div>
              <div class="text-xs text-gray-500">{{ stats.tokens.toLocaleString() }} tokens</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clear Usage Data -->
      <div class="pt-4 border-t border-gray-200">
        <button
          @click="clearUsageData"
          class="text-sm text-red-600 hover:text-red-800 focus:outline-none"
        >
          Clear local usage data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAIConfig } from '~/composables/ai/useAIConfig'

const { clearUsageStats } = useAIConfig()

const loading = ref(false)
const error = ref(null)
const selectedPeriod = ref('30d')
const usageStats = ref({
  totalRequests: 0,
  totalTokens: 0,
  totalCost: 0,
  byProvider: {},
  byModel: {},
  dailyUsage: [],
  topEndpoints: []
})

const fetchUsageStats = async () => {
  loading.value = true
  error.value = null

  try {
    const stats = await $fetch('/api/ai/usage-stats', {
      params: {
        period: selectedPeriod.value
      }
    })
    
    usageStats.value = stats
  } catch (err) {
    error.value = err.message || 'Failed to fetch usage statistics'
    console.error('Error fetching usage stats:', err)
  } finally {
    loading.value = false
  }
}

const clearUsageData = () => {
  if (confirm('Are you sure you want to clear all local usage data? This action cannot be undone.')) {
    clearUsageStats()
    usageStats.value = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {},
      byModel: {},
      dailyUsage: [],
      topEndpoints: []
    }
  }
}

const getProviderColor = (provider) => {
  const colors = {
    google: 'bg-blue-500',
    openai: 'bg-green-500',
    anthropic: 'bg-purple-500',
    openrouter: 'bg-orange-500'
  }
  return colors[provider] || 'bg-gray-500'
}

onMounted(() => {
  fetchUsageStats()
})
</script>
