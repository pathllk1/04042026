import { AIService, getAIConfigFromUser } from '../../utils/aiService'
import { jobStatuses } from '../../utils/sharedJobStatus'

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
    const { jobId = `job_${Date.now()}`, userGuidance = null } = body

    console.log(`🤖 Starting background EPF/ESIC verification job: ${jobId} for user:`, userId)

    if (userGuidance) {
      console.log(`📝 User provided guidance: "${userGuidance}"`)
    } else {
      console.log(`📝 No user guidance provided - using default analysis`)
    }

    // Get user's AI configuration
    const aiConfig = await getAIConfigFromUser(event)
    console.log(`🤖 Using AI Provider: ${aiConfig.provider}, Model: ${aiConfig.model}`)

    // Initialize job status
    jobStatuses.set(jobId, {
      status: 'processing',
      userId,
      startTime: new Date().toISOString(),
      message: 'Starting EPF/ESIC verification...'
    })

    console.log(`📝 Job status initialized for ${jobId}, total jobs: ${jobStatuses.size}`)

    // Create a background job and return immediately
    processEpfEsicVerificationBackground(jobId, userId, aiConfig, userGuidance)

    return {
      success: true,
      message: 'EPF/ESIC verification job started',
      jobId,
      status: 'processing'
    }
  } catch (error) {
    console.error('Error starting EPF/ESIC verification job:', error)
    return {
      success: false,
      message: 'Failed to start EPF/ESIC verification job',
      error: error.message
    }
  }
})

/**
 * Process EPF/ESIC verification in the background
 * This function runs asynchronously after the API has already responded
 */
async function processEpfEsicVerificationBackground(jobId: string, userId: string, aiConfig: any, userGuidance: string | null = null) {
  try {
    console.log(`🔄 Processing background EPF/ESIC verification job: ${jobId}`)

    // Update job status
    jobStatuses.set(jobId, {
      status: 'processing',
      userId,
      startTime: new Date().toISOString(),
      message: 'Analyzing EPF/ESIC rates with AI...'
    })

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

    console.log(`🔄 Generating AI response for EPF/ESIC rules in background job: ${jobId}...`)

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

    console.log(`✅ AI response received for EPF/ESIC rules in background job: ${jobId}`)

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
    } catch (jsonError) {
      console.error(`❌ Error parsing AI response in background job ${jobId}:`, jsonError)
      throw new Error('Failed to parse AI response')
    }

    // Store the results and update job status
    const timestamp = new Date().toISOString()
    const verificationResult = {
      jobId,
      userId,
      timestamp,
      rules: parsedRules,
      status: 'completed'
    }

    // Update job status to completed
    jobStatuses.set(jobId, {
      status: 'completed',
      userId,
      startTime: new Date().toISOString(),
      completedTime: timestamp,
      message: 'EPF/ESIC verification completed successfully',
      rules: parsedRules
    })

    console.log(`✅ Job status updated to completed for ${jobId}, total jobs: ${jobStatuses.size}`)

    console.log(`✅ Background EPF/ESIC verification job completed: ${jobId}`)
    return verificationResult
  } catch (error) {
    console.error(`❌ Background EPF/ESIC verification job failed: ${jobId}`, error)

    // Update job status to failed with error details
    setJobStatus(jobId, {
      status: 'failed',
      userId,
      startTime: new Date().toISOString(),
      failedTime: new Date().toISOString(),
      message: `EPF/ESIC verification failed: ${error.message}`,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        provider: error.provider || 'unknown'
      }
    })

    return {
      jobId,
      userId,
      timestamp: new Date().toISOString(),
      status: 'failed',
      error: error.message
    }
  }
}