import { useAIConfig } from './useAIConfig'
import type { AIConfiguration } from '~/types/ai'

/**
 * Client-side AI Streaming Composable
 * Handles direct streaming from AI providers on the client-side
 * Supports Google Gemini, OpenAI, and other providers with streaming capabilities
 */
export const useClientAIStreaming = () => {
  const { aiConfig, isConfigured } = useAIConfig()

  /**
   * Stream AI response directly from client to AI provider
   * Replicates the exact same prompt structure as server-side normal-chat-stream.post.ts
   */
  const streamAINormalChat = async (
    userMessage: string,
    conversationHistory: Array<{ type: string; content: string }> = [],
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    console.log('💬 [CLIENT NORMAL CHAT] Starting client-side normal chat stream request')
    
    if (!isConfigured.value) {
      onError(new Error('AI configuration not found. Please configure your AI settings.'))
      return
    }

    if (!userMessage) {
      onError(new Error('User message is required'))
      return
    }

    const config = aiConfig.value
    console.log('🔧 [CLIENT NORMAL CHAT] Using AI configuration:', {
      provider: config.provider,
      model: config.model,
      hasApiKey: !!config.apiKey
    })

    if (!config.apiKey) {
      onError(new Error('AI configuration not found. Please configure your AI settings.'))
      return
    }

    try {
      if (config.provider === 'google') {
        await streamGoogleGemini(userMessage, conversationHistory, config, onChunk, onComplete, onError)
      } else {
        onError(new Error('Normal chat currently supports Google Gemini only. Please configure Google AI.'))
      }
    } catch (error: any) {
      console.error('💥 [CLIENT NORMAL CHAT] Error in normal chat:', error)
      onError(error)
    }
  }

  /**
   * Stream Google Gemini response - exact replica of server-side implementation
   */
  const streamGoogleGemini = async (
    userMessage: string,
    conversationHistory: Array<{ type: string; content: string }>,
    config: AIConfiguration,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    try {
      // Import Google Generative AI dynamically
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(config.apiKey)
      const model = genAI.getGenerativeModel({ model: config.model })

      // Format conversation history for Gemini - EXACT REPLICA of server-side
      let formattedHistory = conversationHistory
        .filter((msg: any) => msg.type && msg.content)
        .map((msg: any) => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))

      // Ensure proper history format - EXACT REPLICA of server-side
      if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        formattedHistory = formattedHistory.slice(1)
      }

      // Create simple conversational prompt - EXACT REPLICA of server-side
      const chatPrompt = `You are a helpful AI assistant for normal conversation and questions.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-5).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is the start of the conversation.'}

USER MESSAGE: ${userMessage}

INSTRUCTIONS:
1. Provide helpful, conversational responses
2. Answer questions and provide explanations
3. Respond in the user's preferred language
4. Be direct and informative
5. Do not use placeholder text or fake data
6. Be honest about limitations regarding real-time data
7. For document generation requests, suggest using the document generation mode
8. Respond naturally - do not use JSON format

Respond conversationally to: ${userMessage}`

      console.log('💬 [CLIENT NORMAL CHAT] Starting conversation with AI...')
      
      // Start chat and get streaming response - EXACT REPLICA of server-side
      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
        }
      })

      const result = await chat.sendMessageStream(chatPrompt)
      console.log('📥 [CLIENT NORMAL CHAT] Got stream result, processing chunks...')

      let fullResponse = ''
      let chunkCount = 0

      // Stream chunks to client - EXACT REPLICA of server-side
      for await (const chunk of result.stream) {
        chunkCount++
        const chunkText = chunk.text()
        
        if (chunkText) {
          fullResponse += chunkText
          
          console.log(`📦 [CLIENT NORMAL CHAT] Chunk ${chunkCount}:`, {
            length: chunkText.length,
            preview: chunkText.substring(0, 50) + '...'
          })

          // Send chunk to callback
          onChunk(chunkText)
        }
      }

      console.log('✅ [CLIENT NORMAL CHAT] Finished streaming conversation')
      
      // Send completion
      onComplete(fullResponse)

    } catch (error: any) {
      console.error('💥 [CLIENT NORMAL CHAT] Error in Google Gemini streaming:', error)
      onError(error)
    }
  }

  /**
   * Non-streaming AI call for providers that don't support streaming
   * Uses the same exact prompt structure as streaming version
   */
  const callAINormalChatNonStreaming = async (
    userMessage: string,
    conversationHistory: Array<{ type: string; content: string }> = [],
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    console.log('💬 [CLIENT NORMAL CHAT] Starting client-side normal chat non-streaming request')

    if (!isConfigured.value) {
      onError(new Error('AI configuration not found. Please configure your AI settings.'))
      return
    }

    if (!userMessage) {
      onError(new Error('User message is required'))
      return
    }

    const config = aiConfig.value
    console.log('🔧 [CLIENT NORMAL CHAT] Using AI configuration:', {
      provider: config.provider,
      model: config.model,
      hasApiKey: !!config.apiKey
    })

    if (!config.apiKey) {
      onError(new Error('AI configuration not found. Please configure your AI settings.'))
      return
    }

    try {
      // Import the universal AI client for non-streaming calls
      const { useUniversalAIClient } = await import('./useUniversalAIClient')
      const { callAI } = useUniversalAIClient()

      // Create the exact same prompt structure as streaming version
      const chatPrompt = `You are a helpful AI assistant for normal conversation and questions.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-5).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is the start of the conversation.'}

USER MESSAGE: ${userMessage}

INSTRUCTIONS:
1. Provide helpful, conversational responses
2. Answer questions and provide explanations
3. Respond in the user's preferred language
4. Be direct and informative
5. Do not use placeholder text or fake data
6. Be honest about limitations regarding real-time data
7. For document generation requests, suggest using the document generation mode
8. Respond naturally - do not use JSON format

Respond conversationally to: ${userMessage}`

      console.log('💬 [CLIENT NORMAL CHAT] Making non-streaming AI call...')

      // Make the AI call
      const response = await callAI(chatPrompt)

      console.log('✅ [CLIENT NORMAL CHAT] Received non-streaming response')

      // Send completion
      onComplete(response)

    } catch (error: any) {
      console.error('💥 [CLIENT NORMAL CHAT] Error in non-streaming call:', error)
      onError(error)
    }
  }

  /**
   * Check if streaming is supported for current provider
   */
  const isStreamingSupported = (): boolean => {
    if (!isConfigured.value) return false

    const config = aiConfig.value
    // Currently only Google Gemini supports streaming on client-side
    return config.provider === 'google'
  }

  return {
    streamAINormalChat,
    callAINormalChatNonStreaming,
    isStreamingSupported
  }
}
