import { useAIConfig } from './useAIConfig'

export const useAIApi = () => {
  const { aiConfig, isConfigured, getCustomProvider } = useAIConfig()

  const makeAIRequest = async (url: string, options: any = {}) => {
    console.log('🤖 Making AI request...')
    console.log('📍 URL:', url)
    console.log('⚙️ AI Config:', {
      provider: aiConfig.value.provider,
      model: aiConfig.value.model,
      hasApiKey: !!aiConfig.value.apiKey,
      isConfigured: isConfigured.value
    })

    if (!isConfigured.value) {
      console.error('❌ AI configuration is not complete')
      throw new Error('AI configuration is not complete. Please configure your AI settings.')
    }

    // Check if this is a custom provider
    const customProvider = getCustomProvider(aiConfig.value.provider)

    // Add AI configuration to headers
    const headers = {
      ...options.headers,
      'x-ai-config': JSON.stringify({
        provider: aiConfig.value.provider,
        apiKey: aiConfig.value.apiKey,
        model: aiConfig.value.model,
        temperature: aiConfig.value.temperature,
        maxTokens: aiConfig.value.maxTokens
      })
    }

    // Add custom provider configuration if applicable
    if (customProvider) {
      headers['x-custom-provider'] = JSON.stringify(customProvider)
      console.log('🔧 Adding custom provider to request:', customProvider.name)
    }

    console.log('🚀 Sending AI request with headers...')

    try {
      const response = await $fetch(url, {
        ...options,
        headers
      })

      console.log('✅ AI request successful')
      console.log('📨 Response:', response)

      return response
    } catch (error: any) {
      console.error('❌ AI request failed:', error)
      console.error('🔍 Error details:', {
        message: error.message,
        data: error.data,
        statusCode: error.statusCode
      })
      throw error
    }
  }

  return {
    makeAIRequest,
    isConfigured
  }
}
