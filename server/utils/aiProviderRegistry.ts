import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIConfiguration, AIRequest, AIResponse, CustomAIProvider } from '../types/ai'

/**
 * Server-side Dynamic AI Provider Registry
 * Eliminates hardcoded switch statements in AIService
 */

export interface ServerAIProviderHandler {
  id: string
  name: string
  detect: (config: AIConfiguration) => boolean
  generateContent: (request: AIRequest, config: AIConfiguration) => Promise<AIResponse>
}

// OpenAI Server Handler
const openaiServerHandler: ServerAIProviderHandler = {
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
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) {
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

    const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model,
      provider: 'openai',
      finishReason: data.choices?.[0]?.finish_reason || 'stop'
    }
  }
}

// Google Server Handler
const googleServerHandler: ServerAIProviderHandler = {
  id: 'google',
  name: 'Google Gemini',
  detect: (config: AIConfiguration) => {
    return config.provider === 'google' || 
           config.model?.includes('gemini')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) {
      throw new Error('Google AI API key is required')
    }

    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ 
      model: config.model,
      generationConfig: {
        temperature: request.temperature ?? config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? config.maxTokens ?? 8192,
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

      let content = ''
      try {
        content = response.text()
        console.log('🔍 [GOOGLE CHAT] Successfully extracted text:', content.substring(0, 100) + '...')
      } catch (error) {
        console.error('❌ [GOOGLE CHAT] Error extracting text from response:', error)
        console.log('🔍 [GOOGLE CHAT] Response object:', JSON.stringify(response, null, 2))
        // Try alternative extraction methods
        try {
          content = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
          console.log('🔍 [GOOGLE CHAT] Alternative extraction successful:', content.substring(0, 100) + '...')
        } catch (altError) {
          console.error('❌ [GOOGLE CHAT] Alternative extraction also failed:', altError)
        }
      }

      return {
        content,
        usage: {
          inputTokens: 0, // Google doesn't provide detailed token usage
          outputTokens: 0,
          totalTokens: 0
        },
        model: config.model,
        provider: 'google',
        finishReason: 'stop'
      }
    } else {
      const result = await model.generateContent(prompt)
      const response = result.response

      let content = ''
      try {
        content = response.text()
        console.log('🔍 [GOOGLE] Successfully extracted text:', content.substring(0, 100) + '...')
      } catch (error) {
        console.error('❌ [GOOGLE] Error extracting text from response:', error)
        console.log('🔍 [GOOGLE] Response object:', JSON.stringify(response, null, 2))
        // Try alternative extraction methods
        try {
          content = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
          console.log('🔍 [GOOGLE] Alternative extraction successful:', content.substring(0, 100) + '...')
        } catch (altError) {
          console.error('❌ [GOOGLE] Alternative extraction also failed:', altError)
        }
      }

      return {
        content,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        model: config.model,
        provider: 'google',
        finishReason: 'stop'
      }
    }
  }
}

// Anthropic Server Handler
const anthropicServerHandler: ServerAIProviderHandler = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  detect: (config: AIConfiguration) => {
    return config.provider === 'anthropic' || 
           config.model?.includes('claude')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1'
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        system: request.systemPrompt || undefined,
        messages
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      content: data.content?.[0]?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: config.model,
      provider: 'anthropic',
      finishReason: data.stop_reason || 'stop'
    }
  }
}

// OpenRouter Server Handler
const openrouterServerHandler: ServerAIProviderHandler = {
  id: 'openrouter',
  name: 'OpenRouter',
  detect: (config: AIConfiguration) => {
    return config.provider === 'openrouter' || 
           config.model?.includes('/') ||
           config.baseUrl?.includes('openrouter')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1'
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nuxt-stock-analysis.com',
        'X-Title': 'Nuxt Stock Analysis'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model,
      provider: 'openrouter',
      finishReason: data.choices?.[0]?.finish_reason || 'stop'
    }
  }
}

// Groq Server Handler
const groqServerHandler: ServerAIProviderHandler = {
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
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) {
      throw new Error('Groq API key is required')
    }

    const messages: Array<{ role: string; content: string }> = []

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1'
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model,
      provider: 'groq',
      finishReason: data.choices?.[0]?.finish_reason || 'stop'
    }
  }
}

// Custom Provider Server Handler
const customServerHandler: ServerAIProviderHandler = {
  id: 'custom',
  name: 'Custom Provider',
  detect: (config: AIConfiguration) => {
    return config.provider === 'custom' ||
           (config.baseUrl && !['openai', 'google', 'anthropic', 'openrouter', 'groq'].includes(config.provider))
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.baseUrl) {
      throw new Error('Custom provider requires baseUrl configuration')
    }

    const messages: Array<{ role: string; content: string }> = []
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory)
    }

    messages.push({ role: 'user', content: request.prompt })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    if (config.customSettings?.headers) {
      Object.assign(headers, config.customSettings.headers)
    }

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Custom provider API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    // Try different response formats
    let content = ''
    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content
    } else if (data.content?.[0]?.text) {
      content = data.content[0].text
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      content = data.candidates[0].content.parts[0].text
    } else {
      content = data.response || data.text || JSON.stringify(data)
    }
    
    return {
      content,
      usage: {
        inputTokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
        outputTokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model,
      provider: 'custom',
      finishReason: data.choices?.[0]?.finish_reason || data.stop_reason || 'stop'
    }
  }
}

// Server Provider Registry
const serverProviderHandlers: ServerAIProviderHandler[] = [
  groqServerHandler, // Check Groq first to avoid conflicts with OpenAI detection
  openaiServerHandler,
  googleServerHandler,
  anthropicServerHandler,
  openrouterServerHandler,
  customServerHandler // Always last as fallback
]

export const getServerProviderHandler = (config: AIConfiguration): ServerAIProviderHandler => {
  console.log(`🔍 [SERVER] Detecting provider for: ${config.provider}/${config.model}`)
  
  for (const handler of serverProviderHandlers) {
    if (handler.detect(config)) {
      console.log(`✅ [SERVER] Detected provider: ${handler.name} (${handler.id})`)
      return handler
    }
  }
  
  // Fallback to custom handler
  console.log(`🔄 [SERVER] No specific handler found, using custom handler`)
  return customServerHandler
}

export const registerServerProviderHandler = (handler: ServerAIProviderHandler) => {
  // Remove existing handler with same ID
  const existingIndex = serverProviderHandlers.findIndex(h => h.id === handler.id)
  if (existingIndex !== -1) {
    serverProviderHandlers.splice(existingIndex, 1)
  }
  
  // Add new handler (before custom fallback)
  serverProviderHandlers.splice(-1, 0, handler)
  console.log(`🔧 [SERVER] Registered new provider handler: ${handler.name}`)
}
