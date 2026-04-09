import type { AIError } from '../types/ai'

export class AIErrorHandler {
  static handleError(error: any, provider: string): AIError {
    console.error(`❌ AI Error Handler - Provider: ${provider}`)
    console.error('🔍 Original error:', error)

    let code = 'UNKNOWN_ERROR'
    let message = 'An unknown error occurred'

    // Handle different provider-specific errors
    switch (provider) {
      case 'google':
        return this.handleGoogleError(error)
      case 'openai':
        return this.handleOpenAIError(error)
      case 'anthropic':
        return this.handleAnthropicError(error)
      case 'openrouter':
        return this.handleOpenRouterError(error)
      default:
        break
    }

    // Generic error handling
    if (error.message) {
      message = error.message
    }

    if (error.code) {
      code = error.code
    }

    const aiError = {
      code,
      message,
      provider,
      details: error
    }

    console.error('🚨 Final AI Error:', aiError)

    return aiError
  }

  private static handleGoogleError(error: any): AIError {
    let code = 'GOOGLE_ERROR'
    let message = error.message || 'Google AI error'

    // Handle specific Google AI errors
    if (error.message?.includes('API key')) {
      code = 'INVALID_API_KEY'
      message = 'Invalid Google AI API key. Please check your API key configuration.'
    } else if (error.message?.includes('quota')) {
      code = 'QUOTA_EXCEEDED'
      message = 'Google AI quota exceeded. Please check your usage limits.'
    } else if (error.message?.includes('model')) {
      code = 'INVALID_MODEL'
      message = 'Invalid or unavailable Google AI model.'
    } else if (error.message?.includes('timeout')) {
      code = 'TIMEOUT'
      message = 'Google AI request timed out. Please try again.'
    }

    return {
      code,
      message,
      provider: 'google',
      details: error
    }
  }

  private static handleOpenAIError(error: any): AIError {
    let code = 'OPENAI_ERROR'
    let message = error.message || 'OpenAI error'

    // Handle specific OpenAI errors
    if (error.message?.includes('Incorrect API key')) {
      code = 'INVALID_API_KEY'
      message = 'Invalid OpenAI API key. Please check your API key configuration.'
    } else if (error.message?.includes('insufficient_quota')) {
      code = 'QUOTA_EXCEEDED'
      message = 'OpenAI quota exceeded. Please check your usage limits.'
    } else if (error.message?.includes('model_not_found')) {
      code = 'INVALID_MODEL'
      message = 'Invalid or unavailable OpenAI model.'
    } else if (error.message?.includes('timeout')) {
      code = 'TIMEOUT'
      message = 'OpenAI request timed out. Please try again.'
    } else if (error.message?.includes('rate_limit_exceeded')) {
      code = 'RATE_LIMIT'
      message = 'OpenAI rate limit exceeded. Please wait and try again.'
    }

    return {
      code,
      message,
      provider: 'openai',
      details: error
    }
  }

  private static handleAnthropicError(error: any): AIError {
    let code = 'ANTHROPIC_ERROR'
    let message = error.message || 'Anthropic error'

    // Handle specific Anthropic errors
    if (error.message?.includes('authentication')) {
      code = 'INVALID_API_KEY'
      message = 'Invalid Anthropic API key. Please check your API key configuration.'
    } else if (error.message?.includes('rate_limit')) {
      code = 'RATE_LIMIT'
      message = 'Anthropic rate limit exceeded. Please wait and try again.'
    } else if (error.message?.includes('model')) {
      code = 'INVALID_MODEL'
      message = 'Invalid or unavailable Anthropic model.'
    } else if (error.message?.includes('timeout')) {
      code = 'TIMEOUT'
      message = 'Anthropic request timed out. Please try again.'
    }

    return {
      code,
      message,
      provider: 'anthropic',
      details: error
    }
  }

  private static handleOpenRouterError(error: any): AIError {
    let code = 'OPENROUTER_ERROR'
    let message = error.message || 'OpenRouter error'

    console.error('🔍 OpenRouter Error Handler - Original error:', error)
    console.error('🔍 Error message:', error.message)
    console.error('🔍 Error stack:', error.stack)

    // Preserve the original detailed error message
    const originalMessage = error.message || 'Unknown OpenRouter error'

    // Handle specific OpenRouter errors but preserve details
    if (error.message?.includes('Invalid API key') || error.message?.includes('authentication')) {
      code = 'INVALID_API_KEY'
      message = `Invalid OpenRouter API key. Original error: ${originalMessage}`
    } else if (error.message?.includes('insufficient_quota') || error.message?.includes('quota')) {
      code = 'QUOTA_EXCEEDED'
      message = `OpenRouter quota exceeded. Original error: ${originalMessage}`
    } else if (error.message?.includes('model_not_found') || error.message?.includes('model')) {
      code = 'INVALID_MODEL'
      message = `Invalid or unavailable model on OpenRouter. Original error: ${originalMessage}`
    } else if (error.message?.includes('timeout')) {
      code = 'TIMEOUT'
      message = `OpenRouter request timed out. Original error: ${originalMessage}`
    } else if (error.message?.includes('rate_limit')) {
      code = 'RATE_LIMIT'
      message = `OpenRouter rate limit exceeded. Original error: ${originalMessage}`
    } else if (error.message?.includes('content_policy')) {
      code = 'CONTENT_POLICY'
      message = `Request violates OpenRouter content policy. Original error: ${originalMessage}`
    } else if (error.message?.includes('Provider returned error')) {
      code = 'PROVIDER_ERROR'
      message = `OpenRouter provider error. Original error: ${originalMessage}`
    } else if (error.message?.includes('Bad gateway') || error.message?.includes('502')) {
      code = 'BAD_GATEWAY'
      message = `OpenRouter bad gateway error (provider may be down). Original error: ${originalMessage}`
    } else if (error.message?.includes('Service unavailable') || error.message?.includes('503')) {
      code = 'SERVICE_UNAVAILABLE'
      message = `OpenRouter service unavailable (temporary issue). Original error: ${originalMessage}`
    } else if (error.message?.includes('Too many requests') || error.message?.includes('429')) {
      code = 'TOO_MANY_REQUESTS'
      message = `OpenRouter too many requests (rate limited). Original error: ${originalMessage}`
    } else if (error.message?.includes('Internal server error') || error.message?.includes('500')) {
      code = 'INTERNAL_SERVER_ERROR'
      message = `OpenRouter internal server error. Original error: ${originalMessage}`
    } else {
      // For unknown errors, preserve the full original message
      message = `OpenRouter error: ${originalMessage}`
    }

    console.error('🚨 Final processed error message:', message)

    return {
      code,
      message,
      provider: 'openrouter',
      details: error
    }
  }

  static getErrorMessage(aiError: AIError): string {
    const baseMessage = aiError.message

    // Add provider-specific guidance
    switch (aiError.code) {
      case 'INVALID_API_KEY':
        return `${baseMessage} Please go to Settings > AI Settings to update your API key.`
      case 'QUOTA_EXCEEDED':
        return `${baseMessage} You may need to upgrade your plan or wait for quota reset.`
      case 'RATE_LIMIT':
        return `${baseMessage} Please wait a moment before making another request.`
      case 'INVALID_MODEL':
        return `${baseMessage} Please select a different model in Settings > AI Settings.`
      case 'TIMEOUT':
        return `${baseMessage} This might be due to high demand. Please try again.`
      default:
        return baseMessage
    }
  }

  static shouldRetry(aiError: AIError): boolean {
    // Determine if the error is retryable
    const retryableCodes = ['TIMEOUT', 'RATE_LIMIT', 'QUOTA_EXCEEDED']
    return retryableCodes.includes(aiError.code)
  }

  static getRetryDelay(aiError: AIError): number {
    // Return delay in milliseconds
    switch (aiError.code) {
      case 'RATE_LIMIT':
        return 60000 // 1 minute
      case 'TIMEOUT':
        return 5000 // 5 seconds
      case 'QUOTA_EXCEEDED':
        return 300000 // 5 minutes
      default:
        return 10000 // 10 seconds
    }
  }
}
