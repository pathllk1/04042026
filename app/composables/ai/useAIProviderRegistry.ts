import type { AIConfiguration, AIProviderHandler } from '~/types/ai'

/**
 * Dynamic AI Provider Registry
 * Eliminates all hardcoded provider logic by using a registry pattern
 * Supports unlimited providers without code changes
 */

// OpenAI Provider Handler
const openaiHandler: AIProviderHandler = {
  id: 'openai',
  name: 'OpenAI',
  detect: (config: AIConfiguration) => {
    // Only detect OpenAI if explicitly set as provider, or if it's a genuine OpenAI model
    // Exclude models that start with prefixes used by other providers
    if (config.provider === 'openai') return true

    const model = config.model || ''
    const isGroqModel = model.startsWith('openai/gpt-oss') ||
                       model.includes('llama') ||
                       model.includes('whisper') ||
                       model.includes('mistral') ||
                       model.includes('deepseek')

    if (isGroqModel) return false

    return model.includes('gpt') ||
           model.includes('o1') ||
           model.includes('o3')
  },
  getDefaultBaseUrl: () => 'https://api.openai.com/v1',
  getDefaultHeaders: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    const messages: Array<{ role: string; content: string }> = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    return {
      url: `${baseUrl}/chat/completions`,
      options: {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customSettings?.headers
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 8192
        })
      }
    }
  },
  parseResponse: (data: any) => {
    return data.choices?.[0]?.message?.content || ''
  }
}

// Google AI Provider Handler
const googleHandler: AIProviderHandler = {
  id: 'google',
  name: 'Google Gemini',
  detect: (config: AIConfiguration) => {
    return config.provider === 'google' || 
           config.model?.includes('gemini')
  },
  getDefaultBaseUrl: () => 'https://generativelanguage.googleapis.com/v1beta',
  getDefaultHeaders: (apiKey: string) => ({
    'Content-Type': 'application/json'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

    return {
      url: `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.customSettings?.headers
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 8192
          }
        })
      }
    }
  },
  parseResponse: (data: any) => {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
}

// Anthropic Provider Handler
const anthropicHandler: AIProviderHandler = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  detect: (config: AIConfiguration) => {
    return config.provider === 'anthropic' || 
           config.model?.includes('claude')
  },
  getDefaultBaseUrl: () => 'https://api.anthropic.com/v1',
  getDefaultHeaders: (apiKey: string) => ({
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1'
    const messages: Array<{ role: string; content: string }> = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    return {
      url: `${baseUrl}/messages`,
      options: {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...config.customSettings?.headers
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens || 8192,
          temperature: config.temperature || 0.7,
          messages: messages.filter(m => m.role !== 'system'),
          system: systemPrompt || undefined
        })
      }
    }
  },
  parseResponse: (data: any) => {
    return data.content?.[0]?.text || ''
  }
}

// OpenRouter Provider Handler
const openrouterHandler: AIProviderHandler = {
  id: 'openrouter',
  name: 'OpenRouter',
  detect: (config: AIConfiguration) => {
    return config.provider === 'openrouter' || 
           config.model?.includes('/') ||
           config.baseUrl?.includes('openrouter')
  },
  getDefaultBaseUrl: () => 'https://openrouter.ai/api/v1',
  getDefaultHeaders: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1'
    const messages: Array<{ role: string; content: string }> = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    return {
      url: `${baseUrl}/chat/completions`,
      options: {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nuxt-stock-analysis.com',
          'X-Title': 'Nuxt Stock Analysis',
          ...config.customSettings?.headers
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 8192
        })
      }
    }
  },
  parseResponse: (data: any) => {
    return data.choices?.[0]?.message?.content || ''
  }
}

// Groq Provider Handler
const groqHandler: AIProviderHandler = {
  id: 'groq',
  name: 'Groq Cloud',
  detect: (config: AIConfiguration) => {
    return config.provider === 'groq' ||
           config.baseUrl?.includes('groq.com') ||
           config.model?.includes('llama') ||
           config.model?.includes('gemma') ||
           config.model?.includes('qwen') ||
           config.model?.includes('deepseek') ||
           config.model?.includes('mistral') ||
           config.model?.includes('whisper') ||
           config.model?.startsWith('openai/gpt-oss') ||
           config.model?.startsWith('meta-llama/llama-guard')
  },
  getDefaultBaseUrl: () => 'https://api.groq.com/openai/v1',
  getDefaultHeaders: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    const baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1'
    const messages: Array<{ role: string; content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    return {
      url: `${baseUrl}/chat/completions`,
      options: {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...config.customSettings?.headers
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 8192,
          stream: false
        })
      }
    }
  },
  parseResponse: (data: any) => {
    return data.choices?.[0]?.message?.content || ''
  }
}

// Custom Provider Handler (for unlimited custom providers)
const customHandler: AIProviderHandler = {
  id: 'custom',
  name: 'Custom Provider',
  detect: (config: AIConfiguration) => {
    return config.provider === 'custom' ||
           (config.baseUrl && !['openai', 'google', 'anthropic', 'openrouter', 'groq'].includes(config.provider))
  },
  getDefaultBaseUrl: () => '',
  getDefaultHeaders: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    if (!config.baseUrl) {
      throw new Error('Custom provider requires baseUrl configuration')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Dynamic header configuration
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }
    if (config.customSettings?.headers) {
      Object.assign(headers, config.customSettings.headers)
    }

    return {
      url: config.baseUrl,
      options: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 8192
        })
      }
    }
  },
  parseResponse: (data: any) => {
    // Try OpenAI format first (most common)
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content
    }
    // Try Anthropic format
    if (data.content?.[0]?.text) {
      return data.content[0].text
    }
    // Try Google format
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text
    }
    // Fallback to raw response
    return data.response || data.text || JSON.stringify(data)
  }
}

// Provider Registry
const providerHandlers: AIProviderHandler[] = [
  groqHandler, // Check Groq first to avoid conflicts with OpenAI detection
  openaiHandler,
  googleHandler,
  anthropicHandler,
  openrouterHandler,
  customHandler // Always last as fallback
]

export const useAIProviderRegistry = () => {
  /**
   * Dynamically detect and get the appropriate provider handler
   * No hardcoded logic - uses detection patterns
   */
  const getProviderHandler = (config: AIConfiguration): AIProviderHandler => {
    console.log(`🔍 Detecting provider for: ${config.provider}/${config.model}`)
    
    for (const handler of providerHandlers) {
      if (handler.detect(config)) {
        console.log(`✅ Detected provider: ${handler.name} (${handler.id})`)
        return handler
      }
    }
    
    // Fallback to custom handler
    console.log(`🔄 No specific handler found, using custom handler`)
    return customHandler
  }

  /**
   * Universal AI call function - works with ANY provider
   * Completely dynamic - no hardcoded provider logic
   */
  const callAIProvider = async (
    prompt: string, 
    config: AIConfiguration, 
    systemPrompt?: string
  ): Promise<string> => {
    const handler = getProviderHandler(config)
    
    try {
      console.log(`🚀 Making AI call via ${handler.name}`)
      
      const { url, options } = handler.buildRequest(prompt, config, systemPrompt)
      
      const response = await fetch(url, options)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`${handler.name} API error: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const data = await response.json()
      const result = handler.parseResponse(data)
      
      console.log(`✅ AI call successful via ${handler.name}`)
      return result
      
    } catch (error: any) {
      console.error(`❌ AI call failed via ${handler.name}:`, error)
      throw new Error(`AI call failed: ${error.message}`)
    }
  }

  /**
   * Register a new custom provider handler
   * Allows unlimited extensibility without code changes
   */
  const registerProviderHandler = (handler: AIProviderHandler) => {
    // Remove existing handler with same ID
    const existingIndex = providerHandlers.findIndex(h => h.id === handler.id)
    if (existingIndex !== -1) {
      providerHandlers.splice(existingIndex, 1)
    }
    
    // Add new handler (before custom fallback)
    providerHandlers.splice(-1, 0, handler)
    console.log(`🔧 Registered new provider handler: ${handler.name}`)
  }

  return {
    getProviderHandler,
    callAIProvider,
    registerProviderHandler,
    availableHandlers: providerHandlers
  }
}
