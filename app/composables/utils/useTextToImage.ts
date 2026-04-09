import { ref, computed, readonly } from 'vue'
import useLocalStorage from './useLocalStorage'

const HF_API_KEY = 'huggingface_api_key'
const HF_API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev'

export const useTextToImage = () => {
  const localStorage = useLocalStorage()
  
  // Reactive state
  const isLoading = ref(false)
  const error = ref('')
  
  // Get API key from localStorage
  const getApiKey = (): string => {
    return localStorage.getItem<string>(HF_API_KEY, '')
  }
  
  // Set API key in localStorage
  const setApiKey = (apiKey: string): void => {
    localStorage.setItem(HF_API_KEY, apiKey.trim())
  }
  
  // Remove API key from localStorage
  const removeApiKey = (): void => {
    localStorage.removeItem(HF_API_KEY)
  }
  
  // Check if API key exists
  const hasApiKey = computed((): boolean => {
    return Boolean(getApiKey())
  })
  
  // Generate image using Hugging Face API
  const generateImage = async (prompt: string): Promise<Blob> => {
    const apiKey = getApiKey()
    
    if (!apiKey) {
      throw new Error('Hugging Face API key is required')
    }
    
    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }
    
    isLoading.value = true
    error.value = ''
    
    try {
      console.log('🎨 Starting image generation with FLUX.1-dev...')
      console.log('📝 Prompt:', prompt)
      
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt.trim(),
          parameters: {
            // Optional parameters for FLUX.1-dev
            guidance_scale: 7.5,
            num_inference_steps: 50,
            width: 1024,
            height: 1024
          }
        })
      })
      
      console.log('📥 API Response status:', response.status)
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch (e) {
          // If we can't parse JSON, use the status text
        }
        
        throw new Error(errorMessage)
      }
      
      const contentType = response.headers.get('content-type')
      console.log('📄 Response content type:', contentType)
      
      if (!contentType || !contentType.startsWith('image/')) {
        // Sometimes the API returns JSON with error or loading status
        try {
          const jsonResponse = await response.json()
          if (jsonResponse.error) {
            throw new Error(jsonResponse.error)
          }
          if (jsonResponse.estimated_time) {
            throw new Error(`Model is loading. Please wait ${jsonResponse.estimated_time} seconds and try again.`)
          }
          throw new Error('Unexpected response format')
        } catch (jsonError) {
          throw new Error('Invalid response format - expected image data')
        }
      }
      
      const imageBlob = await response.blob()
      console.log('🖼️ Image generated successfully, size:', imageBlob.size, 'bytes')
      
      if (imageBlob.size === 0) {
        throw new Error('Received empty image data')
      }
      
      return imageBlob
      
    } catch (err: any) {
      console.error('❌ Image generation failed:', err)
      error.value = err.message || 'Failed to generate image'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // Test API key validity
  const testApiKey = async (apiKey?: string): Promise<boolean> => {
    const keyToTest = apiKey || getApiKey()
    
    if (!keyToTest) {
      return false
    }
    
    try {
      console.log('🔑 Testing Hugging Face API key...')
      
      // Use a simple test prompt
      const testPrompt = "A simple test image"
      
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToTest}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: testPrompt
        })
      })
      
      console.log('🔑 API key test response status:', response.status)
      
      // Check if we get a valid response (even if model is loading)
      if (response.status === 200 || response.status === 503) {
        return true
      }
      
      if (response.status === 401 || response.status === 403) {
        return false
      }
      
      // For other status codes, try to parse the response
      try {
        const data = await response.json()
        // If we get a structured response, the API key is likely valid
        return Boolean(data)
      } catch {
        return false
      }
      
    } catch (err) {
      console.error('🔑 API key test failed:', err)
      return false
    }
  }
  
  // Get model status
  const getModelStatus = async (): Promise<{ loading: boolean; estimated_time?: number }> => {
    const apiKey = getApiKey()
    
    if (!apiKey) {
      throw new Error('API key is required')
    }
    
    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: "test"
        })
      })
      
      if (response.status === 503) {
        const data = await response.json()
        return {
          loading: true,
          estimated_time: data.estimated_time
        }
      }
      
      return { loading: false }
      
    } catch (err) {
      console.error('Failed to get model status:', err)
      return { loading: false }
    }
  }
  
  // Clear error
  const clearError = (): void => {
    error.value = ''
  }
  
  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    hasApiKey,
    
    // Methods
    getApiKey,
    setApiKey,
    removeApiKey,
    generateImage,
    testApiKey,
    getModelStatus,
    clearError
  }
}
