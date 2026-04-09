import { ref, computed } from 'vue'

export const useILovePDF = () => {
  const isLoading = ref(false)
  const error = ref(null)
  const progress = ref(0)
  const currentServer = ref(null)  // Store the assigned server
  const authToken = ref(null)  // Cache the auth token
  const tokenExpiry = ref(null)  // Track token expiry
  
  // API key management (stored in localStorage)
  const getApiKey = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ilovepdf_api_key') || ''
    }
    return ''
  }
  
  const setApiKey = (key) => {
    if (typeof window !== 'undefined') {
      if (key && key.trim()) {
        localStorage.setItem('ilovepdf_api_key', key.trim())
      } else {
        localStorage.removeItem('ilovepdf_api_key')
      }
      // Clear cached token when API key changes
      authToken.value = null
      tokenExpiry.value = null
    }
  }
  
  const hasApiKey = computed(() => {
    return getApiKey().length > 0
  })

  // Test API key validity
  const testApiKey = async () => {
    try {
      const response = await makeRequest('/start/compress', {
        method: 'GET'  // Use GET method as per API docs
      })

      console.log('Test API response:', response)

      // Check if response has the expected structure according to API docs
      if (!response || !response.task) {
        return { valid: false, message: 'API key works but response structure is unexpected. Please check the API documentation.' }
      }

      return { valid: true, message: 'API key is valid and working!' }
    } catch (err) {
      return { valid: false, message: err.message }
    }
  }
  
  // Base API configuration
  const API_BASE = 'https://api.ilovepdf.com/v1'

  // Get authentication token from ILovePDF auth server
  const getAuthToken = async () => {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('ILovePDF API key is required')
    }

    // Check if we have a valid cached token (tokens expire after 2 hours)
    const now = new Date().getTime()
    if (authToken.value && tokenExpiry.value && now < tokenExpiry.value) {
      console.log('Using cached auth token')
      return authToken.value
    }

    try {
      console.log('Requesting new auth token...')
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          public_key: apiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Auth Error: ${response.status}`)
      }

      const result = await response.json()
      console.log('Auth response:', result)

      // Cache the token (expires in 2 hours = 7200000 ms, we'll refresh after 1.5 hours)
      authToken.value = result.token
      tokenExpiry.value = now + (1.5 * 60 * 60 * 1000) // 1.5 hours

      return result.token
    } catch (err) {
      console.error('Authentication failed:', err)
      // Clear cached token on error
      authToken.value = null
      tokenExpiry.value = null
      throw err
    }
  }
  
  // Helper function to make API requests
  const makeRequest = async (endpoint, options = {}) => {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('ILovePDF API key is required. Please configure it in settings.')
    }

    try {
      // Get authentication token first
      const authToken = await getAuthToken()

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error Response:', errorData)

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your ILovePDF API key.')
        } else if (response.status === 403) {
          throw new Error('API key does not have permission for this operation.')
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.')
        }

        throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('API Response:', result) // Debug logging
      return result
    } catch (err) {
      console.error('Request failed:', err)
      throw err
    }
  }
  
  // Start a new task
  const startTask = async (tool) => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 10

      // Use the correct endpoint format: /start/{tool}
      const response = await makeRequest(`/start/${tool}`, {
        method: 'GET'  // According to docs, this should be GET, not POST
      })

      progress.value = 20

      // Log the actual response for debugging
      console.log('StartTask API response:', response)
      console.log('Response type:', typeof response)
      console.log('Response keys:', response ? Object.keys(response) : 'null/undefined')

      // Validate response structure according to API docs
      if (!response) {
        throw new Error('No response received from ILovePDF API. Please check your internet connection and try again.')
      }

      // According to API docs, response should have: { "server": "api11.ilovepdf.com", "task": "g27d4mrsg3ztmnzAgm5d..." }
      if (!response.task) {
        console.error('Unexpected API response structure:', response)
        throw new Error(`Invalid response from ILovePDF API. Expected 'task' property but got: ${Object.keys(response).join(', ')}`)
      }

      // Store the server for later use
      if (response.server) {
        currentServer.value = response.server
        console.log('Assigned server:', response.server)
      }

      return response.task
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // Upload file to task
  const uploadFile = async (taskId, file) => {
    try {
      progress.value = 30

      // Validate inputs
      if (!taskId) {
        throw new Error('Task ID is required for file upload')
      }
      if (!file) {
        throw new Error('File is required for upload')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('task', taskId)

      // Use the assigned server for upload
      const serverUrl = currentServer.value ? `https://${currentServer.value}` : API_BASE
      const authToken = await getAuthToken()

      const response = await fetch(`${serverUrl}/v1/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Upload Error Response:', errorData)
        throw new Error(errorData.error?.message || `Upload Error: ${response.status}`)
      }

      progress.value = 50
      const result = await response.json()
      console.log('Upload Response:', result) // Debug logging
      return result
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // Process the task
  const processTask = async (taskId, params = {}) => {
    try {
      progress.value = 60

      // Use the assigned server for processing
      const serverUrl = currentServer.value ? `https://${currentServer.value}` : API_BASE
      const authToken = await getAuthToken()

      const response = await fetch(`${serverUrl}/v1/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task: taskId,
          ...params
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Process Error Response:', errorData)
        throw new Error(errorData.error?.message || `Process Error: ${response.status}`)
      }

      progress.value = 80
      const result = await response.json()
      console.log('Process Response:', result)
      return result
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // Download processed file
  const downloadFile = async (taskId) => {
    try {
      progress.value = 90

      // Use the assigned server for download
      const serverUrl = currentServer.value ? `https://${currentServer.value}` : API_BASE
      const authToken = await getAuthToken()

      const response = await fetch(`${serverUrl}/v1/download/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Download Error: ${response.status}`)
      }

      progress.value = 100
      return response.blob()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // Complete workflow for different PDF operations
  const compressPdf = async (file, compressionLevel = 'recommended') => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0
      
      // Start compress task
      const task = await startTask('compress')
      console.log('Compress task started:', task)

      // Upload file
      const uploadResult = await uploadFile(task, file)

      // Process with compression level
      await processTask(task, {
        tool: 'compress',
        files: [{
          server_filename: uploadResult.server_filename,
          filename: file.name
        }],
        compression_level: compressionLevel
      })
      
      // Download result
      const blob = await downloadFile(task)
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compressed_${file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      return { success: true, message: 'PDF compressed successfully!' }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }
  
  // Merge multiple PDFs
  const mergePdfs = async (files) => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0
      
      if (files.length < 2) {
        throw new Error('At least 2 PDF files are required for merging')
      }
      
      // Start merge task
      const task = await startTask('merge')
      console.log('Merge task started:', task)

      // Upload all files and collect server filenames
      const uploadedFiles = []
      for (let i = 0; i < files.length; i++) {
        const uploadResult = await uploadFile(task, files[i])
        uploadedFiles.push({
          server_filename: uploadResult.server_filename,
          filename: files[i].name
        })
        progress.value = 20 + (i / files.length) * 30
      }

      // Process merge
      await processTask(task, {
        tool: 'merge',
        files: uploadedFiles
      })
      
      // Download result
      const blob = await downloadFile(task)
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'merged_document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      return { success: true, message: 'PDFs merged successfully!' }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }
  
  // Convert PDF to JPG
  const convertPdfToJpg = async (file) => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      const tool = 'pdfjpg'
      
      // Start conversion task
      const task = await startTask(tool)
      
      // Upload file
      const uploadResult = await uploadFile(task, file)

      // Process conversion
      const params = {
        tool: tool,
        files: [{
          server_filename: uploadResult.server_filename,
          filename: file.name
        }]
      }
      await processTask(task, params)

      // Download result
      const blob = await downloadFile(task)

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `converted_${file.name.replace('.pdf', '')}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      return { success: true, message: 'PDF converted to JPG successfully!' }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }
  
  // Split PDF
  const splitPdf = async (file, splitMode = 'pages', ranges = '1-') => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0
      
      // Start split task
      const task = await startTask('split')
      
      // Upload file
      const uploadResult = await uploadFile(task, file)

      // Process split
      await processTask(task, {
        tool: 'split',
        files: [{
          server_filename: uploadResult.server_filename,
          filename: file.name
        }],
        split_mode: splitMode,
        ranges: ranges
      })
      
      // Download result
      const blob = await downloadFile(task)
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `split_${file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      return { success: true, message: 'PDF split successfully!' }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }
  
  return {
    // State
    isLoading,
    error,
    progress,
    hasApiKey,

    // API key management
    getApiKey,
    setApiKey,
    testApiKey,

    // PDF operations
    compressPdf,
    mergePdfs,
    convertPdfToJpg,
    splitPdf
  }
}
