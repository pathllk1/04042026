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
      progress: 0,
      type: 'stock-news'
    })

    console.log(`🚀 Queued AI stock news job: ${job.id} for ${stockData.symbol}`)

    // Start background processing (non-blocking)
    processStockNewsBackground(job.id, stockData, userId, firmId, event)

    // Return immediately with job ID
    return {
      success: true,
      jobId: job.id,
      status: 'queued',
      message: `AI stock news search queued for ${stockData.symbol}`,
      estimatedTime: '15-25 seconds'
    }

  } catch (error: any) {
    console.error('Error queuing AI stock news search:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to queue AI stock news search: ${error?.message || 'Unknown error'}`
    })
  }
})

// Background processing function for AI stock news search
async function processStockNewsBackground(jobId: string, stockData: any, userId: string, firmId: string, event: any) {
  try {
    console.log(`🤖 Starting background AI stock news search for job: ${jobId}`)

    // Update job status
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 10,
      startedAt: new Date(),
      message: 'Initializing stock news analysis...'
    })

    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 30,
      message: 'AI analyzing stock news and market factors...'
    })

    // Get current date for context
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Update progress
    JobManager.updateJob(jobId, {
      progress: 50,
      message: 'Generating comprehensive stock analysis...'
    })

    // Create comprehensive AI prompt for stock news analysis
    const aiPrompt = `You are an expert financial news analyst. Analyze and provide insights about the stock: ${stockData.symbol}.

STOCK INFORMATION:
- Symbol: ${stockData.symbol}
- Company: ${stockData.companyName || stockData.symbol}
- Current Price: ₹${stockData.currentPrice}
- Price Change: ${stockData.change} (${stockData.pChange}%)
- Analysis Date: ${currentTime}

TASK: Provide comprehensive news analysis covering recent developments, market factors, analyst perspectives, and business developments.

Return your analysis in JSON format:
{
  "searchSummary": "Summary of analysis conducted for ${stockData.symbol}",
  "totalFound": "Comprehensive analysis completed",
  "recentNews": [
    {
      "headline": "Key development or news item",
      "date": "Recent timeframe",
      "source": "Financial analysis",
      "summary": "Detailed explanation of the development",
      "impact": "Positive/Negative/Neutral",
      "relevance": "High/Medium/Low"
    }
  ],
  "keyDevelopments": "Top developments affecting ${stockData.symbol}",
  "marketImpact": "Analysis of market factors affecting stock price",
  "analystViews": "Current analyst sentiment on ${stockData.symbol}",
  "riskFactors": "Key risks and challenges",
  "opportunities": "Growth opportunities and catalysts",
  "sectorOutlook": "Sector trends affecting ${stockData.symbol}",
  "searchTimestamp": "${now.toISOString()}"
}`

    try {
      // Generate AI stock news analysis with extended timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI stock news analysis timeout')), 40000)
      )

      const aiPromise = aiService.generateContent({ prompt: aiPrompt })
      const aiResult = await Promise.race([aiPromise, timeoutPromise]) as any
      const aiResponse = aiResult.content

      // Update progress
      JobManager.updateJob(jobId, {
        progress: 80,
        message: 'Processing stock news results...'
      })

      console.log(`✅ AI stock news analysis completed for ${stockData.symbol}`)

      // Parse AI response
      let stockNewsData
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          stockNewsData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError) {
        console.warn('AI stock news response parsing failed, creating structured response')
        stockNewsData = {
          searchSummary: `AI analyzed market factors and developments for ${stockData.symbol}`,
          totalFound: "Comprehensive analysis completed",
          recentNews: extractNewsFromText(aiResponse, stockData.symbol),
          keyDevelopments: extractKeyInfo(aiResponse, 'developments') || `Recent market analysis for ${stockData.symbol} completed`,
          marketImpact: extractKeyInfo(aiResponse, 'impact') || `Market factors affecting ${stockData.symbol} analyzed`,
          analystViews: extractKeyInfo(aiResponse, 'analyst') || `Analyst perspectives on ${stockData.symbol} reviewed`,
          riskFactors: extractKeyInfo(aiResponse, 'risk') || 'Risk assessment completed',
          opportunities: extractKeyInfo(aiResponse, 'opportunity') || 'Growth opportunities identified',
          sectorOutlook: extractKeyInfo(aiResponse, 'sector') || 'Sector analysis completed',
          searchTimestamp: now.toISOString()
        }
      }

      // Validate and clean the response
      const validatedResponse = {
        searchSummary: stockNewsData.searchSummary || `Analysis completed for ${stockData.symbol}`,
        totalFound: stockNewsData.totalFound || 'Analysis completed',
        recentNews: Array.isArray(stockNewsData.recentNews) ? stockNewsData.recentNews.slice(0, 5) : [],
        keyDevelopments: stockNewsData.keyDevelopments || 'Key developments analysis completed',
        marketImpact: stockNewsData.marketImpact || 'Market impact analysis completed',
        analystViews: stockNewsData.analystViews || 'Analyst views analysis completed',
        riskFactors: stockNewsData.riskFactors || 'Risk factors identified',
        opportunities: stockNewsData.opportunities || 'Opportunities analyzed',
        sectorOutlook: stockNewsData.sectorOutlook || 'Sector outlook reviewed',
        searchTimestamp: stockNewsData.searchTimestamp || now.toISOString()
      }

      // Job completed successfully
      JobManager.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        analysis: validatedResponse,
        completedAt: new Date(),
        message: 'AI stock news analysis completed successfully'
      })

      console.log(`✅ Background AI stock news analysis completed for job: ${jobId}`)

    } catch (aiError: any) {
      console.error('AI stock news analysis error:', aiError)

      // Job failed
      JobManager.updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: aiError?.message || 'Unknown error',
        failedAt: new Date(),
        message: `AI stock news analysis failed: ${aiError?.message || 'Unknown error'}`
      })
    }

  } catch (error: any) {
    console.error(`❌ Background AI stock news analysis failed for job: ${jobId}`, error)

    // Job failed
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error?.message || 'Unknown error',
      failedAt: new Date(),
      message: `Stock news analysis failed: ${error?.message || 'Unknown error'}`
    })
  }
}

// Helper function to extract news items from unstructured text
function extractNewsFromText(text: string, symbol: string): any[] {
  const newsItems = []
  
  // Try to find news-like patterns in the text
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  
  for (let i = 0; i < lines.length && newsItems.length < 3; i++) {
    const line = lines[i].trim()
    
    // Look for lines that might be news headlines
    if (line.length > 30 && line.length < 150 && 
        (line.includes(symbol) || line.includes('earnings') || line.includes('announcement'))) {
      newsItems.push({
        headline: line,
        date: 'Recent',
        source: 'Financial Analysis',
        summary: lines[i + 1]?.trim() || 'Market development analysis',
        impact: 'Neutral',
        relevance: 'Medium'
      })
    }
  }
  
  // If no specific news found, create generic analysis items
  if (newsItems.length === 0) {
    newsItems.push({
      headline: `${symbol} market analysis and outlook`,
      date: 'Current',
      source: 'AI Financial Analysis',
      summary: 'Comprehensive analysis of market factors and company fundamentals',
      impact: 'Neutral',
      relevance: 'High'
    })
  }
  
  return newsItems
}

// Helper function to extract key information from unstructured AI response
function extractKeyInfo(text: string, infoType: string): string | null {
  const patterns = {
    developments: /(?:key developments?|important developments?|recent developments?)[\s\S]*?(?=\n\n|\d+\.|$)/i,
    impact: /(?:market impact|impact|effect|influence)[\s\S]*?(?=\n\n|\d+\.|$)/i,
    analyst: /(?:analyst|rating|recommendation|institutional)[\s\S]*?(?=\n\n|\d+\.|$)/i,
    risk: /(?:risk|concern|challenge|threat)[\s\S]*?(?=\n\n|\d+\.|$)/i,
    opportunity: /(?:opportunity|growth|potential|catalyst)[\s\S]*?(?=\n\n|\d+\.|$)/i,
    sector: /(?:sector|industry|market trend)[\s\S]*?(?=\n\n|\d+\.|$)/i
  }
  
  const pattern = patterns[infoType as keyof typeof patterns]
  if (pattern) {
    const match = text.match(pattern)
    return match ? match[0].trim() : null
  }
  
  return null
}
