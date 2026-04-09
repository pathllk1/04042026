import { useAIConfig } from './useAIConfig'
import { useAIProviderRegistry } from './useAIProviderRegistry'
import type { AIConfiguration } from '~/types/ai'

/**
 * Universal AI Client Composable
 * Replaces ALL hardcoded provider logic across client components
 * Works with ANY AI provider dynamically
 */
export const useUniversalAIClient = () => {
  const { aiConfig, isConfigured, getCurrentAIConfig } = useAIConfig()
  const { callAIProvider } = useAIProviderRegistry()

  /**
   * Universal AI call function
   * Replaces all the duplicated callAIProviderDirectly functions
   * Works with ANY provider without hardcoded logic
   */
  const callAI = async (
    prompt: string,
    systemPrompt?: string,
    customConfig?: Partial<AIConfiguration>
  ): Promise<string> => {
    // Use custom config if provided, otherwise use current AI config
    const config = customConfig ? { ...getCurrentAIConfig(), ...customConfig } : getCurrentAIConfig()

    if (!isConfigured.value && !customConfig) {
      throw new Error('AI configuration not found. Please configure your AI settings.')
    }

    if (!config.provider || !config.apiKey || !config.model) {
      throw new Error('Invalid AI configuration. Provider, API key, and model are required.')
    }

    console.log(`🤖 Universal AI call to ${config.provider} with model ${config.model}`)

    try {
      return await callAIProvider(prompt, config, systemPrompt)
    } catch (error: any) {
      console.error(`❌ Universal AI call failed:`, error)
      throw new Error(`AI analysis failed: ${error.message}`)
    }
  }

  /**
   * AI call with JSON response parsing
   * Common pattern used across stock market components
   */
  const callAIForJSON = async <T = any>(
    prompt: string,
    systemPrompt?: string,
    customConfig?: Partial<AIConfiguration>
  ): Promise<T> => {
    const response = await callAI(prompt, systemPrompt, customConfig)
    
    try {
      // Try to parse as JSON
      return JSON.parse(response)
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          throw new Error('AI response is not valid JSON format')
        }
      }
      throw new Error('AI response is not valid JSON format')
    }
  }

  /**
   * AI call with retry logic
   * Useful for critical operations
   */
  const callAIWithRetry = async (
    prompt: string,
    systemPrompt?: string,
    maxRetries: number = 3,
    customConfig?: Partial<AIConfiguration>
  ): Promise<string> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 AI call attempt ${attempt}/${maxRetries}`)
        return await callAI(prompt, systemPrompt, customConfig)
      } catch (error: any) {
        lastError = error
        console.warn(`⚠️ AI call attempt ${attempt} failed:`, error.message)
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('All AI call attempts failed')
  }

  /**
   * Streaming AI call (for future implementation)
   * Placeholder for streaming support
   */
  const callAIStream = async (
    prompt: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void,
    customConfig?: Partial<AIConfiguration>
  ): Promise<string> => {
    // For now, fallback to regular call
    // TODO: Implement streaming support in provider registry
    console.log('🚧 Streaming not yet implemented, falling back to regular call')
    return await callAI(prompt, systemPrompt, customConfig)
  }

  /**
   * Batch AI calls
   * Process multiple prompts efficiently
   */
  const callAIBatch = async (
    prompts: string[],
    systemPrompt?: string,
    customConfig?: Partial<AIConfiguration>
  ): Promise<string[]> => {
    console.log(`📦 Processing batch of ${prompts.length} AI calls`)
    
    const results = await Promise.allSettled(
      prompts.map(prompt => callAI(prompt, systemPrompt, customConfig))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        console.error(`❌ Batch call ${index + 1} failed:`, result.reason)
        throw new Error(`Batch call ${index + 1} failed: ${result.reason.message}`)
      }
    })
  }

  /**
   * Get current AI configuration info
   * Useful for debugging and display
   */
  const getAIInfo = () => {
    return {
      provider: aiConfig.value.provider,
      model: aiConfig.value.model,
      isConfigured: isConfigured.value,
      hasApiKey: !!aiConfig.value.apiKey,
      temperature: aiConfig.value.temperature,
      maxTokens: aiConfig.value.maxTokens
    }
  }

  /**
   * Test AI connection
   * Verify configuration works
   */
  const testAIConnection = async (customConfig?: Partial<AIConfiguration>): Promise<boolean> => {
    try {
      console.log('🧪 Testing AI connection...')
      const response = await callAI(
        'Respond with exactly: "Connection test successful"',
        'You are a test assistant. Respond exactly as requested.',
        customConfig
      )
      
      const success = response.toLowerCase().includes('connection test successful')
      console.log(success ? '✅ AI connection test passed' : '❌ AI connection test failed')
      return success
    } catch (error: any) {
      console.error('❌ AI connection test failed:', error)
      return false
    }
  }

  return {
    // Core functions
    callAI,
    callAIForJSON,
    callAIWithRetry,
    callAIStream,
    callAIBatch,
    
    // Utility functions
    getAIInfo,
    testAIConnection,
    
    // Computed properties
    isConfigured,
    currentConfig: aiConfig
  }
}
