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
      symbol: stockData.symbol,
      userId,
      firmId,
      status: 'queued',
      progress: 0
    })

    console.log(`🚀 Queued AI analysis job: ${job.id} for ${stockData.symbol}`)

    // Start background processing (non-blocking)
    processAIAnalysisBackground(job.id, stockData, userId, firmId, event)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `AI analysis queued for ${stockData.symbol}`,
      estimatedTime: '30-45 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing AI analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue AI analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function
async function processAIAnalysisBackground(jobId: string, stockData: any, userId: string, firmId: string, event: any) {
  try {
    console.log(`🤖 Starting background AI analysis for job: ${jobId}`)

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
      message: 'Generating AI analysis...'
    })

    // Note: News will be fetched separately via AI news endpoint
    const recentNews = 'News analysis available via separate AI news fetch button in modal.'

    // Comprehensive AI prompt with news integration
    const aiPrompt = `
    You are an expert stock market analyst. Provide a comprehensive analysis of the following Indian stock:

    STOCK DETAILS:
    - Symbol: ${stockData.symbol}
    - Company: ${stockData.companyName || stockData.symbol}
    - Current Price: ₹${stockData.currentPrice}
    - Price Change: ₹${stockData.change} (${stockData.pChange}%)
    - Volume: ${stockData.volume}
    - Day High: ₹${stockData.dayHigh}
    - Day Low: ₹${stockData.dayLow}

    RECENT NEWS & DEVELOPMENTS:
    ${recentNews}

    Based on the stock data AND recent news, provide analysis in JSON format:
    {
      "recommendation": "BUY/SELL/HOLD/STRONG BUY/STRONG SELL",
      "confidence": "High/Medium/Low",
      "summary": "Brief 2-3 line summary incorporating recent news impact",
      "technicalAnalysis": "Detailed technical analysis",
      "fundamentalAnalysis": "Company and valuation analysis incorporating news impact",
      "marketTrends": "Market trends and outlook considering recent developments",
      "riskAssessment": "Risk factors and mitigation including news-based risks",
      "newsImpact": "Analysis of how recent news affects the stock outlook",
      "keyNewsHighlights": "Top 3-5 recent news points affecting the stock"
    }

    IMPORTANT: Factor in the recent news when making your recommendation. News can significantly impact stock performance.
    Focus on Indian market context and provide actionable insights.
    `

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'AI processing analysis...'
    })

    // Generate AI analysis with extended timeout for reasoning models
    const isReasoningModel = aiConfig.model.includes('r1') || aiConfig.model.includes('reasoning') || aiConfig.model.includes('thinking')
    const timeoutDuration = isReasoningModel ? 180000 : 120000 // 3 minutes for reasoning models, 2 minutes for others

    console.log(`⏱️ Setting AI analysis timeout: ${timeoutDuration/1000}s for model: ${aiConfig.model}`)

    // Add progress updates during long operations
    const progressInterval = setInterval(() => {
      const currentJob = JobManager.getJob(jobId)
      const currentProgress = currentJob?.progress || 50
      JobManager.updateJob(jobId, {
        progress: Math.min(75, currentProgress + 5),
        message: isReasoningModel ? 'AI is thinking deeply about the analysis...' : 'AI processing analysis...'
      })
    }, 15000) // Update every 15 seconds

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        clearInterval(progressInterval)
        reject(new Error(`AI analysis timeout after ${timeoutDuration/1000} seconds`))
      }, timeoutDuration)
    )

    try {
      const aiPromise = aiService.generateContent({ prompt: aiPrompt })
      const aiResult = await Promise.race([aiPromise, timeoutPromise]) as any
      clearInterval(progressInterval) // Clear interval on success
      const aiResponse = aiResult.content

      // Update progress
      JobManager.updateJob(jobId, {
        progress: 80,
        message: 'Processing AI response...'
      })

      // Parse AI response
      let analysis
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError: any) {
        console.error('❌ Failed to parse AI analysis response:', parseError)
        console.error('❌ Raw response that failed parsing:')
        console.error(aiResponse)
        console.error('❌ STRICT POLICY: No mock/fallback data will be used')
        throw new Error(`Failed to parse AI analysis response: ${parseError.message}. Only real AI data allowed.`)
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis,
        completedAt: new Date(),
        message: 'AI analysis completed successfully'
      })

      console.log(`✅ Background AI analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      clearInterval(progressInterval) // Clear interval on error
      console.error(`❌ AI generation failed for job: ${jobId}`, aiError)
      throw aiError // Re-throw to be caught by outer catch block
    }

  } catch (error: any) {
    console.error(`❌ Background AI analysis failed for job: ${jobId}`, error)

    // Job failed
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Unknown error',
      failedAt: new Date(),
      message: `AI analysis failed: ${error?.message || 'Unknown error'}`
    })
  }
}

// All helper functions removed - no fallback data extraction allowed
// All static/demo news functions removed as per user request
// AI will fetch real news through web search instead
// STRICT POLICY: Only real AI-generated JSON responses are accepted
