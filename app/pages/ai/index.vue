<template>
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    <h1 class="text-3xl font-bold mb-2 text-indigo-700">AI Assistant</h1>
    <div class="mb-6 flex items-center">
      <span class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs px-3 py-1 rounded-full font-medium mr-2">Powered by Gemini 2.5 Flash Preview</span>
      <span class="text-sm text-gray-600">Google's latest and most efficient AI model</span>
    </div>

    <!-- Mode Selector -->
    <div class="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-800">AI Assistant Mode</h3>
        <button
          @click="toggleHistory"
          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </button>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
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
      </div>

      <!-- Mode Description -->
      <div class="mt-3 p-3 rounded-lg text-sm"
           :class="aiMode === 'normal' ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-green-50 border border-green-200 text-green-800'">
        <span class="font-medium">
          {{ aiMode === 'normal' ? '💬 Normal Chat Mode:' : '📄 Document Generation Mode:' }}
        </span>
        {{ aiMode === 'normal' ? 'Ask questions, get explanations, have conversations' : 'Provide requirements and get professional documents with download options' }}
      </div>
    </div>

    <!-- Chat Interface -->
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Chat Messages -->
      <div class="p-6 max-h-[60vh] overflow-y-auto" ref="chatContainer">
        <div v-if="chatHistory.length === 0" class="text-center text-gray-500 py-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p class="text-lg font-medium">Start a conversation with the AI Assistant</p>
        </div>

        <div v-else class="space-y-6">
          <div v-for="(message, index) in chatHistory" :key="index" class="message-container">
            <!-- User Message -->
            <div v-if="message.isUser" class="flex items-start mb-4">
              <div class="flex-shrink-0 bg-indigo-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                You
              </div>
              <div class="ml-3 bg-indigo-50 p-4 rounded-lg rounded-tl-none max-w-[80%]">
                <p class="text-gray-800">{{ message.content }}</p>
                <span class="text-xs text-gray-500 mt-1 block">{{ formatTime(message.timestamp) }}</span>
              </div>
            </div>

            <!-- AI Message -->
            <div v-else class="flex items-start mb-4 flex-row-reverse">
              <div class="flex-shrink-0 bg-green-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                AI
              </div>
              <div class="mr-3 bg-white border border-gray-200 p-4 rounded-lg rounded-tr-none max-w-[80%] relative group">
                <!-- Streaming indicator -->
                <div v-if="message.isStreaming" class="absolute top-0 right-0 mt-1 mr-1">
                  <div class="flex space-x-1 bg-green-100 px-2 py-1 rounded-full shadow-sm">
                    <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                    <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse" style="animation-delay: 0.2s"></div>
                    <div class="w-2 h-2 rounded-full bg-green-600 animate-pulse" style="animation-delay: 0.4s"></div>
                    <span class="text-xs text-green-700 font-medium ml-1">Streaming...</span>
                  </div>
                </div>

                <!-- Message content with real-time updates -->
                <div class="text-gray-800 whitespace-pre-wrap">
                  <span v-html="formatMessageContent(message.content)"></span>
                  <!-- Blinking cursor at the end of streaming text -->
                  <span v-if="message.isStreaming" class="inline-block w-2 h-4 bg-green-500 ml-0.5 animate-blink"></span>
                </div>
                <span class="text-xs text-gray-500 mt-1 block">{{ formatTime(message.timestamp) }}</span>

                <!-- Action Buttons (for document generation mode) -->
                <div v-if="!message.isStreaming && message.actionButtons && message.actionButtons.length > 0"
                     class="mt-4 space-y-2">
                  <button v-for="button in message.actionButtons" :key="button.label"
                          @click="handleActionButton(button)"
                          class="w-full px-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-center"
                          :class="button.type === 'primary'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : button.type === 'success'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-600 text-white hover:bg-gray-700'">
                    <span class="mr-2">{{ button.icon }}</span>
                    {{ button.label }}
                  </button>
                </div>

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
              </div>
            </div>
          </div>
        </div>

        <!-- We don't need the old typing indicator anymore as we're using streaming responses -->
      </div>

      <!-- Input Area -->
      <div class="border-t border-gray-200 p-4 bg-gray-50">
        <div class="flex items-end">
          <textarea
            v-model="userMessage"
            rows="3"
            :placeholder="aiMode === 'document'
              ? 'Describe the document you need (e.g., quotation for 100 LED lights @ ₹1400 each)...'
              : 'Ask me anything or type your message here...'"
            class="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            @keydown.enter.prevent="sendMessage"
          ></textarea>
          <button
            @click="sendMessage"
            class="ml-3 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 h-12 flex items-center"
            :disabled="isLoading || !userMessage.trim()"
          >
            <span v-if="isLoading">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
            <span v-else class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          </button>
        </div>

        <div class="mt-3 flex justify-between items-center">
          <button
            @click="clearChat"
            class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Chat
          </button>

          <div class="flex space-x-3">
            <button
              v-if="chatHistory.length > 0"
              @click="saveConversation"
              class="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Conversation
            </button>

            <button
              v-if="chatHistory.length > 0"
              @click="exportToPDF"
              class="text-sm text-red-600 hover:text-red-800 focus:outline-none flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Error Message with detailed information -->
    <div v-if="error" class="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <div class="flex justify-between items-start">
        <div>
          <strong class="font-bold text-lg">Error Occurred!</strong>
          <span class="block mt-1"> {{ error }}</span>
        </div>
        <button @click="error = ''" class="text-red-700 hover:text-red-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Show error details if available -->
      <div v-if="errorDetails" class="mt-3 pt-3 border-t border-red-300">
        <div class="font-semibold mb-1">Error Details:</div>
        <pre class="text-sm bg-white p-2 rounded overflow-x-auto">{{ errorDetails }}</pre>
      </div>

      <!-- Troubleshooting tips -->
      <div class="mt-3 text-sm">
        <p class="font-semibold">Troubleshooting Tips:</p>
        <ul class="list-disc pl-5 mt-1">
          <li>Check your internet connection</li>
          <li>The AI service might be experiencing high traffic</li>
          <li>Try refreshing the page and sending your message again</li>
          <li>If the problem persists, please try again later</li>
        </ul>
      </div>
    </div>




    <!-- History Modal -->
    <div v-if="showHistory" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        <!-- Reply Modal -->
        <div v-if="showReplyModal" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-indigo-700">Reply to Conversation</h3>
              <button
                @click="closeReplyForm"
                class="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mb-4">
              <label for="replyQuestion" class="block text-sm font-medium text-gray-700 mb-1">Your Reply</label>
              <textarea
                id="replyQuestion"
                v-model="replyQuestion"
                rows="4"
                placeholder="Enter your follow-up question or comment..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
            </div>

            <div class="flex justify-end">
              <button
                @click="submitReply"
                class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                :disabled="isLoading.reply"
              >
                <span v-if="isLoading.reply" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
                <span v-else>Submit Reply</span>
              </button>
            </div>
          </div>
        </div>
        <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
          <h2 class="text-xl font-semibold text-indigo-700">AI Interaction History</h2>
          <div class="flex items-center space-x-2">
            <select
              v-model="historyFilter"
              class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="chat">Chat</option>
            </select>
            <button
              @click="toggleHistory"
              class="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-4 overflow-y-auto flex-grow">
          <div v-if="isLoading.history" class="flex justify-center items-center py-8">
            <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <div v-else-if="aiHistory.length === 0" class="text-center py-8 text-gray-500">
            No history found. Start using the AI features to build your history.
          </div>

          <div v-else class="space-y-4">
            <div v-for="item in filteredHistory" :key="item._id" class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer" @click="loadHistoryItem(item)">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <span
                    :class="{
                      'bg-indigo-100 text-indigo-800': item.type === 'chat',
                      'bg-gray-100 text-gray-800': item.type !== 'chat'
                    }"
                    class="px-2 py-1 rounded-full text-xs font-medium"
                  >
                    {{ item.type === 'chat' ? 'Chat' : item.type }}
                  </span>
                  <span class="text-xs text-gray-500 ml-2">{{ formatDate(item.createdAt) }}</span>
                </div>
                <div class="flex space-x-2">
                  <button
                    @click="showReplies(item)"
                    class="text-indigo-500 hover:text-indigo-700 focus:outline-none"
                    title="View Replies"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button
                    @click="deleteHistoryItem(item._id)"
                    class="text-red-500 hover:text-red-700 focus:outline-none"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="mb-2">
                <h3 class="font-medium text-indigo-700">{{ getHistoryTitle(item) }}</h3>
                <p class="text-sm text-gray-700 mt-1 line-clamp-2">{{ item.question }}</p>
              </div>

              <div class="flex justify-end space-x-2">
                <button
                  @click="openReplyForm(item)"
                  class="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
                >
                  Reply
                </button>
                </div>

                <!-- Chat-like conversation thread -->
                <div v-if="item._id === activeRepliesId" class="mt-4 pt-4 border-t border-gray-200">
                  <h4 class="font-medium text-gray-700 mb-2">Conversation Thread</h4>

                  <!-- Original message -->
                  <div class="bg-indigo-50 p-3 rounded-md mb-3 border-l-4 border-indigo-500">
                    <div class="flex justify-between items-start mb-1">
                      <span class="text-xs font-medium text-indigo-700">You</span>
                      <span class="text-xs text-gray-500">{{ formatDate(item.createdAt) }}</span>
                    </div>
                    <p class="text-sm text-gray-700">{{ item.question }}</p>
                  </div>

                  <!-- AI Response -->
                  <div class="bg-gray-50 p-3 rounded-md mb-3 border-l-4 border-gray-400 ml-4">
                    <div class="flex justify-between items-start mb-1">
                      <span class="text-xs font-medium text-gray-700">AI Assistant</span>
                    </div>
                    <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ item.answer }}</p>
                  </div>

                  <div v-if="isLoading.replies" class="flex justify-center items-center py-4">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>

                  <div v-else-if="replies.length === 0" class="text-center py-2 text-gray-500 text-sm">
                    No follow-up messages yet.
                  </div>

                  <!-- Follow-up messages in chat style -->
                  <template v-else>
                    <div v-for="reply in replies" :key="reply._id" class="mb-3">
                      <!-- User follow-up message -->
                      <div class="bg-indigo-50 p-3 rounded-md mb-2 border-l-4 border-indigo-500">
                        <div class="flex justify-between items-start mb-1">
                          <span class="text-xs font-medium text-indigo-700">You</span>
                          <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2">{{ formatDate(reply.createdAt) }}</span>
                            <button
                              @click="deleteHistoryItem(reply._id)"
                              class="text-red-500 hover:text-red-700 focus:outline-none"
                              title="Delete Message"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p class="text-sm text-gray-700">{{ reply.question }}</p>
                      </div>

                      <!-- AI follow-up response -->
                      <div class="bg-gray-50 p-3 rounded-md mb-3 border-l-4 border-gray-400 ml-4">
                        <div class="flex justify-between items-start mb-1">
                          <span class="text-xs font-medium text-gray-700">AI Assistant</span>
                        </div>
                        <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ reply.answer }}</p>
                      </div>
                    </div>
                  </template>

                  <!-- Quick reply input -->
                  <div class="mt-3 flex items-end">
                    <div class="flex-grow">
                      <textarea
                        v-model="quickReply"
                        rows="2"
                        placeholder="Type a follow-up message..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        @keydown.enter.prevent="quickSubmitReply(item)"
                      ></textarea>
                    </div>
                    <button
                      @click="quickSubmitReply(item)"
                      class="ml-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm flex items-center"
                      :disabled="isLoading.reply || !quickReply"
                    >
                      <span v-if="isLoading.reply">
                        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>
                      <span v-else>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </span>
                    </button>
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
import { ref, computed, watch, nextTick } from 'vue';
import useCsrf from '~/composables/auth/useCsrf';
import useToast from '~/composables/ui/useToast';

// Define page meta to require authentication
definePageMeta({
  requiresAuth: true
});

// Chat state
const chatHistory = ref([]);
const userMessage = ref('');
const isLoading = ref(false);
const error = ref('');
const errorDetails = ref('');
const chatContainer = ref(null);
const isStreaming = ref(false);
const streamingMessage = ref('');

// AI Mode state
const aiMode = ref('normal'); // 'normal' or 'document'

// History state
const showHistory = ref(false);
const aiHistory = ref([]);
const historyFilter = ref('');

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

// Get history item title
const getHistoryTitle = (item) => {
  if (item.type === 'chat') {
    return 'Chat Conversation';
  }
  return item.type.charAt(0).toUpperCase() + item.type.slice(1);
};

// Format message content with code highlighting
const formatMessageContent = (content) => {
  if (!content) return '';

  // Replace code blocks with properly escaped HTML
  let formattedContent = content.replace(/```([\s\S]*?)```/g, (_, codeContent) => {
    // Extract language if specified
    const firstLine = codeContent.trim().split('\n')[0];
    let language = '';
    let code = codeContent;

    if (firstLine && !firstLine.includes('=') && !firstLine.includes('(') && !firstLine.includes('{')) {
      language = firstLine;
      code = codeContent.substring(firstLine.length).trim();
    }

    // Escape HTML tags
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<pre class="bg-gray-100 p-3 rounded-md overflow-x-auto my-2 border border-gray-200"><code class="language-${language} text-sm font-mono">${escapedCode}</code></pre>`;
  });

  // Replace inline code with properly escaped HTML
  formattedContent = formattedContent.replace(/`([^`]+)`/g, (_, code) => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<code class="bg-gray-100 px-1 py-0.5 rounded font-mono text-sm">${escapedCode}</code>`;
  });

  return formattedContent;
};

// Computed filtered history
const filteredHistory = computed(() => {
  if (!historyFilter.value) {
    return aiHistory.value;
  }

  const filter = historyFilter.value.toLowerCase();
  return aiHistory.value.filter(item =>
    item.question.toLowerCase().includes(filter) ||
    (item.answer && item.answer.toLowerCase().includes(filter))
  );
});

// Toggle history panel
const toggleHistory = async () => {
  showHistory.value = !showHistory.value;

  if (showHistory.value) {
    await fetchHistory();
  }
};

// Fetch conversation history
const fetchHistory = async () => {
  try {
    const response = await $fetch('/api/ai/history');
    aiHistory.value = response.history || [];
  } catch (err) {
    console.error('Error fetching history:', err);
    error.value = 'Failed to load conversation history.';

    // Set detailed error information
    if (err.data && err.data.statusMessage) {
      error.value = `Error loading history (${err.status}): ${err.data.statusMessage}`;
      errorDetails.value = JSON.stringify(err.data, null, 2);
    } else if (err.message) {
      errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    }
  }
};


// Load history item
const loadHistoryItem = (item) => {
  showHistory.value = false;

  try {
    // Parse the saved conversation
    const savedChat = JSON.parse(item.answer);
    if (Array.isArray(savedChat)) {
      chatHistory.value = savedChat;

      // Scroll to bottom after loading
      nextTick(() => {
        scrollToBottom();
      });
    }
  } catch (err) {
    console.error('Error loading conversation:', err);
    error.value = 'Failed to load conversation.';
    errorDetails.value = err.stack || JSON.stringify(err, null, 2);
  }
};

// Delete history item
const deleteHistoryItem = async (id) => {
  try {
    await $fetch(`/api/ai/history/${id}`, {
      method: 'DELETE'
    });

    // Remove from local array
    aiHistory.value = aiHistory.value.filter(item => item._id !== id);

    // Show success toast notification
    toast.success('Conversation deleted successfully', 'Deleted', 2000);
  } catch (err) {
    console.error('Error deleting history item:', err);
    error.value = 'Failed to delete history item.';

    // Show error toast notification
    toast.error('Failed to delete conversation', 'Error');

    // Set detailed error information
    if (err.data && err.data.statusMessage) {
      error.value = `Error deleting item (${err.status}): ${err.data.statusMessage}`;
      errorDetails.value = JSON.stringify(err.data, null, 2);
    } else if (err.message) {
      errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    }
  }
};

// Handle mode change
const handleModeChange = () => {
  console.log('🔄 [AI MODE] Mode changed to:', aiMode.value);
  // Clear chat when switching modes for clarity
  if (chatHistory.value.length > 0) {
    const confirmClear = confirm('Switching modes will clear the current conversation. Continue?');
    if (confirmClear) {
      chatHistory.value = [];
    } else {
      // Revert mode change if user cancels
      aiMode.value = aiMode.value === 'normal' ? 'document' : 'normal';
      return;
    }
  }
};

// Send message to AI
const sendMessage = async () => {
  if (!userMessage.value.trim() || isLoading.value) return;

  // Add user message to chat
  const message = userMessage.value.trim();
  chatHistory.value.push({
    content: message,
    isUser: true,
    timestamp: new Date()
  });

  // Clear input
  userMessage.value = '';

  // Scroll to bottom
  await nextTick();
  scrollToBottom();

  // Set loading state
  isLoading.value = true;
  error.value = '';

  try {
    // Add a placeholder for the streaming response
    chatHistory.value.push({
      content: '',
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    });

    // Set streaming state
    isStreaming.value = true;
    streamingMessage.value = '';

    // Scroll to bottom to show the streaming indicator
    await nextTick();
    scrollToBottom();

    // Choose API endpoint based on mode
    const apiEndpoint = aiMode.value === 'document'
      ? '/api/ai/document-generation-stream'
      : '/api/ai/normal-chat-stream';

    // Prepare the request body
    const requestBody = {
      userMessage: message,
      conversationHistory: chatHistory.value
        .filter(msg => !msg.isStreaming)
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => ({
          type: msg.isUser ? 'user' : 'ai',
          content: msg.content
        }))
    };

    // Add document type for document mode
    if (aiMode.value === 'document') {
      requestBody.documentType = 'auto-detect';
    }

    // Get CSRF token
    const { ensureToken } = useCsrf();
    const csrfToken = await ensureToken();

    // Use native fetch with proper headers for SSE
    console.log(`🚀 [UI STREAM] Starting streaming request to ${apiEndpoint} in ${aiMode.value} mode`);
    console.log('📤 [UI STREAM] Request body:', {
      message,
      mode: aiMode.value,
      historyLength: requestBody.conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include', // Include cookies for CSRF
      body: JSON.stringify({
        ...requestBody,
        _csrf: csrfToken // Include CSRF in body as well for double protection
      })
    });

    console.log('📥 [UI STREAM] Server response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    // Get a reader from the response body
    console.log('📖 [UI STREAM] Setting up stream reader');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Process the stream in real-time
    let fullResponse = '';
    let buffer = '';
    let chunkCount = 0;

    console.log('🔄 [UI STREAM] Starting to process stream chunks');
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ [UI STREAM] Stream reading completed');
          break;
        }

        chunkCount++;
        // Decode the chunk and add to buffer
        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;

        console.log(`📦 [UI STREAM] Received chunk ${chunkCount}:`, {
          chunkSize: value.length,
          decodedLength: decodedChunk.length,
          bufferLength: buffer.length,
          chunkPreview: decodedChunk.substring(0, 100) + (decodedChunk.length > 100 ? '...' : '')
        });

        // Process complete SSE messages from buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete chunk in buffer

        console.log(`🔍 [UI STREAM] Processing ${lines.length} complete lines from buffer`);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = line.substring(6);
              console.log('📨 [UI STREAM] Processing SSE line:', jsonData.substring(0, 200) + (jsonData.length > 200 ? '...' : ''));

              const data = JSON.parse(jsonData);
              console.log('📋 [UI STREAM] Parsed data:', {
                type: data.type || 'unknown',
                hasChunk: !!data.chunk,
                chunkLength: data.chunk?.length || 0,
                hasError: !!data.error,
                isDone: !!data.done,
                hasFullResponse: !!data.fullResponse
              });

              if (data.error) {
                console.error('❌ [UI STREAM] Server error:', data.error);
                throw new Error(data.error);
              }

              // Handle new SSE format with type field
              if (data.type === 'chunk' && data.chunk) {
                console.log('📝 [UI STREAM] Adding chunk to streaming message:', {
                  chunkLength: data.chunk.length,
                  chunkPreview: data.chunk.substring(0, 50) + (data.chunk.length > 50 ? '...' : ''),
                  currentStreamingLength: streamingMessage.value.length,
                  fullResponseLength: fullResponse.length
                });

                // Update the streaming message
                streamingMessage.value += data.chunk;
                fullResponse += data.chunk;

                // Update the last message in chat history
                const lastMessage = chatHistory.value[chatHistory.value.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.content = streamingMessage.value;
                  console.log('🔄 [UI STREAM] Updated UI message length:', lastMessage.content.length);
                }

                // Scroll to bottom as content arrives
                scrollToBottom();
              }

              // Handle completion with action buttons
              if (data.type === 'complete' && data.response) {
                console.log('🏁 [UI STREAM] Stream completion event received with response:', {
                  hasMessage: !!data.response.message,
                  hasActionButtons: !!(data.response.actionButtons && data.response.actionButtons.length > 0),
                  actionButtonsCount: data.response.actionButtons?.length || 0,
                  action: data.response.action
                });

                // Update the final message
                const lastMessage = chatHistory.value[chatHistory.value.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.content = data.response.message;
                  lastMessage.actionButtons = data.response.actionButtons || [];
                  lastMessage.isStreaming = false;
                  console.log('✅ [UI STREAM] Finalized message with action buttons:', {
                    messageLength: lastMessage.content.length,
                    actionButtonsCount: lastMessage.actionButtons.length
                  });
                }
                fullResponse = data.response.message;
              }

              // Legacy format support
              if (data.chunk && !data.type) {
                streamingMessage.value += data.chunk;
                fullResponse += data.chunk;
                const lastMessage = chatHistory.value[chatHistory.value.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.content = streamingMessage.value;
                }
                scrollToBottom();
              }

              if (data.done && !data.type) {
                console.log('🏁 [UI STREAM] Legacy completion event received');
                if (data.fullResponse) {
                  fullResponse = data.fullResponse;
                }
              }
            } catch (e) {
              console.error('💥 [UI STREAM] Error parsing SSE message:', {
                error: e.message,
                line: line.substring(0, 200) + (line.length > 200 ? '...' : '')
              });
            }
          }
        }
      }

      console.log('🎯 [UI STREAM] Finalizing streaming message:', {
        totalChunks: chunkCount,
        finalResponseLength: fullResponse.length,
        streamingMessageLength: streamingMessage.value.length,
        responsePreview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : '')
      });

      // Finalize the message when stream is complete
      const lastMessage = chatHistory.value[chatHistory.value.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        console.log('✅ [UI STREAM] Finalizing last message:', {
          beforeLength: lastMessage.content.length,
          afterLength: fullResponse.length,
          wasStreaming: lastMessage.isStreaming
        });
        lastMessage.content = fullResponse;
        lastMessage.isStreaming = false;
      } else {
        console.warn('⚠️ [UI STREAM] No streaming message found to finalize');
      }
    } catch (streamError) {
      console.error('💥 [UI STREAM] Stream processing error:', {
        message: streamError.message,
        stack: streamError.stack,
        timestamp: new Date().toISOString()
      });
      throw streamError;
    } finally {
      console.log('🔓 [UI STREAM] Releasing reader lock');
      reader.releaseLock();
    }

    // Reset streaming state
    isStreaming.value = false;

    // Scroll to bottom when complete
    await nextTick();
    scrollToBottom();

    // Auto-save removed - user must manually save conversations
  } catch (err) {
    console.error('💥 [UI STREAM] Error getting answer:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      status: err.status,
      data: err.data,
      timestamp: new Date().toISOString()
    });

    // Set main error message
    error.value = 'Failed to get an answer from the AI service.';

    // Set detailed error information
    if (err.data && err.data.statusMessage) {
      error.value = `Error (${err.status}): ${err.data.statusMessage}`;
      errorDetails.value = JSON.stringify(err.data, null, 2);
    } else if (err.message) {
      error.value = err.message;
      errorDetails.value = err.stack || 'No additional details available';
    }

    // Remove the streaming message placeholder if it exists
    const lastMessage = chatHistory.value[chatHistory.value.length - 1];
    if (lastMessage && lastMessage.isStreaming) {
      console.log('🗑️ [UI STREAM] Removing streaming message placeholder due to error');
      chatHistory.value.pop();
    }

    // Reset streaming state
    console.log('🔄 [UI STREAM] Resetting streaming state due to error');
    isStreaming.value = false;
  } finally {
    console.log('🏁 [UI STREAM] Finalizing send message operation');
    isLoading.value = false;
  }
};

// Clear the current chat
const clearChat = () => {
  chatHistory.value = [];
  error.value = '';
  errorDetails.value = '';
};

// Initialize toast
const toast = useToast();

// Copy message to clipboard
const copyToClipboard = (text) => {
  // Remove HTML tags for clipboard copy
  const plainText = text.replace(/<[^>]*>/g, '');

  navigator.clipboard.writeText(plainText)
    .then(() => {
      // Show success toast notification
      toast.success('Message copied to clipboard', 'Success', 2000);
    })
    .catch(err => {
      console.error('Failed to copy text:', err);
      toast.error('Failed to copy text', 'Error');
    });
};

// Handle action button clicks
const handleActionButton = async (button) => {
  console.log('🔘 [ACTION BUTTON] Button clicked:', button);

  if (button.action === 'download_document') {
    try {
      // Call the existing document generation API
      const response = await $fetch('/api/ai/generate-document-intelligent', {
        method: 'POST',
        body: {
          request: button.data.request || button.data.content,
          documentType: button.data.documentType || 'quotation',
          format: button.data.format || 'excel',
          details: button.data.details || {}
        }
      });

      if (response.success && response.downloadUrl) {
        // Trigger download
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = response.filename || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`${button.data.format?.toUpperCase() || 'Document'} file downloaded successfully`, 'Document Generated!');
      } else {
        throw new Error(response.error || 'Failed to generate document');
      }
    } catch (error) {
      console.error('Document generation error:', error);
      toast.error(error.message || 'Could not generate document', 'Generation Failed');
    }
  } else if (button.action === 'ask_followup') {
    // Add the follow-up question to the input
    userMessage.value = button.data.question || '';
  } else if (button.action === 'explain_more') {
    // Send an explanation request
    userMessage.value = `Please explain more about: ${button.data.topic}`;
    await sendMessage();
  } else if (button.action === 'configure_ai') {
    // Open AI configuration
    toast.info('Please configure your AI settings in the settings page', 'AI Configuration');
  }
};

// Scroll chat to bottom
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// Watch for changes in chat history to scroll to bottom
watch(
  () => chatHistory.value.length,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  }
);

// Auto-save functionality removed - only manual saving is available

// Manual save conversation to history (with UI feedback)
const saveConversation = async () => {
  if (chatHistory.value.length < 2) return;

  try {
    // Get the first user message as the title/question
    const firstUserMessage = chatHistory.value.find(msg => msg.isUser)?.content || 'Chat conversation';

    await $fetch('/api/ai/history', {
      method: 'POST',
      body: {
        type: 'chat',
        question: firstUserMessage,
        answer: JSON.stringify(chatHistory.value),
        metadata: {
          isFullConversation: true,
          messageCount: chatHistory.value.length,
          model: 'Gemini 2.5 Flash Preview',
          manualSaved: true
        }
      }
    });

    // Show success toast notification
    toast.success('Conversation saved successfully', 'Saved', 2000);
  } catch (err) {
    console.error('Error saving conversation:', err);
    error.value = 'Failed to save conversation. Please try again.';

    // Show error toast notification
    toast.error('Failed to save conversation', 'Error');

    // Set detailed error information
    if (err.data && err.data.statusMessage) {
      error.value = `Error saving conversation (${err.status}): ${err.data.statusMessage}`;
      errorDetails.value = JSON.stringify(err.data, null, 2);
    } else if (err.message) {
      error.value = err.message;
      errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    }
  }
};

// Export conversation to PDF (with HTML fallback)
const exportToPDF = async () => {
  if (chatHistory.value.length === 0) return;

  try {
    // Get the first user message as the title
    const firstUserMessage = chatHistory.value.find(msg => msg.isUser)?.content || 'Chat conversation';
    const title = firstUserMessage.length > 50
      ? firstUserMessage.substring(0, 50) + '...'
      : firstUserMessage;

    // Call the API to generate the PDF
    const response = await $fetch('/api/ai/export-chat-pdf', {
      method: 'POST',
      body: {
        chatHistory: chatHistory.value,
        title,
        filename: 'ai-chat-' + new Date().toISOString().split('T')[0]
      },
      responseType: 'blob'
    });

    // Determine content type from response
    const contentType = response.type;
    const isHTML = contentType === 'text/html';
    const fileExtension = isHTML ? 'html' : 'pdf';

    // Create a blob URL and trigger download
    const blob = new Blob([response], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-chat-${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();

    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // Show success toast notification
      toast.success(`Conversation exported as ${fileExtension.toUpperCase()}`, 'Exported', 2000);
    }, 100);
  } catch (err) {
    console.error('Error exporting conversation:', err);
    error.value = 'Failed to export conversation. Please try again.';

    // Show error toast notification
    toast.error('Failed to export conversation', 'Error');

    // Set detailed error information
    if (err.data && err.data.statusMessage) {
      error.value = `Error exporting conversation (${err.status}): ${err.data.statusMessage}`;
      errorDetails.value = JSON.stringify(err.data, null, 2);
    } else if (err.message) {
      errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    }
  }
};

</script>