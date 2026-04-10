<template>
  <div>
    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity"
      @click="closePopup"
    ></div>

    <!-- Popup Dialog -->
    <div
      v-if="isOpen"
      class="fixed inset-0 flex items-center justify-center z-[100] p-4"
      @click.stop
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all"
        :class="{ 'scale-100 opacity-100': isOpen, 'scale-95 opacity-0': !isOpen }"
      >
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
          <h2 class="text-xl font-semibold text-indigo-700">Settings & Tools</h2>
          <div class="flex items-center space-x-2">
            <button
              @click="closePopup"
              class="text-gray-500 hover:text-gray-700 focus:outline-none"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto flex-grow">
          <!-- Tabs -->
          <div class="border-b border-gray-200 mb-6">
            <nav class="-mb-px flex space-x-6">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  activeTab === tab.id
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500',
                  'px-1 py-2 font-medium transition-all duration-300 hover:text-indigo-500'
                ]"
              >
                {{ tab.name }}
              </button>
            </nav>
          </div>

          <!-- Settings Tab -->
          <div v-if="activeTab === 'settings'" class="space-y-6">
            <div>
              <h3 class="text-lg font-medium text-gray-900 mb-3">Appearance</h3>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label for="theme" class="text-sm font-medium text-gray-700">Theme</label>
                  <select
                    id="theme"
                    v-model="settings.theme"
                    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System Default</option>
                  </select>
                </div>
                <div class="flex items-center justify-between">
                  <label for="fontSize" class="text-sm font-medium text-gray-700">Font Size</label>
                  <select
                    id="fontSize"
                    v-model="settings.fontSize"
                    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 class="text-lg font-medium text-gray-900 mb-3">Notifications</h3>
              <div class="space-y-3">
                <div class="flex items-center">
                  <input
                    id="notifications"
                    v-model="settings.notifications"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="notifications" class="ml-2 text-sm font-medium text-gray-700">
                    Enable notifications
                  </label>
                </div>
                <div class="flex items-center">
                  <input
                    id="sounds"
                    v-model="settings.sounds"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="sounds" class="ml-2 text-sm font-medium text-gray-700">
                    Enable sounds
                  </label>
                </div>
              </div>
            </div>

            <div v-if="isAuthenticated && canAccessAdmin">
              <h3 class="text-lg font-medium text-gray-900 mb-3">AI Assistant</h3>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label for="aiModel" class="text-sm font-medium text-gray-700">Default AI Model</label>
                  <select
                    id="aiModel"
                    v-model="settings.aiModel"
                    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash-lite-preview-06-17">Gemini 2.5 Flash Lite Preview</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 class="text-lg font-medium text-gray-900 mb-3">Visible Tools</h3>
              <p class="text-sm text-gray-500 mb-3">Choose which tools to show in the Tools tab</p>
              <div class="space-y-3">
                <div class="flex items-center">
                  <input
                    id="calculator-toggle"
                    v-model="settings.visibleTools.calculator"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="calculator-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Calculator
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="news-toggle"
                    v-model="settings.visibleTools.news"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="news-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    News Reader
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="pdf-tools-toggle"
                    v-model="settings.visibleTools.pdfTools"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="pdf-tools-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    PDF Tools
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="task-manager-toggle"
                    v-model="settings.visibleTools.taskManager"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="task-manager-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Task Manager
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="todo-list-toggle"
                    v-model="settings.visibleTools.todoList"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="todo-list-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Todo List
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="weather-toggle"
                    v-model="settings.visibleTools.weather"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="weather-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Weather Forecast
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="translator-toggle"
                    v-model="settings.visibleTools.translator"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="translator-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Language Translator
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="image-editor-toggle"
                    v-model="settings.visibleTools.imageEditor"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="image-editor-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Image Editor
                  </label>
                </div>

                <div class="flex items-center">
                  <input
                    id="notes-toggle"
                    v-model="settings.visibleTools.notes"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="notes-toggle" class="ml-2 text-sm font-medium text-gray-700">
                    Notes
                  </label>
                </div>

              </div>
            </div>
          </div>

          <!-- AI Settings Tab -->
          <div v-if="activeTab === 'ai'" class="space-y-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-blue-800">Configure Your AI Provider</h3>
                  <p class="mt-1 text-sm text-blue-700">
                    Use your own AI API key for personalized AI features. Your API key is stored locally and never shared.
                  </p>
                </div>
              </div>
            </div>

            <!-- AI Provider Selection -->
            <div>
              <h3 class="text-lg font-medium text-gray-900 mb-3">AI Provider</h3>
              <div class="space-y-3">
                <!-- Built-in Providers -->
                <div v-for="provider in providers" :key="provider.id" class="flex items-center">
                  <input
                    :id="`provider-${provider.id}`"
                    :value="provider.id"
                    :checked="aiConfig.provider === provider.id"
                    @change="handleProviderChange(provider.id)"
                    type="radio"
                    name="ai-provider"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label :for="`provider-${provider.id}`" class="ml-3 flex-1">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-sm font-medium text-gray-700 flex items-center">
                          {{ provider.name }}
                          <!-- Saved API Key Indicator -->
                          <span v-if="hasApiKeyForProvider(provider.id)"
                                class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            🔑 Saved
                          </span>
                        </div>
                        <div class="text-xs text-gray-500">{{ provider.description }}</div>
                      </div>
                    </div>
                  </label>
                </div>

                <!-- Custom Providers -->
                <div v-if="getActiveCustomProviders().length > 0" class="border-t border-gray-200 pt-3">
                  <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">🔧 Custom Providers</h4>
                  <div v-for="customProvider in getActiveCustomProviders()" :key="customProvider.id" class="flex items-center">
                    <input
                      :id="`provider-${customProvider.id}`"
                      :value="customProvider.id"
                      :checked="aiConfig.provider === customProvider.id"
                      @change="handleProviderChange(customProvider.id)"
                      type="radio"
                      name="ai-provider"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label :for="`provider-${customProvider.id}`" class="ml-3 flex-1">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-sm font-medium text-gray-700 flex items-center">
                            🔧 {{ customProvider.name }}
                            <!-- Custom Provider API Key Indicator -->
                            <span v-if="hasApiKeyForProvider(customProvider.id)"
                                  class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              🔑 Saved
                            </span>
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Custom
                            </span>
                          </div>
                          <div class="text-xs text-gray-500">{{ customProvider.baseUrl }}</div>
                          <div class="text-xs text-gray-400">{{ customProvider.models.length }} models • {{ customProvider.requestFormat.toUpperCase() }} compatible</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- API Key Configuration -->
            <div v-if="currentProvider">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-medium text-gray-900">API Key</h3>
                <!-- Auto-populated indicator with more specific info -->
                <span v-if="tempApiKey && currentModel?.id && hasApiKeyForModel(currentModel.id)"
                      class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                  🔑 Model-specific Key
                </span>
                <span v-else-if="tempApiKey && currentProvider?.id && hasApiKeyForProvider(currentProvider.id)"
                      class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  🔑 Provider Key
                </span>
              </div>
              <div class="space-y-3">
                <div class="relative">
                  <input
                    :type="showApiKey ? 'text' : 'password'"
                    :value="tempApiKey || aiConfig.apiKey"
                    @input="handleApiKeyChange($event.target.value)"
                    :placeholder="`Enter your ${currentProvider.name} API key`"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-20"
                  />
                  <div class="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                    <button
                      @click="toggleApiKeyVisibility"
                      type="button"
                      class="text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      <svg v-if="showApiKey" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                      <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="flex items-center space-x-3">
                  <button
                    @click="testApiKey"
                    :disabled="!tempApiKey?.trim() || testingApiKey"
                    class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="testingApiKey" class="flex items-center">
                      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </span>
                    <span v-else>Test API Key</span>
                  </button>

                  <div v-if="apiKeyValid" class="flex items-center text-green-600 text-sm">
                    <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    Valid
                  </div>

                  <div v-if="aiError" class="text-red-600 text-sm">
                    {{ aiError }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Model Selection -->
            <div v-if="currentProvider && availableModels.length > 0">
              <h3 class="text-lg font-medium text-gray-900 mb-3">AI Model</h3>
              <div class="space-y-3">
                <div v-for="model in availableModels" :key="model.id" class="flex items-start">
                  <input
                    :id="`model-${model.id}`"
                    :value="model.id"
                    :checked="aiConfig.model === model.id"
                    @change="handleModelChange(model.id)"
                    type="radio"
                    name="ai-model"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 mt-1"
                  />
                  <label :for="`model-${model.id}`" class="ml-3 flex-1">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-700">{{ model.name }}</span>
                        <!-- Model-specific API Key Indicator -->
                        <span v-if="model.id && hasApiKeyForModel(model.id)"
                              class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          🔑 Saved
                        </span>
                        <span v-else-if="currentProvider?.id && hasApiKeyForProvider(currentProvider.id)"
                              class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          🔑 Provider Key
                        </span>
                      </div>
                    </div>
                    <div class="text-xs text-gray-500 mb-1">{{ model.description }}</div>
                    <div class="text-xs text-gray-400">
                      Max tokens: {{ model.maxTokens.toLocaleString() }}
                      <span v-if="model.costPer1kTokens" class="ml-2">
                        • Cost: ${{ model.costPer1kTokens.input }}-${{ model.costPer1kTokens.output }}/1K tokens
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Configuration Status -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Configuration Status</h4>
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Provider:</span>
                  <span class="font-medium">{{ currentProvider?.name || 'Not selected' }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Model:</span>
                  <span class="font-medium">{{ currentModel?.name || 'Not selected' }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">API Key:</span>
                  <span :class="isConfigured ? 'text-green-600' : 'text-red-600'" class="font-medium">
                    {{ isConfigured ? 'Configured' : 'Not configured' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Saved Configurations Summary -->
            <div v-if="getSavedModels().length > 0" class="bg-blue-50 rounded-lg p-4">
              <h4 class="text-sm font-medium text-blue-900 mb-3">💾 Saved Model Configurations</h4>
              <div class="space-y-2">
                <div v-for="modelId in getSavedModels().slice(0, 5)" :key="modelId" class="flex items-center justify-between text-sm">
                  <span class="text-blue-800 font-medium">{{ modelId }}</span>
                  <span class="text-blue-600 text-xs">🔑 API Key Saved</span>
                </div>
                <div v-if="getSavedModels().length > 5" class="text-xs text-blue-600 text-center pt-2 border-t border-blue-200">
                  + {{ getSavedModels().length - 5 }} more models with saved keys
                </div>
              </div>
              <div class="mt-3 text-xs text-blue-700">
                💡 <strong>Tip:</strong> Switch between any saved model and your API key will auto-populate!
              </div>
            </div>

            <!-- Export/Import Configuration -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">📁 Configuration Management</h3>

              <!-- Export Section -->
              <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 class="text-sm font-medium text-green-800 mb-3">📤 Export Settings</h4>
                <p class="text-sm text-green-700 mb-4">
                  Save your AI configuration to a JSON file for backup or sharing.
                </p>

                <!-- Export Options -->
                <div class="space-y-2 mb-4">
                  <label class="flex items-center">
                    <input
                      v-model="exportOptions.includeApiKeys"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">
                      Include API Keys
                      <span class="text-green-600">(⚠️ Keep secure!)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="exportOptions.includeUsageStats"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">Include Usage Statistics</span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="exportOptions.includeCustomProviders"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">Include Custom Providers</span>
                  </label>
                </div>

                <button
                  @click="handleExportConfig"
                  :disabled="exportLoading"
                  class="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="exportLoading" class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </span>
                  <span v-else class="flex items-center justify-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Configuration
                  </span>
                </button>
              </div>

              <!-- Import Section -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-blue-800 mb-3">📥 Import Settings</h4>
                <p class="text-sm text-blue-700 mb-4">
                  Load AI configuration from a previously exported JSON file.
                </p>

                <!-- Import Options -->
                <div class="space-y-2 mb-4">
                  <label class="flex items-center">
                    <input
                      v-model="importOptions.mergeWithExisting"
                      type="checkbox"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-blue-700">
                      Merge with existing settings
                      <span class="text-blue-600">(instead of replacing)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="importOptions.importApiKeys"
                      type="checkbox"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-blue-700">
                      Import API Keys
                      <span class="text-blue-600">(if included in file)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="importOptions.importUsageStats"
                      type="checkbox"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-blue-700">Import Usage Statistics</span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="importOptions.importCustomProviders"
                      type="checkbox"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-blue-700">Import Custom Providers</span>
                  </label>
                </div>

                <!-- File Input -->
                <div class="mb-4">
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".json"
                    @change="handleFileSelect"
                    class="hidden"
                  />
                  <button
                    @click="$refs.fileInput?.click()"
                    class="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 border-2 border-dashed border-blue-300 hover:border-blue-400"
                  >
                    <span class="flex items-center justify-center">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Choose Configuration File
                    </span>
                  </button>
                </div>

                <!-- Selected File Display -->
                <div v-if="selectedFile" class="mb-4 p-3 bg-blue-100 rounded-md">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span class="text-sm text-blue-800 font-medium">{{ selectedFile.name }}</span>
                    </div>
                    <button
                      @click="clearSelectedFile"
                      class="text-blue-600 hover:text-blue-800"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="text-xs text-blue-600 mt-1">
                    {{ (selectedFile.size / 1024).toFixed(1) }} KB
                  </div>
                </div>

                <!-- Import Button -->
                <button
                  @click="handleImportConfig"
                  :disabled="!selectedFile || importLoading"
                  class="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="importLoading" class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </span>
                  <span v-else class="flex items-center justify-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 7l3 3m0 0l3-3m-3 3V4" />
                    </svg>
                    Import Configuration
                  </span>
                </button>
              </div>

              <!-- Status Messages -->
              <div v-if="exportImportMessage" class="mt-4 p-3 rounded-md" :class="{
                'bg-green-100 border border-green-200 text-green-800': exportImportSuccess,
                'bg-red-100 border border-red-200 text-red-800': !exportImportSuccess
              }">
                <div class="flex items-center">
                  <svg v-if="exportImportSuccess" class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium">{{ exportImportMessage }}</span>
                </div>
              </div>
            </div>

            <!-- Custom Provider Management -->
            <div class="border-t border-gray-200 pt-6">
              <CustomProviderManager />
            </div>

            <!-- Usage Monitor -->
            <div v-if="isConfigured">
              <AIUsageMonitor />
            </div>
          </div>

          <!-- Tools Tab -->
          <div v-if="activeTab === 'tools'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="tool in tools"
                :key="tool.id"
                class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                @click="navigateTo(tool.action || tool.path)"
              >
                <div class="flex items-center mb-2">
                  <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tool.icon" />
                    </svg>
                  </div>
                  <h3 class="font-medium text-gray-900">{{ tool.name }}</h3>
                </div>
                <p class="text-sm text-gray-500">{{ tool.description }}</p>
              </div>
            </div>

            <!-- User Settings Backup/Restore -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">💾 Settings Backup & Restore</h3>

              <!-- Warning Notice -->
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h4 class="text-sm font-medium text-amber-800">⚠️ Comprehensive Data Backup</h4>
                    <p class="mt-1 text-sm text-amber-700">
                      This feature exports/imports <strong>ALL</strong> your data from localStorage, including AI settings, app preferences, saved data, and more.
                      Use this for complete backup/restore or when switching devices.
                    </p>
                    <p class="mt-2 text-xs text-amber-600">
                      💡 <strong>Tip:</strong> For AI settings only, use the export/import feature in the AI Settings tab.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Data Summary -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-medium text-blue-800">📊 Your Current Data</h4>
                  <div class="flex space-x-2">
                    <button
                      @click="addTestData"
                      class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      ➕ Add Test Data
                    </button>
                    <button
                      @click="testLocalStorageAccess"
                      class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      🔍 Debug
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.totalItems }}</div>
                    <div class="text-gray-600 text-xs">Total Items</div>
                  </div>
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.categories.aiSettings }}</div>
                    <div class="text-gray-600 text-xs">AI Settings</div>
                  </div>
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.categories.appSettings }}</div>
                    <div class="text-gray-600 text-xs">App Settings</div>
                  </div>
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.categories.userData }}</div>
                    <div class="text-gray-600 text-xs">User Data</div>
                  </div>
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.categories.apiKeys }}</div>
                    <div class="text-gray-600 text-xs">API Keys</div>
                  </div>
                  <div class="bg-white rounded p-2">
                    <div class="font-medium text-gray-900">{{ dataSummary.categories.other }}</div>
                    <div class="text-gray-600 text-xs">Other Data</div>
                  </div>
                </div>
              </div>

              <!-- Export Section -->
              <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 class="text-sm font-medium text-green-800 mb-3">📤 Export All Settings</h4>
                <p class="text-sm text-green-700 mb-4">
                  Create a complete backup of all your settings, preferences, and data.
                </p>

                <!-- Export Options -->
                <div class="space-y-2 mb-4">
                  <label class="flex items-center">
                    <input
                      v-model="userDataExportOptions.includeAuthTokens"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">
                      Include Authentication Tokens
                      <span class="text-green-600">(⚠️ Security Risk!)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="userDataExportOptions.includeSensitiveData"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">
                      Include API Keys & Sensitive Data
                      <span class="text-green-600">(⚠️ Keep Secure!)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="userDataExportOptions.includeTemporaryData"
                      type="checkbox"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-green-700">Include Temporary & Cache Data</span>
                  </label>
                </div>

                <button
                  @click="handleExportAllSettings"
                  :disabled="userDataExportLoading"
                  class="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="userDataExportLoading" class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </span>
                  <span v-else class="flex items-center justify-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export All Settings
                  </span>
                </button>
              </div>

              <!-- Import Section -->
              <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-purple-800 mb-3">📥 Import Settings</h4>
                <p class="text-sm text-purple-700 mb-4">
                  Restore your settings from a previously exported backup file.
                </p>

                <!-- Import Options -->
                <div class="space-y-2 mb-4">
                  <label class="flex items-center">
                    <input
                      v-model="userDataImportOptions.mergeWithExisting"
                      type="checkbox"
                      class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-purple-700">
                      Merge with existing settings
                      <span class="text-purple-600">(instead of overwriting)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="userDataImportOptions.importAuthTokens"
                      type="checkbox"
                      class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-purple-700">
                      Import Authentication Tokens
                      <span class="text-purple-600">(if included)</span>
                    </span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="userDataImportOptions.importSensitiveData"
                      type="checkbox"
                      class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-purple-700">Import API Keys & Sensitive Data</span>
                  </label>

                  <label class="flex items-center">
                    <input
                      v-model="userDataImportOptions.importTemporaryData"
                      type="checkbox"
                      class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-purple-700">Import Temporary & Cache Data</span>
                  </label>
                </div>

                <!-- File Input -->
                <div class="mb-4">
                  <input
                    ref="userDataFileInput"
                    type="file"
                    accept=".json"
                    @change="handleUserDataFileSelect"
                    class="hidden"
                  />
                  <button
                    @click="$refs.userDataFileInput?.click()"
                    class="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 border-2 border-dashed border-purple-300 hover:border-purple-400"
                  >
                    <span class="flex items-center justify-center">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Choose Settings Backup File
                    </span>
                  </button>
                </div>

                <!-- Selected File Display -->
                <div v-if="selectedUserDataFile" class="mb-4 p-3 bg-purple-100 rounded-md">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span class="text-sm text-purple-800 font-medium">{{ selectedUserDataFile.name }}</span>
                    </div>
                    <button
                      @click="clearSelectedUserDataFile"
                      class="text-purple-600 hover:text-purple-800"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="text-xs text-purple-600 mt-1">
                    {{ (selectedUserDataFile.size / 1024).toFixed(1) }} KB
                  </div>
                </div>

                <!-- Import Button -->
                <button
                  @click="handleImportAllSettings"
                  :disabled="!selectedUserDataFile || userDataImportLoading"
                  class="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="userDataImportLoading" class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </span>
                  <span v-else class="flex items-center justify-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 7l3 3m0 0l3-3m-3 3V4" />
                    </svg>
                    Import Settings
                  </span>
                </button>
              </div>

              <!-- Status Messages -->
              <div v-if="userDataMessage" class="mt-4 p-3 rounded-md" :class="{
                'bg-green-100 border border-green-200 text-green-800': userDataSuccess,
                'bg-red-100 border border-red-200 text-red-800': !userDataSuccess
              }">
                <div class="flex items-center">
                  <svg v-if="userDataSuccess" class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium">{{ userDataMessage }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Shortcuts Tab -->
          <div v-if="activeTab === 'shortcuts'" class="space-y-6">
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="text-lg font-medium text-gray-900 mb-3">Keyboard Shortcuts</h3>
              <div class="space-y-3">
                <!-- Available to all users -->
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">Open Settings</span>
                  <span class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl + ,</span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">Open Image Editor</span>
                  <span class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl + I</span>
                </div>

                <!-- Available to authenticated users -->
                <div v-if="isAuthenticated" class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">Go to AI Assistant</span>
                  <span class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl + A</span>
                </div>

                <!-- Only available to admin users -->
                <div v-if="isAdminUser" class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">Go to Admin</span>
                  <span class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl + Shift + A</span>
                </div>
                <div v-else-if="isAuthenticated" class="flex items-center justify-between opacity-50">
                  <span class="text-sm text-gray-700">Go to Admin (Admin only)</span>
                  <span class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl + Shift + A</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes Tab -->
          <div v-if="activeTab === 'notes'" class="space-y-6">
            <NotesTab />
          </div>

          <!-- About Tab -->
          <div v-if="activeTab === 'about'" class="space-y-6">
            <div class="text-center">
              <div class="mb-4">
                <div class="inline-block p-3 bg-indigo-100 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <h3 class="text-xl font-medium text-gray-900 mb-2">Application Version</h3>
              <p class="text-gray-500 mb-4">v1.0.0</p>
              <p class="text-sm text-gray-600 mb-6">
                Powered by Gemini 2.5 Flash Preview
              </p>
              <div class="flex justify-center space-x-4">
                <button class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                  Check for Updates
                </button>
              </div>
            </div>

            <!-- Data Privacy Information -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">🔒 Data Privacy & Logout</h3>
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-yellow-800 mb-3">
                  🧹 Complete Data Cleanup on Logout
                </h4>
                <p class="text-sm text-yellow-700 mb-4">
                  When you log out, ALL your personal data is automatically cleared from this device to ensure the next user gets a fresh start. This includes:
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-yellow-700">
                  <div class="space-y-1">
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Authentication tokens
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      AI settings & API keys
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Application preferences
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Saved cities & weather data
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Inventory & form data
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Timer & usage statistics
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Notes & cached data
                    </div>
                    <div class="flex items-center">
                      <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      All other user-specific data
                    </div>
                  </div>
                </div>
                <div class="mt-4 p-3 bg-yellow-100 rounded-md">
                  <p class="text-xs text-yellow-800 font-medium">
                    💡 <strong>Privacy First:</strong> This ensures your personal information never remains on shared devices and the next user gets a completely clean experience.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 bg-gray-50">
          <div class="flex justify-end">
            <button
              @click="saveSettings"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Nuxt v4 handles auto-imports for Vue, Nuxt, and project components/composables
import { showAccessDenied } from '~~/utils/accessDenied';
import { AI_PROVIDERS } from '~/types/ai';

// Explicitly import components as they are not being auto-resolved correctly
import NotesTab from '~/components/tools/NotesTab.vue';
import AIUsageMonitor from '~/components/tools/AIUsageMonitor.vue';
import CustomProviderManager from '~/components/tools/CustomProviderManager.vue';

// Explicitly import composables from subdirectories as they are not auto-imported by default
import useUserRole from '~/composables/auth/useUserRole';
import { useAIConfig } from '~/composables/ai/useAIConfig';
import { useUserDataManager } from '~/composables/utils/useUserDataManager';

// Props for v-model binding
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:isOpen']);

// Composables like useUserRole, useAIConfig, useUserDataManager are auto-imported in Nuxt v4
// if they are in the app/composables directory.

const router = useRouter();
const isOpen = computed({
  get: () => props.isOpen,
  set: (value) => emit('update:isOpen', value)
});
const activeTab = ref('tools');

// Authentication state - use useAuth() composable instead of checking cookie directly
const { user, isLoggedIn } = useAuth();
const isAuthenticated = computed(() => isLoggedIn.value);

// Get user role information
const { isAdmin, isSubContractor, isManager, hasRolePrivilege, ROLES } = useUserRole();
const isAdminUser = computed(() => isAdmin());
const isSubContractorUser = computed(() => isSubContractor());
const isManagerUser = computed(() => isManager());
const canAccessAdmin = computed(() => hasRolePrivilege(ROLES.ADMIN));

// Define tabs
const tabs = [
  { id: 'tools', name: 'Tools' },
  { id: 'settings', name: 'Settings' },
  { id: 'ai', name: 'AI Settings' },
  { id: 'notes', name: 'Notes' },
  { id: 'shortcuts', name: 'Shortcuts' },
  { id: 'about', name: 'About' }
];

// AI Configuration
const {
  aiConfig,
  currentProvider,
  currentModel,
  availableModels,
  isConfigured,
  providers,
  updateProvider,
  updateModel,
  updateApiKey,
  validateApiKey,
  isLoading: aiLoading,
  error: aiError,
  getCurrentApiKey,
  hasApiKeyForProvider,
  hasApiKeyForModel,
  getApiKeyForModel,
  getSavedProviders,
  getSavedModels,
  getSavedModelsForProvider,
  getActiveCustomProviders,
  exportToFile,
  importFromFile
} = useAIConfig();

// User Data Manager
const {
  exportToFile: exportUserDataToFile,
  importFromFile: importUserDataFromFile,
  getDataSummary
} = useUserDataManager();

// AI Settings State
const showApiKey = ref(false);
const testingApiKey = ref(false);
const apiKeyValid = ref(false);
const tempApiKey = ref('');

// Export/Import State
const exportLoading = ref(false);
const importLoading = ref(false);
const selectedFile = ref(null);
const exportImportMessage = ref('');
const exportImportSuccess = ref(false);

// Export/Import Options
const exportOptions = ref({
  includeApiKeys: false,
  includeUsageStats: false,
  includeCustomProviders: true
});

const importOptions = ref({
  mergeWithExisting: false,
  importApiKeys: false,
  importUsageStats: false,
  importCustomProviders: true
});

// User Data Export/Import State
const userDataExportLoading = ref(false);
const userDataImportLoading = ref(false);
const selectedUserDataFile = ref(null);
const userDataMessage = ref('');
const userDataSuccess = ref(false);

// User Data Export/Import Options
const userDataExportOptions = ref({
  includeAuthTokens: false,
  includeSensitiveData: false,
  includeTemporaryData: false
});

const userDataImportOptions = ref({
  mergeWithExisting: true,
  importAuthTokens: false,
  importSensitiveData: false,
  importTemporaryData: false
});

// Data Summary (computed)
const dataSummary = computed(() => {
  try {
    return getDataSummary();
  } catch (error) {
    console.error('Error getting data summary:', error);
    return {
      totalItems: 0,
      categories: {
        authentication: 0,
        aiSettings: 0,
        appSettings: 0,
        apiKeys: 0,
        userData: 0,
        temporaryData: 0,
        other: 0
      }
    };
  }
});

// Default settings
const defaultSettings = {
  theme: 'light',
  fontSize: 'medium',
  notifications: true,
  sounds: false,
  aiModel: 'gemini-2.5-flash',
  visibleTools: {
    calculator: true,
    pdfTools: true,
    taskManager: true,
    todoList: true,
    weather: true,
    translator: true,
    notes: true
  }
};

// Helper function to ensure settings structure is valid
const ensureValidSettings = (settingsObj) => {
  const result = { ...settingsObj };

  // Ensure visibleTools exists
  if (!result.visibleTools) {
    result.visibleTools = { ...defaultSettings.visibleTools };
  } else {
    // Ensure all tool properties exist
    if (result.visibleTools.calculator === undefined) result.visibleTools.calculator = true;
    if (result.visibleTools.news === undefined) result.visibleTools.news = true;
    if (result.visibleTools.pdfTools === undefined) result.visibleTools.pdfTools = true;
    if (result.visibleTools.taskManager === undefined) result.visibleTools.taskManager = true;
    if (result.visibleTools.todoList === undefined) result.visibleTools.todoList = true;
    if (result.visibleTools.weather === undefined) result.visibleTools.weather = true;
    if (result.visibleTools.translator === undefined) result.visibleTools.translator = true;
    if (result.visibleTools.imageEditor === undefined) result.visibleTools.imageEditor = true;
    if (result.visibleTools.notes === undefined) result.visibleTools.notes = true;
  }

  return result;
};

// Settings state
const settings = ref(ensureValidSettings({...defaultSettings}));

// Tools list with role-based access control
const allTools = [
  {
    id: 'ai',
    name: 'AI Assistant',
    description: 'Ask questions, get guidance, and create professional documents',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    path: '/ai/documents',
    requiredRole: 'authenticated' // Only available to authenticated users
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform quick calculations',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    action: 'openCalculator',
    requiredRole: null // Available to all users
  },
  {
    id: 'pdf-tools',
    name: 'PDF Tools',
    description: 'Professional PDF tools - compress, merge, convert, split (ILovePDF)',
    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    action: 'openPdfTools',
    requiredRole: null // Available to all users
  },

  {
    id: 'task-manager',
    name: 'Task Manager',
    description: 'Manage your tasks and to-dos with priorities and due dates',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    action: 'openTaskManager',
    requiredRole: 'authenticated' // Available to authenticated users only
  },
  {
    id: 'todo-list',
    name: 'Todo List',
    description: 'Keep track of your daily todos with a simple checklist',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    action: 'openTodoList',
    requiredRole: 'authenticated' // Available to authenticated users only
  },
  {
    id: 'weather',
    name: 'Weather Forecast',
    description: 'Check current weather and forecast for any city',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    action: 'openWeather',
    requiredRole: null // Available to all users
  },
  {
    id: 'translator',
    name: 'Language Translator',
    description: 'Translate text between multiple languages',
    icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
    action: 'openTranslator',
    requiredRole: null // Available to all users
  },
  {
    id: 'text-to-image',
    name: 'AI Image Generator',
    description: 'Generate images from text using AI (FLUX.1-dev)',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    action: 'openTextToImage',
    requiredRole: null // Available to all users
  },

  {
    id: 'notes',
    name: 'Notes',
    description: 'Create and manage your personal notes',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    action: 'openNotes',
    requiredRole: 'authenticated' // Only available to authenticated users
  },
  {
    id: 'admin',
    name: 'Admin Panel',
    description: 'Manage system settings and users',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    path: '/admin',
    requiredRole: 'admin' // Only available to admin users
  }
];

// Filter tools based on user role and visibility preferences
const tools = computed(() => {
  return allTools.filter(tool => {
    // If tool requires authentication, check if user is authenticated
    if (tool.requiredRole === 'authenticated' && !isAuthenticated.value) return false;

    // Use the role hierarchy to check permissions
    if (tool.requiredRole === 'admin' && !canAccessAdmin.value) return false;
    if (tool.requiredRole === 'manager' && !hasRolePrivilege(ROLES.MANAGER)) return false;
    if (tool.requiredRole === 'subcontractor' && !hasRolePrivilege(ROLES.SUB_CONTRACTOR)) return false;

    // Check user's visibility preferences (with safety checks)
    if (tool.id === 'calculator' && settings.value.visibleTools && settings.value.visibleTools.calculator === false) return false;
    if (tool.id === 'news' && settings.value.visibleTools && settings.value.visibleTools.news === false) return false;
    if (tool.id === 'pdf-tools' && settings.value.visibleTools && settings.value.visibleTools.pdfTools === false) return false;
    if (tool.id === 'task-manager' && settings.value.visibleTools && settings.value.visibleTools.taskManager === false) return false;
    if (tool.id === 'todo-list' && settings.value.visibleTools && settings.value.visibleTools.todoList === false) return false;
    if (tool.id === 'weather' && settings.value.visibleTools && settings.value.visibleTools.weather === false) return false;
    if (tool.id === 'translator' && settings.value.visibleTools && settings.value.visibleTools.translator === false) return false;
    if (tool.id === 'image-editor' && settings.value.visibleTools && settings.value.visibleTools.imageEditor === false) return false;
    if (tool.id === 'notes' && settings.value.visibleTools && settings.value.visibleTools.notes === false) return false;
    if (tool.id === 'chat' && settings.value.visibleTools && settings.value.visibleTools.chat === false) return false;

    return true;
  });
});

// Open/close methods
const openPopup = () => {
  isOpen.value = true;
  // Load saved settings if available
  const savedSettings = localStorage.getItem('app_settings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      settings.value = ensureValidSettings(parsedSettings);
    } catch (error) {
      console.error('Error parsing saved settings:', error);
      // Reset to default settings if there's an error
      settings.value = ensureValidSettings({...defaultSettings});
    }
  }
};

const closePopup = () => {
  isOpen.value = false;
};

// AI Settings Methods
const handleProviderChange = (providerId) => {
  console.log('🔄 Provider changed to:', providerId)
  updateProvider(providerId);

  // Auto-populate API key if available for this provider
  const savedApiKey = getCurrentApiKey();
  if (savedApiKey) {
    console.log('🔑 Auto-populating saved API key for provider:', providerId)
    tempApiKey.value = savedApiKey;
    apiKeyValid.value = true; // Assume saved keys are valid
  } else {
    console.log('🔑 No saved API key for provider:', providerId)
    tempApiKey.value = '';
    apiKeyValid.value = false;
  }
};

const handleModelChange = (modelId) => {
  console.log('🔄 Model changed to:', modelId)
  updateModel(modelId);

  // Auto-populate API key if available for this specific model
  const savedApiKey = getCurrentApiKey();
  if (savedApiKey) {
    console.log('🔑 Auto-populating saved API key for model:', modelId)
    tempApiKey.value = savedApiKey;
    apiKeyValid.value = true; // Assume saved keys are valid
  } else {
    console.log('🔑 No saved API key for model:', modelId)
    tempApiKey.value = '';
    apiKeyValid.value = false;
  }
};

const handleApiKeyChange = (apiKey) => {
  tempApiKey.value = apiKey;
  updateApiKey(apiKey);
  apiKeyValid.value = false;
};

const testApiKey = async () => {
  console.log('🔑 Testing API key...')
  console.log('📋 Current settings:', {
    provider: currentProvider.value?.id,
    model: currentModel.value?.id,
    hasApiKey: !!tempApiKey.value?.trim()
  })

  if (!tempApiKey.value.trim()) {
    console.error('❌ No API key provided')
    return;
  }

  testingApiKey.value = true;
  try {
    console.log('🚀 Starting API key validation...')
    const isValid = await validateApiKey(tempApiKey.value.trim());

    console.log(`${isValid ? '✅' : '❌'} API key test result: ${isValid}`)

    apiKeyValid.value = isValid;
    if (isValid) {
      console.log('✅ API key valid, updating configuration...')
      updateApiKey(tempApiKey.value.trim());
    } else {
      console.log('❌ API key invalid')
    }
  } catch (error) {
    console.error('❌ API key test failed:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      data: error.data,
      statusCode: error.statusCode
    });
    apiKeyValid.value = false;
  } finally {
    testingApiKey.value = false;
  }
};

const toggleApiKeyVisibility = () => {
  showApiKey.value = !showApiKey.value;
};

// Export/Import Methods
const showMessage = (message, success = true) => {
  exportImportMessage.value = message;
  exportImportSuccess.value = success;

  // Clear message after 5 seconds
  setTimeout(() => {
    exportImportMessage.value = '';
  }, 5000);
};

const handleExportConfig = async () => {
  exportLoading.value = true;
  try {
    const result = await exportToFile(exportOptions.value);
    if (result.success) {
      showMessage(result.message, true);
    } else {
      showMessage(result.message, false);
    }
  } catch (error) {
    console.error('Export error:', error);
    showMessage('Failed to export configuration', false);
  } finally {
    exportLoading.value = false;
  }
};

const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      selectedFile.value = file;
      exportImportMessage.value = '';
    } else {
      showMessage('Please select a valid JSON file', false);
      event.target.value = '';
    }
  }
};

const clearSelectedFile = () => {
  selectedFile.value = null;
  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) {
    fileInput.value = '';
  }
};

const handleImportConfig = async () => {
  if (!selectedFile.value) {
    showMessage('Please select a file to import', false);
    return;
  }

  importLoading.value = true;
  try {
    const result = await importFromFile(selectedFile.value, importOptions.value);
    if (result.success) {
      showMessage(result.message, true);
      // Clear the selected file after successful import
      clearSelectedFile();

      // Refresh the API key display if needed
      const savedApiKey = getCurrentApiKey();
      if (savedApiKey) {
        tempApiKey.value = savedApiKey;
        apiKeyValid.value = true;
      }
    } else {
      showMessage(result.message, false);
    }
  } catch (error) {
    console.error('Import error:', error);
    showMessage('Failed to import configuration', false);
  } finally {
    importLoading.value = false;
  }
};

// User Data Export/Import Methods
const showUserDataMessage = (message, success = true) => {
  userDataMessage.value = message;
  userDataSuccess.value = success;

  // Clear message after 5 seconds
  setTimeout(() => {
    userDataMessage.value = '';
  }, 5000);
};

const handleExportAllSettings = async () => {
  userDataExportLoading.value = true;
  try {
    // Add debug flag to see what's being exported
    const exportOptionsWithDebug = {
      ...userDataExportOptions.value,
      debug: true
    };

    console.log('🚀 Starting export with options:', exportOptionsWithDebug);
    const result = await exportUserDataToFile(exportOptionsWithDebug);

    if (result.success) {
      showUserDataMessage(result.message, true);
    } else {
      showUserDataMessage(result.message, false);
    }
  } catch (error) {
    console.error('Export error:', error);
    showUserDataMessage('Failed to export settings', false);
  } finally {
    userDataExportLoading.value = false;
  }
};

const handleUserDataFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      selectedUserDataFile.value = file;
      userDataMessage.value = '';
    } else {
      showUserDataMessage('Please select a valid JSON file', false);
      event.target.value = '';
    }
  }
};

const clearSelectedUserDataFile = () => {
  selectedUserDataFile.value = null;
  const fileInput = document.querySelector('input[ref="userDataFileInput"]');
  if (fileInput) {
    fileInput.value = '';
  }
};

const handleImportAllSettings = async () => {
  if (!selectedUserDataFile.value) {
    showUserDataMessage('Please select a file to import', false);
    return;
  }

  userDataImportLoading.value = true;
  try {
    const result = await importUserDataFromFile(selectedUserDataFile.value, userDataImportOptions.value);
    if (result.success) {
      showUserDataMessage(result.message, true);
      // Clear the selected file after successful import
      clearSelectedUserDataFile();

      // Refresh the data summary
      // The computed property will automatically update

      // Refresh the AI settings display if needed
      const savedApiKey = getCurrentApiKey();
      if (savedApiKey) {
        tempApiKey.value = savedApiKey;
        apiKeyValid.value = true;
      }
    } else {
      showUserDataMessage(result.message, false);
    }
  } catch (error) {
    console.error('Import error:', error);
    showUserDataMessage('Failed to import settings', false);
  } finally {
    userDataImportLoading.value = false;
  }
};

// Debug function to test localStorage access
const testLocalStorageAccess = () => {
  console.log('🔍 Testing localStorage access...');

  if (import.meta.server) {
    console.log('❌ Window is undefined (SSR context)');
    return;
  }

  if (!window.localStorage) {
    console.log('❌ localStorage is not available');
    return;
  }

  try {
    // Test basic localStorage access
    console.log('📊 localStorage.length:', window.localStorage.length);

    // List all keys
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    console.log('🔑 All localStorage keys:', keys);
    console.log('📝 Total keys found:', keys.length);

    // Test the composable functions
    const { getAllUserDataKeys, getAllUserData } = useUserDataManager();
    const composableKeys = getAllUserDataKeys();
    const composableData = getAllUserData();

    console.log('🔧 Composable keys:', composableKeys);
    console.log('🔧 Composable data:', composableData);
    console.log('🔧 Composable keys count:', composableKeys.length);
    console.log('🔧 Composable data keys count:', Object.keys(composableData).length);

    // Add a test key to verify write access
    const testKey = 'test_export_' + Date.now();
    window.localStorage.setItem(testKey, JSON.stringify({ test: true, timestamp: new Date().toISOString() }));
    console.log('✅ Test key added:', testKey);

    // Verify it can be read back
    const testValue = window.localStorage.getItem(testKey);
    console.log('✅ Test key value:', testValue);

    showUserDataMessage(`Debug complete! Found ${keys.length} localStorage keys. Check console for details.`, true);

  } catch (error) {
    console.error('❌ Error testing localStorage:', error);
    showUserDataMessage('Error testing localStorage access', false);
  }
};

// Function to add test data to localStorage
const addTestData = () => {
  console.log('➕ Adding test data to localStorage...');

  if (import.meta.server || !window.localStorage) {
    showUserDataMessage('localStorage not available', false);
    return;
  }

  try {
    const timestamp = Date.now();

    // Add various types of test data
    const testData = {
      // Authentication data
      'test_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      'test_refreshToken': 'refresh_token_test_value',
      'test_user': JSON.stringify({ id: 1, name: 'Test User', email: 'test@example.com' }),

      // AI Settings
      'ai_configuration': JSON.stringify({ provider: 'test', model: 'test-model' }),
      'ai_configuration_extended': JSON.stringify({ currentProvider: 'test', currentModel: 'test-model', providerKeys: {} }),
      'ai_usage_stats': JSON.stringify([{ timestamp: new Date().toISOString(), tokens: 100 }]),

      // App Settings
      'app_settings': JSON.stringify({ theme: 'dark', fontSize: 'medium', notifications: true }),
      'user_settings': JSON.stringify({ language: 'en', timezone: 'UTC' }),

      // API Keys
      'test_api_key': 'sk-test-api-key-12345',
      'openai_api_key': 'sk-openai-test-key',
      'google_credentials': JSON.stringify({ apiKey: 'test-google-key', projectId: 'test-project' }),

      // User Data
      'weather_saved_cities': JSON.stringify(['New York', 'London', 'Tokyo']),
      'user_notes': JSON.stringify([{ id: 1, title: 'Test Note', content: 'This is a test note' }]),
      'inventory_data': JSON.stringify({ items: [{ id: 1, name: 'Test Item', quantity: 10 }] }),
      'timer_state': JSON.stringify({ minutes: 25, seconds: 0, active: false }),

      // Temporary Data
      'temp_form_data': JSON.stringify({ field1: 'value1', field2: 'value2' }),
      'cache_user_preferences': JSON.stringify({ lastLogin: new Date().toISOString() }),
      'auto_save_document': JSON.stringify({ content: 'Auto-saved content', timestamp: new Date().toISOString() }),

      // Other Data
      'custom_setting_1': 'simple string value',
      'custom_setting_2': JSON.stringify({ complex: { nested: { data: true } } }),
      'last_activity': new Date().toISOString(),

      // Add timestamp to all keys for uniqueness
      [`test_data_timestamp_${timestamp}`]: timestamp.toString()
    };

    // Add all test data to localStorage
    Object.entries(testData).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });

    console.log('✅ Test data added successfully');
    console.log('📊 Added keys:', Object.keys(testData));

    showUserDataMessage(`Added ${Object.keys(testData).length} test items to localStorage`, true);

  } catch (error) {
    console.error('❌ Error adding test data:', error);
    showUserDataMessage('Error adding test data', false);
  }
};

// Save settings
const saveSettings = () => {
  // Ensure settings are valid before saving
  const validSettings = ensureValidSettings(settings.value);
  settings.value = validSettings;

  // Save to localStorage
  localStorage.setItem('app_settings', JSON.stringify(validSettings));

  // Apply settings
  applySettings();
  closePopup();
};

// Apply settings
const applySettings = () => {
  // Apply theme
  document.documentElement.classList.remove('light-theme', 'dark-theme');
  if (settings.value.theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.add('light-theme');
  }

  // Apply font size
  document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
  if (settings.value.fontSize === 'small') {
    document.documentElement.classList.add('text-sm');
  } else if (settings.value.fontSize === 'large') {
    document.documentElement.classList.add('text-lg');
  } else {
    document.documentElement.classList.add('text-base');
  }
};

// Navigation with role-based access control
const navigateTo = (pathOrAction) => {
  // Check if it's a special action
  if (pathOrAction === 'openCalculator') {
    window.dispatchEvent(new CustomEvent('open-calculator'));
    // Keep the settings modal open in the background
    return;
  }

  if (pathOrAction === 'openPdfTools') {
    window.dispatchEvent(new CustomEvent('open-pdf-tools'));
    // Keep the settings modal open in the background
    return;
  }



  if (pathOrAction === 'openTaskManager') {
    window.dispatchEvent(new CustomEvent('open-task-manager'));
    // Keep the settings modal open in the background
    return;
  }

  if (pathOrAction === 'openTodoList') {
    window.dispatchEvent(new CustomEvent('open-todo-list'));
    // Keep the settings modal open in the background
    return;
  }

  if (pathOrAction === 'openTextToImage') {
    window.dispatchEvent(new CustomEvent('open-text-to-image'));
    // Keep the settings modal open in the background
    return;
  }

  if (pathOrAction === 'openWeather') {
    window.dispatchEvent(new CustomEvent('open-weather'));
    // Keep the settings modal open in the background
    return;
  }

  if (pathOrAction === 'openTranslator') {
    window.dispatchEvent(new CustomEvent('open-translator'));
    // Keep the settings modal open in the background
    return;
  }



  if (pathOrAction === 'openNotes') {
    // Switch to the Notes tab
    activeTab.value = 'notes';
    return;
  }

  if (pathOrAction === 'openChat') {
    window.dispatchEvent(new CustomEvent('open-chat'));
    // Close the settings modal when opening the Chat
    closePopup();
    return;
  }

  // Check if user has permission to access admin page
  if (pathOrAction === '/admin' && !canAccessAdmin.value) {
    // Show standardized access denied message
    showAccessDenied('Access denied: Admin privileges required');
    return;
  }

  // Navigate to the requested page
  router.push(pathOrAction);
  closePopup();
};

// Keyboard shortcut handler
const handleKeyDown = (event) => {
  // Ctrl + , (comma) to open settings
  if (event.ctrlKey && event.key === ',') {
    event.preventDefault();
    openPopup();
  }

  // Add other global shortcuts here
  if (event.ctrlKey && event.key === 'a') {
    event.preventDefault();
    router.push('/ai/documents');
  }

  if (event.ctrlKey && event.shiftKey && event.key === 'A') {
    event.preventDefault();
    router.push('/admin');
  }
};

// Handle set-settings-tab event
const handleSetSettingsTab = (event) => {
  if (event.detail && tabs.some(tab => tab.id === event.detail)) {
    activeTab.value = event.detail;
  }
};

// Handle opening global settings from external components
const handleOpenGlobalSettings = (event) => {
  if (event.detail?.activeTab) {
    activeTab.value = event.detail.activeTab;
  }
  isOpen.value = true;
};

// Setup event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('set-settings-tab', handleSetSettingsTab);
  window.addEventListener('open-global-settings', handleOpenGlobalSettings);

  // Apply any saved settings on mount
  const savedSettings = localStorage.getItem('app_settings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      settings.value = ensureValidSettings(parsedSettings);
      applySettings();
    } catch (error) {
      console.error('Error parsing saved settings on mount:', error);
      // Reset to default settings if there's an error
      settings.value = ensureValidSettings({...defaultSettings});
      applySettings();
    }
  }

  // Initialize AI settings - auto-populate API key if available
  nextTick(() => {
    const savedApiKey = getCurrentApiKey();
    if (savedApiKey) {
      console.log('🔑 Auto-populating saved API key on mount')
      tempApiKey.value = savedApiKey;
      apiKeyValid.value = true;
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('set-settings-tab', handleSetSettingsTab);
  window.removeEventListener('open-global-settings', handleOpenGlobalSettings);
});

// Expose methods for external use
defineExpose({
  openPopup,
  closePopup
});
</script>
