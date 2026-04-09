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

    // Read request body
    const fundData = await readBody(event)

    // Validate required fields
    if (!fundData.schemeName || !fundData.schemeCode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Scheme name and code are required'
      })
    }

    console.log(`🏭 Starting portfolio analysis for: ${fundData.schemeName}`)

    // Create a job for tracking progress
    const job = JobManager.createJob({
      type: 'mutual-fund-portfolio-analysis',
      symbol: fundData.schemeName, // Use scheme name as symbol
      userId,
      firmId,
      status: 'queued',
      progress: 0,
      message: 'Starting portfolio analysis...'
    })

    console.log(`🚀 Queued mutual fund portfolio analysis job: ${job.id} for ${fundData.schemeName}`)

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

    // Start background processing (non-blocking)
    processPortfolioAnalysis(job.id, fundData, userId, firmId, aiConfig)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `Mutual fund portfolio analysis queued for ${fundData.schemeName}`,
      estimatedTime: '60-90 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing mutual fund portfolio analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue mutual fund portfolio analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for mutual fund portfolio analysis
async function processPortfolioAnalysis(jobId: string, fundData: any, userId: string, firmId: string, aiConfig: any) {
  try {
    console.log(`🤖 Starting background mutual fund portfolio analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Fetching real fund details from AMFI...'
    })

    // Fetch real fund details from AMFI API
    const realFundDetails = await fetchRealFundDetails(fundData.schemeCode, fundData.schemeName)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Analyzing fund category and investment style...'
    })

    // Analyze real fund fundamentals
    const fundamentalMetrics = analyzeRealFundamentals(realFundDetails, fundData)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'Generating AI portfolio analysis...'
    })

    // Initialize dynamic AI service
    console.log('🤖 Using dynamic AI configuration:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey
    })

    const aiService = new AIService(aiConfig)

    // Enhanced AI prompt for mutual fund portfolio analysis
    const aiPrompt = `You are a professional mutual fund portfolio analyst with expertise in Indian mutual fund markets and portfolio construction.

MUTUAL FUND INFORMATION:
- Scheme Name: ${fundData.schemeName}
- Scheme Code: ${fundData.schemeCode}
- Fund House: ${fundData.fundHouse}
- Category: ${fundData.category}
- Current NAV: ₹${fundData.currentNAV}
- Current Value: ₹${fundData.currentValue}
- Profit/Loss: ₹${fundData.profitLoss} (${fundData.profitLossPercentage}%)

REAL FUND DATA FROM AMFI:
- Fund House: ${fundamentalMetrics.fundHouse}
- Current NAV: ₹${fundamentalMetrics.currentNAV}
- NAV Date: ${fundamentalMetrics.navDate}
- Category: ${fundamentalMetrics.schemeCategory}

ANALYSIS REQUIREMENTS:
Based on the fund category "${fundamentalMetrics.schemeCategory}" and fund house "${fundamentalMetrics.fundHouse}", provide realistic portfolio analysis using your knowledge of Indian mutual fund industry patterns and typical holdings for this category.

1. SECTOR ALLOCATION ANALYSIS:
   - For equity funds: Provide typical sector allocation based on category (Large Cap, Mid Cap, Small Cap, Multi Cap, etc.)
   - For debt funds: Provide credit quality and duration analysis
   - For hybrid funds: Provide equity vs debt breakdown plus major equity sectors
   - Use realistic percentages based on category norms and current market conditions

2. TOP HOLDINGS ANALYSIS:
   - For equity funds: Provide typical top 10 stock holdings based on fund category and current market leaders
   - Include company names, sectors, and typical weight percentages
   - Focus on companies that are commonly held by funds in this category
   - Include market cap information (Large/Mid/Small cap)

IMPORTANT: Only provide analysis based on real knowledge of Indian mutual fund industry patterns. Do not use fictional data.

Return analysis in JSON format:
{
  "sectorAllocation": [
    {
      "sector": "Information Technology",
      "percentage": 25.5,
      "description": "IT services and software companies"
    }
  ],
  "topHoldings": [
    {
      "company": "Reliance Industries Ltd",
      "sector": "Oil & Gas",
      "weight": 8.5,
      "marketCap": "Large Cap"
    }
  ],
  "portfolioSummary": "Overall portfolio composition and investment strategy",
  "riskProfile": "Risk characteristics of the portfolio",
  "diversification": "Analysis of portfolio diversification"
}

Focus on Indian mutual fund context and provide realistic analysis based on actual market knowledge.`

    try {
      // Generate AI analysis with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Portfolio analysis timeout')), 60000) // 60 seconds
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
        message: 'Processing portfolio analysis results...'
      })

      console.log(`✅ Portfolio analysis completed for ${fundData.schemeName}`)

      // Parse AI response
      let portfolioAnalysis
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          portfolioAnalysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError) {
        console.error('Failed to parse AI response for portfolio analysis:', parseError)
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
        ...portfolioAnalysis,
        analysisTimestamp: new Date().toISOString()
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis: finalAnalysis,
        completedAt: new Date(),
        message: 'Mutual fund portfolio analysis completed successfully'
      })

      console.log(`✅ Background mutual fund portfolio analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      console.error('AI portfolio analysis error:', aiError)
      throw new Error(`AI portfolio analysis failed: ${aiError?.message || 'Unknown AI error'}`)
    }

  } catch (error: any) {
    console.error(`❌ Background mutual fund portfolio analysis failed for job: ${jobId}`, error)
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Mutual fund portfolio analysis failed',
      failedAt: new Date(),
      message: 'Portfolio analysis failed'
    })
  }
}

// Reuse the same functions from fundamental analysis
async function fetchRealFundDetails(schemeCode: string, schemeName: string) {
  try {
    console.log(`🔍 Fetching real fund details for scheme: ${schemeCode} - ${schemeName}`)

    // Use the mfapi.in API which provides real fund data
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
    navDate: realFundDetails.navDate
  }
}
