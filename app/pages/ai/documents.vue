<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <!-- Main Container -->
    <div class="container mx-auto px-4 pt-6 pb-8 max-w-7xl">
      <!-- Page Header -->
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <span class="mr-3 text-4xl">🤖</span>
          AI Assistant
        </h1>
      </div>

      <!-- Mode Selector -->
      <div class="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-gray-800">AI Assistant Mode</h3>
        </div>

        <div class="grid md:grid-cols-3 gap-4">
          <!-- Normal Chat Mode -->
          <label class="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all duration-200"
                 :class="aiMode === 'normal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'">
            <input type="radio"
                   v-model="aiMode"
                   value="normal"
                   @change="handleModeChange"
                   class="mt-1 mr-3 text-blue-600 focus:ring-blue-500">
            <div class="flex-1">
              <div class="flex items-center mb-1">
                <span class="text-xl mr-2">💬</span>
                <span class="font-semibold text-gray-800">Normal Chat</span>
              </div>
              <p class="text-sm text-gray-600">
                General conversation, questions, explanations
              </p>
            </div>
          </label>

          <!-- Document Generation Mode -->
          <label class="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all duration-200"
                 :class="aiMode === 'document' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'">
            <input type="radio"
                   v-model="aiMode"
                   value="document"
                   @change="handleModeChange"
                   class="mt-1 mr-3 text-green-600 focus:ring-green-500">
            <div class="flex-1">
              <div class="flex items-center mb-1">
                <span class="text-xl mr-2">📄</span>
                <span class="font-semibold text-gray-800">Document Generation</span>
              </div>
              <p class="text-sm text-gray-600">
                Create quotations, invoices, reports, contracts
              </p>
            </div>
          </label>

          <!-- AI Conversation Mode -->
          <label class="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all duration-200"
                 :class="aiMode === 'conversation' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'">
            <input type="radio"
                   v-model="aiMode"
                   value="conversation"
                   @change="handleModeChange"
                   class="mt-1 mr-3 text-purple-600 focus:ring-purple-500">
            <div class="flex-1">
              <div class="flex items-center mb-1">
                <span class="text-xl mr-2">🤖</span>
                <span class="font-semibold text-gray-800">AI Conversation</span>
              </div>
              <p class="text-sm text-gray-600">
                Watch two AI models have a conversation
              </p>
            </div>
          </label>
        </div>

        <!-- Mode Description -->
        <div class="mt-3 p-3 rounded-lg text-sm"
             :class="aiMode === 'normal' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                     aiMode === 'document' ? 'bg-green-50 border border-green-200 text-green-800' :
                     'bg-purple-50 border border-purple-200 text-purple-800'">
          <span class="font-medium">
            {{ aiMode === 'normal' ? '💬 Normal Chat Mode:' :
               aiMode === 'document' ? '📄 Document Generation Mode:' :
               '🤖 AI Conversation Mode:' }}
          </span>
          {{ aiMode === 'normal' ? 'Ask questions, get explanations, have conversations' :
             aiMode === 'document' ? 'Provide requirements and get professional documents with download options' :
             'Watch two AI models have a conversation based on your prompt' }}
        </div>
      </div>

      <!-- Main AI Chat Interface (Normal & Document modes) -->
      <div v-if="aiMode !== 'conversation'" class="bg-white rounded-lg shadow-xl">
        <!-- Chat Header -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg flex justify-between items-center">
          <div>
            <h2 class="text-xl font-bold flex items-center">
              <span class="mr-3">🤖</span>
              AI Assistant
              <span class="ml-3 text-xs bg-white/20 px-2 py-1 rounded-full">
                🧠 Enhanced Memory
              </span>
            </h2>
            <p class="mt-1 opacity-90 text-sm">
              Ask me anything - I remember our conversations and learn from them!
            </p>
          </div>
          <button 
            @click="window.dispatchEvent(new CustomEvent('open-news'))"
            class="bg-white/20 hover:bg-white/30 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all flex items-center"
          >
            <span class="mr-1">📰</span>
            Latest News
          </button>
        </div>

        <!-- Chat Messages -->
        <div class="p-6">
          <div class="messages mb-6 max-h-96 overflow-y-auto" ref="messagesContainer">
            <div v-if="conversation.length === 0" class="text-center text-gray-500 py-8">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p class="text-base font-medium">Start a conversation</p>
            </div>

            <div v-else class="space-y-6">
              <div v-for="message in conversation" :key="message.id" class="message-container">
                <!-- User Message Bubble -->
                <div v-if="message.type === 'user'" class="flex items-start mb-4">
                  <div class="flex-shrink-0 bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                    You
                  </div>
                  <div class="ml-3 bg-blue-50 p-4 rounded-lg rounded-tl-none max-w-[85%]">
                    <p class="text-gray-800">{{ message.content }}</p>
                    <span class="text-xs text-gray-500 mt-1 block">{{ formatTime(message.timestamp || Date.now()) }}</span>
                  </div>
                </div>

                <!-- AI Message Bubble -->
                <div v-else class="flex items-start mb-4 flex-row-reverse">
                  <div class="flex-shrink-0 bg-green-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                    AI
                  </div>
                  <div class="mr-3 bg-white border border-gray-200 p-4 rounded-lg rounded-tr-none max-w-[85%] relative group">
                    <!-- Streaming indicator -->
                    <div v-if="message.isStreaming" class="absolute top-2 right-2">
                      <div class="flex space-x-1 bg-green-100 px-2 py-1 rounded-full shadow-sm">
                        <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                        <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse" style="animation-delay: 0.4s"></div>
                        <span class="text-xs text-green-700 font-medium ml-1">Streaming...</span>
                      </div>
                    </div>

                    <!-- Message content -->
                    <div class="text-gray-800 whitespace-pre-wrap">
                      <span v-html="formatMessageContent(message.content)"></span>
                      <!-- Blinking cursor for streaming messages -->
                      <span v-if="message.isStreaming" class="inline-block w-2 h-4 bg-green-500 ml-0.5 animate-blink"></span>
                    </div>
                    <span class="text-xs text-gray-500 mt-1 block">{{ formatTime(message.timestamp || Date.now()) }}</span>

                    <!-- Copy button (only show for completed messages) -->
                    <button
                      v-if="!message.isStreaming"
                      @click="copyToClipboard(message.content)"
                      class="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy to clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>

                    <!-- AI Suggestions -->
                    <div v-if="message.suggestions && message.suggestions.length > 0" class="mt-3 flex flex-wrap gap-2">
                      <button v-for="suggestion in message.suggestions" :key="suggestion"
                              @click="useExample(suggestion)"
                              class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors">
                        {{ suggestion }}
                      </button>
                    </div>

                    <!-- AI Action Buttons -->
                    <div v-if="message.actionButtons && message.actionButtons.length > 0" class="mt-3 flex flex-wrap gap-2">
                      <button v-for="button in message.actionButtons" :key="button.label"
                              @click="handleActionButton(button.action, button.data)"
                              :disabled="downloadingButtons.has(button.label)"
                              :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center',
                                     downloadingButtons.has(button.label) ? 'opacity-75 cursor-not-allowed' : '',
                                     button.type === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400' :
                                     button.type === 'success' ? 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400' :
                                     'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100']">
                        <!-- Loading spinner -->
                        <svg v-if="downloadingButtons.has(button.label)"
                             class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                             xmlns="http://www.w3.org/2000/svg"
                             fill="none"
                             viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <!-- Button content -->
                        <span>{{ button.icon }} {{ downloadingButtons.has(button.label) ? 'Generating...' : button.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Progress -->
          <div v-if="currentJob" class="mb-6">
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">AI Processing</span>
                <span class="text-sm text-gray-500">{{ currentJob.progress }}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                     :style="{ width: currentJob.progress + '%' }"></div>
              </div>
              <div class="flex items-center text-sm text-gray-600">
                <span class="animate-pulse mr-2">🤖</span>
                {{ currentJob.message }}
              </div>
            </div>
          </div>

          <!-- Download Options -->
          <div v-if="documentReady" class="mb-6">
            <div class="bg-green-50 border border-green-200 rounded-lg p-6">
              <div class="flex items-center mb-4">
                <span class="text-2xl mr-3">🎉</span>
                <div>
                  <h3 class="text-lg font-bold text-green-800">Document Ready!</h3>
                  <p class="text-green-600">{{ documentData?.title || 'Your document has been created successfully' }}</p>
                </div>
              </div>

              <div class="grid md:grid-cols-3 gap-4">
                <div v-for="format in availableFormats" :key="format.type"
                     class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <button @click="downloadFormat(format.type)"
                          class="w-full flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 mb-3">
                    <span class="text-xl mr-2">{{ format.icon }}</span>
                    {{ format.label }}
                  </button>
                  <div class="text-xs text-gray-500">
                    {{ formatFileSize(format.size) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Input Section -->
          <div class="border-t pt-6">
            <div class="flex flex-col space-y-4">
              <textarea v-model="userInput"
                        :disabled="isProcessing || isStreaming"
                        :placeholder="isStreaming ? 'AI is responding...' :
                          aiMode === 'document'
                            ? 'Describe the document you need (e.g., quotation for 100 LED lights @ ₹1400 each)...'
                            : 'Ask me anything! I\'m here to help with questions, guidance, and creating documents when needed...'"
                        class="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        @keydown.ctrl.enter="sendToAI"></textarea>

              <div class="flex justify-between items-center">
                <div class="text-sm text-gray-500">
                  {{ isStreaming ?
                      (isStreamingSupported() ? 'Streaming response...' : 'Processing response...') :
                      'Press Ctrl+Enter to send' }}
                </div>
                <button @click="sendToAI"
                        :disabled="isProcessing || isStreaming || !userInput.trim()"
                        class="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center">
                  <span v-if="!isProcessing && !isStreaming" class="mr-2">🤖</span>
                  <span v-else-if="isStreaming" class="mr-2">
                    <div class="flex space-x-1">
                      <div class="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      <div class="w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.2s"></div>
                      <div class="w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                  </span>
                  <span v-else class="mr-2 animate-spin">⚡</span>
                  {{ isStreaming ? 'AI is responding...' : isProcessing ? 'AI is thinking...' : 'Ask AI' }}
                </button>
              </div>
            </div>
          </div>

          <!-- AI Provider Footer -->
          <div class="border-t border-gray-200 px-4 py-2 bg-gray-50 text-center">
            <div class="flex items-center justify-center text-xs text-gray-500">
              <span class="mr-2">🤖</span>
              <span>{{ aiDisplayInfo }}</span>
              <button
                v-if="!isConfigured"
                @click="openAISettings"
                class="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                Configure AI
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Conversation Interface -->
      <div v-if="aiMode === 'conversation'" class="bg-white rounded-lg shadow-xl">
        <!-- Conversation Header -->
        <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg">
          <h2 class="text-xl font-bold flex items-center">
            <span class="mr-3">🤖</span>
            AI Model Conversation
          </h2>
          <p class="mt-1 opacity-90 text-sm">
            Watch two AI models have a conversation based on your prompt
          </p>
        </div>

        <!-- AI Model Selection -->
        <div class="p-6 border-b border-gray-200">
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <!-- Model A Selection -->
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 class="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                <span class="mr-2">🤖</span>
                AI Model A
              </h3>

              <!-- Provider Selection -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  v-model="selectedProviderA"
                  :disabled="isConversationActive"
                  @change="onProviderAChange"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select Provider</option>
                  <option value="google">Google Gemini</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="groq">Groq Cloud</option>
                </select>
              </div>

              <!-- Model Selection -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  v-model="selectedModelA"
                  :disabled="isConversationActive || !selectedProviderA"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select Model</option>
                  <option v-for="model in getModelsForProvider(selectedProviderA)" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </option>
                </select>
              </div>

              <!-- API Key Input -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  v-model="apiKeyA"
                  type="password"
                  :disabled="isConversationActive"
                  placeholder="Enter API key for this provider"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                >
              </div>
            </div>

            <!-- Model B Selection -->
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 class="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                <span class="mr-2">🤖</span>
                AI Model B
              </h3>

              <!-- Provider Selection -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  v-model="selectedProviderB"
                  :disabled="isConversationActive"
                  @change="onProviderBChange"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select Provider</option>
                  <option value="google">Google Gemini</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="groq">Groq Cloud</option>
                </select>
              </div>

              <!-- Model Selection -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  v-model="selectedModelB"
                  :disabled="isConversationActive || !selectedProviderB"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select Model</option>
                  <option v-for="model in getModelsForProvider(selectedProviderB)" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </option>
                </select>
              </div>

              <!-- API Key Input -->
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  v-model="apiKeyB"
                  type="password"
                  :disabled="isConversationActive"
                  placeholder="Enter API key for this provider"
                  class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
              </div>
            </div>
          </div>

          <!-- Conversation Prompt -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Conversation Topic</label>
            <textarea
              v-model="conversationPrompt"
              :disabled="isConversationActive"
              placeholder="Enter a topic or question for the AI models to discuss..."
              rows="3"
              class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
            ></textarea>
          </div>

          <!-- Control Buttons -->
          <div class="flex flex-wrap gap-3">
            <button
              @click="startConversation"
              :disabled="!canStartConversation || isConversationActive"
              class="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {{ isConversationActive ? '🔄 Running...' : '🚀 Start Conversation' }}
            </button>

            <button
              @click="stopConversation"
              :disabled="!isConversationActive"
              class="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              ⏹️ Stop
            </button>

            <button
              @click="clearConversation"
              :disabled="isConversationActive || conversationHistory.length === 0"
              class="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              🗑️ Clear
            </button>

            <!-- Export Dropdown -->
            <div class="relative" v-if="conversationHistory.length > 0">
              <button
                @click="showConversationExportMenu = !showConversationExportMenu"
                :disabled="isConversationActive"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
              >
                📄 Export
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              <!-- Export Menu -->
              <div v-if="showConversationExportMenu" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  @click="exportConversation('txt')"
                  class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                >
                  📄 Export as TXT
                </button>
                <button
                  @click="exportConversation('md')"
                  class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                >
                  📝 Export as Markdown
                </button>
                <button
                  @click="exportConversation('json')"
                  class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                >
                  🔧 Export as JSON
                </button>
                <button
                  @click="exportConversation('html')"
                  class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                >
                  🌐 Export as HTML
                </button>
                <hr class="my-1">
                <button
                  @click="copyConversationToClipboard"
                  class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                >
                  📋 Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Countdown Timer -->
        <div v-if="waitingCountdown > 0" class="p-4 bg-yellow-50 border-b border-yellow-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                {{ waitingCountdown }}
              </div>
              <div>
                <div class="font-medium text-yellow-800">Waiting for next response...</div>
                <div class="text-sm text-yellow-600">Rate limiting protection active</div>
              </div>
            </div>
            <div class="text-2xl text-yellow-500">⏰</div>
          </div>
          <!-- Progress bar -->
          <div class="mt-3 w-full bg-yellow-200 rounded-full h-2">
            <div class="bg-yellow-500 h-2 rounded-full transition-all duration-1000"
                 :style="{ width: `${Math.max(0, (60 - waitingCountdown) / 60 * 100)}%` }"></div>
          </div>
        </div>

        <!-- Conversation Status -->
        <div v-if="conversationStatus" class="p-4 border-b border-gray-200"
             :class="conversationStatus.type === 'error' ? 'bg-red-50 border-red-200' :
                     conversationStatus.type === 'success' ? 'bg-green-50 border-green-200' :
                     'bg-blue-50 border-blue-200'">
          <div class="flex items-center">
            <span class="mr-2">
              {{ conversationStatus.type === 'error' ? '❌' :
                 conversationStatus.type === 'success' ? '✅' : '💭' }}
            </span>
            <span :class="conversationStatus.type === 'error' ? 'text-red-800' :
                           conversationStatus.type === 'success' ? 'text-green-800' :
                           'text-blue-800'">
              {{ conversationStatus.message }}
            </span>
          </div>
        </div>

        <!-- Conversation History -->
        <div class="p-6">
          <div class="conversation-history max-h-96 overflow-y-auto" ref="conversationContainer">
            <div v-if="conversationHistory.length === 0" class="text-center text-gray-500 py-8">
              <div class="text-6xl mb-4">🤖💬🤖</div>
              <p class="text-lg font-medium">No conversation yet</p>
              <p class="text-sm">Configure models and start a conversation to see the AI dialogue</p>
            </div>

            <div v-else class="space-y-6">
              <div v-for="(exchange, index) in conversationHistory" :key="index" class="border border-gray-200 rounded-lg p-4">
                <div class="text-sm text-gray-500 mb-3 font-medium">Turn {{ exchange.turn }}</div>

                <!-- Model A Response -->
                <div v-if="exchange.modelA" class="mb-4">
                  <div class="flex items-center mb-2">
                    <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">A</div>
                    <span class="font-medium text-purple-800">{{ selectedProviderA }}/{{ selectedModelA }}</span>
                  </div>
                  <div class="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p class="text-gray-800 whitespace-pre-wrap">{{ exchange.modelA }}</p>
                  </div>
                </div>

                <!-- Model B Response -->
                <div v-if="exchange.modelB">
                  <div class="flex items-center mb-2">
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">B</div>
                    <span class="font-medium text-blue-800">{{ selectedProviderB }}/{{ selectedModelB }}</span>
                  </div>
                  <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p class="text-gray-800 whitespace-pre-wrap">{{ exchange.modelB }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, onMounted } from 'vue';
import { useAIConfig } from '~/composables/ai/useAIConfig';
import { AI_PROVIDERS } from '~/types/ai';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';
import useAuthRefresh from '~/composables/auth/useAuthRefresh';
import useCsrf from '~/composables/auth/useCsrf';
import { useUniversalAIClient } from '~/composables/ai/useUniversalAIClient';
import { useClientAIStreaming } from '~/composables/ai/useClientAIStreaming';
import { useAIConversationEngine } from '~/composables/ai/useAIConversationEngine';

// Set page metadata
useHead({
  title: 'AI Assistant - Ask Questions & Create Documents',
  meta: [
    {
      name: 'description',
      content: 'Dynamic AI assistant that answers questions, provides guidance, and creates professional documents. Ask anything or request document creation.'
    }
  ]
});

// Authentication is handled by global middleware

// Authentication and API
const { fetchWithAuth } = useApiWithAuth();
const { ensureValidToken, getToken } = useAuthRefresh();
const { ensureToken } = useCsrf();

// AI Configuration
const { aiConfig, currentProvider, currentModel, isConfigured } = useAIConfig();

// Universal AI Client for client-side processing
const { callAI, isConfigured: isAIClientConfigured } = useUniversalAIClient();

// Client-side AI Streaming
const { streamAINormalChat, callAINormalChatNonStreaming, isStreamingSupported } = useClientAIStreaming();

// AI Conversation Engine (for conversation mode)
const { startConversation: startAIConversation, stopConversation: stopAIConversation } = useAIConversationEngine();

// Helper function to get provider name
const getProviderName = (providerId) => {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  return provider ? provider.name : providerId;
};

// Computed property for AI display info
const aiDisplayInfo = computed(() => {
  if (!isConfigured.value) {
    return 'AI Not Configured';
  }
  const providerName = getProviderName(aiConfig.value.provider);
  const modelName = currentModel.value?.name || aiConfig.value.model;

  // Add streaming status for normal chat mode
  if (aiMode.value === 'normal') {
    const streamingSupported = isStreamingSupported();
    const streamingStatus = streamingSupported ? '🌊 Streaming' : '📝 Non-streaming';
    return `${providerName} - ${modelName} (${streamingStatus})`;
  }

  return `${providerName} - ${modelName}`;
});

// Reactive variables
const conversation = ref([]);
const userInput = ref('');
const isProcessing = ref(false);
const currentJob = ref(null);
const documentReady = ref(false);
const availableFormats = ref([]);
const documentData = ref(null);
const messagesContainer = ref(null);
const isStreaming = ref(false);
const streamingMessage = ref('');

// AI Mode state
const aiMode = ref('normal'); // 'normal', 'document', or 'conversation'
const previousMode = ref('normal'); // Track previous mode for reverting

// Download loading state
const downloadingButtons = ref(new Set()); // Track which buttons are loading

// AI Conversation state (for conversation mode)
const selectedProviderA = ref('');
const selectedProviderB = ref('');
const selectedModelA = ref('');
const selectedModelB = ref('');
const apiKeyA = ref('');
const apiKeyB = ref('');
const conversationPrompt = ref('');
const conversationHistory = ref([]);
const isConversationActive = ref(false);
const conversationStatus = ref(null);
const conversationContainer = ref(null);
const waitingCountdown = ref(0);
const showConversationExportMenu = ref(false);

// Initialize conversation on mount
onMounted(() => {
  initializeConversation();

  // Close export menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
      showConversationExportMenu.value = false;
    }
  });
});

// Handle mode change
const handleModeChange = () => {
  console.log('🔄 [AI MODE] Mode changed to:', aiMode.value, 'from:', previousMode.value);

  // Clear conversation when switching modes for clarity
  const hasNormalConversation = conversation.value.length > 0;
  const hasAIConversation = conversationHistory.value.length > 0;

  if (hasNormalConversation || hasAIConversation) {
    const confirmClear = confirm('Switching modes will clear the current conversation. Continue?');
    if (confirmClear) {
      // Clear both types of conversations
      conversation.value = [];
      conversationHistory.value = [];
      conversationStatus.value = null;
      waitingCountdown.value = 0;

      // Update previous mode
      previousMode.value = aiMode.value;
    } else {
      // User cancelled - revert to previous mode
      aiMode.value = previousMode.value;
      return;
    }
  } else {
    // No conversation to clear, just update previous mode
    previousMode.value = aiMode.value;
  }

  // Additional cleanup when switching modes
  if (aiMode.value === 'conversation') {
    // Stop any active AI conversation
    if (isConversationActive.value) {
      stopConversation();
    }
  }
};

// Use example function
const useExample = (example) => {
  userInput.value = example;
};

// Copy to clipboard function
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);

    // Show success notification
    showNotification('Message copied to clipboard!', 'success');
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification('Message copied to clipboard!', 'success');
    } catch (fallbackErr) {
      showNotification('Failed to copy message', 'error');
    }
    document.body.removeChild(textArea);
  }
};

// Format time for messages
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

// Format message content (preserve line breaks)
const formatMessageContent = (content) => {
  return content.replace(/\n/g, '<br>');
};

// Show notification
const showNotification = (message, type = 'info') => {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium z-50 transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    'bg-blue-500'
  }`;
  notification.textContent = message;

  // Add to DOM
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 100);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateY(100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
};

// Start document generation when AI determines it's needed
const startDocumentGeneration = async (originalRequest, documentDetails) => {
  try {
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: `Perfect! I'll create that ${documentDetails?.documentType || 'document'} for you. Let me start working on it...`,
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();

    const response = await $fetch('/api/ai/generate-document-intelligent', {
      method: 'POST',
      body: { userRequest: originalRequest }
    });

    currentJob.value = {
      id: response.jobId,
      progress: 0,
      message: response.message,
      estimatedDuration: 60
    };

    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: response.message,
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();

    // Start polling for progress
    pollJobProgress();

  } catch (error) {
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: `I encountered an issue while creating the document: ${error.data?.message || error.message}. Would you like me to try a different approach?`,
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();
  }
};

// Handle action buttons from AI responses
const handleActionButton = async (action, data) => {
  console.log('🔘 [ACTION BUTTON] Button clicked:', { action, data });

  if (action === 'download_immediate') {
    // New improved flow - immediate download without duplicate AI processing
    const buttonLabel = data.filename || `${data.format?.toUpperCase()} Download`;

    try {
      console.log('⚡ [IMMEDIATE DOWNLOAD] Starting immediate download:', data);

      // Set loading state
      downloadingButtons.value.add(buttonLabel);

      // Direct download using the job's download URL
      const response = await fetch(`/api/ai/download-document/${data.jobId}/${data.format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'X-CSRF-Token': await ensureToken()
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Create download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `document.${data.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(`${data.format?.toUpperCase()} file downloaded successfully!`, 'success');

    } catch (error) {
      console.error('Immediate download error:', error);
      showNotification(error.message || 'Download failed', 'error');
    } finally {
      downloadingButtons.value.delete(buttonLabel);
    }
  } else if (action === 'create_document') {
    await startDocumentGeneration(data.request, data.details);
  } else if (action === 'download_document') {
    // DEPRECATED: This is the old flow that makes duplicate AI calls
    // The new improved flow uses 'download_immediate' action
    console.warn('⚠️ [DEPRECATED] Using old download_document flow - this makes duplicate AI calls');

    showNotification('This download method is deprecated. Please refresh and try again for faster downloads.', 'error');
    return;
  } else if (action === 'ask_followup') {
    userInput.value = data.question;
  } else if (action === 'explain_more') {
    await sendFollowupQuestion(`Please explain more about: ${data.topic}`);
  } else if (action === 'configure_ai') {
    openAISettings();
  }
};

// Poll job status for document generation
const pollJobStatus = async (jobId, format, buttonLabel) => {
  const maxAttempts = 60; // 60 attempts = 2 minutes max
  let attempts = 0;

  const poll = async () => {
    try {
      attempts++;
      console.log(`📊 [JOB POLL] Checking job status (attempt ${attempts}/${maxAttempts}):`, jobId);

      // Get tokens for authenticated request
      const token = getToken();
      const csrfToken = await ensureToken();

      const response = await fetch(`/api/ai/job-status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to check job status: ${response.status}`);
      }

      const jobStatus = await response.json();
      console.log('📋 [JOB POLL] Job status:', jobStatus);

      if (jobStatus.status === 'completed' && jobStatus.availableFormats) {
        // Find the requested format or use the first available
        const formatData = jobStatus.availableFormats.find(f => f.format === format) || jobStatus.availableFormats[0];

        if (formatData && formatData.downloadUrl) {
          // Job completed successfully - trigger download
          const link = document.createElement('a');
          link.href = formatData.downloadUrl;
          link.download = formatData.filename || `document.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          showNotification(`${format?.toUpperCase() || 'Document'} file downloaded successfully!`, 'success');
          downloadingButtons.value.delete(buttonLabel);
          return;
        } else {
          downloadingButtons.value.delete(buttonLabel);
          throw new Error(`Requested format ${format} not available`);
        }
      } else if (jobStatus.status === 'completed') {
        downloadingButtons.value.delete(buttonLabel);
        throw new Error('Document generation completed but no download available');
      } else if (jobStatus.status === 'failed') {
        downloadingButtons.value.delete(buttonLabel);
        throw new Error(jobStatus.error || 'Document generation failed');
      } else if (jobStatus.status === 'processing' || jobStatus.status === 'queued') {
        // Job still in progress
        if (attempts < maxAttempts) {
          // Wait 2 seconds before next poll
          setTimeout(poll, 2000);
        } else {
          downloadingButtons.value.delete(buttonLabel);
          throw new Error('Document generation timed out. Please try again.');
        }
      } else {
        downloadingButtons.value.delete(buttonLabel);
        throw new Error(`Unknown job status: ${jobStatus.status}`);
      }
    } catch (error) {
      console.error('Job polling error:', error);
      showNotification(error.message || 'Failed to check document generation status', 'error');
      downloadingButtons.value.delete(buttonLabel);
    }
  };

  // Start polling
  poll();
};

// Send follow-up question
const sendFollowupQuestion = async (question) => {
  userInput.value = question;
  await sendToAI();
};

// Client-side AI streaming for normal chat mode
const sendToAIClientSide = async () => {
  if (!userInput.value.trim() || isProcessing.value) return;

  // Check if AI is configured (skip check for SYSTEM_INIT)
  if (!isConfigured.value && userInput.value !== 'SYSTEM_INIT') {
    console.error('AI is not configured. Please configure your AI settings.');
    return;
  }

  const request = userInput.value;

  // Add user message (skip for SYSTEM_INIT)
  if (request !== 'SYSTEM_INIT') {
    conversation.value.push({
      id: Date.now(),
      type: 'user',
      content: request,
      timestamp: Date.now()
    });
  }

  userInput.value = '';
  isProcessing.value = true;
  documentReady.value = false;
  currentJob.value = null;

  // Scroll to bottom
  await nextTick();
  scrollToBottom();

  try {
    // Add placeholder for streaming response
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      suggestions: [],
      actionButtons: []
    });

    // Set streaming state
    isStreaming.value = true;
    streamingMessage.value = '';

    // Scroll to show streaming indicator
    await nextTick();
    scrollToBottom();

    // Prepare conversation history for AI
    const conversationHistoryForAI = conversation.value
      .filter(msg => !msg.isStreaming)
      .slice(-10)
      .map(msg => ({
        type: msg.type === 'user' ? 'user' : 'ai',
        content: msg.content
      }));

    console.log(`🚀 [CLIENT AI] Starting client-side normal chat`);

    // Check if streaming is supported for current provider
    const streamingSupported = isStreamingSupported();
    console.log(`📡 [CLIENT AI] Streaming supported: ${streamingSupported}`);

    if (streamingSupported) {
      // Use client-side streaming
      console.log('🌊 [CLIENT AI] Using streaming mode');
      await streamAINormalChat(
      request,
      conversationHistoryForAI,
      // onChunk callback
      (chunk) => {
        streamingMessage.value += chunk;

        // Update last message in conversation
        const lastMessage = conversation.value[conversation.value.length - 1];
        if (lastMessage && lastMessage.isStreaming) {
          lastMessage.content = streamingMessage.value;
        }

        // Scroll as content arrives
        scrollToBottom();
      },
      // onComplete callback
      (fullResponse) => {
        // Finalize the streaming message
        const lastMessage = conversation.value[conversation.value.length - 1];
        if (lastMessage && lastMessage.isStreaming) {
          lastMessage.content = fullResponse;
          lastMessage.isStreaming = false;
          lastMessage.suggestions = [];
          lastMessage.actionButtons = [];
        }

        // Reset streaming state
        isStreaming.value = false;

        // Final scroll
        nextTick().then(() => {
          scrollToBottom();
        });
      },
      // onError callback
      (error) => {
        console.error('Error in client-side AI streaming:', error);

        // Remove streaming placeholder if it exists
        const lastMessage = conversation.value[conversation.value.length - 1];
        if (lastMessage && lastMessage.isStreaming) {
          conversation.value.pop();
        }

        // Handle authentication errors specifically
        let errorMessage = 'Sorry, I encountered an error. Please try again.';
        if (error.message?.includes('Authentication') ||
            error.message?.includes('Unauthorized') ||
            error.message?.includes('jwt expired')) {
          errorMessage = 'Your session has expired. Please refresh the page and try again.';
        } else if (error.message) {
          errorMessage = `Sorry, I encountered an error: ${error.message}`;
        }

        // Add error message
        conversation.value.push({
          id: Date.now(),
          type: 'ai',
          content: errorMessage,
          timestamp: Date.now(),
          suggestions: [],
          actionButtons: []
        });

        nextTick().then(() => {
          scrollToBottom();
        });

        // Reset streaming state
        isStreaming.value = false;
      }
    );
    } else {
      // Use non-streaming mode
      console.log('📝 [CLIENT AI] Using non-streaming mode');

      // Show a notice that streaming is not available
      const lastMessage = conversation.value[conversation.value.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        const providerName = getProviderName(aiConfig.value.provider);
        lastMessage.content = `💭 ${providerName} doesn't support real-time streaming. Processing your request...`;
      }

      await callAINormalChatNonStreaming(
        request,
        conversationHistoryForAI,
        // onComplete callback
        (fullResponse) => {
          // Finalize the message
          const lastMessage = conversation.value[conversation.value.length - 1];
          if (lastMessage && lastMessage.isStreaming) {
            lastMessage.content = fullResponse;
            lastMessage.isStreaming = false;
            lastMessage.suggestions = [];
            lastMessage.actionButtons = [];
          }

          // Reset streaming state
          isStreaming.value = false;

          // Final scroll
          nextTick().then(() => {
            scrollToBottom();
          });
        },
        // onError callback
        (error) => {
          console.error('Error in client-side AI non-streaming:', error);

          // Remove placeholder if it exists
          const lastMessage = conversation.value[conversation.value.length - 1];
          if (lastMessage && lastMessage.isStreaming) {
            conversation.value.pop();
          }

          // Handle authentication errors specifically
          let errorMessage = 'Sorry, I encountered an error. Please try again.';
          if (error.message?.includes('Authentication') ||
              error.message?.includes('Unauthorized') ||
              error.message?.includes('jwt expired')) {
            errorMessage = 'Your session has expired. Please refresh the page and try again.';
          } else if (error.message) {
            errorMessage = `Sorry, I encountered an error: ${error.message}`;
          }

          // Add error message
          conversation.value.push({
            id: Date.now(),
            type: 'ai',
            content: errorMessage,
            timestamp: Date.now(),
            suggestions: [],
            actionButtons: []
          });

          nextTick().then(() => {
            scrollToBottom();
          });

          // Reset streaming state
          isStreaming.value = false;
        }
      );
    }

  } catch (error) {
    console.error('Error in client-side AI processing:', error);

    // Remove streaming placeholder if it exists
    const lastMessage = conversation.value[conversation.value.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      conversation.value.pop();
    }

    // Add error message
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: 'Sorry, I encountered an error. Please try again.',
      timestamp: Date.now(),
      suggestions: [],
      actionButtons: []
    });

    await nextTick();
    scrollToBottom();

    // Reset streaming state
    isStreaming.value = false;
  } finally {
    isProcessing.value = false;
  }
};

// Send message to AI with streaming
const sendToAI = async () => {
  if (!userInput.value.trim() || isProcessing.value) return;

  // Check if AI is configured (skip check for SYSTEM_INIT)
  if (!isConfigured.value && userInput.value !== 'SYSTEM_INIT') {
    console.error('AI is not configured. Please configure your AI settings.');
    // No fallback message - strict real data only requirement
    return;
  }

  // Route to appropriate handler based on mode
  if (aiMode.value === 'normal') {
    // Use client-side streaming for normal chat
    console.log('🔄 [AI ROUTING] Using client-side streaming for normal chat mode');
    await sendToAIClientSide();
    return;
  } else {
    // Use server-side streaming for document generation
    console.log('🔄 [AI ROUTING] Using server-side streaming for document generation mode');
    await sendToAIServerSide();
    return;
  }
};

// Server-side AI streaming for document generation mode
const sendToAIServerSide = async () => {
  if (!userInput.value.trim() || isProcessing.value) return;

  // Check if AI is configured (skip check for SYSTEM_INIT)
  if (!isConfigured.value && userInput.value !== 'SYSTEM_INIT') {
    console.error('AI is not configured. Please configure your AI settings.');
    // No fallback message - strict real data only requirement
    return;
  }

  const request = userInput.value;

  // Add user message (skip for SYSTEM_INIT)
  if (request !== 'SYSTEM_INIT') {
    conversation.value.push({
      id: Date.now(),
      type: 'user',
      content: request,
      timestamp: Date.now()
    });
  }

  userInput.value = '';
  isProcessing.value = true;
  documentReady.value = false;
  currentJob.value = null;

  // Scroll to bottom
  await nextTick();
  scrollToBottom();

  try {
    // Add placeholder for streaming response
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      suggestions: [],
      actionButtons: []
    });

    // Set streaming state
    isStreaming.value = true;
    streamingMessage.value = '';

    // Scroll to show streaming indicator
    await nextTick();
    scrollToBottom();

    // Ensure we have a valid token before streaming
    const hasValidToken = await ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Authentication failed. Please log in again.');
    }

    // Get tokens
    const token = getToken();
    const csrfToken = await ensureToken();

    // Use document generation endpoint for server-side processing
    const apiEndpoint = '/api/ai/document-generation-stream';

    // Prepare request body for document generation
    const requestBody = {
      userMessage: request,
      conversationHistory: conversation.value
        .filter(msg => !msg.isStreaming)
        .slice(-10)
        .map(msg => ({
          type: msg.type === 'user' ? 'user' : 'ai',
          content: msg.content
        })),
      documentType: 'auto-detect',
      _csrf: csrfToken
    };

    // Use native fetch for SSE streaming with proper authentication
    console.log(`🚀 [AI STREAM] Starting request to ${apiEndpoint} in document generation mode`);
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
        'X-AI-Config': JSON.stringify(aiConfig.value)
      },
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    // Get reader for streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = '';
    let buffer = '';
    let finalResponseData = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.type === 'error') {
                throw new Error(data.error);
              }

              if (data.type === 'chunk' && data.chunk) {
                // Update streaming message
                streamingMessage.value += data.chunk;
                fullResponse += data.chunk;

                // Update last message in conversation
                const lastMessage = conversation.value[conversation.value.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.content = streamingMessage.value;
                }

                // Scroll as content arrives
                scrollToBottom();
              }

              if (data.type === 'complete') {
                finalResponseData = data.response;
                if (data.response.message) {
                  fullResponse = data.response.message;
                }
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e);
            }
          }
        }
      }

      // Finalize the streaming message
      const lastMessage = conversation.value[conversation.value.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        lastMessage.content = fullResponse;
        lastMessage.isStreaming = false;
        lastMessage.suggestions = finalResponseData?.suggestions || [];
        lastMessage.actionButtons = finalResponseData?.actionButtons || [];
      }

    } catch (streamError) {
      console.error('Stream processing error:', streamError);
      throw streamError;
    } finally {
      reader.releaseLock();
    }

    // Reset streaming state
    isStreaming.value = false;

    // Final scroll
    await nextTick();
    scrollToBottom();

    // Handle document generation if detected (new improved flow)
    if (finalResponseData?.action === 'document_generated' && finalResponseData?.jobId) {
      console.log('🔄 [DOC GEN] Starting background job polling for:', finalResponseData.jobId);

      // Set current job for polling
      currentJob.value = {
        id: finalResponseData.jobId,
        progress: 50, // AI analysis is complete
        message: 'AI analysis complete, generating files...',
        estimatedDuration: 30
      };

      // Start polling for job completion
      pollJobProgress();
    } else if (finalResponseData?.action === 'create_document') {
      // Fallback to old flow if needed
      await startDocumentGeneration(request, finalResponseData.documentDetails);
    }

  } catch (error) {
    console.error('Error in AI streaming:', error);

    // Remove streaming placeholder if it exists
    const lastMessage = conversation.value[conversation.value.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      conversation.value.pop();
    }

    // Handle authentication errors specifically
    let errorMessage = 'Sorry, I encountered an error. Please try again.';
    if (error.message?.includes('Authentication') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('jwt expired') ||
        error.status === 401) {
      errorMessage = 'Your session has expired. Please refresh the page and try again.';
    } else if (error.message) {
      errorMessage = `Sorry, I encountered an error: ${error.message}`;
    }

    // Add error message
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: errorMessage,
      timestamp: Date.now(),
      suggestions: [],
      actionButtons: []
    });

    await nextTick();
    scrollToBottom();

    // Reset streaming state
    isStreaming.value = false;
  } finally {
    isProcessing.value = false;
  }
};

// Poll job progress
const pollJobProgress = async () => {
  if (!currentJob.value) return;

  try {
    const job = await $fetch(`/api/ai/job-status/${currentJob.value.id}`);
    currentJob.value = { ...currentJob.value, ...job };

    if (job.status === 'completed') {
      documentReady.value = true;
      documentData.value = job.documentData;

      // Generate immediate download action buttons from job data
      const actionButtons = job.availableFormats?.map(format => ({
        label: `${format.format === 'pdf' ? '📄' : format.format === 'excel' ? '📊' : '📝'} Download ${format.format.toUpperCase()}`,
        action: 'download_immediate',
        type: format.format === 'pdf' ? 'primary' : 'success',
        icon: format.format === 'pdf' ? '📄' : format.format === 'excel' ? '📊' : '📝',
        data: {
          format: format.format,
          downloadUrl: format.downloadUrl,
          filename: format.filename,
          size: format.size,
          jobId: job.id
        }
      })) || [];

      // Add AI message with immediate download buttons
      conversation.value.push({
        id: Date.now(),
        type: 'ai',
        content: `Perfect! I've created your "${job.documentData?.documentType || 'document'}" successfully. Your files are ready for immediate download:`,
        timestamp: Date.now(),
        actionButtons: actionButtons
      });

      // Clear current job and reset states
      currentJob.value = null;
      documentReady.value = false;

      await nextTick();
      scrollToBottom();

    } else if (job.status === 'failed') {
      conversation.value.push({
        id: Date.now(),
        type: 'ai',
        content: `I encountered an issue: ${job.error}. Would you like me to try again with a different approach?`,
        timestamp: Date.now()
      });

      await nextTick();
      scrollToBottom();
    } else {
      // Continue polling
      setTimeout(pollJobProgress, 2000);
    }

  } catch (error) {
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: 'I lost connection while processing. Please try your request again.',
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();
  }
};

// Download format
const downloadFormat = async (format) => {
  try {
    const response = await fetch(`/api/ai/download-document/${currentJob.value.id}/${format}`);

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = availableFormats.value.find(f => f.type === format)?.downloadUrl?.split('/').pop() || `document.${format === 'word' ? 'docx' : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Add success message
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: `✅ ${format.charAt(0).toUpperCase() + format.slice(1)} file downloaded successfully! Need another document?`,
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();

  } catch (error) {
    conversation.value.push({
      id: Date.now(),
      type: 'ai',
      content: `❌ Sorry, the download failed. Please try again.`,
      timestamp: Date.now()
    });

    await nextTick();
    scrollToBottom();
  }
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Scroll to bottom
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Initialize conversation with system message
const initializeConversation = async () => {
  if (conversation.value.length > 0) return; // Already initialized

  try {
    // Set the system init message and call appropriate AI handler
    userInput.value = 'SYSTEM_INIT';

    // Use client-side for normal mode, server-side for document mode
    if (aiMode.value === 'normal') {
      await sendToAIClientSide();
    } else {
      await sendToAIServerSide();
    }

    // Clear the input after initialization
    userInput.value = '';
  } catch (error) {
    console.error('Failed to initialize conversation:', error);
    // No fallback message - strict real data only requirement
  }
};

// Open AI Settings
const openAISettings = () => {
  // Emit event to open global settings with AI tab
  window.dispatchEvent(new CustomEvent('open-global-settings', {
    detail: { activeTab: 'ai' }
  }));
};

// ===== AI CONVERSATION FUNCTIONS =====

// Provider model definitions
const providerModels = {
  google: [
    { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash (Latest)' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Latest)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
    { id: 'gemma-4-31b', name: 'Gemma 4 31B (Open Model)' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental' }
  ],
  openrouter: [
    { id: 'google/gemma-4-31b:free', name: '🆓 Gemma 4 31B (Free)' },
    { id: 'meta-llama/llama-4-scout:free', name: '🆓 Llama 4 Scout (Free)' },
    { id: 'qwen/qwen-3-coder-480b:free', name: '🆓 Qwen 3 Coder 480B (Free)' },
    { id: 'openai/gpt-oss-120b:free', name: '🆓 OpenAI GPT-OSS 120B (Free)' },
    { id: 'deepseek/deepseek-r1:free', name: '🆓 DeepSeek R1 (Free)' },
    { id: 'google/gemini-2.5-pro-exp:free', name: '🆓 Gemini 2.5 Pro Exp (Free)' },
    { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
  ],
  groq: [
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Reasoning)' },
    { id: 'meta-llama/llama-4-scout-17b', name: 'Llama 4 Scout 17B' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (Latest)' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B' },
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B' }
  ]
};

// Get models for a specific provider
const getModelsForProvider = (providerId) => {
  return providerModels[providerId] || [];
};

// Handle provider changes
const onProviderAChange = () => {
  selectedModelA.value = '';
  apiKeyA.value = '';
};

const onProviderBChange = () => {
  selectedModelB.value = '';
  apiKeyB.value = '';
};

// Computed property for conversation validation
const canStartConversation = computed(() => {
  return conversationPrompt.value.trim() &&
         selectedProviderA.value &&
         selectedProviderB.value &&
         selectedModelA.value &&
         selectedModelB.value &&
         apiKeyA.value.trim() &&
         apiKeyB.value.trim() &&
         !isConversationActive.value &&
         (selectedProviderA.value !== selectedProviderB.value || selectedModelA.value !== selectedModelB.value);
});

// Start AI conversation
const startConversation = async () => {
  if (!canStartConversation.value) return;

  console.log('🚀 Starting AI conversation...');
  isConversationActive.value = true;
  conversationHistory.value = [];
  conversationStatus.value = { type: 'info', message: 'Starting conversation...' };

  try {
    // Create model configurations
    const modelAConfig = {
      provider: selectedProviderA.value,
      model: selectedModelA.value,
      apiKey: apiKeyA.value
    };

    const modelBConfig = {
      provider: selectedProviderB.value,
      model: selectedModelB.value,
      apiKey: apiKeyB.value
    };

    await startAIConversation(
      conversationPrompt.value,
      modelAConfig,
      modelBConfig,
      // onUpdate callback
      (exchange) => {
        // Find existing exchange or add new one
        const existingIndex = conversationHistory.value.findIndex(e => e.turn === exchange.turn);
        if (existingIndex >= 0) {
          conversationHistory.value[existingIndex] = exchange;
        } else {
          conversationHistory.value.push(exchange);
        }

        // Scroll to bottom
        nextTick(() => {
          if (conversationContainer.value) {
            conversationContainer.value.scrollTop = conversationContainer.value.scrollHeight;
          }
        });
      },
      // onError callback
      (error) => {
        console.error('❌ Conversation error:', error);
        conversationStatus.value = {
          type: 'error',
          message: `Conversation error: ${error.message}`
        };
        isConversationActive.value = false;
        waitingCountdown.value = 0;
      },
      // onComplete callback
      () => {
        console.log('✅ Conversation completed');
        conversationStatus.value = {
          type: 'success',
          message: `Conversation completed with ${conversationHistory.value.length} exchanges`
        };
        isConversationActive.value = false;
        waitingCountdown.value = 0;
      },
      // onCountdown callback
      (seconds, message) => {
        waitingCountdown.value = seconds;
        conversationStatus.value = {
          type: 'info',
          message: message
        };
      }
    )
  } catch (error) {
    console.error('❌ Failed to start conversation:', error);
    conversationStatus.value = {
      type: 'error',
      message: `Failed to start conversation: ${error.message}`
    };
    isConversationActive.value = false;
    waitingCountdown.value = 0;
  }
};

// Stop AI conversation
const stopConversation = () => {
  console.log('⏹️ Stopping conversation...');
  stopAIConversation();
  conversationStatus.value = { type: 'info', message: 'Conversation stopped by user' };
  isConversationActive.value = false;
  waitingCountdown.value = 0;
};

// Clear conversation history
const clearConversation = () => {
  conversationHistory.value = [];
  conversationStatus.value = null;
  waitingCountdown.value = 0;
};

// Export conversation in different formats
const exportConversation = (format) => {
  if (conversationHistory.value.length === 0) {
    showNotification('No conversation to export', 'error');
    return;
  }

  showConversationExportMenu.value = false;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ai-conversation-${timestamp}`;

  let content = '';
  let mimeType = 'text/plain';
  let fileExtension = format;

  // Generate content based on format
  switch (format) {
    case 'txt':
      content = generateTextExport();
      mimeType = 'text/plain';
      break;
    case 'md':
      content = generateMarkdownExport();
      mimeType = 'text/markdown';
      break;
    case 'json':
      content = generateJSONExport();
      mimeType = 'application/json';
      break;
    case 'html':
      content = generateHTMLExport();
      mimeType = 'text/html';
      break;
    default:
      showNotification('Unsupported export format', 'error');
      return;
  }

  // Create and download file
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`Conversation exported as ${format.toUpperCase()}`, 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Failed to export conversation', 'error');
  }
};

// Generate text export
const generateTextExport = () => {
  const header = `AI Model Conversation Export
Generated: ${new Date().toLocaleString()}
Topic: ${conversationPrompt.value}
Model A: ${selectedProviderA.value}/${selectedModelA.value}
Model B: ${selectedProviderB.value}/${selectedModelB.value}
Total Exchanges: ${conversationHistory.value.length}

${'='.repeat(80)}

`;

  let content = header;

  conversationHistory.value.forEach((exchange, index) => {
    content += `Turn ${exchange.turn}\n`;
    content += '-'.repeat(40) + '\n\n';

    if (exchange.modelA) {
      content += `Model A (${selectedProviderA.value}/${selectedModelA.value}):\n`;
      content += exchange.modelA + '\n\n';
    }

    if (exchange.modelB) {
      content += `Model B (${selectedProviderB.value}/${selectedModelB.value}):\n`;
      content += exchange.modelB + '\n\n';
    }

    if (index < conversationHistory.value.length - 1) {
      content += '\n';
    }
  });

  return content;
};

// Generate markdown export
const generateMarkdownExport = () => {
  const header = `# AI Model Conversation Export

**Generated:** ${new Date().toLocaleString()}
**Topic:** ${conversationPrompt.value}
**Model A:** ${selectedProviderA.value}/${selectedModelA.value}
**Model B:** ${selectedProviderB.value}/${selectedModelB.value}
**Total Exchanges:** ${conversationHistory.value.length}

---

`;

  let content = header;

  conversationHistory.value.forEach((exchange, index) => {
    content += `## Turn ${exchange.turn}\n\n`;

    if (exchange.modelA) {
      content += `### 🤖 Model A (${selectedProviderA.value}/${selectedModelA.value})\n\n`;
      content += exchange.modelA + '\n\n';
    }

    if (exchange.modelB) {
      content += `### 🤖 Model B (${selectedProviderB.value}/${selectedModelB.value})\n\n`;
      content += exchange.modelB + '\n\n';
    }

    if (index < conversationHistory.value.length - 1) {
      content += '---\n\n';
    }
  });

  return content;
};

// Generate JSON export
const generateJSONExport = () => {
  const exportData = {
    metadata: {
      generated: new Date().toISOString(),
      topic: conversationPrompt.value,
      modelA: {
        provider: selectedProviderA.value,
        model: selectedModelA.value
      },
      modelB: {
        provider: selectedProviderB.value,
        model: selectedModelB.value
      },
      totalExchanges: conversationHistory.value.length
    },
    conversation: conversationHistory.value.map(exchange => ({
      turn: exchange.turn,
      modelA: exchange.modelA || null,
      modelB: exchange.modelB || null
    }))
  };

  return JSON.stringify(exportData, null, 2);
};

// Generate HTML export
const generateHTMLExport = () => {
  const header = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Model Conversation Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metadata { display: grid; grid-template-columns: auto 1fr; gap: 10px; }
        .metadata strong { color: #495057; }
        .turn { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .turn-header { background: #e9ecef; padding: 10px 20px; font-weight: bold; }
        .model-response { padding: 20px; }
        .model-a { background: #f8f5ff; border-left: 4px solid #8b5cf6; }
        .model-b { background: #f0f9ff; border-left: 4px solid #3b82f6; }
        .model-label { font-weight: bold; margin-bottom: 10px; color: #374151; }
        .response-text { white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Model Conversation Export</h1>
        <div class="metadata">
            <strong>Generated:</strong> <span>${new Date().toLocaleString()}</span>
            <strong>Topic:</strong> <span>${conversationPrompt.value}</span>
            <strong>Model A:</strong> <span>${selectedProviderA.value}/${selectedModelA.value}</span>
            <strong>Model B:</strong> <span>${selectedProviderB.value}/${selectedModelB.value}</span>
            <strong>Total Exchanges:</strong> <span>${conversationHistory.value.length}</span>
        </div>
    </div>
`;

  let content = header;

  conversationHistory.value.forEach((exchange) => {
    content += `    <div class="turn">
        <div class="turn-header">Turn ${exchange.turn}</div>
`;

    if (exchange.modelA) {
      content += `        <div class="model-response model-a">
            <div class="model-label">🤖 Model A (${selectedProviderA.value}/${selectedModelA.value})</div>
            <div class="response-text">${exchange.modelA.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
`;
    }

    if (exchange.modelB) {
      content += `        <div class="model-response model-b">
            <div class="model-label">🤖 Model B (${selectedProviderB.value}/${selectedModelB.value})</div>
            <div class="response-text">${exchange.modelB.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
`;
    }

    content += `    </div>
`;
  });

  content += `</body>
</html>`;

  return content;
};

// Copy conversation to clipboard
const copyConversationToClipboard = async () => {
  if (conversationHistory.value.length === 0) {
    showNotification('No conversation to copy', 'error');
    return;
  }

  showConversationExportMenu.value = false;

  const textContent = generateTextExport();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Use modern clipboard API
      await navigator.clipboard.writeText(textContent);
      showNotification('Conversation copied to clipboard!', 'success');
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textContent;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        showNotification('Conversation copied to clipboard!', 'success');
      } catch (fallbackErr) {
        showNotification('Failed to copy conversation', 'error');
      }

      document.body.removeChild(textArea);
    }
  } catch (error) {
    console.error('Copy error:', error);
    showNotification('Failed to copy conversation', 'error');
  }
};
</script>

<style scoped>
.message-container {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-blink {
  animation: blink 1s infinite;
}

.messages {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.messages::-webkit-scrollbar {
  width: 6px;
}

.messages::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

/* Bubble styling */
.message-container .bg-blue-50 {
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.message-container .bg-white {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Hover effects for copy button */
.group:hover .opacity-0 {
  opacity: 1;
}

/* Notification animation */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
