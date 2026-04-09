/**
 * Adobe PDF Services API - Export PDF Endpoint
 * Exports PDF to different formats using Adobe PDF Services REST API
 */
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { file, targetFormat = 'docx', credentials } = body

    if (!file || !credentials) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: file and credentials are required'
      })
    }

    // Validate target format - Adobe PDF Services supported formats (lowercase)
    const validFormats = {
      'doc': 'doc',
      'docx': 'docx',
      'pptx': 'pptx',
      'xlsx': 'xlsx',
      'rtf': 'rtf',
      'jpeg': 'jpeg',
      'png': 'png'
    }

    const normalizedFormat = targetFormat.toLowerCase()
    if (!validFormats[normalizedFormat]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid target format '${targetFormat}'. Supported formats: ${Object.keys(validFormats).join(', ')}`
      })
    }

    const adobeTargetFormat = validFormats[normalizedFormat]

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
    console.log('🔍 Token Response:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      access_token: tokenData.access_token ? '***PRESENT***' : 'MISSING'
    })
    const accessToken = tokenData.access_token

    if (!accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No access token received from Adobe IMS'
      })
    }

    // Step 2: Upload asset
    console.log('📤 Uploading PDF asset...')
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
        statusMessage: 'Failed to get upload URL from Adobe PDF Services'
      })
    }

    const uploadData = await uploadResponse.json()
    console.log('🔍 Upload Response:', JSON.stringify(uploadData, null, 2))
    const { uploadUri, assetID } = uploadData

    if (!uploadUri || !assetID) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Invalid upload response: missing uploadUri or assetID'
      })
    }

    // Step 3: Upload file to cloud storage
    console.log('☁️ Uploading file to cloud storage...')
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
        statusMessage: 'Failed to upload file to cloud storage'
      })
    }

    // Step 4: Create export job
    console.log(`📄 Creating export job to ${adobeTargetFormat}...`)
    console.log('🔍 Asset ID:', assetID)
    console.log('🔍 Target Format:', adobeTargetFormat)

    const jobPayload = {
      assetID: assetID,
      targetFormat: adobeTargetFormat
    }

    console.log('🔍 Job Payload:', JSON.stringify(jobPayload, null, 2))

    const jobResponse = await fetch('https://pdf-services.adobe.io/operation/exportpdf', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jobPayload)
    })

    console.log('🔍 Job Response Status:', jobResponse.status)
    console.log('🔍 Job Response Headers:', Object.fromEntries(jobResponse.headers.entries()))

    if (!jobResponse.ok) {
      const errorData = await jobResponse.json().catch(() => ({}))
      console.error('❌ Job Creation Error:', errorData)

      // Extract error message properly
      let errorMessage = 'Failed to create export job'
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

    // Step 5: Poll for job completion
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
        statusMessage: statusData.error?.message || 'PDF export job failed'
      })
    }

    if (jobStatus === 'in progress') {
      throw createError({
        statusCode: 408,
        statusMessage: 'PDF export job timed out'
      })
    }

    // Step 6: Download exported file
    console.log('📥 Downloading exported file...')
    const downloadUri = statusData.asset?.downloadUri
    if (!downloadUri) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No download URI provided for exported file'
      })
    }

    const downloadResponse = await fetch(downloadUri)
    if (!downloadResponse.ok) {
      throw createError({
        statusCode: downloadResponse.status,
        statusMessage: 'Failed to download exported file'
      })
    }

    const exportedBuffer = await downloadResponse.arrayBuffer()
    const exportedBase64 = Buffer.from(exportedBuffer).toString('base64')

    // Determine MIME type and file extension
    const mimeTypes = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      rtf: 'application/rtf',
      jpeg: 'image/jpeg',
      png: 'image/png'
    }

    const mimeType = mimeTypes[normalizedFormat] || 'application/octet-stream'
    const fileName = file.name.replace('.pdf', `.${normalizedFormat}`)

    console.log('✅ PDF export completed successfully')

    return {
      success: true,
      message: `PDF exported to ${adobeTargetFormat.toUpperCase()} successfully`,
      file: {
        name: fileName,
        data: exportedBase64,
        type: mimeType,
        size: exportedBuffer.byteLength
      },
      targetFormat: adobeTargetFormat.toUpperCase(),
      originalSize: fileBuffer.length,
      exportedSize: exportedBuffer.byteLength
    }

  } catch (error) {
    console.error('❌ Adobe PDF export error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'PDF export failed: ' + error.message
    })
  }
})
