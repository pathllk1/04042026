import { defineEventHandler, readBody, createError } from 'h3'
import { AIService } from '../../utils/aiService'

export default defineEventHandler(async (event) => {
  // Get user context
  const userId = event.context.userId
  const firmId = event.context.user?.firmId

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

    console.log(`🤖 AI Stock Analysis requested for: ${stockData.symbol}`)

    // Get AI configuration from request headers (dynamic AI system)
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

    console.log('🤖 Using dynamic AI configuration:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey
    })

    // Initialize dynamic AI service
    const aiService = new AIService(aiConfig)

    // Prepare comprehensive AI prompt for stock analysis
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
    - Previous Close: ₹${stockData.previousClose}

    Provide analysis in the following structure:

    1. OVERALL RECOMMENDATION: (BUY/SELL/HOLD/STRONG BUY/STRONG SELL)
    2. CONFIDENCE LEVEL: (High/Medium/Low)
    3. SUMMARY: Brief 2-3 line summary of your recommendation

    4. TECHNICAL ANALYSIS:
    - Price action and trend analysis
    - Support and resistance levels
    - Volume analysis
    - Technical indicators interpretation
    - Short-term price outlook

    5. FUNDAMENTAL ANALYSIS:
    - Company business overview
    - Financial health assessment
    - Industry position and competitive advantages
    - Growth prospects
    - Valuation assessment

    6. MARKET TRENDS & OUTLOOK:
    - Sector performance and trends
    - Market sentiment
    - Economic factors affecting the stock
    - Medium to long-term outlook

    7. RISK ASSESSMENT:
    - Key risks and challenges
    - Volatility assessment
    - Risk-reward ratio
    - Risk mitigation strategies

    IMPORTANT GUIDELINES:
    - Base analysis on current market conditions and available data
    - Consider both technical and fundamental factors
    - Provide balanced, objective analysis
    - Include appropriate disclaimers about market risks
    - Focus on Indian market context
    - Keep language professional but accessible
    - Provide actionable insights

    Return response in JSON format:
    {
      "recommendation": "BUY/SELL/HOLD/STRONG BUY/STRONG SELL",
      "confidence": "High/Medium/Low",
      "summary": "Brief summary",
      "technicalAnalysis": "Detailed technical analysis",
      "fundamentalAnalysis": "Detailed fundamental analysis", 
      "marketTrends": "Market trends and outlook",
      "riskAssessment": "Risk assessment and mitigation"
    }
    `

    try {
      console.log(`🔄 Generating AI analysis for ${stockData.symbol}...`)
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 45000) // 45 second timeout
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
      
      console.log(`✅ AI analysis completed for ${stockData.symbol}`)

      // Extract JSON from AI response
      let analysis
      try {
        // Try to find JSON in the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in AI response')
        }
      } catch (parseError) {
        console.warn('AI response parsing failed, creating structured response:', parseError)
        
        // Create structured response from raw text
        analysis = {
          recommendation: extractRecommendation(aiResponse),
          confidence: extractConfidence(aiResponse),
          summary: extractSection(aiResponse, 'SUMMARY') || 'AI analysis completed successfully.',
          technicalAnalysis: extractSection(aiResponse, 'TECHNICAL ANALYSIS') || 'Technical analysis not available.',
          fundamentalAnalysis: extractSection(aiResponse, 'FUNDAMENTAL ANALYSIS') || 'Fundamental analysis not available.',
          marketTrends: extractSection(aiResponse, 'MARKET TRENDS') || 'Market trends analysis not available.',
          riskAssessment: extractSection(aiResponse, 'RISK ASSESSMENT') || 'Risk assessment not available.'
        }
      }

      // Validate analysis structure
      if (!analysis.recommendation) {
        analysis.recommendation = 'HOLD'
      }
      if (!analysis.confidence) {
        analysis.confidence = 'Medium'
      }
      if (!analysis.summary) {
        analysis.summary = `AI analysis for ${stockData.symbol} completed. Please review detailed sections below.`
      }

      return {
        success: true,
        analysis,
        symbol: stockData.symbol,
        timestamp: new Date(),
        message: `AI analysis completed for ${stockData.symbol}`
      }

    } catch (aiError) {
      console.error('AI generation error:', aiError)
      
      // STRICT POLICY: No fallback data allowed
      console.error('❌ STRICT POLICY: No fallback data allowed - failing request')
      throw createError({
        statusCode: 500,
        statusMessage: `AI analysis failed for ${stockData.symbol}. No fallback data provided as per strict real-data-only policy.`
      })
    }

  } catch (error) {
    console.error('Error in AI stock analysis:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `AI stock analysis failed: ${error.message}`
    })
  }
})

// Helper functions to extract information from unstructured AI response
function extractRecommendation(text) {
  const recommendations = ['STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL']
  for (const rec of recommendations) {
    if (text.toUpperCase().includes(rec)) {
      return rec
    }
  }
  return 'HOLD'
}

function extractConfidence(text) {
  if (text.toLowerCase().includes('high confidence') || text.toLowerCase().includes('confidence: high')) {
    return 'High'
  }
  if (text.toLowerCase().includes('low confidence') || text.toLowerCase().includes('confidence: low')) {
    return 'Low'
  }
  return 'Medium'
}

function extractSection(text, sectionName) {
  const regex = new RegExp(`${sectionName}:?\\s*([\\s\\S]*?)(?=\\n\\n|\\d+\\.|$)`, 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : null
}
