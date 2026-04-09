import { defineEventHandler, readBody, createError } from 'h3'
import { JobManager } from '../../utils/jobManager'
import { AIService } from '../../utils/aiService'

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
    const fundData = await readBody(event)

    if (!fundData.schemeCode || !fundData.schemeName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Scheme code and name are required'
      })
    }

    // Create job using JobManager
    const job = JobManager.createJob({
      symbol: fundData.schemeName, // Use scheme name as symbol
      userId,
      firmId,
      status: 'queued',
      progress: 0,
      type: 'mutual-fund-fundamental-analysis'
    })

    console.log(`🚀 Queued mutual fund fundamental analysis job: ${job.id} for ${fundData.schemeName}`)

    // Get AI configuration from request headers
    const aiConfigHeader = getHeader(event, 'x-ai-config')
    if (!aiConfigHeader) {
      throw createError({
        statusCode: 400,
        statusMessage: 'AI configuration not provided. Please configure your AI settings.'
      })
    }

    let aiConfig
    try {
      aiConfig = JSON.parse(aiConfigHeader as string)
    } catch (error) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid AI configuration format'
      })
    }

    // Get custom provider configuration if available
    const customProviderHeader = getHeader(event, 'x-custom-provider')
    let customProvider = null
    if (customProviderHeader) {
      try {
        customProvider = JSON.parse(customProviderHeader as string)
        console.log('🔧 Custom provider detected:', customProvider.name)
      } catch (error) {
        console.warn('⚠️ Invalid custom provider format, ignoring')
      }
    }

    // Start background processing (non-blocking)
    processMutualFundFundamentalAnalysisBackground(job.id, fundData, userId, firmId, aiConfig, customProvider)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `Mutual fund fundamental analysis queued for ${fundData.schemeName}`,
      estimatedTime: '60-90 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing mutual fund fundamental analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue mutual fund fundamental analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for mutual fund fundamental analysis
async function processMutualFundFundamentalAnalysisBackground(jobId: string, fundData: any, userId: string, firmId: string, aiConfig: any, customProvider?: any) {
  try {
    console.log(`🤖 Starting background mutual fund fundamental analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Fetching real fund information from AMFI...'
    })

    // Fetch real fund details from AMFI
    const realFundDetails = await fetchRealFundDetails(fundData.schemeCode, fundData.schemeName)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Analyzing real fund fundamentals...'
    })

    // Analyze real fund fundamentals
    const fundamentalMetrics = analyzeRealFundamentals(realFundDetails, fundData)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'Generating AI fundamental analysis...'
    })

    console.log('🤖 Using dynamic AI configuration:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey,
      customProvider: customProvider ? customProvider.name : 'None'
    })

    // Initialize dynamic AI service with custom provider support
    const aiService = new AIService(aiConfig, customProvider)

    // Enhanced AI prompt for mutual fund fundamental analysis
    const aiPrompt = `You are a professional mutual fund analyst with expertise in Indian mutual fund markets.

MUTUAL FUND INFORMATION:
- Scheme Name: ${fundData.schemeName}
- Scheme Code: ${fundData.schemeCode}
- Fund House: ${fundData.fundHouse}
- Category: ${fundData.category}
- Current NAV: ₹${fundData.currentNAV}
- Current Value: ₹${fundData.currentValue}
- Profit/Loss: ₹${fundData.profitLoss} (${fundData.profitLossPercentage}%)

REAL FUNDAMENTAL DATA FROM AMFI:
- Fund House: ${fundamentalMetrics.fundHouse}
- Current NAV: ₹${fundamentalMetrics.currentNAV}
- NAV Date: ${fundamentalMetrics.navDate}
- Category: ${fundamentalMetrics.schemeCategory}
- User's Investment Performance: ${fundData.profitLossPercentage}%

ANALYSIS REQUIREMENTS:
1. FUNDAMENTAL ANALYSIS:
   - Fund house quality assessment
   - Expense ratio evaluation
   - Category performance analysis
   - AUM size implications



3. INVESTMENT SUITABILITY:
   - Risk profile assessment
   - Investment horizon recommendations
   - Portfolio fit analysis

4. COMPARATIVE ANALYSIS:
   - Peer comparison within category
   - Benchmark performance evaluation
   - Value proposition assessment

Return analysis in JSON format:
{
  "metrics": {
    "fundHouse": "${fundamentalMetrics.fundHouse}",
    "currentNAV": "₹${fundamentalMetrics.currentNAV}",
    "navDate": "${fundamentalMetrics.navDate}",
    "category": "${fundamentalMetrics.schemeCategory}"
  },

  "fundamentalRecommendation": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL",
  "confidence": "High/Medium/Low",
  "fundHouseAnalysis": "Assessment of fund house quality and track record",
  "expenseAnalysis": "Expense ratio evaluation and cost efficiency",
  "categoryAnalysis": "Performance within fund category",
  "riskAssessment": "Risk profile and suitability analysis",
  "investmentHorizon": "Recommended investment timeframe",
  "portfolioFit": "How this fund fits in a diversified portfolio",
  "keyStrengths": "Main advantages of this fund",
  "keyRisks": "Primary risks and concerns",
  "outlook": "Future prospects and expectations"
}

Focus on Indian mutual fund context and provide actionable analysis based on real fundamental data.`

    try {
      // Generate AI analysis with timeout
      // Generate AI analysis with extended timeout
      const isReasoningModel = aiConfig.model.includes('r1') || aiConfig.model.includes('reasoning') || aiConfig.model.includes('thinking')
      const timeoutDuration = isReasoningModel ? 180000 : 120000 // 3 minutes for reasoning models, 2 minutes for others

      console.log(`⏱️ Setting mutual fund fundamental analysis timeout: ${timeoutDuration/1000}s for model: ${aiConfig.model}`)

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Mutual fund fundamental analysis timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration)
      )

      const aiPromise = aiService.generateContent({ prompt: aiPrompt })
      const aiResult = await Promise.race([aiPromise, timeoutPromise]) as any

      // Handle reasoning models that might return content in reasoning field
      let aiResponse = aiResult.content || ''

      if (!aiResponse.trim() && aiResult.reasoning && aiResult.reasoning.trim()) {
        console.log('🧠 Using reasoning field as content for reasoning model')
        aiResponse = aiResult.reasoning
      }

      if (!aiResponse.trim()) {
        throw new Error('AI returned empty response in both content and reasoning fields')
      }

      // Update progress
      JobManager.updateJob(jobId, {
        progress: 80,
        message: 'Processing fundamental analysis results...'
      })

      console.log(`✅ Mutual fund fundamental analysis completed for ${fundData.schemeName}`)

      // Parse AI response
      let fundamentalAnalysis
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          fundamentalAnalysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError) {
        console.error('Failed to parse AI response for mutual fund fundamental analysis:', parseError)
        throw new Error('AI analysis failed - unable to parse response. Only real data analysis is supported.')
      }

      // Prepare final response with real data and AI analysis
      const finalAnalysis = {
        fundInfo: {
          schemeCode: fundData.schemeCode,
          schemeName: fundData.schemeName,
          fundHouse: fundData.fundHouse,
          category: fundData.category
        },
        fundamentalMetrics,
        aiAnalysis: fundamentalAnalysis,
        analysisTimestamp: new Date().toISOString()
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis: finalAnalysis,
        completedAt: new Date(),
        message: 'Mutual fund fundamental analysis completed successfully'
      })

      console.log(`✅ Background mutual fund fundamental analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      console.error('Mutual fund fundamental analysis AI error:', aiError)

      // Job failed
      JobManager.updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: aiError?.message || 'Unknown error',
        failedAt: new Date(),
        message: `Mutual fund fundamental analysis failed: ${aiError?.message || 'Unknown error'}`
      })
    }

  } catch (error: any) {
    console.error(`❌ Background mutual fund fundamental analysis failed for job: ${jobId}`, error)

    // Job failed
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Unknown error',
      failedAt: new Date(),
      message: `Mutual fund fundamental analysis failed: ${error?.message || 'Unknown error'}`
    })
  }
}

// Helper functions for fundamental analysis using real data
async function fetchRealFundDetails(schemeCode: string, schemeName: string) {
  try {
    console.log(`🔍 Fetching real fund details for scheme: ${schemeCode} (${schemeName})`)

    // Use the mfapi.in API which provides real fund details and NAV data
    const apiUrl = `https://api.mfapi.in/mf/${schemeCode}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch fund details: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data || !data.meta) {
      throw new Error('No fund details available from API')
    }

    console.log(`✅ Fetched real fund details for: ${data.meta.scheme_name}`)

    // Extract real fund details from API response
    const fundDetails = {
      schemeCode: data.meta.scheme_code,
      schemeName: data.meta.scheme_name,
      fundHouse: data.meta.fund_house,
      schemeType: data.meta.scheme_type,
      schemeCategory: data.meta.scheme_category,
      currentNAV: data.data && data.data.length > 0 ? parseFloat(data.data[0].nav) : 0,
      navDate: data.data && data.data.length > 0 ? data.data[0].date : new Date().toISOString().split('T')[0]
    }

    // Ensure we have real data
    if (!fundDetails.fundHouse || fundDetails.fundHouse.trim() === '') {
      throw new Error('Fund house information not available from API')
    }

    return fundDetails
  } catch (error) {
    console.error('Error fetching real fund details:', error)
    throw new Error(`Failed to fetch real fund details: ${error}`)
  }
}

function analyzeRealFundamentals(realFundDetails: any, _fundData: any) {
  // Only use real data - no static estimates allowed
  if (!realFundDetails || !realFundDetails.fundHouse || realFundDetails.fundHouse.trim() === '') {
    throw new Error('No real fund details available from API. Cannot proceed without actual fund data.')
  }

  console.log(`📊 Analyzing real fundamentals for: ${realFundDetails.schemeName}`)

  return {
    schemeCode: realFundDetails.schemeCode,
    schemeName: realFundDetails.schemeName,
    fundHouse: realFundDetails.fundHouse,
    schemeType: realFundDetails.schemeType,
    schemeCategory: realFundDetails.schemeCategory,
    currentNAV: realFundDetails.currentNAV,
    navDate: realFundDetails.navDate,
    // Note: Additional metrics like expense ratio, AUM, fund age, portfolio holdings
    // would need to be fetched from specialized APIs like Value Research, Morningstar,
    // or fund house websites. For now, we rely on AI analysis of available real data.
  }
}
