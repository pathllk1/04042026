import { ref } from 'vue'
import { useAIConfig } from './useAIConfig'
import type { AIConfiguration } from '~/types/ai'

/**
 * AI Conversation Engine
 * Handles AI-to-AI conversations with continuity prompts
 */
export const useAIConversationEngine = () => {
  const { aiConfigExtended, isConfigured } = useAIConfig()

  // Conversation state
  const isActive = ref(false)
  const currentTurn = ref(0)
  const conversationHistory = ref<Array<{ modelA?: string; modelB?: string; turn: number }>>([])

  // Continuity prompts to keep conversation flowing
  const continuityPrompts = [
    "What do you think about this perspective?",
    "Do you agree with my analysis?", 
    "How would you approach this differently?",
    "What's your take on this?",
    "Am I missing something important here?",
    "Could this be improved further?",
    "What would you add to this?",
    "Do you see any flaws in this reasoning?",
    "How does this align with your understanding?",
    "What questions does this raise for you?",
    "What are the implications of this?",
    "How might this evolve in the future?",
    "What challenges do you foresee?",
    "What's the counterargument to this?",
    "How would you build upon this idea?"
  ]

  /**
   * Get AI configuration for a specific model - using modelKeys from aiConfigExtended
   */
  const getModelConfig = (modelId: string): AIConfiguration => {
    const [provider, model] = modelId.split('/')

    console.log(`🔑 DEBUG: Getting config for ${modelId}`)
    console.log(`🔑 DEBUG: provider=${provider}, model=${model}`)

    // Get API key from aiConfigExtended.modelKeys (this has all the individual model API keys)
    const apiKey = aiConfigExtended.value.modelKeys[modelId]

    console.log(`🔑 DEBUG: apiKey from modelKeys length=${apiKey ? apiKey.length : 0}`)
    console.log(`🔑 DEBUG: apiKey preview=${apiKey ? apiKey.substring(0, 10) + '...' : 'NONE'}`)
    console.log(`🔑 DEBUG: Available modelKeys:`, Object.keys(aiConfigExtended.value.modelKeys))

    if (!apiKey) {
      console.error(`❌ No API key found for model: ${modelId}`)
      console.log(`🔍 DEBUG: Available models with keys:`, Object.keys(aiConfigExtended.value.modelKeys))
    }

    return {
      provider,
      model,
      apiKey,
      temperature: 0.7,
      maxTokens: 1500  // Limit response tokens to keep conversations manageable
    }
  }

  /**
   * Clean AI response by removing thinking tags and limiting length
   */
  const cleanAIResponse = (response: string): string => {
    let cleaned = response.trim()

    // Remove thinking tags and content (for models like DeepSeek R1)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    cleaned = cleaned.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')
    cleaned = cleaned.replace(/\*\*Thinking:\*\*[\s\S]*?\n\n/gi, '')

    // Remove any remaining XML-like thinking tags
    cleaned = cleaned.replace(/<[^>]*think[^>]*>[\s\S]*?<\/[^>]*think[^>]*>/gi, '')

    // Trim whitespace and normalize line breaks
    cleaned = cleaned.trim().replace(/\n{3,}/g, '\n\n')

    // Limit response length to prevent token explosion (max ~1000 tokens ≈ 4000 chars)
    if (cleaned.length > 4000) {
      cleaned = cleaned.substring(0, 4000).trim()
      // Try to end at a sentence boundary
      const lastSentence = cleaned.lastIndexOf('.')
      const lastQuestion = cleaned.lastIndexOf('?')
      const lastExclamation = cleaned.lastIndexOf('!')
      const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation)

      if (lastPunctuation > 3000) { // Only truncate at sentence if it's not too short
        cleaned = cleaned.substring(0, lastPunctuation + 1)
      }

      console.log(`⚠️ Response truncated from ${response.length} to ${cleaned.length} characters`)
    }

    return cleaned
  }

  /**
   * Add continuity prompt to AI response
   */
  const addContinuityPrompt = (response: string, turnNumber: number): string => {
    // Don't add prompt if response already ends with a question
    if (response.trim().endsWith('?')) {
      return response
    }

    // Select prompt based on turn number to avoid repetition
    const promptIndex = turnNumber % continuityPrompts.length
    const selectedPrompt = continuityPrompts[promptIndex]

    return `${response.trim()} ${selectedPrompt}`
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4)
  }

  /**
   * Truncate conversation context to stay under token limit
   */
  const truncateContext = (context: string, maxTokens: number = 4000): string => {
    const estimatedTokens = estimateTokens(context)

    if (estimatedTokens <= maxTokens) {
      return context
    }

    console.log(`⚠️ Context too long (${estimatedTokens} tokens), truncating to ${maxTokens} tokens`)

    // Keep roughly the target number of characters (tokens * 4)
    const targetChars = maxTokens * 4
    const lines = context.split('\n')

    // Keep the most recent conversation turns
    let truncated = ''
    for (let i = lines.length - 1; i >= 0; i--) {
      const newLength = truncated.length + lines[i].length + 1
      if (newLength > targetChars) {
        break
      }
      truncated = lines[i] + '\n' + truncated
    }

    return truncated.trim()
  }

  /**
   * Wait with countdown callback
   */
  const waitWithCountdown = (seconds: number, onCountdown?: (remaining: number) => void): Promise<void> => {
    return new Promise((resolve) => {
      let remaining = seconds

      const interval = setInterval(() => {
        if (onCountdown) {
          onCountdown(remaining)
        }

        remaining--

        if (remaining < 0) {
          clearInterval(interval)
          resolve()
        }
      }, 1000)
    })
  }

  /**
   * Get model name from ID (simple fallback)
   */
  const getModelName = (modelId: string): string => {
    const [provider, model] = modelId.split('/')
    return model || modelId
  }

  /**
   * Call AI model with conversation context using direct config via unified backend API
   */
  const callAIModelWithConfig = async (
    config: { provider: string, model: string, apiKey: string },
    prompt: string,
    conversationContext: string = ''
  ): Promise<string> => {
    const { provider, model, apiKey } = config

    // Truncate conversation context to stay under token limits
    const truncatedContext = conversationContext ? truncateContext(conversationContext, 3000) : ''

    // Build full prompt with truncated conversation context
    const fullPrompt = truncatedContext
      ? `${truncatedContext}\n\nCurrent message: ${prompt}`
      : prompt

    const promptTokens = estimateTokens(fullPrompt)
    console.log(`🤖 Calling unified API for ${provider}/${model} with prompt length: ${fullPrompt.length} chars (~${promptTokens} tokens)`)

    // Validate API key
    if (!apiKey) {
      throw new Error(`No API key provided for ${provider}`)
    }

    try {
      // Use unified dynamic chat endpoint
      const response = await $fetch<{ message: string }>('/api/ai/dynamic-chat', {
        method: 'POST',
        headers: {
          'x-ai-config': JSON.stringify({
            provider,
            model,
            apiKey,
            temperature: 0.7,
            maxTokens: 1500
          })
        },
        body: {
          userMessage: fullPrompt,
          conversationHistory: [] // History is already part of fullPrompt in this engine
        }
      })

      const cleanedResponse = cleanAIResponse(response.message)
      console.log(`✅ ${provider}/${model} responded via unified API: ${response.message.length} → ${cleanedResponse.length} chars`)
      return cleanedResponse

    } catch (error: any) {
      console.error(`❌ Error calling ${provider}/${model} via unified API:`, error)
      throw new Error(`${provider}/${model} failed: ${error.message}`)
    }
  }

  /**
   * Start AI conversation
   */
  const startConversation = async (
    initialPrompt: string,
    modelAConfig: { provider: string, model: string, apiKey: string },
    modelBConfig: { provider: string, model: string, apiKey: string },
    onUpdate: (exchange: { modelA?: string; modelB?: string; turn: number }) => void,
    onError: (error: Error) => void,
    onComplete: () => void,
    onCountdown?: (seconds: number, message: string) => void
  ) => {
    console.log('🚀 Starting AI conversation between', `${modelAConfig.provider}/${modelAConfig.model}`, 'and', `${modelBConfig.provider}/${modelBConfig.model}`)

    isActive.value = true
    currentTurn.value = 0
    conversationHistory.value = []

    try {
      // Start with Model A responding to initial prompt
      let currentPrompt = initialPrompt
      let conversationContext = `Initial topic: ${initialPrompt}\n\nConversation so far:\n`

      console.log(`🎯 INITIAL SETUP:`)
      console.log(`🎯 Initial prompt: "${initialPrompt}"`)
      console.log(`🎯 Model A: ${modelAConfig.provider}/${modelAConfig.model}`)
      console.log(`🎯 Model B: ${modelBConfig.provider}/${modelBConfig.model}`)

      while (isActive.value) {
        currentTurn.value++
        console.log(`🔄 Turn ${currentTurn.value}`)
        console.log(`🔄 Current prompt at start of turn: "${currentPrompt.substring(0, 200)}..."`)

        // Create new exchange object
        const exchange = { turn: currentTurn.value }

        // Model A's turn
        console.log(`🤖 Model A (${modelAConfig.provider}/${modelAConfig.model}) responding to prompt:`, currentPrompt.substring(0, 100) + '...')
        try {
          const responseA = await callAIModelWithConfig(modelAConfig, currentPrompt, conversationContext)
          const responseAWithPrompt = addContinuityPrompt(responseA, currentTurn.value)

          exchange.modelA = responseAWithPrompt
          conversationHistory.value.push(exchange)
          onUpdate(exchange)

          // Update conversation context and set prompt for Model B
          conversationContext += `\nModel A: ${responseAWithPrompt}`
          currentPrompt = responseAWithPrompt
          console.log(`✅ Model A responded. Next prompt for Model B:`, currentPrompt.substring(0, 100) + '...')

          // Check if conversation should continue
          if (!isActive.value) break

          // Check context length and truncate if needed
          const contextTokens = estimateTokens(conversationContext)
          if (contextTokens > 5000) {
            console.log(`⚠️ Context getting long (${contextTokens} tokens), truncating...`)
            conversationContext = truncateContext(conversationContext, 3000)
          }

          // 1 minute delay between model responses to prevent rate limiting
          console.log('⏰ Waiting 1 minute before next model response...')
          await waitWithCountdown(60, (seconds) => {
            if (onCountdown) {
              onCountdown(seconds, `${modelBConfig.model} will respond in ${seconds} seconds...`)
            }
          })

          // Model B's turn
          console.log(`🤖 Model B (${modelBConfig.provider}/${modelBConfig.model}) responding to prompt:`, currentPrompt.substring(0, 100) + '...')
          const responseB = await callAIModelWithConfig(modelBConfig, currentPrompt, conversationContext)
          const responseBWithPrompt = addContinuityPrompt(responseB, currentTurn.value)

          exchange.modelB = responseBWithPrompt
          onUpdate(exchange)

          // Update conversation context and set prompt for next turn
          conversationContext += `\nModel B: ${responseBWithPrompt}`
          currentPrompt = responseBWithPrompt
          console.log(`✅ Model B responded. Next prompt for Model A:`, currentPrompt.substring(0, 100) + '...')

          // Check context length again
          const finalContextTokens = estimateTokens(conversationContext)
          if (finalContextTokens > 5000) {
            console.log(`⚠️ Context getting long (${finalContextTokens} tokens), truncating...`)
            conversationContext = truncateContext(conversationContext, 3000)
          }

          // Limit conversation length to prevent infinite loops
          if (currentTurn.value >= 10) {
            console.log('🛑 Conversation reached maximum turns (10)')
            break
          }

          // 1 minute delay before next turn to prevent rate limiting
          console.log('⏰ Waiting 1 minute before next conversation turn...')
          await waitWithCountdown(60, (seconds) => {
            if (onCountdown) {
              onCountdown(seconds, `Next conversation turn in ${seconds} seconds...`)
            }
          })

        } catch (error: any) {
          console.error(`❌ Error in turn ${currentTurn.value}:`, error)
          onError(error)
          break
        }
      }

    } catch (error: any) {
      console.error('❌ Conversation error:', error)
      onError(error)
    } finally {
      isActive.value = false
      onComplete()
      console.log('🏁 Conversation ended')
    }
  }

  /**
   * Stop conversation
   */
  const stopConversation = () => {
    console.log('⏹️ Stopping conversation...')
    isActive.value = false
  }

  /**
   * Clear conversation history
   */
  const clearHistory = () => {
    conversationHistory.value = []
    currentTurn.value = 0
  }

  /**
   * Export conversation as text
   */
  const exportConversation = (modelAName: string, modelBName: string): string => {
    const timestamp = new Date().toLocaleString()
    let exportText = `AI Model Conversation Export\n`
    exportText += `Generated: ${timestamp}\n`
    exportText += `Model A: ${modelAName}\n`
    exportText += `Model B: ${modelBName}\n`
    exportText += `Total Exchanges: ${conversationHistory.value.length}\n`
    exportText += `\n${'='.repeat(50)}\n\n`

    conversationHistory.value.forEach((exchange, index) => {
      exportText += `Turn ${exchange.turn}\n`
      exportText += `${'-'.repeat(20)}\n`
      
      if (exchange.modelA) {
        exportText += `${modelAName}:\n${exchange.modelA}\n\n`
      }
      
      if (exchange.modelB) {
        exportText += `${modelBName}:\n${exchange.modelB}\n\n`
      }
      
      exportText += `\n`
    })

    return exportText
  }

  /**
   * Get conversation statistics
   */
  const getStats = () => {
    const totalExchanges = conversationHistory.value.length
    const totalWords = conversationHistory.value.reduce((count, exchange) => {
      const wordsA = exchange.modelA ? exchange.modelA.split(' ').length : 0
      const wordsB = exchange.modelB ? exchange.modelB.split(' ').length : 0
      return count + wordsA + wordsB
    }, 0)

    return {
      totalExchanges,
      totalWords,
      averageWordsPerExchange: totalExchanges > 0 ? Math.round(totalWords / totalExchanges) : 0,
      isActive: isActive.value,
      currentTurn: currentTurn.value
    }
  }

  return {
    // State
    isActive,
    currentTurn,
    conversationHistory,
    
    // Methods
    startConversation,
    stopConversation,
    clearHistory,
    exportConversation,
    getStats
  }
}
