<template>
  <UModal
    :open="isOpen"
    @update:open="$emit('close')"
    :ui="{
      content: 'max-w-4xl max-h-[90vh] overflow-hidden',
      overlay: { base: 'z-[99999]' },
      wrapper: { base: 'z-[99999]' }
    }"
  >
    <template #content>
      <div class="bg-white rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col relative">
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-semibold text-white">AI Image Generator</h2>
                <p class="text-purple-100 text-sm">Powered by Hugging Face FLUX.1-dev</p>
              </div>
            </div>
            <button
              @click="$emit('close')"
              class="text-white hover:text-gray-200 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-grow overflow-auto p-6">
          <!-- API Key Configuration -->
          <div v-if="!hasApiKey" class="mb-6">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-yellow-800">Hugging Face API Key Required</h3>
                  <p class="mt-1 text-sm text-yellow-700">
                    To use the AI Image Generator, you need a Hugging Face API key. Get your free API key from 
                    <a href="https://huggingface.co/settings/tokens" target="_blank" class="underline font-medium">Hugging Face Settings</a>.
                  </p>
                  <div class="mt-3 flex space-x-2">
                    <input
                      v-model="tempApiKey"
                      type="password"
                      placeholder="Enter your Hugging Face API key (hf_...)"
                      class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                      @click="saveApiKey"
                      :disabled="!tempApiKey.trim()"
                      class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Image Generation Interface -->
          <div v-if="hasApiKey" class="space-y-6">
            <!-- Prompt Input -->
            <div>
              <label for="prompt" class="block text-sm font-medium text-gray-700 mb-2">
                Image Description
              </label>
              <textarea
                id="prompt"
                v-model="prompt"
                rows="3"
                placeholder="Describe the image you want to generate... (e.g., 'A beautiful sunset over mountains with a lake in the foreground')"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              ></textarea>
            </div>

            <!-- Generate Button -->
            <div class="flex justify-center">
              <button
                @click="generateImage"
                :disabled="isLoading || !prompt.trim()"
                class="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg v-if="isLoading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{{ isLoading ? 'Generating...' : 'Generate Image' }}</span>
              </button>
            </div>

            <!-- Loading Progress -->
            <div v-if="isLoading" class="text-center">
              <div class="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-blue-700 text-sm font-medium">Generating your image with FLUX.1-dev...</span>
              </div>
            </div>

            <!-- Error Display -->
            <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Generation Failed</h3>
                  <p class="mt-1 text-sm text-red-700">{{ error }}</p>
                  <button
                    @click="error = ''"
                    class="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>

            <!-- Generated Image Display -->
            <div v-if="generatedImageUrl" class="space-y-4">
              <div class="text-center">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Generated Image</h3>
                <div class="inline-block border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                  <img
                    :src="generatedImageUrl"
                    :alt="prompt"
                    class="max-w-full max-h-96 object-contain"
                  />
                </div>
              </div>

              <!-- Image Actions -->
              <div class="flex justify-center space-x-3">
                <button
                  @click="downloadImage"
                  class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center space-x-2"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download</span>
                </button>
                <button
                  @click="copyImageToClipboard"
                  class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center space-x-2"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copy</span>
                </button>
                <button
                  @click="clearImage"
                  class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 flex items-center space-x-2"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <!-- Usage Info -->
            <div class="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 class="text-sm font-medium text-gray-900 mb-2">Usage Information</h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>• Model: FLUX.1-dev (Black Forest Labs)</li>
                <li>• Your API key is stored locally in your browser</li>
                <li>• Images are generated directly from Hugging Face</li>
                <li>• Generated images are not stored on our servers</li>
                <li>• Check your Hugging Face usage limits</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTextToImage } from '~/composables/utils/useTextToImage'
import useToast from '~/composables/ui/useToast'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close'])

// Composables
const {
  isLoading,
  error,
  hasApiKey,
  getApiKey,
  setApiKey,
  generateImage: generateImageAPI
} = useTextToImage()

const { success, error: showError } = useToast()

// Local state
const tempApiKey = ref('')
const prompt = ref('')
const generatedImageUrl = ref('')

// Methods
const saveApiKey = () => {
  if (!tempApiKey.value.trim()) return
  
  setApiKey(tempApiKey.value.trim())
  success('API key saved successfully', 'Saved')
  tempApiKey.value = ''
}

const generateImage = async () => {
  if (!prompt.value.trim()) return
  
  try {
    error.value = ''
    const imageBlob = await generateImageAPI(prompt.value.trim())
    
    // Create object URL for display
    generatedImageUrl.value = URL.createObjectURL(imageBlob)
    
    success('Image generated successfully!', 'Success')
  } catch (err) {
    console.error('Image generation error:', err)
    error.value = err.message || 'Failed to generate image'
    showError('Failed to generate image', 'Error')
  }
}

const downloadImage = () => {
  if (!generatedImageUrl.value) return
  
  const link = document.createElement('a')
  link.href = generatedImageUrl.value
  link.download = `ai-generated-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  success('Image downloaded', 'Downloaded')
}

const copyImageToClipboard = async () => {
  if (!generatedImageUrl.value) return
  
  try {
    const response = await fetch(generatedImageUrl.value)
    const blob = await response.blob()
    
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ])
    
    success('Image copied to clipboard', 'Copied')
  } catch (err) {
    console.error('Copy failed:', err)
    showError('Failed to copy image', 'Error')
  }
}

const clearImage = () => {
  if (generatedImageUrl.value) {
    URL.revokeObjectURL(generatedImageUrl.value)
    generatedImageUrl.value = ''
  }
  prompt.value = ''
  error.value = ''
}

// Initialize
onMounted(() => {
  if (hasApiKey.value) {
    tempApiKey.value = ''
  }
})
</script>
