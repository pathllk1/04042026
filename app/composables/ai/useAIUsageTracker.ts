import { ref } from 'vue'
import { useAIConfig } from './useAIConfig'

export const useAIUsageTracker = () => {
  const { recordUsage } = useAIConfig()
  const isTracking = ref(false)

  const trackAIRequest = async (
    endpoint: string,
    provider: string,
    model: string,
    requestData: any,
    responseData: any
  ) => {
    if (isTracking.value) return

    try {
      isTracking.value = true

      // Extract token usage from response
      const tokens = responseData.usage?.totalTokens || 0
      const inputTokens = responseData.usage?.inputTokens || 0
      const outputTokens = responseData.usage?.outputTokens || 0

      // Record usage locally
      recordUsage(tokens, provider, model)

      // Optionally send to server for centralized tracking
      // This would be useful for team/organization usage tracking
      if (process.client) {
        try {
          await $fetch('/api/ai/track-usage', {
            method: 'POST',
            body: {
              endpoint,
              provider,
              model,
              tokens,
              inputTokens,
              outputTokens,
              timestamp: new Date().toISOString(),
              requestSize: JSON.stringify(requestData).length,
              responseSize: JSON.stringify(responseData).length
            }
          })
        } catch (error) {
          // Silently fail server tracking - local tracking is more important
          console.warn('Failed to track usage on server:', error)
        }
      }
    } catch (error) {
      console.error('Error tracking AI usage:', error)
    } finally {
      isTracking.value = false
    }
  }

  const estimateTokens = (text: string): number => {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  const estimateCost = (tokens: number, provider: string, model: string): number => {
    // This would typically come from a pricing database
    // For now, using rough estimates
    const pricing: Record<string, Record<string, { input: number; output: number }>> = {
      google: {
        'gemini-2.5-flash': { input: 0.075, output: 0.30 },
        'gemini-2.5-pro': { input: 1.25, output: 5.00 },
        'gemini-2.5-flash-lite-preview-06-17': { input: 0.037, output: 0.15 },
        'gemini-1.5-pro': { input: 1.25, output: 5.00 },
        'gemini-1.5-flash': { input: 0.075, output: 0.30 }
      },
      openai: {
        'gpt-4o': { input: 2.50, output: 10.00 },
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
      },
      anthropic: {
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
      },
      openrouter: {
        // Free Models - Google
        'google/gemini-2.0-flash-exp:free': { input: 0.00, output: 0.00 },
        'google/gemini-2.0-flash-thinking-exp:free': { input: 0.00, output: 0.00 },
        'google/gemma-2-9b-it:free': { input: 0.00, output: 0.00 },

        // Free Models - Meta Llama
        'meta-llama/llama-3.2-3b-instruct:free': { input: 0.00, output: 0.00 },
        'meta-llama/llama-3.2-1b-instruct:free': { input: 0.00, output: 0.00 },
        'meta-llama/llama-3.1-8b-instruct:free': { input: 0.00, output: 0.00 },
        'shisa-ai/shisa-v2-llama-3.3-70b:free': { input: 0.00, output: 0.00 },

        // Free Models - Microsoft
        'microsoft/phi-3-mini-128k-instruct:free': { input: 0.00, output: 0.00 },
        'microsoft/phi-3-medium-128k-instruct:free': { input: 0.00, output: 0.00 },

        // Free Models - Qwen/Alibaba
        'qwen/qwen-2.5-7b-instruct:free': { input: 0.00, output: 0.00 },
        'qwen/qwen-2.5-coder-7b-instruct:free': { input: 0.00, output: 0.00 },

        // Free Models - DeepSeek R1 Series
        'deepseek/deepseek-r1-distill-llama-70b:free': { input: 0.00, output: 0.00 },
        'deepseek/deepseek-r1-distill-qwen-14b:free': { input: 0.00, output: 0.00 },
        'deepseek/deepseek-r1-distill-qwen-32b:free': { input: 0.00, output: 0.00 },
        'deepseek/deepseek-v3-base:free': { input: 0.00, output: 0.00 },
        'deepseek/deepseek-v3-0324:free': { input: 0.00, output: 0.00 },
        'deepseek/deepseek-r1-0528:free': { input: 0.00, output: 0.00 },

        // Free Models - Other Providers
        'huggingfaceh4/zephyr-7b-beta:free': { input: 0.00, output: 0.00 },
        'openchat/openchat-7b:free': { input: 0.00, output: 0.00 },
        'mistralai/mistral-7b-instruct:free': { input: 0.00, output: 0.00 },
        'nous-research/nous-hermes-2-mixtral-8x7b-dpo:free': { input: 0.00, output: 0.00 },
        'cognitivecomputations/dolphin-2.6-mixtral-8x7b:free': { input: 0.00, output: 0.00 },
        'gryphe/mythomax-l2-13b:free': { input: 0.00, output: 0.00 },

        // Premium Models
        'google/gemini-2.0-flash-exp': { input: 0.075, output: 0.30 },
        'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
        'openai/gpt-4o': { input: 2.50, output: 10.00 },
        'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },

        // DeepSeek Models
        'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
        'deepseek/deepseek-coder': { input: 0.14, output: 0.28 },

        // Qwen Models
        'qwen/qwen-2.5-72b-instruct': { input: 0.40, output: 1.20 },
        'qwen/qwen-2.5-coder-32b-instruct': { input: 0.20, output: 0.60 },

        // Meta Llama Models
        'meta-llama/llama-3.1-405b-instruct': { input: 3.00, output: 3.00 },
        'meta-llama/llama-3.1-70b-instruct': { input: 0.52, output: 0.75 },
        'meta-llama/llama-3.2-90b-vision-instruct': { input: 0.90, output: 0.90 },

        // Mistral Models
        'mistralai/mistral-large': { input: 2.00, output: 6.00 },
        'mistralai/codestral-mamba': { input: 0.25, output: 0.25 },

        // Specialized Models
        'perplexity/llama-3.1-sonar-large-128k-online': { input: 1.00, output: 1.00 },
        'x-ai/grok-beta': { input: 5.00, output: 15.00 },
        'cohere/command-r-plus': { input: 2.50, output: 10.00 }
      }
    }

    const modelPricing = pricing[provider]?.[model]
    if (!modelPricing) return 0

    // Assume 50/50 split between input and output tokens for estimation
    const avgPrice = (modelPricing.input + modelPricing.output) / 2
    return (tokens / 1000) * avgPrice
  }

  const getUsageSummary = () => {
    const { totalUsage } = useAIConfig()
    return {
      totalRequests: totalUsage.value.requests,
      totalTokens: totalUsage.value.tokens,
      estimatedCost: totalUsage.value.cost
    }
  }

  return {
    trackAIRequest,
    estimateTokens,
    estimateCost,
    getUsageSummary,
    isTracking: readonly(isTracking)
  }
}
