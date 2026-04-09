import { AIService, getAIConfigFromUser } from '../../utils/aiService'

export default defineEventHandler(async (event) => {
  // Verify authentication
  const { userId, user } = event.context
  if (!userId || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  try {
    const body = await readBody(event)
    const { forceUpdate = false, userGuidance = null } = body

    console.log('🤖 AI EPF/ESIC Rules fetch requested by user:', userId)

    if (userGuidance) {
      console.log(`📝 User provided guidance: "${userGuidance}"`)
    } else {
      console.log(`📝 No user guidance provided - using default analysis`)
    }

    // Get user's AI configuration
    const aiConfig = await getAIConfigFromUser(event)
    console.log(`🤖 Using AI Provider: ${aiConfig.provider}, Model: ${aiConfig.model}`)

    // Initialize dynamic AI service
    const aiService = new AIService(aiConfig)

    // Comprehensive AI prompt for fetching current EPF/ESIC rules
    const aiPrompt = `
    You are an expert in Indian labor laws and government regulations. I need you to provide the most current EPF (Employee Provident Fund) and ESIC (Employee State Insurance Corporation) rates and rules as per the latest government notifications.

    ${userGuidance ? `
    ═══════════════════════════════════════════════════════════════
    🎯 CRITICAL USER INSTRUCTIONS - HIGHEST PRIORITY:
    ${userGuidance}

    ⚠️ MANDATORY: You MUST follow the above user guidance carefully.
    These instructions take precedence over general analysis.
    Please address these specific requirements in your response.
    ═══════════════════════════════════════════════════════════════

    ` : ''}

    Please provide the following information in JSON format:

    {
      "epf": {
        "employeeRate": "Employee contribution rate as decimal (e.g., 0.12 for 12%)",
        "employerEpfRate": "Employer EPF contribution rate as decimal",
        "employerEpsRate": "Employer EPS contribution rate as decimal",
        "edliRate": "EDLI contribution rate as decimal",
        "adminChargesRate": "EPF Admin charges rate as decimal (usually 0.65%)",
        "wageLimit": "Maximum wage limit for EPF calculation in rupees",
        "maxEmployeeContribution": "Maximum employee EPF contribution in rupees",
        "maxEpsContribution": "Maximum EPS contribution in rupees",
        "maxAdminCharges": "Maximum admin charges per employee per month in rupees",
        "effectiveDate": "Date from which these rates are effective (YYYY-MM-DD format)"
      },
      "esic": {
        "employeeRate": "Employee ESIC contribution rate as decimal",
        "employerRate": "Employer ESIC contribution rate as decimal",
        "wageLimit": "Maximum wage limit for ESIC calculation in rupees",
        "effectiveDate": "Date from which these rates are effective (YYYY-MM-DD format)"
      },
      "lastUpdated": "Current date and time in ISO format",
      "source": "Government notification or official source reference",
      "confidence": "High/Medium/Low based on data reliability"
    }

    Based on my knowledge as of 2024, the current rates are:
    - EPF Employee: 12% (max ₹1,800 on wage ceiling of ₹15,000)
    - EPF Employer: 3.67%
    - EPS Employer: 8.33% (max ₹1,250 on wage ceiling of ₹15,000)
    - EDLI: 0.5%
    - EPF Admin Charges: 0.65% (max ₹75 per employee per month)
    - ESIC Employee: 0.75%
    - ESIC Employer: 3.25%
    - ESIC wage ceiling: ₹25,000

    IMPORTANT: Please ensure you include the EPF Admin charges rate (typically 0.65%) and maximum admin charges limit (typically ₹75 per employee per month). This is a crucial component that employers must pay in addition to EPF and EPS contributions.

    Please verify these rates and provide the most current information. If there have been any recent changes or notifications, please include them.

    ${userGuidance ? `
    ═══════════════════════════════════════════════════════════════
    🔴 FINAL REMINDER: FOLLOW USER INSTRUCTIONS ABOVE
    The user has provided specific guidance at the top of this prompt.
    Make sure your analysis addresses those requirements.
    ═══════════════════════════════════════════════════════════════
    ` : ''}
    `

    console.log('🔄 Generating AI response for EPF/ESIC rules...')

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), 45000)
    )

    const aiPromise = aiService.generateContent({ prompt: aiPrompt })
    const aiResult = await Promise.race([aiPromise, timeoutPromise]) as any

    // Handle reasoning models that might return content in reasoning field
    let aiResponse = aiResult.content || ''
    if (!aiResponse.trim() && aiResult.reasoning && aiResult.reasoning.trim()) {
      console.log('🧠 Using reasoning field as content for reasoning model')
      aiResponse = aiResult.reasoning
    }

    console.log('✅ AI response received for EPF/ESIC rules')

    // Parse AI response
    let parsedRules
    try {
      // Extract JSON from AI response (it might have additional text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedRules = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No valid JSON found in AI response')
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      // STRICT POLICY: No fallback data allowed
      console.error('❌ STRICT POLICY: No fallback data allowed - failing request')
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to parse EPF/ESIC rules from AI response. No fallback data provided as per strict real-data-only policy.'
      })
    }

    // Validate and sanitize the parsed rules
    const validatedRules = {
      epf: {
        employeeRate: Number(parsedRules.epf?.employeeRate) || 0.12,
        employerEpfRate: Number(parsedRules.epf?.employerEpfRate) || 0.0367,
        employerEpsRate: Number(parsedRules.epf?.employerEpsRate) || 0.0833,
        edliRate: Number(parsedRules.epf?.edliRate) || 0.005,
        adminChargesRate: Number(parsedRules.epf?.adminChargesRate) || 0.0065,
        wageLimit: Number(parsedRules.epf?.wageLimit) || 15000,
        maxEmployeeContribution: Number(parsedRules.epf?.maxEmployeeContribution) || 1800,
        maxEpsContribution: Number(parsedRules.epf?.maxEpsContribution) || 1250,
        maxAdminCharges: Number(parsedRules.epf?.maxAdminCharges) || 75,
        effectiveDate: parsedRules.epf?.effectiveDate || '2024-01-01'
      },
      esic: {
        employeeRate: Number(parsedRules.esic?.employeeRate) || 0.0075,
        employerRate: Number(parsedRules.esic?.employerRate) || 0.0325,
        wageLimit: Number(parsedRules.esic?.wageLimit) || 25000,
        effectiveDate: parsedRules.esic?.effectiveDate || '2024-01-01'
      },
      lastUpdated: new Date().toISOString(),
      source: parsedRules.source || 'AI Analysis',
      confidence: parsedRules.confidence || 'High',
      aiResponse: aiResponse.substring(0, 500) // Store first 500 chars for reference
    }

    console.log('📊 Validated EPF/ESIC rules:', validatedRules)

    return {
      success: true,
      data: validatedRules,
      message: 'EPF/ESIC rules fetched successfully using AI',
      timestamp: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('❌ Error in AI EPF/ESIC rules fetch:', error)

    // STRICT POLICY: No fallback data allowed
    console.error('❌ STRICT POLICY: No fallback data allowed - failing request')
    throw createError({
      statusCode: 500,
      statusMessage: `AI EPF/ESIC rules fetch failed. No fallback data provided as per strict real-data-only policy. Error: ${error?.message || 'Unknown error'}`
    })
  }
})
