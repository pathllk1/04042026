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
  generateContentStream?: (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void) => Promise<AIResponse>
}

// OpenAI Server Handler
const openaiServerHandler: ServerAIProviderHandler = {
  id: 'openai',
  name: 'OpenAI',
  detect: (config: AIConfiguration) => {
    if (config.provider === 'openai') return true
    const model = config.model || ''
    const isGroqModel = model.startsWith('openai/gpt-oss') || model.includes('llama') || model.includes('whisper') || model.includes('mistral') || model.includes('deepseek')
    if (isGroqModel) return false
    return model.includes('gpt') || model.includes('o1') || model.includes('o3')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('OpenAI API key is required')
    const messages = buildOpenAIMessages(request)
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

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`)
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
  },
  generateContentStream: async (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('OpenAI API key is required')
    const messages = buildOpenAIMessages(request)
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
        stream: true
      })
    })

    if (!response.ok) throw new Error(`OpenAI API stream error: ${response.status} - ${await response.text()}`)
    
    // In-memory response reconstruction
    let fullContent = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get response reader')
    
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))
      
      for (const line of lines) {
        const dataStr = line.replace('data: ', '').trim()
        if (dataStr === '[DONE]') break
        
        try {
          const data = JSON.parse(dataStr)
          const content = data.choices?.[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch (e) {
          console.warn('Error parsing OpenAI stream chunk:', e)
        }
      }
    }

    return {
      content: fullContent,
      model: config.model,
      provider: 'openai'
    }
  }
}

// Google Server Handler
const googleServerHandler: ServerAIProviderHandler = {
  id: 'google',
  name: 'Google Gemini',
  detect: (config: AIConfiguration) => {
    return config.provider === 'google' || config.model?.includes('gemini')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Google AI API key is required')
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ 
      model: config.model,
      generationConfig: {
        temperature: request.temperature ?? config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? config.maxTokens ?? 8192,
      }
    })

    if (request.conversationHistory && request.conversationHistory.length > 0) {
      const chat = model.startChat({
        history: request.conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      })
      const result = await chat.sendMessage(request.prompt)
      return {
        content: result.response.text(),
        model: config.model,
        provider: 'google'
      }
    } else {
      const result = await model.generateContent(request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt)
      return {
        content: result.response.text(),
        model: config.model,
        provider: 'google'
      }
    }
  },
  generateContentStream: async (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Google AI API key is required')
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ 
      model: config.model,
      generationConfig: {
        temperature: request.temperature ?? config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? config.maxTokens ?? 8192,
      }
    })

    let fullContent = ''
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      const chat = model.startChat({
        history: request.conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      })
      const result = await chat.sendMessageStream(request.prompt)
      for await (const chunk of result.stream) {
        const text = chunk.text()
        fullContent += text
        onChunk(text)
      }
    } else {
      const result = await model.generateContentStream(request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt)
      for await (const chunk of result.stream) {
        const text = chunk.text()
        fullContent += text
        onChunk(text)
      }
    }

    return {
      content: fullContent,
      model: config.model,
      provider: 'google'
    }
  }
}

// Anthropic Server Handler
const anthropicServerHandler: ServerAIProviderHandler = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  detect: (config: AIConfiguration) => {
    return config.provider === 'anthropic' || config.model?.includes('claude')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Anthropic API key is required')
    const messages = request.conversationHistory?.map(m => ({ role: m.role, content: m.content })) || []
    messages.push({ role: 'user', content: request.prompt })

    const response = await fetch((config.baseUrl || 'https://api.anthropic.com/v1') + '/messages', {
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

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
    const data = await response.json()
    return {
      content: data.content?.[0]?.text || '',
      model: config.model,
      provider: 'anthropic'
    }
  },
  generateContentStream: async (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Anthropic API key is required')
    const messages = request.conversationHistory?.map(m => ({ role: m.role, content: m.content })) || []
    messages.push({ role: 'user', content: request.prompt })

    const response = await fetch((config.baseUrl || 'https://api.anthropic.com/v1') + '/messages', {
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
        messages,
        stream: true
      })
    })

    if (!response.ok) throw new Error(`Anthropic stream error: ${response.status}`)
    
    let fullContent = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))
      
      for (const line of lines) {
        const dataStr = line.replace('data: ', '').trim()
        try {
          const data = JSON.parse(dataStr)
          if (data.type === 'content_block_delta') {
            const text = data.delta?.text || ''
            fullContent += text
            onChunk(text)
          }
        } catch (e) {}
      }
    }

    return { content: fullContent, model: config.model, provider: 'anthropic' }
  }
}

// OpenRouter Server Handler
const openrouterServerHandler: ServerAIProviderHandler = {
  id: 'openrouter',
  name: 'OpenRouter',
  detect: (config: AIConfiguration) => {
    return config.provider === 'openrouter' || config.model?.includes('/') || config.baseUrl?.includes('openrouter')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('OpenRouter API key is required')
    const messages = buildOpenAIMessages(request)
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`)
    const data = await response.json()
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      provider: 'openrouter'
    }
  },
  generateContentStream: async (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('OpenRouter API key is required')
    const messages = buildOpenAIMessages(request)
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        stream: true
      })
    })

    if (!response.ok) throw new Error(`OpenRouter stream error: ${response.status}`)
    
    let fullContent = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))
      
      for (const line of lines) {
        const dataStr = line.replace('data: ', '').trim()
        if (dataStr === '[DONE]') break
        try {
          const data = JSON.parse(dataStr)
          const text = data.choices?.[0]?.delta?.content || ''
          if (text) {
            fullContent += text
            onChunk(text)
          }
        } catch (e) {}
      }
    }

    return { content: fullContent, model: config.model, provider: 'openrouter' }
  }
}

// Groq Server Handler
const groqServerHandler: ServerAIProviderHandler = {
  id: 'groq',
  name: 'Groq Cloud',
  detect: (config: AIConfiguration) => {
    return config.provider === 'groq' || config.model?.includes('llama') || config.model?.includes('gemma') || config.model?.includes('qwen') || config.model?.includes('deepseek') || config.model?.includes('mistral') || config.model?.includes('whisper') || config.model?.startsWith('openai/gpt-oss')
  },
  generateContent: async (request: AIRequest, config: AIConfiguration): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Groq API key is required')
    const messages = buildOpenAIMessages(request)
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8192
      })
    })

    if (!response.ok) throw new Error(`Groq error: ${response.status}`)
    const data = await response.json()
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      provider: 'groq'
    }
  },
  generateContentStream: async (request: AIRequest, config: AIConfiguration, onChunk: (chunk: string) => void): Promise<AIResponse> => {
    if (!config.apiKey) throw new Error('Groq API key is required')
    const messages = buildOpenAIMessages(request)
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        stream: true
      })
    })

    if (!response.ok) throw new Error(`Groq stream error: ${response.status}`)
    
    let fullContent = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader')
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))
      
      for (const line of lines) {
        const dataStr = line.replace('data: ', '').trim()
        if (dataStr === '[DONE]') break
        try {
          const data = JSON.parse(dataStr)
          const text = data.choices?.[0]?.delta?.content || ''
          if (text) {
            fullContent += text
            onChunk(text)
          }
        } catch (e) {}
      }
    }

    return { content: fullContent, model: config.model, provider: 'groq' }
  }
}

// Helper to build OpenAI compatible messages
function buildOpenAIMessages(request: AIRequest) {
  const messages = []
  if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt })
  if (request.conversationHistory) {
    messages.push(...request.conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })))
  }
  messages.push({ role: 'user', content: request.prompt })
  return messages
}

// Server Provider Registry
const serverProviderHandlers: ServerAIProviderHandler[] = [
  groqServerHandler,
  openaiServerHandler,
  googleServerHandler,
  anthropicServerHandler,
  openrouterServerHandler
]

export const getServerProviderHandler = (config: AIConfiguration): ServerAIProviderHandler => {
  for (const handler of serverProviderHandlers) {
    if (handler.detect(config)) return handler
  }
  return openrouterServerHandler // Default fallback
}
