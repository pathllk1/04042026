import { ref, computed, watch, readonly } from 'vue'
import type { AIConfiguration, AIConfigurationExtended, AIProvider, AIModel, AIUsageStats, AIProviderKeys, AIModelKeys, CustomAIProvider } from '~/types/ai'
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, DEFAULT_AI_CONFIG_EXTENDED, CUSTOM_PROVIDER_TEMPLATES } from '~/types/ai'
import useLocalStorage from '~/composables/utils/useLocalStorage'

const AI_CONFIG_KEY = 'ai_configuration'
const AI_CONFIG_EXTENDED_KEY = 'ai_configuration_extended'
const AI_USAGE_KEY = 'ai_usage_stats'

export const useAIConfig = () => {
  const localStorage = useLocalStorage()

  // Reactive state - Extended configuration with multi-provider support
  const aiConfigExtended = ref<AIConfigurationExtended>({ ...DEFAULT_AI_CONFIG_EXTENDED })
  const usageStats = ref<AIUsageStats[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Helper function to get current model's full ID
  const getCurrentModelId = (): string => {
    return `${aiConfigExtended.value.currentProvider}/${aiConfigExtended.value.currentModel}`
  }

  // Helper function to get API key for current model
  const getCurrentModelApiKey = (): string => {
    const modelId = getCurrentModelId()
    // First try model-specific key, then fall back to provider key
    return aiConfigExtended.value.modelKeys[modelId] ||
           aiConfigExtended.value.providerKeys[aiConfigExtended.value.currentProvider] || ''
  }

  // Backward compatibility - computed property that mimics old AIConfiguration
  const aiConfig = computed<AIConfiguration>(() => ({
    provider: aiConfigExtended.value.currentProvider,
    apiKey: getCurrentModelApiKey(),
    model: aiConfigExtended.value.currentModel,
    temperature: aiConfigExtended.value.temperature,
    maxTokens: aiConfigExtended.value.maxTokens,
    customSettings: aiConfigExtended.value.customSettings
  }))

  // Load configuration from localStorage
  const loadConfig = () => {
    try {
      // Try to load extended configuration first
      const savedExtendedConfig = localStorage.getItem<AIConfigurationExtended>(AI_CONFIG_EXTENDED_KEY, null)

      if (savedExtendedConfig) {
        // Use extended configuration and ensure all new fields are present
        aiConfigExtended.value = {
          ...DEFAULT_AI_CONFIG_EXTENDED,
          ...savedExtendedConfig,
          // Ensure new fields exist (for backward compatibility)
          customProviders: savedExtendedConfig.customProviders || {},
          activeCustomProviders: savedExtendedConfig.activeCustomProviders || []
        }

        // Migrate deprecated model to new stable model
        if (aiConfigExtended.value.currentModel === 'gemini-2.5-flash-preview-04-17') {
          console.log('🔄 Migrating deprecated model to gemini-2.5-flash')
          aiConfigExtended.value.currentModel = 'gemini-2.5-flash'
          saveConfig() // Save the migrated configuration
        }
      } else {
        // Migrate from old configuration format
        const savedConfig = localStorage.getItem<AIConfiguration>(AI_CONFIG_KEY, DEFAULT_AI_CONFIG)

        // Migrate deprecated model to new stable model
        let migratedModel = savedConfig.model
        if (savedConfig.model === 'gemini-2.5-flash-preview-04-17') {
          console.log('🔄 Migrating deprecated model to gemini-2.5-flash')
          migratedModel = 'gemini-2.5-flash'
        }

        const modelId = `${savedConfig.provider}/${migratedModel}`
        aiConfigExtended.value = {
          ...DEFAULT_AI_CONFIG_EXTENDED,
          currentProvider: savedConfig.provider,
          currentModel: migratedModel,
          temperature: savedConfig.temperature,
          maxTokens: savedConfig.maxTokens,
          customSettings: savedConfig.customSettings,
          providerKeys: savedConfig.apiKey ? { [savedConfig.provider]: savedConfig.apiKey } : {},
          modelKeys: savedConfig.apiKey ? { [modelId]: savedConfig.apiKey } : {},
          providerModels: { [savedConfig.provider]: migratedModel },
          modelSettings: {},
          customProviders: {},
          activeCustomProviders: []
        }
        // Save migrated configuration
        saveConfig()
      }

      const savedUsage = localStorage.getItem<AIUsageStats[]>(AI_USAGE_KEY, [])
      usageStats.value = savedUsage
    } catch (err) {
      console.error('Error loading AI configuration:', err)
      error.value = 'Failed to load AI configuration'
    }
  }

  // Save configuration to localStorage
  const saveConfig = () => {
    try {
      localStorage.setItem(AI_CONFIG_EXTENDED_KEY, aiConfigExtended.value)
      // Also save in old format for backward compatibility
      localStorage.setItem(AI_CONFIG_KEY, aiConfig.value)
      error.value = null
    } catch (err) {
      console.error('Error saving AI configuration:', err)
      error.value = 'Failed to save AI configuration'
    }
  }

  // Save usage stats
  const saveUsageStats = () => {
    try {
      localStorage.setItem(AI_USAGE_KEY, usageStats.value)
    } catch (err) {
      console.error('Error saving usage stats:', err)
    }
  }

  // Watch for config changes and auto-save
  watch(aiConfigExtended, saveConfig, { deep: true })
  watch(usageStats, saveUsageStats, { deep: true })

  // Computed properties
  const currentProvider = computed((): AIProvider | undefined => {
    // Check if current provider is a custom provider
    const customProvider = aiConfigExtended.value.customProviders[aiConfigExtended.value.currentProvider]

    if (customProvider) {
      // Convert custom provider to AIProvider format
      return {
        id: customProvider.id,
        name: customProvider.name,
        description: `Custom provider: ${customProvider.baseUrl}`,
        models: customProvider.models.map(modelId => ({
          id: modelId,
          name: modelId,
          description: `Custom model from ${customProvider.name}`,
          maxTokens: customProvider.maxTokensLimit || 32768,
          costPer1kTokens: null
        })),
        apiKeyRequired: !!customProvider.apiKeyHeader,
        baseUrl: customProvider.baseUrl,
        headers: customProvider.customHeaders
      }
    }

    // Use built-in provider
    return AI_PROVIDERS.find(p => p.id === aiConfigExtended.value.currentProvider)
  })

  const currentModel = computed((): AIModel | undefined => {
    return currentProvider.value?.models.find(m => m.id === aiConfigExtended.value.currentModel)
  })

  const availableModels = computed((): AIModel[] => {
    // Check if current provider is a custom provider
    const customProvider = aiConfigExtended.value.customProviders[aiConfigExtended.value.currentProvider]

    if (customProvider) {
      // Convert custom provider models to AIModel format
      return customProvider.models.map(modelId => ({
        id: modelId,
        name: modelId,
        description: `Custom model from ${customProvider.name}`,
        maxTokens: customProvider.maxTokensLimit || 32768,
        costPer1kTokens: null // Custom providers don't have predefined costs
      }))
    }

    // Use built-in provider models
    return currentProvider.value?.models || []
  })

  const isConfigured = computed((): boolean => {
    const currentApiKey = getCurrentModelApiKey()
    return !!(aiConfigExtended.value.currentProvider && currentApiKey && aiConfigExtended.value.currentModel)
  })

  const totalUsage = computed(() => {
    return usageStats.value.reduce((acc, stat) => ({
      requests: acc.requests + stat.totalRequests,
      tokens: acc.tokens + stat.totalTokensUsed,
      cost: acc.cost + stat.estimatedCost
    }), { requests: 0, tokens: 0, cost: 0 })
  })

  // Methods
  const updateProvider = (providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    if (provider) {
      console.log('🔄 Switching provider to:', providerId)

      // Save current model for current provider
      if (aiConfigExtended.value.currentProvider) {
        aiConfigExtended.value.providerModels[aiConfigExtended.value.currentProvider] = aiConfigExtended.value.currentModel
      }

      // Switch to new provider
      aiConfigExtended.value.currentProvider = providerId

      // Restore last used model for this provider, or use first available
      const lastUsedModel = aiConfigExtended.value.providerModels[providerId]
      const modelExists = provider.models.find(m => m.id === lastUsedModel)

      if (lastUsedModel && modelExists) {
        aiConfigExtended.value.currentModel = lastUsedModel
        console.log('📋 Restored last used model:', lastUsedModel)
      } else if (provider.models.length > 0) {
        aiConfigExtended.value.currentModel = provider.models[0].id
        console.log('📋 Using default model:', provider.models[0].id)
      }

      // API key will be auto-populated from providerKeys (no need to clear)
      console.log('🔑 API key auto-populated:', !!aiConfigExtended.value.providerKeys[providerId])
    }
  }

  const updateModel = (modelId: string) => {
    const model = currentProvider.value?.models.find(m => m.id === modelId)
    if (model) {
      console.log('🔄 Switching model to:', modelId)

      // Save current model settings
      const currentModelId = getCurrentModelId()
      if (aiConfigExtended.value.temperature || aiConfigExtended.value.maxTokens) {
        aiConfigExtended.value.modelSettings[currentModelId] = {
          temperature: aiConfigExtended.value.temperature,
          maxTokens: aiConfigExtended.value.maxTokens
        }
      }

      // Switch to new model
      aiConfigExtended.value.currentModel = modelId
      const newModelId = getCurrentModelId()

      // Restore model-specific settings if available
      const savedSettings = aiConfigExtended.value.modelSettings[newModelId]
      if (savedSettings) {
        if (savedSettings.temperature !== undefined) {
          aiConfigExtended.value.temperature = savedSettings.temperature
        }
        if (savedSettings.maxTokens !== undefined) {
          aiConfigExtended.value.maxTokens = savedSettings.maxTokens
        }
        console.log('📋 Restored model settings:', savedSettings)
      } else {
        // Update max tokens based on model capabilities
        aiConfigExtended.value.maxTokens = Math.min(aiConfigExtended.value.maxTokens || 8192, model.maxTokens)
      }

      // Save this model as the preferred model for current provider
      aiConfigExtended.value.providerModels[aiConfigExtended.value.currentProvider] = modelId

      // Check if this model has a saved API key
      const hasModelKey = !!aiConfigExtended.value.modelKeys[newModelId]
      const hasProviderKey = !!aiConfigExtended.value.providerKeys[aiConfigExtended.value.currentProvider]

      console.log('🔑 API key status:', {
        modelKey: hasModelKey,
        providerKey: hasProviderKey,
        willAutoPopulate: hasModelKey || hasProviderKey
      })
    }
  }

  const updateApiKey = (apiKey: string) => {
    const trimmedKey = apiKey.trim()
    const modelId = getCurrentModelId()

    // Store API key for current model (primary storage)
    aiConfigExtended.value.modelKeys[modelId] = trimmedKey

    // Also store for provider (backward compatibility and fallback)
    aiConfigExtended.value.providerKeys[aiConfigExtended.value.currentProvider] = trimmedKey

    console.log('🔑 API key saved for:', {
      model: modelId,
      provider: aiConfigExtended.value.currentProvider
    })
  }

  const updateSettings = (settings: Partial<AIConfiguration>) => {
    // Update extended configuration
    if (settings.provider) aiConfigExtended.value.currentProvider = settings.provider
    if (settings.model) aiConfigExtended.value.currentModel = settings.model
    if (settings.temperature !== undefined) aiConfigExtended.value.temperature = settings.temperature
    if (settings.maxTokens !== undefined) aiConfigExtended.value.maxTokens = settings.maxTokens
    if (settings.customSettings) aiConfigExtended.value.customSettings = settings.customSettings
    if (settings.apiKey) {
      aiConfigExtended.value.providerKeys[aiConfigExtended.value.currentProvider] = settings.apiKey
    }
  }

  // Helper method to get current API key for UI
  const getCurrentApiKey = (): string => {
    return getCurrentModelApiKey()
  }

  // Helper method to check if provider has saved API key
  const hasApiKeyForProvider = (providerId: string): boolean => {
    if (!providerId || typeof providerId !== 'string') {
      return false
    }
    return !!(aiConfigExtended.value.providerKeys[providerId])
  }

  // Helper method to check if model has saved API key
  const hasApiKeyForModel = (modelId: string): boolean => {
    if (!modelId || typeof modelId !== 'string') {
      return false
    }
    const fullModelId = modelId.includes('/') ? modelId : `${aiConfigExtended.value.currentProvider}/${modelId}`
    return !!(aiConfigExtended.value.modelKeys[fullModelId])
  }

  // Helper method to get API key for specific model
  const getApiKeyForModel = (modelId: string): string => {
    if (!modelId || typeof modelId !== 'string') {
      return ''
    }
    const fullModelId = modelId.includes('/') ? modelId : `${aiConfigExtended.value.currentProvider}/${modelId}`
    return aiConfigExtended.value.modelKeys[fullModelId] || ''
  }

  // Helper method to get all saved providers
  const getSavedProviders = (): string[] => {
    return Object.keys(aiConfigExtended.value.providerKeys).filter(
      providerId => aiConfigExtended.value.providerKeys[providerId]
    )
  }

  // Helper method to get all saved models
  const getSavedModels = (): string[] => {
    return Object.keys(aiConfigExtended.value.modelKeys).filter(
      modelId => aiConfigExtended.value.modelKeys[modelId]
    )
  }

  // Helper method to get saved models for a specific provider
  const getSavedModelsForProvider = (providerId: string): string[] => {
    return Object.keys(aiConfigExtended.value.modelKeys)
      .filter(modelId => modelId.startsWith(`${providerId}/`))
      .filter(modelId => aiConfigExtended.value.modelKeys[modelId])
      .map(modelId => modelId.replace(`${providerId}/`, ''))
  }

  // Custom provider management methods
  const addCustomProvider = (provider: CustomAIProvider) => {
    aiConfigExtended.value.customProviders[provider.id] = provider
    if (provider.isActive && !aiConfigExtended.value.activeCustomProviders.includes(provider.id)) {
      aiConfigExtended.value.activeCustomProviders.push(provider.id)
    }
    console.log('🔧 Added custom provider:', provider.name)
  }

  const updateCustomProvider = (providerId: string, updates: Partial<CustomAIProvider>) => {
    if (aiConfigExtended.value.customProviders[providerId]) {
      aiConfigExtended.value.customProviders[providerId] = {
        ...aiConfigExtended.value.customProviders[providerId],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      console.log('🔧 Updated custom provider:', providerId)
    }
  }

  const removeCustomProvider = (providerId: string) => {
    delete aiConfigExtended.value.customProviders[providerId]
    aiConfigExtended.value.activeCustomProviders = aiConfigExtended.value.activeCustomProviders.filter(id => id !== providerId)
    console.log('🔧 Removed custom provider:', providerId)
  }

  const toggleCustomProvider = (providerId: string) => {
    const provider = aiConfigExtended.value.customProviders[providerId]
    if (provider) {
      provider.isActive = !provider.isActive
      if (provider.isActive && !aiConfigExtended.value.activeCustomProviders.includes(providerId)) {
        aiConfigExtended.value.activeCustomProviders.push(providerId)
      } else if (!provider.isActive) {
        aiConfigExtended.value.activeCustomProviders = aiConfigExtended.value.activeCustomProviders.filter(id => id !== providerId)
      }
      console.log('🔧 Toggled custom provider:', providerId, provider.isActive ? 'ON' : 'OFF')
    }
  }

  const getCustomProvider = (providerId: string): CustomAIProvider | undefined => {
    return aiConfigExtended.value.customProviders[providerId]
  }

  // Get current AI configuration in universal format
  const getCurrentAIConfig = (): AIConfiguration => {
    const provider = currentProvider.value
    const customProvider = getCustomProvider(aiConfigExtended.value.currentProvider)

    return {
      provider: aiConfigExtended.value.currentProvider,
      apiKey: getCurrentApiKey(),
      model: aiConfigExtended.value.currentModel,
      temperature: aiConfigExtended.value.temperature,
      maxTokens: aiConfigExtended.value.maxTokens,
      baseUrl: provider?.baseUrl || customProvider?.baseUrl,
      customSettings: {
        headers: provider?.headers || customProvider?.customHeaders,
        ...aiConfigExtended.value.customSettings
      }
    }
  }

  const getAllCustomProviders = (): CustomAIProvider[] => {
    return Object.values(aiConfigExtended.value.customProviders)
  }

  const getActiveCustomProviders = (): CustomAIProvider[] => {
    return aiConfigExtended.value.activeCustomProviders
      .map(id => aiConfigExtended.value.customProviders[id])
      .filter(Boolean)
  }

  const createProviderFromTemplate = (templateId: string, customizations?: Partial<CustomAIProvider>): CustomAIProvider => {
    const template = CUSTOM_PROVIDER_TEMPLATES.find(t => t.id === templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const provider: CustomAIProvider = {
      ...template,
      id: `${templateId}-${Date.now()}`, // Make unique
      ...customizations,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return provider
  }

  const validateApiKey = async (apiKey?: string): Promise<boolean> => {
    const keyToTest = apiKey || aiConfig.value.apiKey

    console.log('🔑 Starting API key validation...')
    console.log('📋 Config:', {
      provider: aiConfig.value.provider,
      model: aiConfig.value.model,
      hasApiKey: !!keyToTest,
      hasProvider: !!currentProvider.value
    })

    if (!keyToTest || !currentProvider.value) {
      console.error('❌ Missing API key or provider')
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      console.log('🚀 Sending validation request...')
      // Test API key with a simple request
      const response = await $fetch('/api/ai/validate-key', {
        method: 'POST',
        body: {
          provider: aiConfig.value.provider,
          apiKey: keyToTest,
          model: aiConfig.value.model
        }
      })

      console.log('📨 Validation response:', response)
      console.log(`${response.valid ? '✅' : '❌'} API key validation result: ${response.valid}`)

      return response.valid
    } catch (err: any) {
      console.error('❌ API key validation error:', err)
      console.error('🔍 Error details:', {
        message: err.message,
        data: err.data,
        statusCode: err.statusCode
      })
      error.value = err.data?.message || err.message || 'API key validation failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const recordUsage = (tokens: number, provider: string, model: string) => {
    const existingStatIndex = usageStats.value.findIndex(
      stat => stat.provider === provider && stat.model === model
    )

    const modelInfo = AI_PROVIDERS
      .find(p => p.id === provider)
      ?.models.find(m => m.id === model)

    const estimatedCost = modelInfo?.costPer1kTokens 
      ? (tokens / 1000) * (modelInfo.costPer1kTokens.input + modelInfo.costPer1kTokens.output) / 2
      : 0

    if (existingStatIndex >= 0) {
      // Update existing stats
      const stat = usageStats.value[existingStatIndex]
      stat.totalRequests += 1
      stat.totalTokensUsed += tokens
      stat.estimatedCost += estimatedCost
      stat.lastUsed = new Date()
    } else {
      // Create new stats entry
      usageStats.value.push({
        totalRequests: 1,
        totalTokensUsed: tokens,
        estimatedCost,
        lastUsed: new Date(),
        provider,
        model
      })
    }
  }

  const resetConfig = () => {
    aiConfig.value = { ...DEFAULT_AI_CONFIG }
    error.value = null
  }

  const clearUsageStats = () => {
    usageStats.value = []
  }

  // Enhanced export functionality with options
  const exportConfig = (options: {
    includeApiKeys?: boolean
    includeUsageStats?: boolean
    includeCustomProviders?: boolean
  } = {}) => {
    const {
      includeApiKeys = false,
      includeUsageStats = false,
      includeCustomProviders = true
    } = options

    const configToExport: any = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      basicConfig: { ...aiConfig.value },
      extendedConfig: { ...aiConfigExtended.value }
    }

    // Handle API keys based on option
    if (!includeApiKeys) {
      // Remove sensitive data from basic config
      delete configToExport.basicConfig.apiKey

      // Remove sensitive data from extended config
      configToExport.extendedConfig = {
        ...configToExport.extendedConfig,
        providerKeys: {},
        modelKeys: {}
      }
    }

    // Include usage stats if requested
    if (includeUsageStats) {
      configToExport.usageStats = [...usageStats.value]
    }

    // Handle custom providers
    if (!includeCustomProviders) {
      configToExport.extendedConfig.customProviders = {}
      configToExport.extendedConfig.activeCustomProviders = []
    }

    return JSON.stringify(configToExport, null, 2)
  }

  // Enhanced import functionality with validation
  const importConfig = (configJson: string, options: {
    mergeWithExisting?: boolean
    importApiKeys?: boolean
    importUsageStats?: boolean
    importCustomProviders?: boolean
  } = {}) => {
    const {
      mergeWithExisting = false,
      importApiKeys = false,
      importUsageStats = false,
      importCustomProviders = true
    } = options

    try {
      const importedData = JSON.parse(configJson)

      // Validate the imported data structure
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid configuration format')
      }

      // Handle different export versions
      let importedConfig: any
      let importedExtendedConfig: any
      let importedUsageStats: any

      if (importedData.version === '2.0') {
        // New format with extended config
        importedConfig = importedData.basicConfig
        importedExtendedConfig = importedData.extendedConfig
        importedUsageStats = importedData.usageStats
      } else {
        // Legacy format - basic config only
        importedConfig = importedData
        importedExtendedConfig = null
        importedUsageStats = null
      }

      // Validate basic config
      if (!importedConfig || !importedConfig.provider) {
        throw new Error('Invalid configuration: missing provider')
      }

      // Validate provider exists
      const providerExists = AI_PROVIDERS.find(p => p.id === importedConfig.provider) ||
        (importedExtendedConfig?.customProviders && importedExtendedConfig.customProviders[importedConfig.provider])

      if (!providerExists) {
        throw new Error(`Unknown provider: ${importedConfig.provider}`)
      }

      // Apply the configuration
      if (mergeWithExisting) {
        // Merge with existing configuration
        if (importedExtendedConfig) {
          // Merge extended config
          const mergedExtendedConfig = { ...aiConfigExtended.value }

          // Merge provider keys if importing API keys
          if (importApiKeys && importedExtendedConfig.providerKeys) {
            mergedExtendedConfig.providerKeys = {
              ...mergedExtendedConfig.providerKeys,
              ...importedExtendedConfig.providerKeys
            }
          }

          // Merge model keys if importing API keys
          if (importApiKeys && importedExtendedConfig.modelKeys) {
            mergedExtendedConfig.modelKeys = {
              ...mergedExtendedConfig.modelKeys,
              ...importedExtendedConfig.modelKeys
            }
          }

          // Merge custom providers if importing them
          if (importCustomProviders && importedExtendedConfig.customProviders) {
            mergedExtendedConfig.customProviders = {
              ...mergedExtendedConfig.customProviders,
              ...importedExtendedConfig.customProviders
            }

            // Merge active custom providers
            if (importedExtendedConfig.activeCustomProviders) {
              const existingActive = new Set(mergedExtendedConfig.activeCustomProviders)
              importedExtendedConfig.activeCustomProviders.forEach((id: string) => {
                existingActive.add(id)
              })
              mergedExtendedConfig.activeCustomProviders = Array.from(existingActive)
            }
          }

          // Update other settings
          mergedExtendedConfig.currentProvider = importedExtendedConfig.currentProvider || mergedExtendedConfig.currentProvider
          mergedExtendedConfig.currentModel = importedExtendedConfig.currentModel || mergedExtendedConfig.currentModel
          mergedExtendedConfig.temperature = importedExtendedConfig.temperature ?? mergedExtendedConfig.temperature
          mergedExtendedConfig.maxTokens = importedExtendedConfig.maxTokens ?? mergedExtendedConfig.maxTokens

          aiConfigExtended.value = mergedExtendedConfig
        } else {
          // Legacy import - merge basic settings
          updateSettings({
            ...aiConfig.value,
            ...importedConfig,
            apiKey: importApiKeys ? importedConfig.apiKey : aiConfig.value.apiKey
          })
        }
      } else {
        // Replace existing configuration
        if (importedExtendedConfig) {
          // Full extended config replacement
          const newExtendedConfig = { ...importedExtendedConfig }

          // Handle API keys based on import option
          if (!importApiKeys) {
            newExtendedConfig.providerKeys = aiConfigExtended.value.providerKeys
            newExtendedConfig.modelKeys = aiConfigExtended.value.modelKeys
          }

          // Handle custom providers based on import option
          if (!importCustomProviders) {
            newExtendedConfig.customProviders = aiConfigExtended.value.customProviders
            newExtendedConfig.activeCustomProviders = aiConfigExtended.value.activeCustomProviders
          }

          aiConfigExtended.value = newExtendedConfig
        } else {
          // Legacy import - replace basic config
          updateSettings({
            ...importedConfig,
            apiKey: importApiKeys ? importedConfig.apiKey : aiConfig.value.apiKey
          })
        }
      }

      // Import usage stats if requested and available
      if (importUsageStats && importedUsageStats && Array.isArray(importedUsageStats)) {
        if (mergeWithExisting) {
          // Merge usage stats (avoid duplicates by timestamp)
          const existingTimestamps = new Set(usageStats.value.map(stat => stat.timestamp))
          const newStats = importedUsageStats.filter((stat: any) => !existingTimestamps.has(stat.timestamp))
          usageStats.value = [...usageStats.value, ...newStats]
        } else {
          usageStats.value = importedUsageStats
        }
      }

      return { success: true, message: 'Configuration imported successfully' }
    } catch (error) {
      console.error('Error importing configuration:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import configuration'
      }
    }
  }

  // Export to file
  const exportToFile = (options: Parameters<typeof exportConfig>[0] = {}) => {
    try {
      const configData = exportConfig(options)
      const blob = new Blob([configData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `ai-config-${timestamp}.json`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true, message: `Configuration exported to ${filename}` }
    } catch (error) {
      console.error('Error exporting to file:', error)
      return { success: false, message: 'Failed to export configuration' }
    }
  }

  // Import from file
  const importFromFile = (file: File, options: Parameters<typeof importConfig>[1] = {}) => {
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const result = importConfig(content, options)
          resolve(result)
        } catch (error) {
          resolve({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to read file'
          })
        }
      }

      reader.onerror = () => {
        resolve({ success: false, message: 'Failed to read file' })
      }

      reader.readAsText(file)
    })
  }

  // Initialize on composable creation
  if (process.client) {
    loadConfig()
  }

  return {
    // State
    aiConfig: readonly(aiConfig),
    aiConfigExtended: readonly(aiConfigExtended),
    usageStats: readonly(usageStats),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    currentProvider,
    currentModel,
    availableModels,
    isConfigured,
    totalUsage,
    providers: AI_PROVIDERS,

    // Methods
    updateProvider,
    updateModel,
    updateApiKey,
    updateSettings,
    validateApiKey,
    recordUsage,
    resetConfig,
    clearUsageStats,
    exportConfig,
    importConfig,
    exportToFile,
    importFromFile,
    loadConfig,
    saveConfig,

    // New multi-provider and multi-model methods
    getCurrentApiKey,
    hasApiKeyForProvider,
    hasApiKeyForModel,
    getApiKeyForModel,
    getSavedProviders,
    getSavedModels,
    getSavedModelsForProvider,

    // Custom provider management methods
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider,
    toggleCustomProvider,
    getCustomProvider,
    getAllCustomProviders,
    getActiveCustomProviders,
    createProviderFromTemplate,

    // Universal AI configuration
    getCurrentAIConfig,

    // Custom provider templates
    customProviderTemplates: readonly(ref(CUSTOM_PROVIDER_TEMPLATES))
  }
}
