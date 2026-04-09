import { defineEventHandler, readBody, createError } from 'h3'
import { JobManager } from '../../utils/jobManager'
import { AIService, getAIConfigFromUser } from '../../utils/aiService'

export default defineEventHandler(async (event) => {
  // Get user context with normalization
  const userId = String(event.context.userId || event.context.user?.id || '')
  const firmId = String(event.context.user?.firmId || event.context.firmId || '')

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  try {
    const stockData = await readBody(event)

    if (!stockData.symbol) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Stock symbol is required'
      })
    }

    // Create job using JobManager
    const job = JobManager.createJob({
      type: 'fundamental-analysis',
      symbol: stockData.symbol,
      userId,
      firmId,
      status: 'queued',
      progress: 0
    })

    console.log(`🚀 Queued AI fundamental analysis job: ${job.id} for ${stockData.symbol}`)

    // Start background processing (non-blocking)
    processFundamentalAnalysisBackground(job.id, stockData, userId, firmId, event)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `AI fundamental analysis queued for ${stockData.symbol}`,
      estimatedTime: '45-60 seconds'
    }

  } catch (error) {
    console.error('Error queuing fundamental analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to queue fundamental analysis'
    })
  }
})

async function processFundamentalAnalysisBackground(jobId: string, stockData: any, userId: string, firmId: string, event: any) {
  try {
    console.log(`🤖 Starting background AI fundamental analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date()
    })

    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Generating AI fundamental analysis...'
    })

    // Comprehensive AI prompt for fundamental analysis
    const aiPrompt = `
    You are an expert financial analyst specializing in fundamental analysis. Provide a comprehensive fundamental analysis of the following Indian stock:

    STOCK DETAILS:
    - Symbol: ${stockData.symbol}
    - Company: ${stockData.companyName || stockData.symbol}
    - Current Price: ₹${stockData.currentPrice}
    - Price Change: ₹${stockData.change} (${stockData.pChange}%)
    - Volume: ${stockData.volume}
    - Day High: ₹${stockData.dayHigh}
    - Day Low: ₹${stockData.dayLow}

    Provide a detailed fundamental analysis in JSON format with the following structure:
    {
      "metrics": {
        "pe": "P/E ratio or null if not available",
        "pb": "P/B ratio or null if not available",
        "roe": "Return on Equity % or null if not available",
        "debtToEquity": "Debt to Equity ratio or null if not available",
        "dividendYield": "Dividend yield % or null if not available",
        "marketCap": "Market capitalization or null if not available",
        "eps": "Earnings per share or null if not available",
        "revenue": "Annual revenue or null if not available"
      },
      "financialHealth": "Detailed HTML analysis of balance sheet, debt management, cash flow, and liquidity. Use <p>, <ul>, <li>, <strong> tags for formatting.",
      "profitability": "Detailed HTML analysis of revenue growth, margins, return metrics, earnings quality. Use <p>, <ul>, <li>, <strong> tags for formatting.",
      "pros": ["Array of specific strengths and positive factors"],
      "cons": ["Array of specific weaknesses and risk factors"],
      "recommendation": "BUY/SELL/HOLD/STRONG_BUY/STRONG_SELL",
      "confidence": "High/Medium/Low",
      "summary": "Detailed HTML investment summary with key highlights. Use <p>, <ul>, <li>, <strong> tags for formatting.",
      "analysisTimestamp": "${new Date().toISOString()}"
    }

    CRITICAL REQUIREMENTS:
    - ONLY provide REAL financial data - NO mock, sample, or fake data
    - If specific metrics are not available, set them to null (not fabricated values)
    - Focus on actual company fundamentals, business model, competitive position
    - Provide genuine analysis based on the company's actual financial performance
    - Include sector-specific analysis and industry comparisons
    - Consider current market conditions and economic factors
    - Be honest about data limitations - use null for unavailable metrics
    - Provide actionable insights for investors

    RESPONSE FORMAT:
    - Return ONLY valid JSON (no markdown, no explanations, no code blocks)
    - Start response with { and end with }
    - Ensure all strings are properly escaped
    - Use double quotes for all JSON keys and string values
    - Do not include any text before or after the JSON
    `

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 60,
      message: 'Processing AI response...'
    })

    // Generate AI analysis with timeout
    const isReasoningModel = aiConfig.model.includes('r1') || aiConfig.model.includes('reasoning') || aiConfig.model.includes('thinking')
    const timeoutDuration = isReasoningModel ? 180000 : 120000 // 3 minutes for reasoning models, 2 minutes for others

    console.log(`⏱️ Setting fundamental analysis timeout: ${timeoutDuration/1000}s for model: ${aiConfig.model}`)

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Fundamental analysis timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration)
    )

    console.log('🚀 Starting AI fundamental analysis for:', stockData.symbol)
    console.log('📝 AI Prompt length:', aiPrompt.length)

    const aiPromise = aiService.generateContent({ prompt: aiPrompt })
    const result = await Promise.race([aiPromise, timeoutPromise]) as any

    console.log('✅ AI analysis completed')
    console.log('📄 Response content length:', result.content?.length || 0)
    console.log('🧠 Response reasoning length:', result.reasoning?.length || 0)

    // Handle reasoning models that might return content in reasoning field
    let analysisText = result.content || ''

    // For reasoning models, if content is empty but reasoning has content, use reasoning
    if (!analysisText.trim() && result.reasoning && result.reasoning.trim()) {
      console.log('🧠 Using reasoning field as content for reasoning model')
      analysisText = result.reasoning
    }

    // If still no content, this is an error
    if (!analysisText.trim()) {
      console.error('❌ AI returned no usable content in either content or reasoning fields')
      throw new Error('AI returned empty response in both content and reasoning fields')
    }

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 80,
      message: 'Parsing analysis results...'
    })

    // Parse JSON response - STRICT REAL DATA ONLY
    let analysis: any

    console.log('📄 Raw AI Response:')
    console.log('='.repeat(50))
    console.log(analysisText)
    console.log('='.repeat(50))

    if (!analysisText || analysisText.trim().length === 0) {
      console.error('❌ AI returned empty response - NO FALLBACK DATA ALLOWED')
      throw new Error('AI returned empty response. Cannot proceed without real AI analysis.')
    }

    try {
      // Clean the response text to extract JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response:')
        console.error('Response content:', analysisText.substring(0, 500) + '...')
        console.error('❌ STRICT POLICY: No fallback data allowed - failing request')
        throw new Error('No valid JSON found in AI response. Real data parsing failed.')
      }

      console.log('🔍 Extracted JSON string:')
      console.log(jsonMatch[0].substring(0, 200) + '...')

      analysis = JSON.parse(jsonMatch[0])

      // Validate that we have real analysis data
      if (!analysis || typeof analysis !== 'object') {
        console.error('❌ Parsed analysis is not a valid object')
        throw new Error('Invalid analysis object structure')
      }

      // Check for required fields to ensure it's real analysis (matching the prompt structure)
      const requiredFields = ['summary', 'recommendation', 'pros', 'cons', 'financialHealth', 'profitability']
      const missingFields = requiredFields.filter(field => !analysis[field])

      if (missingFields.length > 0) {
        console.error('❌ Missing required analysis fields:', missingFields)
        console.error('❌ Available fields:', Object.keys(analysis))
        console.error('❌ STRICT POLICY: Incomplete real data - failing request')
        throw new Error(`Incomplete AI analysis - missing fields: ${missingFields.join(', ')}`)
      }

      // Validate that arrays are actually arrays
      if (!Array.isArray(analysis.pros) || !Array.isArray(analysis.cons)) {
        console.error('❌ Pros/cons are not arrays:', { pros: typeof analysis.pros, cons: typeof analysis.cons })
        throw new Error('Invalid analysis structure - pros and cons must be arrays')
      }

      // Validate that we have meaningful content (not empty strings)
      if (!analysis.summary.trim() || !analysis.recommendation.trim()) {
        console.error('❌ Empty summary or recommendation')
        throw new Error('Analysis contains empty required fields')
      }

      console.log('✅ Successfully parsed real AI analysis with all required fields')

    } catch (parseError: any) {
      console.error('❌ Failed to parse AI response:', parseError)
      console.error('❌ Raw response that failed parsing:')
      console.error(analysisText)
      console.error('❌ STRICT POLICY: No mock/fallback data will be used')
      throw new Error(`Failed to parse AI analysis response: ${parseError.message}. Only real AI data allowed.`)
    }

    // Complete the job
    JobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'AI fundamental analysis completed',
      analysis,
      completedAt: new Date()
    })

    console.log(`✅ AI fundamental analysis completed for ${stockData.symbol}`)

  } catch (error: any) {
    console.error(`❌ AI fundamental analysis failed for ${stockData.symbol}:`, error)
    console.error('🔍 Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    JobManager.updateJob(jobId, {
      status: 'failed',
      error: error?.message || 'AI fundamental analysis failed',
      failedAt: new Date()
    })
  }
}

// All mock data generation functions removed - using real AI analysis only
