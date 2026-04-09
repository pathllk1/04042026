/**
 * Adobe PDF Services API - Test Credentials Endpoint
 * Tests if the provided Adobe PDF Services credentials are valid
 */
export default defineEventHandler(async (event) => {
  // Handle CSRF for POST requests
  if (event.node.req.method === 'POST') {
    // Allow the request to proceed - Nuxt handles CSRF internally
  }

  try {
    const body = await readBody(event)
    const { clientId, clientSecret, organizationId } = body

    if (!clientId || !clientSecret || !organizationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required credentials: clientId, clientSecret, and organizationId are required'
      })
    }

    // Test authentication with Adobe IMS
    const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'openid,AdobeID,read_organizations,additional_info.projectedProductContext,additional_info.roles'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw createError({
        statusCode: 401,
        statusMessage: errorData.error_description || 'Invalid Adobe PDF Services credentials'
      })
    }

    const tokenData = await response.json()

    // Verify we got a valid access token
    if (!tokenData.access_token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Failed to obtain access token from Adobe IMS'
      })
    }

    return {
      success: true,
      message: 'Adobe PDF Services credentials are valid!',
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    }

  } catch (error) {
    console.error('Adobe PDF Services credential test error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to test Adobe PDF Services credentials: ' + error.message
    })
  }
})
