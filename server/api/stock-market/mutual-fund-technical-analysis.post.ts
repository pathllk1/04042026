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
      type: 'mutual-fund-technical-analysis'
    })

    console.log(`🚀 Queued mutual fund technical analysis job: ${job.id} for ${fundData.schemeName}`)

    // Start background processing (non-blocking)
    processMutualFundTechnicalAnalysisBackground(job.id, fundData, userId, firmId, event)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `Mutual fund technical analysis queued for ${fundData.schemeName}`,
      estimatedTime: '60-90 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing mutual fund technical analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue mutual fund technical analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for mutual fund technical analysis
async function processMutualFundTechnicalAnalysisBackground(jobId: string, fundData: any, userId: string, firmId: string, event: any) {
  try {
    console.log(`🤖 Starting background mutual fund technical analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Fetching real NAV history from AMFI...'
    })

    // Fetch real NAV history from AMFI API
    const navHistory = await fetchRealNAVHistory(fundData.schemeCode)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Analyzing real performance metrics...'
    })

    // Calculate real performance metrics from actual NAV data
    const performanceMetrics = calculateRealPerformanceMetrics(navHistory, fundData)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'Generating AI technical analysis...'
    })

    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)

    // Enhanced AI prompt for mutual fund technical analysis
    const aiPrompt = `You are a professional mutual fund analyst with expertise in Indian mutual fund markets.

MUTUAL FUND INFORMATION:
- Scheme Name: ${fundData.schemeName}
- Scheme Code: ${fundData.schemeCode}
- Fund House: ${fundData.fundHouse}
- Category: ${fundData.category}
- Current NAV: ₹${fundData.currentNAV}
- Current Value: ₹${fundData.currentValue}
- Profit/Loss: ₹${fundData.profitLoss} (${fundData.profitLossPercentage}%)

REAL PERFORMANCE DATA:
- 1Y Returns: ${performanceMetrics.returns1Y.toFixed(2)}%
- Volatility: ${performanceMetrics.volatility.toFixed(2)}%
- Sharpe Ratio: ${performanceMetrics.sharpeRatio.toFixed(2)}
- Max Drawdown: ${performanceMetrics.maxDrawdown.toFixed(2)}%
- Current Trend: ${performanceMetrics.returns1Y > 0 ? 'Upward' : 'Downward'}

ANALYSIS REQUIREMENTS:
1. PERFORMANCE ANALYSIS:
   - NAV trend analysis based on real data
   - Risk-adjusted returns evaluation
   - Volatility assessment

2. TECHNICAL INDICATORS:
   - Momentum analysis
   - Trend strength evaluation
   - Risk metrics interpretation

3. INVESTMENT RECOMMENDATION:
   - Buy/Hold/Sell recommendation
   - Risk assessment
   - Investment horizon suggestions

Return analysis in JSON format:
{
  "technicalRecommendation": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL",
  "confidence": "High/Medium/Low",
  "performanceAnalysis": "Detailed performance analysis based on real NAV data",
  "riskAnalysis": "Risk assessment using real volatility and drawdown data",
  "trendAnalysis": "Current trend and momentum analysis",
  "investmentStrategy": "Recommended investment approach",
  "keyMetrics": "Important metrics to monitor",
  "outlook": "Short and medium term outlook"
}

Focus on Indian mutual fund context and provide actionable analysis based on real data.`

    try {
      // Generate AI analysis with extended timeout
      const isReasoningModel = aiConfig.model.includes('r1') || aiConfig.model.includes('reasoning') || aiConfig.model.includes('thinking')
      const timeoutDuration = isReasoningModel ? 180000 : 120000 // 3 minutes for reasoning models, 2 minutes for others

      console.log(`⏱️ Setting mutual fund analysis timeout: ${timeoutDuration/1000}s for model: ${aiConfig.model}`)

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Mutual fund analysis timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration)
      )

      const aiPromise = aiService.generateContent({ prompt: aiPrompt })
      const aiResult = await Promise.race([aiPromise, timeoutPromise]) as any
      const aiResponse = aiResult.content

      // Update progress
      JobManager.updateJob(jobId, {
        progress: 80,
        message: 'Processing analysis results...'
      })

      console.log(`✅ Mutual fund technical analysis completed for ${fundData.schemeName}`)

      // Parse AI response
      let technicalAnalysis
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          technicalAnalysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError) {
        console.error('Failed to parse AI response for mutual fund technical analysis:', parseError)
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
        performanceMetrics,
        aiAnalysis: technicalAnalysis,
        navHistory: navHistory.slice(-30), // Last 30 days for chart
        analysisTimestamp: new Date().toISOString()
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis: finalAnalysis,
        completedAt: new Date(),
        message: 'Mutual fund technical analysis completed successfully'
      })

      console.log(`✅ Background mutual fund technical analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      console.error('Mutual fund technical analysis AI error:', aiError)

      // Job failed
      JobManager.updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: aiError?.message || 'Unknown error',
        failedAt: new Date(),
        message: `Mutual fund technical analysis failed: ${aiError?.message || 'Unknown error'}`
      })
    }

  } catch (error: any) {
    console.error(`❌ Background mutual fund technical analysis failed for job: ${jobId}`, error)

    // Job failed
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Unknown error',
      failedAt: new Date(),
      message: `Mutual fund technical analysis failed: ${error?.message || 'Unknown error'}`
    })
  }
}

// Real data functions using actual MF API for historical NAV data
async function fetchRealNAVHistory(schemeCode: string): Promise<any[]> {
  try {
    console.log(`🔍 Fetching historical NAV data for scheme: ${schemeCode}`)

    // Use the mfapi.in API which provides historical NAV data
    const apiUrl = `https://api.mfapi.in/mf/${schemeCode}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch NAV history: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('No NAV history data available from API')
    }

    console.log(`✅ Fetched ${data.data.length} historical NAV data points for scheme: ${schemeCode}`)

    // Format the data - the API returns data in reverse chronological order (newest first)
    // We'll keep this order for calculations
    const navHistory = data.data.map((item: any) => ({
      date: item.date, // Format: DD-MM-YYYY
      nav: parseFloat(item.nav),
      schemeCode: schemeCode
    }))

    // Ensure we have at least 30 days of data for meaningful analysis
    if (navHistory.length < 30) {
      console.warn(`⚠️ Limited NAV history available for ${schemeCode}: only ${navHistory.length} data points`)
    }

    // Return at least 1 year of data if available (up to 365 data points)
    return navHistory.slice(0, Math.min(365, navHistory.length))
  } catch (error) {
    console.error('Error fetching real NAV history:', error)
    throw new Error(`Failed to fetch real NAV history: ${error}`)
  }
}

function calculateRealPerformanceMetrics(navHistory: any[], _fundData: any) {
  // Use ONLY real NAV data to calculate metrics - no fallbacks allowed
  if (!navHistory || navHistory.length === 0) {
    throw new Error('No real NAV history available for analysis. Cannot proceed without actual market data.')
  }

  console.log(`📊 Calculating performance metrics from ${navHistory.length} NAV data points`)

  // NAV history is in reverse chronological order (newest first)
  const currentNAV = navHistory[0]?.nav // Most recent NAV
  const oldestNAV = navHistory[navHistory.length - 1]?.nav // Oldest NAV

  // Calculate 1Y returns using actual NAV data
  let returns1Y = 0
  let returns3Y = 0

  if (navHistory.length >= 252) { // ~1 year of trading days
    const nav1YearAgo = navHistory[251]?.nav
    if (nav1YearAgo > 0) {
      returns1Y = ((currentNAV - nav1YearAgo) / nav1YearAgo) * 100
    }
  } else if (oldestNAV > 0) {
    // Use available data for partial year calculation
    const daysDiff = navHistory.length
    const annualizedReturn = ((currentNAV - oldestNAV) / oldestNAV) * (365 / daysDiff) * 100
    returns1Y = annualizedReturn
  }

  // Calculate 3Y returns if we have enough data
  if (navHistory.length >= 756) { // ~3 years of trading days
    const nav3YearsAgo = navHistory[755]?.nav
    if (nav3YearsAgo > 0) {
      const totalReturn = ((currentNAV - nav3YearsAgo) / nav3YearsAgo) * 100
      returns3Y = (Math.pow(1 + totalReturn/100, 1/3) - 1) * 100 // Annualized
    }
  } else {
    returns3Y = returns1Y // Use 1Y return as approximation
  }

  const volatility = calculateRealVolatility(navHistory)
  const sharpeRatio = calculateRealSharpeRatio(returns1Y, volatility)
  const maxDrawdown = calculateMaxDrawdown(navHistory)

  // Calculate alpha (excess return over market)
  const marketReturn = 12 // Assume 12% market return
  const alpha = returns1Y - marketReturn

  console.log(`📈 Calculated metrics: 1Y Return: ${returns1Y.toFixed(2)}%, Volatility: ${volatility.toFixed(2)}%, Sharpe: ${sharpeRatio.toFixed(2)}`)

  return {
    returns1Y: Number(returns1Y.toFixed(2)),
    returns3Y: Number(returns3Y.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    beta: 1.0, // Would need market data to calculate real beta
    alpha: Number(alpha.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2))
  }
}

function calculateRealVolatility(navHistory: any[]): number {
  if (navHistory.length < 2) return 0

  const returns = []
  // Since navHistory is in reverse chronological order (newest first),
  // we need to calculate returns from oldest to newest
  for (let i = navHistory.length - 1; i > 0; i--) {
    const prevNAV = navHistory[i].nav // Older NAV
    const currNAV = navHistory[i-1].nav // Newer NAV
    if (prevNAV > 0 && currNAV > 0) {
      returns.push((currNAV - prevNAV) / prevNAV)
    }
  }

  if (returns.length === 0) return 0

  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length

  // Annualized volatility (assuming daily data)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

function calculateRealSharpeRatio(returns: number, volatility: number): number {
  const riskFreeRate = 6.5 // Current risk-free rate
  return volatility > 0 ? (returns - riskFreeRate) / volatility : 0
}

function calculateMaxDrawdown(navHistory: any[]): number {
  if (navHistory.length < 2) return 0

  let maxDrawdown = 0
  let peak = 0

  // Process in chronological order (reverse the array since it's newest first)
  const chronologicalHistory = [...navHistory].reverse()

  for (const point of chronologicalHistory) {
    if (point.nav > peak) {
      peak = point.nav
    }
    const drawdown = peak > 0 ? (peak - point.nav) / peak * 100 : 0
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown
}

// No need to export jobs - using JobManager instead
