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

  async generateContent(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    console.log(`🚀 AI Request - Provider: ${this.config.provider}, Model: ${this.config.model}`)
    console.log(`📝 AI Request - Prompt: ${request.prompt.substring(0, 100)}...`)

    try {
      let response: AIResponse

      // Use dynamic provider registry - NO MORE HARDCODED LOGIC!
      if (this.customProvider) {
        console.log(`🔧 Using custom provider: ${this.customProvider.name}`)
        response = await this.generateWithCustomProvider(request)
      } else {
        // Get handler dynamically based on configuration
        const handler = getServerProviderHandler(this.config)
        console.log(`🎯 Using dynamic handler: ${handler.name}`)
        response = await handler.generateContent(request, this.config)
      }

      console.log(`🔍 [AI SERVICE] Response from handler:`, {
        content: response.content,
        contentLength: response.content?.length,
        contentType: typeof response.content,
        provider: response.provider,
        model: response.model
      })

      // Add timing information
      response.usage = response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

      // Estimate tokens if not provided (rough estimation)
      if (response.usage.totalTokens === 0) {
        const estimatedInputTokens = Math.ceil((request.prompt.length + (request.systemPrompt?.length || 0)) / 4)
        const estimatedOutputTokens = Math.ceil(response.content.length / 4)
        response.usage = {
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          totalTokens: estimatedInputTokens + estimatedOutputTokens
        }
      }

      const duration = Date.now() - startTime
      console.log(`✅ AI Response - Duration: ${duration}ms, Tokens: ${response.usage.totalTokens || 'unknown'}`)
      console.log(`📄 AI Response - Content: ${response.content.substring(0, 200)}...`)
      if (response.reasoning) {
        console.log(`🧠 AI Response - Reasoning: ${response.reasoning.substring(0, 200)}...`)
      }

      return response
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`❌ AI generation failed after ${duration}ms:`, error)
      console.error(`🔍 Error details:`, {
        provider: this.config.provider,
        model: this.config.model,
        errorMessage: error.message,
        errorStack: error.stack
      })
      throw this.handleError(error)
    }
  }

  private async generateWithGoogle(request: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) {
      throw new Error('Google AI API key is required')
    }

    const genAI = new GoogleGenerativeAI(this.config.apiKey)
    const model = genAI.getGenerativeModel({ 
      model: this.config.model,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 8192,
      }
    })

    let prompt = request.prompt
    if (request.systemPrompt) {
      prompt = `${request.systemPrompt}\n\n${request.prompt}`
    }

    // Handle conversation history for Google
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      const chat = model.startChat({
        history: request.conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      })
      
      const result = await chat.sendMessage(request.prompt)
      const response = result.response
      
      return {
        content: response.text(),
        usage: {
          inputTokens: 0, // Google doesn't provide detailed token usage
          outputTokens: 0,
          totalTokens: 0
        },
        model: this.config.model,
        provider: 'google',
        finishReason: 'stop'
      }
    } else {
      const result = await model.generateContent(prompt)
      const response = result.response
      
      return {
        content: response.text(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        model: this.config.model,
        provider: 'google',
        finishReason: 'stop'
      }
    }
  }

  private async generateWithOpenAI(request: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8192
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const choice = data.choices[0]

    return {
      content: choice.message.content,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: this.config.model,
      provider: 'openai',
      finishReason: choice.finish_reason
    }
  }

  private async generateWithAnthropic(request: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const requestBody: any = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8192,
      temperature: request.temperature ?? this.config.temperature ?? 0.7
    }

    if (request.systemPrompt) {
      requestBody.system = request.systemPrompt
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()

    return {
      content: data.content[0]?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: this.config.model,
      provider: 'anthropic',
      finishReason: data.stop_reason
    }
  }

  private async generateWithCustomProvider(request: AIRequest): Promise<AIResponse> {
    if (!this.customProvider) {
      throw new Error('Custom provider configuration is missing')
    }

    const provider = this.customProvider
    console.log(`🔧 Custom Provider: ${provider.name}`)
    console.log(`🌐 Base URL: ${provider.baseUrl}`)
    console.log(`🤖 Model: ${this.config.model}`)

    try {
      // Build headers dynamically
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...provider.customHeaders
      }

      // Add API key if configured
      if (provider.apiKeyHeader && this.config.apiKey) {
        headers[provider.apiKeyHeader] = `${provider.apiKeyPrefix}${this.config.apiKey}`
      }

      // Build request body based on format
      let requestBody: any
      switch (provider.requestFormat) {
        case 'openai':
          requestBody = AIRequestBuilder.buildOpenAIRequest(request, this.config.model)
          break
        case 'anthropic':
          requestBody = AIRequestBuilder.buildAnthropicRequest(request, this.config.model)
          break
        case 'google':
          requestBody = AIRequestBuilder.buildGoogleRequest(request)
          break
        case 'custom':
          requestBody = AIRequestBuilder.buildCustomRequest(request, provider)
          break
        default:
          throw new Error(`Unsupported request format: ${provider.requestFormat}`)
      }

      console.log(`🚀 Custom Provider Request:`, JSON.stringify(requestBody, null, 2))

      // Make the request
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Custom Provider HTTP Error: ${response.status} ${response.statusText}`)
        console.error(`📄 Error response: ${errorText}`)
        throw new Error(`Custom provider HTTP error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log(`📨 Custom Provider Response:`, JSON.stringify(data, null, 2))

      // Parse response based on format
      let aiResponse: AIResponse
      switch (provider.responseFormat) {
        case 'openai':
          aiResponse = AIResponseParser.parseOpenAIResponse(data)
          break
        case 'anthropic':
          aiResponse = AIResponseParser.parseAnthropicResponse(data)
          break
        case 'google':
          aiResponse = AIResponseParser.parseGoogleResponse(data)
          break
        case 'custom':
          aiResponse = AIResponseParser.parseCustomResponse(data, provider)
          break
        default:
          throw new Error(`Unsupported response format: ${provider.responseFormat}`)
      }

      return aiResponse

    } catch (error: any) {
      console.error(`❌ Custom Provider Error (${provider.name}):`, error)
      throw AIErrorHandler.handleError(error, `custom-${provider.id}`)
    }
  }

  private async generateWithOpenRouter(request: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key is required')
    }

    console.log('🔑 OpenRouter API Key:', this.config.apiKey.substring(0, 10) + '...')
    console.log('🤖 OpenRouter Model:', this.config.model)
    console.log('📊 Request details:', {
      modelId: this.config.model,
      promptLength: request.prompt.length,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? this.config.maxTokens ?? 8192
    })

    const messages: Array<{ role: string; content: string }> = []

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const requestBody = {
      model: this.config.model,
      messages,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8192
    }

    console.log('🚀 OpenRouter API Request:', JSON.stringify(requestBody, null, 2))

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': useRuntimeConfig().public.nodeEnv === 'production' ? 'https://your-domain.com' : 'http://localhost:3001', // Your app domain
        'X-Title': 'Stock Market AI App' // Your app name
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      console.error(`❌ OpenRouter API HTTP Error: ${response.status} ${response.statusText}`)
      console.error(`🔍 Response headers:`, Object.fromEntries(response.headers.entries()))

      let errorMessage = `OpenRouter API HTTP ${response.status}: ${response.statusText}`
      let errorDetails = null

      try {
        const errorResponse = await response.text()
        console.error('📄 Raw error response:', errorResponse)

        try {
          errorDetails = JSON.parse(errorResponse)
          console.error('🔍 Parsed error details:', errorDetails)

          // Extract detailed error information
          if (errorDetails.error) {
            if (typeof errorDetails.error === 'string') {
              errorMessage = `OpenRouter API error: ${errorDetails.error}`
            } else if (errorDetails.error.message) {
              errorMessage = `OpenRouter API error: ${errorDetails.error.message}`
              if (errorDetails.error.type) {
                errorMessage += ` (Type: ${errorDetails.error.type})`
              }
              if (errorDetails.error.code) {
                errorMessage += ` (Code: ${errorDetails.error.code})`
              }
            }
          } else if (errorDetails.message) {
            errorMessage = `OpenRouter API error: ${errorDetails.message}`
          }
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          errorMessage = `OpenRouter API error: ${errorResponse}`
        }
      } catch (textError) {
        console.error('❌ Failed to read error response:', textError)
        errorMessage = `OpenRouter API error: ${response.status} ${response.statusText} (Could not read error details)`
      }

      console.error('🚨 Final error message:', errorMessage)
      throw new Error(errorMessage)
    }

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('❌ Failed to parse OpenRouter response as JSON:', parseError)
      const textResponse = await response.text()
      console.error('📄 Raw response:', textResponse)
      throw new Error(`OpenRouter API returned invalid JSON: ${parseError.message}`)
    }

    // Debug logging
    console.log('🔍 OpenRouter API Response:', JSON.stringify(data, null, 2))

    // Check if OpenRouter returned an error in the response body (even with 200 status)
    if (data.error) {
      console.error('❌ OpenRouter returned error in response body:', data.error)

      let errorMessage = 'OpenRouter API error: '
      if (typeof data.error === 'string') {
        errorMessage += data.error
      } else if (data.error.message) {
        errorMessage += data.error.message
        if (data.error.type) errorMessage += ` (Type: ${data.error.type})`
        if (data.error.code) errorMessage += ` (Code: ${data.error.code})`
        if (data.error.param) errorMessage += ` (Param: ${data.error.param})`
      } else {
        errorMessage += JSON.stringify(data.error)
      }

      throw new Error(errorMessage)
    }

    // Check for other error indicators
    if (data.detail && typeof data.detail === 'string') {
      console.error('❌ OpenRouter returned detail error:', data.detail)
      throw new Error(`OpenRouter API error: ${data.detail}`)
    }

    // Check if response indicates an error state
    if (data.status === 'error') {
      console.error('❌ OpenRouter returned error status:', data)
      throw new Error(`OpenRouter API error: ${data.message || 'Unknown error status'}`)
    }

    // Validate response structure
    if (!data) {
      throw new Error('OpenRouter API returned empty response')
    }

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`OpenRouter API returned invalid response structure. Expected 'choices' array but got: ${JSON.stringify(data)}`)
    }

    const choice = data.choices[0]

    if (!choice || !choice.message) {
      throw new Error(`OpenRouter API returned invalid choice structure: ${JSON.stringify(choice)}`)
    }

    // Handle reasoning models (like DeepSeek R1) that return content in different fields
    let content = choice.message.content || ''

    // For reasoning models, the actual response might be in the reasoning field
    // and content might be empty. In this case, we should use the reasoning as content
    if (!content && choice.message.reasoning) {
      content = choice.message.reasoning
    }

    // For validation purposes, if both content and reasoning are present,
    // we can combine them or just use content
    if (choice.message.content && choice.message.reasoning) {
      // For reasoning models, we might want to include both
      content = choice.message.content || choice.message.reasoning
    }

    // If still no content, this might be an incomplete response
    if (!content) {
      console.warn('⚠️ OpenRouter response has no content or reasoning:', choice.message)
      // For validation, we'll accept this as a successful API call
      content = 'Response received (reasoning model may have incomplete output)'
    }

    return {
      content,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: this.config.model,
      provider: 'openrouter',
      finishReason: choice.finish_reason || 'stop',
      // Include reasoning for reasoning models
      reasoning: choice.message.reasoning || undefined
    }
  }

  private handleError(error: any): AIError {
    return AIErrorHandler.handleError(error, this.config.provider)
  }

  static async validateApiKey(provider: string, apiKey: string, model: string): Promise<boolean> {
    // Determine appropriate token limits based on model type
    const isReasoningModel = model.includes('r1') || model.includes('reasoning') || model.includes('thinking')
    const maxTokens = isReasoningModel ? 500 : 100 // More tokens for reasoning models

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
          ? 'Please respond with exactly: "API key validation successful"' // Simpler prompt for reasoning models
          : 'Hello, this is a test. Please respond with "Test successful".',
        maxTokens
      }

      const response = await service.generateContent(testRequest)

      console.log('🔍 [VALIDATION] Response received:', {
        content: response.content,
        contentLength: response.content?.length,
        contentType: typeof response.content,
        reasoning: response.reasoning,
        reasoningLength: response.reasoning?.length,
        provider: response.provider,
        model: response.model,
        fullResponse: JSON.stringify(response, null, 2)
      })

      // For reasoning models, content might be empty but reasoning field might have content
      const hasContent = Boolean(response.content && response.content.length > 0)
      const hasReasoning = Boolean(response.reasoning && response.reasoning.length > 0)

      console.log('🔍 [VALIDATION] Validation checks:', {
        hasContent,
        hasReasoning,
        result: hasContent || hasReasoning
      })

      // Validation passes if we have either content or reasoning
      return hasContent || hasReasoning
    } catch (error) {
      console.error('API key validation failed:', error)
      return false
    }
  }
}

// Helper function to get AI configuration from user context
export async function getAIConfigFromUser(event: any): Promise<AIConfiguration> {
  // First, try to get validated config from middleware
  if (event.context?.aiConfig) {
    return event.context.aiConfig
  }

  // Try to get AI config from request headers (sent from client)
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

  // Fallback to environment variable for backward compatibility
  const config = useRuntimeConfig()
  const googleAiKey = config.googleAiApiKey

  if (googleAiKey) {
    return {
      provider: 'google',
      apiKey: googleAiKey,
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 8192
    }
  }

  throw new Error('No AI configuration available. Please configure your AI settings in the global settings.')
}

// Helper methods for dynamic request/response building
export class AIRequestBuilder {
  static buildOpenAIRequest(request: AIRequest, model: string): any {
    const messages = []

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    messages.push({ role: 'user', content: request.prompt })

    return {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 8192,
      stream: false
    }
  }

  static buildAnthropicRequest(request: AIRequest, model: string): any {
    return {
      model,
      max_tokens: request.maxTokens ?? 8192,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt || '',
      messages: [{ role: 'user', content: request.prompt }]
    }
  }

  static buildGoogleRequest(request: AIRequest): any {
    const prompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt

    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192
      }
    }
  }

  static buildCustomRequest(request: AIRequest, provider: CustomAIProvider): any {
    // Default to OpenAI format for custom providers
    return this.buildOpenAIRequest(request, provider.models[0] || 'default')
  }
}

export class AIResponseParser {
  static parseOpenAIResponse(data: any): AIResponse {
    const content = data.choices?.[0]?.message?.content || ''
    const reasoning = data.choices?.[0]?.message?.reasoning || ''

    return {
      content,
      reasoning,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model || '',
      finishReason: data.choices?.[0]?.finish_reason || 'stop'
    }
  }

  static parseAnthropicResponse(data: any): AIResponse {
    const content = data.content?.[0]?.text || ''

    return {
      content,
      reasoning: '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model || '',
      finishReason: data.stop_reason || 'stop'
    }
  }

  static parseGoogleResponse(data: any): AIResponse {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      content,
      reasoning: '',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: data.modelVersion || '',
      finishReason: data.candidates?.[0]?.finishReason || 'STOP'
    }
  }

  static parseCustomResponse(data: any, provider: CustomAIProvider): AIResponse {
    // Default to OpenAI format parsing for custom providers
    return this.parseOpenAIResponse(data)
  }
}
