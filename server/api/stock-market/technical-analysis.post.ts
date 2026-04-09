import { defineEventHandler, readBody, createError } from 'h3'
import { JobManager } from '../../utils/jobManager'
import { AIService } from '../../utils/aiService'
import yahooFinance from 'yahoo-finance2'
import { calculateAllTechnicalIndicators, calculateSMASeries, calculateRSISeries, calculateMACDSeries } from '../../utils/technicalIndicators'

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
      progress: 0,
      type: 'technical-analysis'
    })

    console.log(`🚀 Queued technical analysis job: ${job.id} for ${stockData.symbol}`)

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
    processTechnicalAnalysisBackground(job.id, stockData, userId, firmId, aiConfig)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `Technical analysis queued for ${stockData.symbol}`,
      estimatedTime: '30-45 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing technical analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue technical analysis: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for technical analysis
async function processTechnicalAnalysisBackground(jobId: string, stockData: any, userId: string, firmId: string, aiConfig: any) {
  try {
    console.log(`🤖 Starting background technical analysis for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Fetching 200-day historical data...'
    })

    // Fetch 200-day historical data using existing Yahoo Finance integration
    const yahooSymbol = stockData.symbol.endsWith('.NS') ? stockData.symbol : `${stockData.symbol}.NS`

    // Use 300 calendar days to ensure we get at least 200 trading days
    // (accounting for weekends, holidays, and market closures)
    // Fetch ~400 trading days of historical data to ensure a substantial length for the 200-day SMA line.
    // 600 calendar days should be sufficient to cover ~400 trading days.
    const historicalData = await yahooFinance.historical(yahooSymbol, {
      period1: new Date(Date.now() - 600 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d'
    })

    // IMPORTANT: Ensure data is sorted chronologically from oldest to newest before any calculations.
    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log(`📊 Fetched ${historicalData.length} data points for ${yahooSymbol} technical analysis`)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'Calculating technical indicators...'
    })

    // Validate historical data before calculation
    if (!historicalData || historicalData.length === 0) {
      throw new Error(`No historical data found for ${yahooSymbol}. Symbol may be invalid or delisted.`)
    }

    if (historicalData.length < 50) {
      console.warn(`⚠️ Limited historical data for ${yahooSymbol}: only ${historicalData.length} data points`)
    }

    // Calculate all technical indicators for the AI prompt
    const technicalIndicators = calculateAllTechnicalIndicators(historicalData)

    // --- Chart Data Preparation ---
    // Calculate SMA series for the entire historical data for charting
    const closePrices = historicalData.map(d => d.close).filter(c => c !== null && c !== undefined && !isNaN(c));
    const sma50Series = calculateSMASeries(closePrices, 50);
    const sma200Series = calculateSMASeries(closePrices, 200);
    const rsiSeries = calculateRSISeries(closePrices);
    const { macdLines, signalLines, histograms } = calculateMACDSeries(closePrices);

    // Attach SMA series data to the historical data for the frontend chart
    const historicalDataForChart = historicalData.map((dataPoint, index) => ({
      ...dataPoint,
      sma50: sma50Series[index],
      sma200: sma200Series[index],
      rsi: rsiSeries[index],
      macd: macdLines[index],
      signal: signalLines[index],
      histogram: histograms[index]
    }));

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'Generating AI technical analysis...'
    })

    // Initialize dynamic AI service
    console.log('🤖 Using dynamic AI configuration:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey
    })

    const aiService = new AIService(aiConfig)

    // Enhanced AI prompt with technical analysis data
    const aiPrompt = `You are a professional technical analyst with expertise in Indian stock markets.

STOCK INFORMATION:
- Symbol: ${stockData.symbol}
- Company: ${stockData.companyName || stockData.symbol}
- Current Price: ₹${stockData.currentPrice}
- Price Change: ₹${stockData.change} (${stockData.pChange}%)

TECHNICAL ANALYSIS DATA (${historicalData.length} trading days):
- 200-day SMA: ₹${technicalIndicators.sma200.toFixed(2)}
- 50-day SMA: ₹${technicalIndicators.sma50.toFixed(2)}
- 20-day SMA: ₹${technicalIndicators.sma20.toFixed(2)}
- 12-day EMA: ₹${technicalIndicators.ema12.toFixed(2)}
- 26-day EMA: ₹${technicalIndicators.ema26.toFixed(2)}
- RSI (14): ${technicalIndicators.rsi.toFixed(2)}
- MACD Line: ${technicalIndicators.macd.line.toFixed(4)}
- MACD Signal: ${technicalIndicators.macd.signal.toFixed(4)}
- MACD Histogram: ${technicalIndicators.macd.histogram.toFixed(4)}
- Bollinger Upper: ₹${technicalIndicators.bollingerBands.upper.toFixed(2)}
- Bollinger Middle: ₹${technicalIndicators.bollingerBands.middle.toFixed(2)}
- Bollinger Lower: ₹${technicalIndicators.bollingerBands.lower.toFixed(2)}
- ATR: ${technicalIndicators.atr.toFixed(2)}
- Support Levels: ${technicalIndicators.supportResistance.support.map(s => '₹' + s.toFixed(2)).join(', ')}
- Resistance Levels: ${technicalIndicators.supportResistance.resistance.map(r => '₹' + r.toFixed(2)).join(', ')}

ANALYSIS REQUIREMENTS:
1. MOVING AVERAGE ANALYSIS (based on ${historicalData.length} days of data):
   - Current price position relative to long-term SMA (200-day or available data)
   - Long-term trend direction and strength
   - Moving average crossover signals

2. TECHNICAL INDICATORS INTERPRETATION:
   - RSI overbought/oversold analysis
   - MACD trend and momentum signals
   - Bollinger Bands position and volatility
   - Support and resistance level validation

3. TREND ANALYSIS:
   - Primary trend (bullish/bearish/sideways)
   - Trend strength and sustainability
   - Potential reversal signals

4. TRADING RECOMMENDATIONS:
   - Entry points and optimal timing
   - Stop-loss levels based on technical support
   - Target prices using resistance levels
   - Risk-reward ratio assessment

5. ACTIONABLE INSIGHTS:
   - Short-term (1-2 weeks) outlook
   - Medium-term (1-3 months) outlook
   - Key levels to watch
   - Trading strategy recommendations

Return analysis in JSON format:
{
  "technicalRecommendation": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL",
  "confidence": "High/Medium/Low",
  "trendAnalysis": "Detailed 200-day trend analysis",
  "movingAverageAnalysis": "SMA and EMA analysis with crossover signals",
  "momentumAnalysis": "RSI and MACD interpretation",
  "volatilityAnalysis": "Bollinger Bands and ATR analysis",
  "supportResistanceAnalysis": "Key levels and price action",
  "entryStrategy": "Optimal entry points and timing",
  "riskManagement": "Stop-loss and position sizing recommendations",
  "priceTargets": {
    "shortTerm": "1-2 week target price",
    "mediumTerm": "1-3 month target price",
    "stopLoss": "Recommended stop-loss level"
  },
  "keyLevelsToWatch": ["List of important price levels"],
  "tradingStrategy": "Specific trading approach and timing"
}

Focus on Indian market context and provide actionable technical analysis based on the 200-day data.`

    try {
      // Generate AI technical analysis with extended timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Technical analysis timeout')), 120000) // 2 minutes
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
        message: 'Processing technical analysis results...'
      })

      console.log(`✅ Technical analysis completed for ${stockData.symbol}`)

      // Parse AI response - STRICT REAL DATA ONLY
      let technicalAnalysis: any

      console.log('📄 Raw AI Technical Analysis Response:')
      console.log('='.repeat(50))
      console.log(aiResponse)
      console.log('='.repeat(50))

      if (!aiResponse || aiResponse.trim().length === 0) {
        console.error('❌ AI returned empty technical analysis response - NO FALLBACK DATA ALLOWED')
        throw new Error('AI returned empty technical analysis response. Cannot proceed without real AI analysis.')
      }

      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
          console.error('❌ No JSON found in AI technical analysis response:')
          console.error('Response content:', aiResponse.substring(0, 500) + '...')
          console.error('❌ STRICT POLICY: No fallback data allowed - failing request')
          throw new Error('No valid JSON found in AI technical analysis response. Real data parsing failed.')
        }

        console.log('🔍 Extracted JSON string:')
        console.log(jsonMatch[0].substring(0, 200) + '...')

        technicalAnalysis = JSON.parse(jsonMatch[0])

        // Validate that we have real analysis data
        if (!technicalAnalysis || typeof technicalAnalysis !== 'object') {
          console.error('❌ Parsed technical analysis is not a valid object')
          throw new Error('Invalid technical analysis object structure')
        }

        // Check for required fields to ensure it's real analysis
        const requiredFields = ['technicalRecommendation', 'confidence', 'trendAnalysis']
        const missingFields = requiredFields.filter(field => !technicalAnalysis[field])

        if (missingFields.length > 0) {
          console.error('❌ Missing required technical analysis fields:', missingFields)
          console.error('❌ Available fields:', Object.keys(technicalAnalysis))
          console.error('❌ STRICT POLICY: Incomplete real data - failing request')
          throw new Error(`Incomplete AI technical analysis - missing fields: ${missingFields.join(', ')}`)
        }

        console.log('✅ Successfully parsed real AI technical analysis with all required fields')

      } catch (parseError: any) {
        console.error('❌ Failed to parse AI technical analysis response:', parseError)
        console.error('❌ Raw response that failed parsing:')
        console.error(aiResponse)
        console.error('❌ STRICT POLICY: No mock/fallback data will be used')
        throw new Error(`Failed to parse AI technical analysis response: ${parseError.message}. Only real AI data allowed.`)
      }

      // Prepare final response with both technical data and AI analysis
      const finalAnalysis = {
        technicalIndicators,
        aiAnalysis: technicalAnalysis,
        historicalData: historicalDataForChart, // Send the enhanced data with SMA series
        historicalDataPoints: historicalData.length,
        analysisTimestamp: new Date().toISOString()
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis: finalAnalysis,
        completedAt: new Date(),
        message: 'Technical analysis completed successfully'
      })

      console.log(`✅ Background technical analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      console.error('Technical analysis AI error:', aiError)
      
      // Job failed
      JobManager.updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: aiError?.message || 'Unknown error',
        failedAt: new Date(),
        message: `Technical analysis failed: ${aiError?.message || 'Unknown error'}`
      })
    }

  } catch (error: any) {
    console.error(`❌ Background technical analysis failed for job: ${jobId}`, error)
    
    // Job failed
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Unknown error',
      failedAt: new Date(),
      message: `Technical analysis failed: ${error?.message || 'Unknown error'}`
    })
  }
}
