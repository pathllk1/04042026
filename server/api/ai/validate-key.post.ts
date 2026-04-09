import { AIService } from '../../utils/aiService'

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication
    const { userId, user } = event.context
    if (!userId || !user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    const body = await readBody(event)
    const { provider, apiKey, model } = body

    console.log(`🔑 Starting API key validation...`)
    console.log(`📋 Provider: ${provider}`)
    console.log(`🤖 Model: ${model}`)
    console.log(`🔐 API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT PROVIDED'}`)

    if (!provider || !apiKey || !model) {
      console.error('❌ Missing required fields:', { provider: !!provider, apiKey: !!apiKey, model: !!model })
      throw createError({
        statusCode: 400,
        statusMessage: 'Provider, API key, and model are required'
      })
    }

    console.log(`🔑 Validating API key for provider: ${provider}, model: ${model}`)

    // Validate the API key
    const isValid = await AIService.validateApiKey(provider, apiKey, model)

    console.log(`${isValid ? '✅' : '❌'} API key validation result: ${isValid}`)

    return {
      valid: isValid,
      provider,
      model,
      message: isValid ? 'API key is valid' : 'API key validation failed'
    }

  } catch (error: any) {
    console.error('❌ API key validation error:', error)
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    })
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to validate API key'
    })
  }
})
