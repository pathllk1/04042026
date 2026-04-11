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
        <!-- Close Button -->
        <button @click="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors duration-200 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Header -->
        <div class="p-6 pb-0">
          <h3 class="text-lg leading-6 font-medium text-gray-900 flex items-center mb-6" id="modal-headline">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            Language Translator
          </h3>
        </div>

        <!-- Content -->
        <div class="flex-grow overflow-auto p-6 pt-0">
          <div class="mt-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Source Language and Text -->
              <div class="flex flex-col">
                <div class="flex justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700">Source Language</label>
                  <div v-if="isDetecting" class="text-sm text-blue-500">Detecting...</div>
                  <div v-else-if="detectedLanguage" class="text-sm text-green-500">
                    Detected: {{ getLanguageName(detectedLanguage.language) }} ({{ Math.round(detectedLanguage.confidence * 100) }}% confidence)
                  </div>
                </div>

                <select
                  v-model="sourceLanguage"
                  class="mb-4 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                >
                  <option value="auto">Auto Detect</option>
                  <option v-for="lang in languages" :key="lang.code" :value="lang.code">
                    {{ lang.name }}
                  </option>
                </select>

                <textarea
                  v-model="sourceText"
                  rows="8"
                  class="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                  placeholder="Enter text to translate..."
                  @input="debouncedTranslate"
                ></textarea>

                <div class="flex justify-between mt-2">
                  <span class="text-sm text-gray-500">{{ sourceText.length }} characters</span>
                  <button
                    @click="clearSource"
                    class="text-sm text-red-500 hover:text-red-700"
                    v-if="sourceText"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <!-- Target Language and Translation -->
              <div class="flex flex-col">
                <label class="block text-sm font-medium text-gray-700 mb-2">Target Language</label>
                <select
                  v-model="targetLanguage"
                  class="mb-4 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                >
                  <option v-for="lang in languages" :key="lang.code" :value="lang.code">
                    {{ lang.name }}
                  </option>
                </select>

                <div class="relative">
                  <textarea
                    v-model="translatedText"
                    rows="8"
                    class="w-full rounded-md border border-gray-300 shadow-sm bg-gray-50 px-3 py-2"
                    readonly
                  ></textarea>

                  <div
                    v-if="isLoading"
                    class="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-md"
                  >
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                </div>

                <div class="flex justify-end mt-2">
                  <button
                    @click="copyTranslation"
                    class="text-sm text-blue-500 hover:text-blue-700 flex items-center"
                    v-if="translatedText"
                  >
                    <span v-if="copied">Copied!</span>
                    <span v-else>Copy to clipboard</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-center">
              <button
                @click="translate"
                class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                :disabled="isLoading || !sourceText"
              >
                {{ isLoading ? 'Translating...' : 'Translate' }}
              </button>
            </div>

            <div class="mt-4 text-center text-xs text-gray-500">
              Powered by {{ provider ? provider : 'Translation API' }}
              <span v-if="matchQuality !== null"> - Match Quality: {{ Math.round(matchQuality * 100) }}%</span>
            </div>

            <!-- Translation History -->
            <div v-if="translationHistory.length > 0" class="mt-8">
              <h2 class="text-lg font-semibold mb-3">Recent Translations</h2>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Text</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Translation</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Languages</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(item, index) in translationHistory.slice(0, 3)" :key="index">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">{{ item.sourceText }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">{{ item.translatedText }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ getLanguageName(item.sourceLanguage) }} → {{ getLanguageName(item.targetLanguage) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button @click="restoreTranslation(item)" class="text-blue-500 hover:text-blue-700 mr-3">
                          Restore
                        </button>
                        <button @click="removeFromHistory(index)" class="text-red-500 hover:text-red-700">
                          Remove
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-2 text-right">
                <button
                  @click="clearHistory"
                  class="text-sm text-red-500 hover:text-red-700"
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-auto flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            @click="closeModal"
          >
            Close
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';
import useToast from '~/composables/ui/useToast';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const api = useApiWithAuth();
const { success, error: showError, info } = useToast();

// State variables
const sourceLanguage = ref('auto');
const targetLanguage = ref('en');
const sourceText = ref('');
const translatedText = ref('');
const isLoading = ref(false);
const isDetecting = ref(false);
const detectedLanguage = ref(null);
const copied = ref(false);
const languages = ref([]);
const translationHistory = ref([]);
const provider = ref('');
const matchQuality = ref(null);

// Load translation history from localStorage on component mount
// This doesn't require authentication
onMounted(() => {
  if (process.client) {
    loadTranslationHistory();
  }
});

// Translate function
async function translate() {
  if (!sourceText.value || isLoading.value) return;

  isLoading.value = true;

  try {
    const response = await api.post('/api/tools/translate', {
      text: sourceText.value,
      source: sourceLanguage.value,
      target: targetLanguage.value
    });

    translatedText.value = response.translatedText;

    // Update provider information
    if (response.provider) {
      provider.value = response.provider;
    }

    // Update match quality if available
    matchQuality.value = response.matchQuality !== undefined ? response.matchQuality : null;

    if (response.detectedLanguage) {
      detectedLanguage.value = response.detectedLanguage;
    }

    // Add to translation history
    addToHistory();

    success('Translation completed successfully');
  } catch (err) {
    console.error('Translation error:', err);
    showError(err.message || 'Error translating text. Please try again.');
  } finally {
    isLoading.value = false;
  }
}

// Debounced translate for auto-translation
let debounceTimeout;
function debouncedTranslate() {
  clearTimeout(debounceTimeout);
  if (sourceText.value.length > 0) {
    debounceTimeout = setTimeout(() => {
      translate();
    }, 1000); // 1 second delay
  } else {
    translatedText.value = '';
  }
}

// Copy translation to clipboard
function copyTranslation() {
  if (!translatedText.value) return;

  if (process.client) {
    navigator.clipboard.writeText(translatedText.value)
      .then(() => {
        copied.value = true;
        setTimeout(() => {
          copied.value = false;
        }, 2000);
        success('Translation copied to clipboard');
      })
      .catch(err => {
        console.error('Error copying to clipboard:', err);
        showError('Failed to copy to clipboard');
      });
  }
}

// Clear source text
function clearSource() {
  sourceText.value = '';
  translatedText.value = '';
  detectedLanguage.value = null;
  matchQuality.value = null;
}

// Get language name from code
function getLanguageName(code) {
  if (code === 'auto') return 'Auto Detect';
  const lang = languages.value.find(l => l.code === code);
  return lang ? lang.name : code;
}

// Translation history functions
function addToHistory() {
  if (!sourceText.value || !translatedText.value) return;

  // Add to the beginning of the array
  translationHistory.value.unshift({
    sourceText: sourceText.value,
    translatedText: translatedText.value,
    sourceLanguage: detectedLanguage.value?.language || sourceLanguage.value,
    targetLanguage: targetLanguage.value,
    timestamp: new Date().toISOString()
  });

  // Limit history to 20 items
  if (translationHistory.value.length > 20) {
    translationHistory.value = translationHistory.value.slice(0, 20);
  }

  // Save to localStorage
  saveTranslationHistory();
}

function restoreTranslation(item) {
  sourceText.value = item.sourceText;
  sourceLanguage.value = item.sourceLanguage;
  targetLanguage.value = item.targetLanguage;
  translatedText.value = item.translatedText;

  info('Translation restored from history');
}

function removeFromHistory(index) {
  translationHistory.value.splice(index, 1);
  saveTranslationHistory();
}

function clearHistory() {
  translationHistory.value = [];
  saveTranslationHistory();
  info('Translation history cleared');
}

function saveTranslationHistory() {
  if (process.client) {
    try {
      localStorage.setItem('translationHistory', JSON.stringify(translationHistory.value));
    } catch (err) {
      console.error('Error saving translation history:', err);
    }
  }
}

function loadTranslationHistory() {
  if (process.client) {
    try {
      const saved = localStorage.getItem('translationHistory');
      if (saved) {
        translationHistory.value = JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error loading translation history:', err);
    }
  }
}

// Close modal
function closeModal() {
  emit('close');
}

// Watch for language changes to retranslate
watch([targetLanguage], () => {
  if (sourceText.value && translatedText.value) {
    translate();
  }
});

// Function to fetch available languages
async function fetchLanguages() {
  try {
    isLoading.value = true;
    const fetchedLanguages = await api.get('/api/tools/languages');

    // Check if we got provider information
    if (fetchedLanguages.length > 0 && fetchedLanguages[0].provider) {
      provider.value = fetchedLanguages[0].provider;
    }

    // Format languages to match our expected structure
    languages.value = fetchedLanguages.map(lang => ({
      code: lang.code,
      name: lang.name
    }));
  } catch (err) {
    console.error('Error fetching languages:', err);
    showError('Failed to load available languages. Using default language set.');

    // Fallback languages
    languages.value = [
      { code: 'en', name: 'English' },
      { code: 'ar', name: 'Arabic' },
      { code: 'zh', name: 'Chinese' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'hi', name: 'Hindi' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'es', name: 'Spanish' }
    ];
  } finally {
    isLoading.value = false;
  }
}

// Check if user is authenticated
function isAuthenticated() {
  if (process.client) {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='));
    return !!token;
  }
  return false;
}

// Watch for modal open state to show welcome message and fetch languages when modal is opened
watch(() => props.isOpen, (newValue) => {
  if (newValue === true) {
    // Fetch languages when the modal is opened
    if (languages.value.length === 0) {
      fetchLanguages();
    }

    // Only show the welcome message when the modal is actually opened
    setTimeout(() => {
      info('Ready to translate! Select languages and enter text.');
    }, 500); // Small delay to ensure modal is visible first
  }
});
</script>

<style scoped>
/* Add any component-specific styles here */
textarea {
  resize: none;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
