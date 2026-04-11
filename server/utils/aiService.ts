import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIConfiguration, AIRequest, AIResponse, AIError, CustomAIProvider } from '../types/ai'
import { AIErrorHandler } from './aiErrorHandler'
import { getServerProviderHandler } from './aiProviderRegistry'
import { useRuntimeConfig } from '#imports'

export class AIService {
  private config: AIConfiguration
  private customProvider?: CustomAIProvider

  constructor(config: AIConfiguration, customProvider?: CustomAIProvider) {
    this.config = config
    this.customProvider = customProvider
  }

  /**
   * Generates content using the configured provider
   * Completely dynamic - uses the provider registry
   */
  async generateContent(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    console.log(`🚀 [AI SERVICE] Request - Provider: ${this.config.provider}, Model: ${this.config.model}`)

    try {
      const handler = getServerProviderHandler(this.config)
      console.log(`🎯 [AI SERVICE] Using handler: ${handler.name}`)
      
      const response = await handler.generateContent(request, this.config)
      
      // Ensure usage stats exist
      response.usage = response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      
      const duration = Date.now() - startTime
      console.log(`✅ [AI SERVICE] Response received in ${duration}ms`)
      
      return response
    } catch (error: any) {
      console.error(`❌ [AI SERVICE] Generation failed:`, error)
      throw this.handleError(error)
    }
  }

  /**
   * Generates streaming content using the configured provider
   */
  async generateContentStream(request: AIRequest, onChunk: (chunk: string) => void): Promise<AIResponse> {
    const startTime = Date.now()
    console.log(`🚀 [AI SERVICE] Stream Request - Provider: ${this.config.provider}, Model: ${this.config.model}`)

    try {
      const handler = getServerProviderHandler(this.config)
      console.log(`🎯 [AI SERVICE] Using stream handler: ${handler.name}`)
      
      if (!handler.generateContentStream) {
        console.warn(`⚠️ [AI SERVICE] Provider ${handler.name} does not support streaming, falling back to regular generation`)
        const response = await handler.generateContent(request, this.config)
        onChunk(response.content)
        return response
      }

      const response = await handler.generateContentStream(request, this.config, onChunk)
      
      const duration = Date.now() - startTime
      console.log(`✅ [AI SERVICE] Stream completed in ${duration}ms`)
      
      return response
    } catch (error: any) {
      console.error(`❌ [AI SERVICE] Stream failed:`, error)
      throw this.handleError(error)
    }
  }

  private handleError(error: any): AIError {
    return AIErrorHandler.handleError(error, this.config.provider)
  }

  /**
   * Universal API key validator
   */
  static async validateApiKey(provider: string, apiKey: string, model: string): Promise<boolean> {
    const isReasoningModel = model.includes('r1') || model.includes('reasoning') || model.includes('thinking')
    const maxTokens = isReasoningModel ? 500 : 100

    const testConfig: AIConfiguration = {
      provider,
      apiKey,
      model,
      temperature: 0.7,
      maxTokens
    }

    const service = new AIService(testConfig)

    try {
      const testRequest: AIRequest = {
        prompt: isReasoningModel
          ? 'Please respond with exactly: "API key validation successful"'
          : 'Hello, this is a test. Please respond with "Test successful".',
        maxTokens
      }

      const response = await service.generateContent(testRequest)
      return Boolean(response.content && response.content.length > 0)
    } catch (error) {
      console.error('API key validation failed:', error)
      return false
    }
  }
}

/**
 * Robust AI configuration retrieval from user context
 */
export async function getAIConfigFromUser(event: any): Promise<AIConfiguration> {
  // 1. Check validated context from middleware
  if (event.context?.aiConfig) {
    return event.context.aiConfig
  }

  // 2. Check request headers (sent from client)
  const aiConfigHeader = getHeader(event, 'x-ai-config')
  if (aiConfigHeader) {
    try {
      const config = JSON.parse(aiConfigHeader)
      if (config.provider && config.apiKey && config.model) {
        return config
      }
    } catch (error) {
      console.error('Invalid AI config in header:', error)
    }
  }

  // 3. Fallback to server environment variables
  const config = useRuntimeConfig()
  const googleAiKey = config.googleAiApiKey

  if (googleAiKey) {
    return {
      provider: 'google',
      apiKey: googleAiKey,
      model: 'gemini-3.1-flash', // Use latest 2026 model
      temperature: 0.7,
      maxTokens: 8192
    }
  }

  throw new Error('No AI configuration available. Please configure your AI settings in the application settings.')
}
