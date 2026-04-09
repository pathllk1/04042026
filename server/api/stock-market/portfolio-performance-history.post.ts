import { JobManager } from '../../utils/jobManager'
import yahooFinance from 'yahoo-finance2'

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
    console.log(`🏭 Starting portfolio performance history analysis for user: ${userId}`)

    // Create a job for tracking progress
    const job = JobManager.createJob({
      type: 'portfolio-performance-history',
      symbol: 'Combined Portfolio', // Use combined portfolio as symbol
      userId,
      firmId,
      status: 'queued',
      progress: 0,
      message: 'Starting portfolio performance analysis...'
    })

    console.log(`🚀 Queued portfolio performance history job: ${job.id}`)

    // Start background processing (non-blocking)
    processPortfolioPerformanceHistory(job.id, userId, firmId)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: 'Portfolio performance analysis queued',
      estimatedTime: '60-120 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing portfolio performance analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue portfolio performance analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for portfolio performance history
async function processPortfolioPerformanceHistory(jobId: string, userId: string, firmId: string) {
  try {
    console.log(`🤖 Starting background portfolio performance analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Fetching current portfolio data...'
    })

    // Add timeout for the entire process (5 minutes)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Portfolio performance analysis timeout - process took too long')), 300000)
    )

    const analysisPromise = performPortfolioAnalysis(jobId, userId, firmId)

    // Race between analysis and timeout
    await Promise.race([analysisPromise, timeoutPromise])

  } catch (error: any) {
    console.error(`❌ Background portfolio performance analysis failed for job: ${jobId}`, error)
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Portfolio performance analysis failed',
      failedAt: new Date(),
      message: 'Portfolio performance analysis failed'
    })
  }
}

// Separate function for the actual analysis logic
async function performPortfolioAnalysis(jobId: string, userId: string, firmId: string) {
  try {

    // Step 1: Fetch current portfolio data (equity + mutual funds)
    console.log(`📊 Fetching portfolio data for user: ${userId}`)
    const [equityData, mutualFundData] = await Promise.all([
      fetchCurrentEquityData(userId),
      fetchCurrentMutualFundData(userId)
    ])

    console.log(`📊 Found ${equityData.length} equity investments and ${mutualFundData.length} mutual fund investments`)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Fetching historical equity prices...'
    })

    // Step 2: Fetch historical equity data (7 days and 30 days ago)
    console.log(`📈 Calculating equity performance for ${equityData.length} investments`)
    const equityPerformance = await calculateEquityPerformance(equityData)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 60,
      message: 'Fetching historical mutual fund NAVs...'
    })

    // Step 3: Fetch historical mutual fund data (7 days and 30 days ago)
    console.log(`📊 Calculating mutual fund performance for ${mutualFundData.length} funds`)
    const mutualFundPerformance = await calculateMutualFundPerformance(mutualFundData)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 80,
      message: 'Calculating combined portfolio performance...'
    })

    // Step 4: Calculate combined performance
    const combinedPerformance = calculateCombinedPerformance(equityPerformance, mutualFundPerformance)

    // Prepare final response with real data only
    const finalAnalysis = {
      portfolioSummary: {
        totalEquityInvestments: equityData.length,
        totalMutualFundInvestments: mutualFundData.length,
        totalInvestments: equityData.length + mutualFundData.length
      },
      weeklyPerformance: combinedPerformance.weekly,
      monthlyPerformance: combinedPerformance.monthly,
      equityBreakdown: equityPerformance,
      mutualFundBreakdown: mutualFundPerformance,
      analysisTimestamp: new Date().toISOString(),
      dataSource: 'Real market data from Yahoo Finance and AMFI APIs'
    }

    // Job completed successfully
    JobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      analysis: finalAnalysis,
      completedAt: new Date(),
      message: 'Portfolio performance analysis completed successfully'
    })

    console.log(`✅ Background portfolio performance analysis completed for job: ${jobId}`)
  } catch (error: any) {
    console.error(`❌ Portfolio performance analysis failed for job: ${jobId}`, error)
    throw error // Re-throw to be caught by the outer try-catch
  }
}

// Fetch current equity data from database
async function fetchCurrentEquityData(userId: string) {
  try {
    const Folio = (await import('../../models/Folio')).default
    const investments = await Folio.find({ user: userId }).lean()
    
    console.log(`📈 Fetched ${investments.length} equity investments from database`)
    return investments.filter(inv => inv.cprice && inv.qnty) // Only investments with current price and quantity
  } catch (error) {
    console.error('Error fetching equity data:', error)
    throw new Error(`Failed to fetch equity data: ${error}`)
  }
}

// Fetch current mutual fund data from database
async function fetchCurrentMutualFundData(userId: string) {
  try {
    const MutualFund = (await import('../../models/MutualFund')).default
    const mutualFunds = await MutualFund.find({ user: userId }).lean()
    
    console.log(`📊 Fetched ${mutualFunds.length} mutual fund investments from database`)
    return mutualFunds.filter(fund => fund.currentNAV && fund.units) // Only funds with current NAV and units
  } catch (error) {
    console.error('Error fetching mutual fund data:', error)
    throw new Error(`Failed to fetch mutual fund data: ${error}`)
  }
}

// Calculate equity performance using real historical data
async function calculateEquityPerformance(equityData: any[]) {
  const performance = {
    weekly: { totalPL: 0, validInvestments: 0, details: [] },
    monthly: { totalPL: 0, validInvestments: 0, details: [] }
  }

  for (const investment of equityData) {
    try {
      // Get historical prices for 7 days and 30 days ago
      const [weeklyPrice, monthlyPrice] = await Promise.all([
        getHistoricalEquityPrice(investment.symbol, 7),
        getHistoricalEquityPrice(investment.symbol, 30)
      ])

      console.log(`📈 ${investment.symbol}: Current=₹${investment.cprice}, Weekly=₹${weeklyPrice}, Monthly=₹${monthlyPrice}, Qty=${investment.qnty}`)

      // Calculate weekly P&L if historical data available
      if (weeklyPrice) {
        const weeklyPL = (investment.cprice - weeklyPrice) * investment.qnty
        performance.weekly.totalPL += weeklyPL
        performance.weekly.validInvestments++
        performance.weekly.details.push({
          symbol: investment.symbol,
          currentPrice: investment.cprice,
          historicalPrice: weeklyPrice,
          quantity: investment.qnty,
          pl: weeklyPL
        })
        console.log(`📈 ${investment.symbol} Weekly P&L: ₹${weeklyPL.toFixed(2)} (${investment.cprice} - ${weeklyPrice}) * ${investment.qnty}`)
      } else {
        console.log(`📈 ${investment.symbol}: No weekly historical price found`)
      }

      // Calculate monthly P&L if historical data available
      if (monthlyPrice) {
        const monthlyPL = (investment.cprice - monthlyPrice) * investment.qnty
        performance.monthly.totalPL += monthlyPL
        performance.monthly.validInvestments++
        performance.monthly.details.push({
          symbol: investment.symbol,
          currentPrice: investment.cprice,
          historicalPrice: monthlyPrice,
          quantity: investment.qnty,
          pl: monthlyPL
        })
        console.log(`📈 ${investment.symbol} Monthly P&L: ₹${monthlyPL.toFixed(2)} (${investment.cprice} - ${monthlyPrice}) * ${investment.qnty}`)
      } else {
        console.log(`📈 ${investment.symbol}: No monthly historical price found`)
      }

    } catch (error) {
      console.error(`Error calculating performance for ${investment.symbol}:`, error)
      // Continue with next investment - no fallback data
    }
  }

  console.log(`📈 EQUITY PERFORMANCE SUMMARY:`)
  console.log(`📈 Weekly: ₹${performance.weekly.totalPL} from ${performance.weekly.validInvestments} stocks`)
  console.log(`📈 Monthly: ₹${performance.monthly.totalPL} from ${performance.monthly.validInvestments} stocks`)

  return performance
}

// Calculate mutual fund performance using real historical NAV data
async function calculateMutualFundPerformance(mutualFundData: any[]) {
  const performance = {
    weekly: { totalPL: 0, validInvestments: 0, details: [] },
    monthly: { totalPL: 0, validInvestments: 0, details: [] }
  }

  console.log(`📊 Processing ${mutualFundData.length} mutual funds for performance calculation`)

  for (let i = 0; i < mutualFundData.length; i++) {
    const fund = mutualFundData[i]
    try {
      console.log(`📊 Processing fund ${i + 1}/${mutualFundData.length}: ${fund.schemeName} (${fund.schemeCode})`)

      // Get historical NAVs for 7 days and 30 days ago
      const [weeklyNAV, monthlyNAV] = await Promise.all([
        getHistoricalMutualFundNAV(fund.schemeCode, 7),
        getHistoricalMutualFundNAV(fund.schemeCode, 30)
      ])

      console.log(`📊 ${fund.schemeName}: Current NAV=₹${fund.currentNAV}, Weekly NAV=₹${weeklyNAV}, Monthly NAV=₹${monthlyNAV}, Units=${fund.units}`)

      // Calculate weekly P&L if historical data available
      if (weeklyNAV) {
        const weeklyPL = (fund.currentNAV - weeklyNAV) * fund.units
        console.log(`📊 Weekly P&L calculation: (${fund.currentNAV} - ${weeklyNAV}) * ${fund.units} = ₹${weeklyPL}`)
        performance.weekly.totalPL += weeklyPL
        performance.weekly.validInvestments++
        performance.weekly.details.push({
          schemeName: fund.schemeName,
          schemeCode: fund.schemeCode,
          currentNAV: fund.currentNAV,
          historicalNAV: weeklyNAV,
          units: fund.units,
          pl: weeklyPL
        })
        console.log(`📊 ${fund.schemeName} Weekly P&L: ₹${weeklyPL.toFixed(2)} (${fund.currentNAV} - ${weeklyNAV}) * ${fund.units}`)
      } else {
        console.log(`📊 ${fund.schemeName}: No weekly historical NAV found`)
      }

      // Calculate monthly P&L if historical data available
      if (monthlyNAV) {
        const monthlyPL = (fund.currentNAV - monthlyNAV) * fund.units
        console.log(`📊 Monthly P&L calculation: (${fund.currentNAV} - ${monthlyNAV}) * ${fund.units} = ₹${monthlyPL}`)
        performance.monthly.totalPL += monthlyPL
        performance.monthly.validInvestments++
        performance.monthly.details.push({
          schemeName: fund.schemeName,
          schemeCode: fund.schemeCode,
          currentNAV: fund.currentNAV,
          historicalNAV: monthlyNAV,
          units: fund.units,
          pl: monthlyPL
        })
        console.log(`📊 ${fund.schemeName} Monthly P&L: ₹${monthlyPL.toFixed(2)} (${fund.currentNAV} - ${monthlyNAV}) * ${fund.units}`)
      } else {
        console.log(`📊 ${fund.schemeName}: No monthly historical NAV found`)
      }

    } catch (error) {
      console.error(`Error calculating performance for ${fund.schemeName}:`, error)
      // Continue with next fund - no fallback data
    }
  }

  console.log(`📊 MUTUAL FUND PERFORMANCE SUMMARY:`)
  console.log(`📊 Weekly: ₹${performance.weekly.totalPL} from ${performance.weekly.validInvestments} funds`)
  console.log(`📊 Monthly: ₹${performance.monthly.totalPL} from ${performance.monthly.validInvestments} funds`)

  return performance
}

// Get historical equity price using Yahoo Finance API (real data only)
async function getHistoricalEquityPrice(symbol: string, daysAgo: number): Promise<number | null> {
  try {
    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (daysAgo + 10)) // Get more days to account for weekends/holidays

    console.log(`📈 Fetching historical price for ${yahooSymbol} (${daysAgo} days ago)`)
    console.log(`📈 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    // Add timeout for Yahoo Finance API call (20 seconds - reduced)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Yahoo Finance API timeout for ${yahooSymbol}`)), 20000)
    )

    const yahooPromise = yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    })

    const historicalData = await Promise.race([yahooPromise, timeoutPromise]) as any

    if (!historicalData || historicalData.length === 0) {
      console.log(`📈 No historical data found for ${yahooSymbol}`)
      return null // No fallback data
    }

    // Find the closest date to the target date
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)

    console.log(`📈 Target date: ${targetDate.toISOString().split('T')[0]}`)
    console.log(`📈 Available data points: ${historicalData.length}`)

    // Sort by date descending and find the closest date on or before target
    const sortedData = historicalData
      .filter((item: any) => item.date && item.close)
      .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())

    let closestData = null
    for (const item of sortedData) {
      if (item.date <= targetDate) {
        closestData = item
        break
      }
    }

    // If no data on or before target date, take the oldest available
    if (!closestData && sortedData.length > 0) {
      closestData = sortedData[sortedData.length - 1]
    }

    if (closestData) {
      const price = closestData.close
      console.log(`📈 Historical price for ${yahooSymbol}: ${price} (date: ${closestData.date?.toISOString().split('T')[0]})`)
      return price
    }

    // If no historical data, try to get current price (still real data)
    console.log(`📈 No historical data found for ${yahooSymbol}, attempting to get current price`)

    const currentData = await Promise.race([
      yahooFinance.quote(yahooSymbol),
      timeoutPromise
    ])

    if (currentData && currentData.regularMarketPrice) {
      console.log(`📈 Using current price for ${yahooSymbol}: ${currentData.regularMarketPrice}`)
      return currentData.regularMarketPrice
    }

    console.log(`📈 No price data available for ${yahooSymbol}`)
    return null

  } catch (error) {
    console.error(`❌ Error fetching price for ${symbol}:`, error)
    return null // No fallback data
  }
}

// Circuit breaker to prevent infinite API calls
const apiCallTracker = new Map<string, number>()

// Get historical mutual fund NAV using AMFI API (real data only)
async function getHistoricalMutualFundNAV(schemeCode: string, daysAgo: number): Promise<number | null> {
  try {
    // Circuit breaker: prevent more than 3 calls per scheme per session
    const callKey = `${schemeCode}-${daysAgo}`
    const callCount = apiCallTracker.get(callKey) || 0

    if (callCount >= 3) {
      console.log(`🚫 Circuit breaker: Too many calls for scheme ${schemeCode} (${daysAgo} days ago)`)
      return null
    }

    apiCallTracker.set(callKey, callCount + 1)

    const apiUrl = `https://api.mfapi.in/mf/${schemeCode}`
    console.log(`📊 Fetching historical NAV for scheme ${schemeCode} (${daysAgo} days ago) - Call #${callCount + 1}`)

    // Add timeout for AMFI API call (15 seconds - reduced)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`📊 AMFI API response not ok for scheme ${schemeCode}: ${response.status}`)
      return null // No fallback data
    }

    const data = await response.json()
    if (!data || !data.data || data.data.length === 0) {
      console.log(`📊 No NAV data found for scheme ${schemeCode}`)
      return null // No fallback data
    }

    // Find NAV from daysAgo
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)

    console.log(`📊 Target date for NAV: ${targetDate.toISOString().split('T')[0]}`)
    console.log(`📊 Available NAV data points: ${data.data.length}`)

    // Look for exact date or closest available date (check more entries)
    for (let i = 0; i < Math.min(data.data.length, 20); i++) { // Check up to 20 recent entries
      const navEntry = data.data[i]

      try {
        const entryDate = new Date(navEntry.date.split('-').reverse().join('-')) // Convert DD-MM-YYYY to YYYY-MM-DD
        console.log(`📊 Checking NAV entry: ${navEntry.date} (${entryDate.toISOString().split('T')[0]}) - NAV: ${navEntry.nav}`)

        if (entryDate <= targetDate) {
          const nav = parseFloat(navEntry.nav)
          console.log(`📊 Historical NAV for scheme ${schemeCode}: ${nav} (date: ${navEntry.date})`)
          return nav
        }
      } catch (dateError) {
        console.log(`📊 Error parsing date ${navEntry.date}:`, dateError)
        continue
      }
    }

    // If no historical data found, try to use current NAV as approximation (still real data)
    if (data.data.length > 0) {
      const currentNav = parseFloat(data.data[0].nav)
      console.log(`📊 No historical NAV found for scheme ${schemeCode}, using current NAV: ${currentNav}`)
      return currentNav
    }

    console.log(`📊 No NAV data available for scheme ${schemeCode}`)
    return null // No fallback data

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`⏰ AMFI API timeout for scheme ${schemeCode}`)
    } else {
      console.error(`❌ Error fetching historical NAV for scheme ${schemeCode}:`, error)
    }
    return null // No fallback data
  }
}

// Calculate combined portfolio performance
function calculateCombinedPerformance(equityPerformance: any, mutualFundPerformance: any) {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  return {
    weekly: {
      totalPL: equityPerformance.weekly.totalPL + mutualFundPerformance.weekly.totalPL,
      equityPL: equityPerformance.weekly.totalPL,
      mutualFundPL: mutualFundPerformance.weekly.totalPL,
      validEquityInvestments: equityPerformance.weekly.validInvestments,
      validMutualFundInvestments: mutualFundPerformance.weekly.validInvestments,
      fromDate: weekAgo.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
    },
    monthly: {
      totalPL: equityPerformance.monthly.totalPL + mutualFundPerformance.monthly.totalPL,
      equityPL: equityPerformance.monthly.totalPL,
      mutualFundPL: mutualFundPerformance.monthly.totalPL,
      validEquityInvestments: equityPerformance.monthly.validInvestments,
      validMutualFundInvestments: mutualFundPerformance.monthly.validInvestments,
      fromDate: monthAgo.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
    }
  }
}
