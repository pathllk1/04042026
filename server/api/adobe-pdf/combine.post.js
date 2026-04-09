/**
 * Adobe PDF Services API - Combine PDFs Endpoint
 * Combines multiple PDF files using Adobe PDF Services REST API
 */
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { files, credentials } = body

    if (!files || !Array.isArray(files) || files.length < 2 || !credentials) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: files (array of at least 2 PDFs) and credentials are required'
      })
    }

    const { clientId, clientSecret } = credentials

    // Step 1: Get access token
    console.log('🔐 Getting Adobe access token...')
    const tokenResponse = await fetch('https://pdf-services.adobe.io/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      throw createError({
        statusCode: 401,
        statusMessage: errorData.error_description || 'Failed to authenticate with Adobe PDF Services'
      })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Step 2: Upload all PDF assets
    console.log(`📤 Uploading ${files.length} PDF assets...`)
    const assetIDs = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Get upload URL
      const uploadResponse = await fetch('https://pdf-services.adobe.io/assets', {
        method: 'POST',
        headers: {
          'X-API-Key': clientId,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mediaType: 'application/pdf'
        })
      })

      if (!uploadResponse.ok) {
        throw createError({
          statusCode: uploadResponse.status,
          statusMessage: `Failed to get upload URL for file ${i + 1}`
        })
      }

      const uploadData = await uploadResponse.json()
      const { uploadUri, assetID } = uploadData

      // Upload file to cloud storage
      const fileBuffer = Buffer.from(file.data, 'base64')
      
      const cloudUploadResponse = await fetch(uploadUri, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf'
        },
        body: fileBuffer
      })

      if (!cloudUploadResponse.ok) {
        throw createError({
          statusCode: cloudUploadResponse.status,
          statusMessage: `Failed to upload file ${i + 1} to cloud storage`
        })
      }

      assetIDs.push(assetID)
    }

    // Step 3: Create combine job
    console.log('🔗 Creating combine job...')
    const jobResponse = await fetch('https://pdf-services.adobe.io/operation/combinepdf', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assets: assetIDs.map(assetID => ({ assetID }))
      })
    })

    if (!jobResponse.ok) {
      const errorData = await jobResponse.json().catch(() => ({}))
      console.error('❌ Job Creation Error:', errorData)

      // Extract error message properly
      let errorMessage = 'Failed to create combine job'
      if (errorData.error && errorData.error.message) {
        errorMessage = errorData.error.message
      } else if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = String(errorData.error)
      }

      throw createError({
        statusCode: jobResponse.status,
        statusMessage: errorMessage
      })
    }

    const jobLocation = jobResponse.headers.get('location')
    if (!jobLocation) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No job location returned from Adobe PDF Services'
      })
    }

    // Step 4: Poll for job completion
    console.log('⏳ Polling for job completion...')
    let jobStatus = 'in progress'
    let attempts = 0
    const maxAttempts = 30 // 5 minutes max
    let statusData

    while (jobStatus === 'in progress' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
      
      const statusResponse = await fetch(jobLocation, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Key': clientId
        }
      })

      if (!statusResponse.ok) {
        throw createError({
          statusCode: statusResponse.status,
          statusMessage: 'Failed to check job status'
        })
      }

      statusData = await statusResponse.json()
      jobStatus = statusData.status
      attempts++
    }

    if (jobStatus === 'failed') {
      throw createError({
        statusCode: 500,
        statusMessage: statusData.error?.message || 'PDF combine job failed'
      })
    }

    if (jobStatus === 'in progress') {
      throw createError({
        statusCode: 408,
        statusMessage: 'PDF combine job timed out'
      })
    }

    // Step 5: Download combined file
    console.log('📥 Downloading combined PDF...')
    const downloadUri = statusData.asset?.downloadUri
    if (!downloadUri) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No download URI provided for combined PDF'
      })
    }

    const downloadResponse = await fetch(downloadUri)
    if (!downloadResponse.ok) {
      throw createError({
        statusCode: downloadResponse.status,
        statusMessage: 'Failed to download combined PDF'
      })
    }

    const combinedBuffer = await downloadResponse.arrayBuffer()
    const combinedBase64 = Buffer.from(combinedBuffer).toString('base64')

    console.log('✅ PDF combination completed successfully')

    return {
      success: true,
      message: 'PDFs combined successfully',
      file: {
        name: 'combined_document.pdf',
        data: combinedBase64,
        type: 'application/pdf',
        size: combinedBuffer.byteLength
      },
      filesCount: files.length,
      originalFiles: files.map(f => f.name)
    }

  } catch (error) {
    console.error('❌ Adobe PDF combine error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'PDF combination failed: ' + error.message
    })
  }
})
