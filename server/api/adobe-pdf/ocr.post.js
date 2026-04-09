/**
 * Adobe PDF Services API - OCR PDF Endpoint
 * Performs OCR on PDF files using Adobe PDF Services REST API
 */
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { file, locale = 'en-US', credentials } = body

    if (!file || !credentials) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: file and credentials are required'
      })
    }

    // Validate locale
    const validLocales = [
      'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'pt-BR', 
      'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'nl-NL', 'da-DK', 'fi-FI',
      'nb-NO', 'sv-SE', 'cs-CZ', 'pl-PL', 'ru-RU', 'uk-UA', 'bg-BG',
      'hr-HR', 'hu-HU', 'ro-RO', 'sk-SK', 'sl-SI', 'et-EE', 'lv-LV',
      'lt-LT', 'mt-MT', 'el-GR', 'tr-TR', 'ar-AE', 'he-IL'
    ]

    if (!validLocales.includes(locale)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid locale. Supported locales: ${validLocales.slice(0, 10).join(', ')}... (and ${validLocales.length - 10} more)`
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

    // Step 4: Create OCR job
    console.log(`🔍 Creating OCR job with locale ${locale}...`)
    const jobResponse = await fetch('https://pdf-services.adobe.io/operation/ocr', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assetID: assetID,
        ocrLang: locale
      })
    })

    if (!jobResponse.ok) {
      const errorData = await jobResponse.json().catch(() => ({}))
      console.error('❌ Job Creation Error:', errorData)

      // Extract error message properly
      let errorMessage = 'Failed to create OCR job'
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

    // Step 5: Poll for job completion (OCR takes longer)
    console.log('⏳ Polling for OCR job completion...')
    let jobStatus = 'in progress'
    let attempts = 0
    const maxAttempts = 60 // 10 minutes max for OCR
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

      // Log progress for long-running OCR jobs
      if (attempts % 6 === 0) { // Every minute
        console.log(`⏳ OCR still in progress... (${attempts}/60 attempts)`)
      }
    }

    if (jobStatus === 'failed') {
      throw createError({
        statusCode: 500,
        statusMessage: statusData.error?.message || 'OCR job failed'
      })
    }

    if (jobStatus === 'in progress') {
      throw createError({
        statusCode: 408,
        statusMessage: 'OCR job timed out'
      })
    }

    // Step 6: Download OCR processed file
    console.log('📥 Downloading OCR processed PDF...')
    const downloadUri = statusData.asset?.downloadUri
    if (!downloadUri) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No download URI provided for OCR processed PDF'
      })
    }

    const downloadResponse = await fetch(downloadUri)
    if (!downloadResponse.ok) {
      throw createError({
        statusCode: downloadResponse.status,
        statusMessage: 'Failed to download OCR processed PDF'
      })
    }

    const ocrBuffer = await downloadResponse.arrayBuffer()
    const ocrBase64 = Buffer.from(ocrBuffer).toString('base64')

    console.log('✅ OCR processing completed successfully')

    return {
      success: true,
      message: 'OCR processing completed successfully',
      file: {
        name: file.name.replace('.pdf', '_ocr.pdf'),
        data: ocrBase64,
        type: 'application/pdf',
        size: ocrBuffer.byteLength
      },
      locale,
      originalSize: fileBuffer.length,
      processedSize: ocrBuffer.byteLength,
      processingTime: `${attempts * 10} seconds`
    }

  } catch (error) {
    console.error('❌ Adobe PDF OCR error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'OCR processing failed: ' + error.message
    })
  }
})
