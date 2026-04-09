import { ref, computed } from 'vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

/**
 * Adobe PDF Services API Composable
 * Provides comprehensive PDF operations using Adobe's enterprise-grade API
 */
export const useAdobePDF = () => {
  // Use the application's standard API composable for authenticated requests
  const api = useApiWithAuth()
  // State management
  const isLoading = ref(false)
  const error = ref(null)
  const progress = ref(0)
  
  // Configuration
  const STORAGE_KEY = 'adobe_pdf_credentials'
  
  // Reactive state for credentials
  const credentials = ref({
    clientId: '',
    clientSecret: '',
    organizationId: ''
  })
  
  // Computed properties
  const hasCredentials = computed(() => {
    return credentials.value.clientId && 
           credentials.value.clientSecret && 
           credentials.value.organizationId
  })
  
  // Load credentials from localStorage
  const loadCredentials = () => {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        credentials.value = {
          clientId: parsed.clientId || '',
          clientSecret: parsed.clientSecret || '',
          organizationId: parsed.organizationId || ''
        }
      }
    } catch (err) {
      console.error('Error loading Adobe PDF credentials:', err)
    }
  }
  
  // Save credentials to localStorage
  const saveCredentials = (newCredentials) => {
    try {
      credentials.value = { ...newCredentials }

      // Check if we're in browser environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials.value))
      }

      return true
    } catch (err) {
      console.error('Error saving Adobe PDF credentials:', err)
      return false
    }
  }
  
  // Clear credentials
  const clearCredentials = () => {
    credentials.value = {
      clientId: '',
      clientSecret: '',
      organizationId: ''
    }

    // Check if we're in browser environment
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  
  // Get access token for API calls
  const getAccessToken = async () => {
    try {
      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      // Use native fetch for external Adobe IMS API
      const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: credentials.value.clientId,
          client_secret: credentials.value.clientSecret,
          grant_type: 'client_credentials',
          scope: 'openid,AdobeID,read_organizations,additional_info.projectedProductContext,additional_info.roles'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error_description || `Authentication failed: ${response.status}`)
      }

      const data = await response.json()
      return data.access_token
    } catch (err) {
      error.value = err.message
      throw err
    }
  }
  
  // Test credentials validity
  const testCredentials = async () => {
    try {
      isLoading.value = true
      error.value = null

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      // Use authenticated API for CSRF handling
      const result = await api.post('/api/adobe-pdf/test-credentials', {
        clientId: credentials.value.clientId,
        clientSecret: credentials.value.clientSecret,
        organizationId: credentials.value.organizationId
      })

      return {
        valid: true,
        message: result.message || 'Adobe PDF Services credentials are valid!'
      }
    } catch (err) {
      return {
        valid: false,
        message: err.data?.statusMessage || err.message || 'Failed to test credentials'
      }
    } finally {
      isLoading.value = false
    }
  }
  
  // PDF Operations - Real Adobe PDF Services API Integration

  // Helper function to prepare file data for API
  const prepareFileForAPI = (file) => {
    if (file instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1] // Remove data:application/pdf;base64, prefix
          resolve({
            name: file.name,
            data: base64Data,
            type: file.type,
            size: file.size
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }
    return Promise.resolve(file) // Already in correct format
  }

  // Helper function to download file from base64 data
  const downloadFile = (fileData) => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(fileData.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: fileData.type })

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileData.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      return true
    } catch (error) {
      console.error('Download error:', error)
      throw new Error('Failed to download file: ' + error.message)
    }
  }

  // Create PDF from various formats
  const createPdf = async (file) => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      // For now, return a message that this feature needs implementation
      // This would require a separate create-pdf endpoint
      throw new Error('PDF creation from other formats is not yet implemented. Please use the export feature to convert PDFs to other formats.')

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }

  // Export PDF to various formats
  const exportPdf = async (file, targetFormat = 'docx') => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      if (!targetFormat) {
        throw new Error('Target format is required for PDF export')
      }

      // Prepare file data
      const fileData = await prepareFileForAPI(file)
      progress.value = 10

      // Call real Adobe PDF Services API
      const response = await api.post('/api/adobe-pdf/export', {
        file: fileData,
        targetFormat,
        credentials: credentials.value
      })

      progress.value = 100

      // Automatically trigger download if response contains file data
      if (response.success && response.file) {
        downloadFile(response.file)
      }

      return response

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }

  // Compress PDF
  const compressPdf = async (file, compressionLevel = 'MEDIUM') => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      // Prepare file data
      const fileData = await prepareFileForAPI(file)
      progress.value = 10

      // Call real Adobe PDF Services API
      const response = await api.post('/api/adobe-pdf/compress', {
        file: fileData,
        compressionLevel,
        credentials: credentials.value
      })

      progress.value = 100

      // Automatically trigger download if response contains file data
      if (response.success && response.file) {
        downloadFile(response.file)
      }

      return response

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }

  // Combine multiple PDFs
  const combinePdfs = async (files) => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      if (!Array.isArray(files) || files.length < 2) {
        throw new Error('At least 2 PDF files are required for combination')
      }

      // Prepare all files data
      const filesData = await Promise.all(files.map(file => prepareFileForAPI(file)))
      progress.value = 20

      // Call real Adobe PDF Services API
      const response = await api.post('/api/adobe-pdf/combine', {
        files: filesData,
        credentials: credentials.value
      })

      progress.value = 100

      // Automatically trigger download if response contains file data
      if (response.success && response.file) {
        downloadFile(response.file)
      }

      return response

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }

  // OCR PDF
  const ocrPdf = async (file, locale = 'en-US') => {
    try {
      isLoading.value = true
      error.value = null
      progress.value = 0

      if (!hasCredentials.value) {
        throw new Error('Adobe PDF credentials not configured')
      }

      // Prepare file data
      const fileData = await prepareFileForAPI(file)
      progress.value = 10

      // Call real Adobe PDF Services API
      const response = await api.post('/api/adobe-pdf/ocr', {
        file: fileData,
        locale,
        credentials: credentials.value
      })

      progress.value = 100

      // Automatically trigger download if response contains file data
      if (response.success && response.file) {
        downloadFile(response.file)
      }

      return response

    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      progress.value = 0
    }
  }

  // Initialize credentials on composable creation (safe for SSR)
  loadCredentials()

  // Also provide a way to manually initialize on client-side
  const initializeCredentials = () => {
    loadCredentials()
  }

  return {
    // State
    isLoading,
    error,
    progress,
    credentials,
    hasCredentials,

    // Credential management
    loadCredentials,
    saveCredentials,
    clearCredentials,
    testCredentials,
    initializeCredentials,

    // Utility functions
    getAccessToken,
    downloadFile,

    // PDF Operations
    createPdf,
    exportPdf,
    compressPdf,
    combinePdfs,
    ocrPdf,

    // Advanced operations
    protectPdf: async (file, password) => {
      try {
        isLoading.value = true
        error.value = null
        progress.value = 0

        if (!hasCredentials.value) {
          throw new Error('Adobe PDF credentials not configured')
        }

        // This feature needs a separate protect-pdf endpoint implementation
        throw new Error('PDF protection feature is not yet implemented. Please check back later.')

      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        isLoading.value = false
        progress.value = 0
      }
    },

    splitPdf: async (file) => {
      try {
        isLoading.value = true
        error.value = null
        progress.value = 0

        if (!hasCredentials.value) {
          throw new Error('Adobe PDF credentials not configured')
        }

        // This feature needs a separate split-pdf endpoint implementation
        throw new Error('PDF splitting feature is not yet implemented. Please check back later.')

      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        isLoading.value = false
        progress.value = 0
      }
    },

    linearizePdf: async (file) => {
      try {
        isLoading.value = true
        error.value = null
        progress.value = 0

        if (!hasCredentials.value) {
          throw new Error('Adobe PDF credentials not configured')
        }

        // This feature needs a separate linearize-pdf endpoint implementation
        throw new Error('PDF linearization feature is not yet implemented. Please check back later.')

      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        isLoading.value = false
        progress.value = 0
      }
    },

    extractPdf: async (file) => {
      try {
        isLoading.value = true
        error.value = null
        progress.value = 0

        if (!hasCredentials.value) {
          throw new Error('Adobe PDF credentials not configured')
        }

        // This feature needs a separate extract-pdf endpoint implementation
        throw new Error('PDF content extraction feature is not yet implemented. Please check back later.')

      } catch (err) {
        error.value = err.message
        throw err
      } finally {
        isLoading.value = false
        progress.value = 0
      }
    }
  }
}
