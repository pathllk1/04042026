/**
 * Adobe PDF Services API - Compress PDF Endpoint
 * Compresses PDF files using Adobe PDF Services REST API
 */
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { file, compressionLevel = 'MEDIUM', credentials } = body

    if (!file || !credentials) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: file and credentials are required'
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
    const { uploadUri, assetID } = uploadData

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

    // Step 4: Create compression job
    console.log('🗜️ Creating compression job...')
    const jobResponse = await fetch('https://pdf-services.adobe.io/operation/compresspdf', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assetID: assetID,
        compressionLevel: compressionLevel
      })
    })

    if (!jobResponse.ok) {
      const errorData = await jobResponse.json().catch(() => ({}))
      console.error('❌ Job Creation Error:', errorData)

      // Extract error message properly
      let errorMessage = 'Failed to create compression job'
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
        statusMessage: statusData.error?.message || 'PDF compression job failed'
      })
    }

    if (jobStatus === 'in progress') {
      throw createError({
        statusCode: 408,
        statusMessage: 'PDF compression job timed out'
      })
    }

    // Step 6: Download compressed file
    console.log('📥 Downloading compressed PDF...')
    const downloadUri = statusData.asset?.downloadUri
    if (!downloadUri) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No download URI provided for compressed PDF'
      })
    }

    const downloadResponse = await fetch(downloadUri)
    if (!downloadResponse.ok) {
      throw createError({
        statusCode: downloadResponse.status,
        statusMessage: 'Failed to download compressed PDF'
      })
    }

    const compressedBuffer = await downloadResponse.arrayBuffer()
    const compressedBase64 = Buffer.from(compressedBuffer).toString('base64')

    console.log('✅ PDF compression completed successfully')

    return {
      success: true,
      message: 'PDF compressed successfully',
      file: {
        name: file.name.replace('.pdf', '_compressed.pdf'),
        data: compressedBase64,
        type: 'application/pdf',
        size: compressedBuffer.byteLength
      },
      compressionLevel,
      originalSize: fileBuffer.length,
      compressedSize: compressedBuffer.byteLength,
      compressionRatio: ((fileBuffer.length - compressedBuffer.byteLength) / fileBuffer.length * 100).toFixed(2)
    }

  } catch (error) {
    console.error('❌ Adobe PDF compression error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'PDF compression failed: ' + error.message
    })
  }
})
