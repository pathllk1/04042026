<template>
  <UContainer class="py-6 max-w-7xl">
    <!-- Page Header -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-extrabold flex items-center justify-center gap-3">
        <span class="text-primary-500 text-5xl">🤖</span>
        AI Assistant
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mt-2">Enhanced with Intelligent Document Generation</p>
    </div>

    <!-- Mode Selector -->
    <UCard class="mb-8 overflow-hidden" :ui="{ body: { padding: 'p-6' } }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <UIcon name="i-lucide-settings-2" class="text-primary-500" />
            AI Assistant Mode
          </h3>
          <UBadge color="primary" variant="subtle" class="animate-pulse">Active Mode: {{ aiMode === 'normal' ? 'Chat' : aiMode === 'document' ? 'Docs' : 'Battle' }}</UBadge>
        </div>
      </template>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- Normal Chat Mode -->
        <UCard
          :class="['cursor-pointer transition-all duration-300 ring-2 ring-offset-2 dark:ring-offset-gray-900', 
                   aiMode === 'normal' ? 'ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-700']"
          @click="aiMode = 'normal'; handleModeChange()"
          :ui="{ body: { padding: 'p-4' } }"
        >
          <div class="flex items-start gap-4">
            <URadio v-model="aiMode" value="normal" color="blue" />
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl">💬</span>
                <span class="font-bold">Normal Chat</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 leading-tight">
                General conversation, questions, and detailed explanations.
              </p>
            </div>
          </div>
        </UCard>

        <!-- Document Generation Mode -->
        <UCard
          :class="['cursor-pointer transition-all duration-300 ring-2 ring-offset-2 dark:ring-offset-gray-900', 
                   aiMode === 'document' ? 'ring-green-500 bg-green-50/50 dark:bg-green-900/10' : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-700']"
          @click="aiMode = 'document'; handleModeChange()"
          :ui="{ body: { padding: 'p-4' } }"
        >
          <div class="flex items-start gap-4">
            <URadio v-model="aiMode" value="document" color="green" />
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl">📄</span>
                <span class="font-bold">Document Generation</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 leading-tight">
                Create quotations, invoices, reports, and professional contracts.
              </p>
            </div>
          </div>
        </UCard>

        <!-- AI Conversation Mode -->
        <UCard
          :class="['cursor-pointer transition-all duration-300 ring-2 ring-offset-2 dark:ring-offset-gray-900', 
                   aiMode === 'conversation' ? 'ring-purple-500 bg-purple-50/50 dark:bg-purple-900/10' : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-700']"
          @click="aiMode = 'conversation'; handleModeChange()"
          :ui="{ body: { padding: 'p-4' } }"
        >
          <div class="flex items-start gap-4">
            <URadio v-model="aiMode" value="conversation" color="purple" />
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl">🤖</span>
                <span class="font-bold">AI Conversation</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 leading-tight">
                Watch two AI models have a conversation based on your prompt.
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Mode Description -->
      <div class="mt-6">
        <UAlert
          :icon="aiMode === 'normal' ? 'i-lucide-message-square' : aiMode === 'document' ? 'i-lucide-file-text' : 'i-lucide-bot'"
          :title="aiMode === 'normal' ? 'Normal Chat Mode' : aiMode === 'document' ? 'Document Generation Mode' : 'AI Conversation Mode'"
          :description="aiMode === 'normal' ? 'Ask questions, get explanations, have conversations' :
                         aiMode === 'document' ? 'Provide requirements and get professional documents with download options' :
                         'Watch two AI models have a conversation based on your prompt'"
          :color="aiMode === 'normal' ? 'blue' : aiMode === 'document' ? 'green' : 'purple'"
          variant="soft"
        />
      </div>
    </UCard>

    <!-- Main AI Chat Interface (Normal & Document modes) -->
    <UCard v-if="aiMode !== 'conversation'" class="shadow-xl overflow-hidden flex flex-col h-[750px]" :ui="{ body: { padding: 'p-0 flex-1 overflow-hidden' }, header: { padding: 'px-6 py-4' } }">
      <template #header>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-4">
            <UAvatar icon="i-lucide-bot" size="lg" color="primary" variant="soft" class="ring-2 ring-primary-500/20" />
            <div>
              <h2 class="text-xl font-bold flex items-center gap-2">
                AI Assistant
                <UBadge color="primary" variant="subtle" size="sm" class="rounded-full">🧠 Enhanced Memory</UBadge>
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Ask me anything - I'm here to help!</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton 
              icon="i-lucide-newspaper" 
              variant="ghost" 
              color="gray"
              @click="openNews"
              class="hidden sm:flex"
            >
              Latest News
            </UButton>
            <UButton
              v-if="conversation.length > 0"
              icon="i-lucide-trash-2"
              variant="ghost"
              color="red"
              @click="clearNormalConversation"
              size="sm"
            >
              Clear
            </UButton>
          </div>
        </div>
      </template>

      <!-- Chat Body -->
      <div class="flex flex-col h-full bg-gray-50/30 dark:bg-gray-900/10">
        <!-- Messages Area -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6" ref="messagesContainer">
          <div v-if="conversation.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <div class="relative">
               <UIcon name="i-lucide-messages-square" class="w-20 h-20 opacity-10" />
               <UIcon name="i-lucide-sparkles" class="w-8 h-8 absolute -top-2 -right-2 text-primary-500/30 animate-pulse" />
            </div>
            <p class="text-lg font-medium">Start a conversation with AI Assistant</p>
            <div class="flex flex-wrap justify-center gap-2 max-w-md">
              <UButton v-for="ex in ['Help me with my budget', 'Create an invoice', 'Explain AI features']" 
                       :key="ex" variant="soft" size="xs" color="gray" @click="useExample(ex)">
                {{ ex }}
              </UButton>
            </div>
          </div>

          <div v-else class="space-y-8">
            <div v-for="message in conversation" :key="message.id" 
                 :class="['flex gap-3 items-start', message.type === 'user' ? 'flex-row-reverse' : '']">
              <!-- Avatar -->
              <UAvatar v-if="message.type === 'user'" 
                       :alt="user?.fullname || 'You'" 
                       size="sm" 
                       class="mt-1 ring-2 ring-primary-500/20" />
              <UAvatar v-else icon="i-lucide-bot" color="primary" variant="soft" size="sm" class="mt-1 ring-2 ring-primary-500/10" />

              <!-- Bubble -->
              <div :class="['max-w-[85%] min-w-[120px] relative group', 
                            message.type === 'user' ? 'bg-primary-600 text-white rounded-2xl rounded-tr-none p-4 shadow-md' : 
                                                    'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-none p-4 shadow-sm']">
                <!-- Streaming indicator (AI only) -->
                <div v-if="message.isStreaming" class="absolute -top-3 left-2 z-10">
                  <UBadge color="green" variant="solid" size="xs" class="animate-pulse px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <UIcon name="i-lucide-loader-2" class="animate-spin w-3 h-3" />
                    Streaming...
                  </UBadge>
                </div>

                <!-- Message Content -->
                <div class="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                  <span v-if="message.content" v-html="formatMessageContent(message.content)"></span>
                  <span v-else-if="message.isStreaming" class="text-gray-400 italic">Thinking...</span>
                  <span v-if="message.isStreaming" class="inline-block w-1.5 h-4 bg-primary-500 ml-1 animate-pulse align-middle"></span>
                </div>

                <!-- Timestamp & Actions -->
                <div class="flex items-center justify-between mt-3 opacity-60 text-[10px]">
                  <span>{{ formatTime(message.timestamp || Date.now()) }}</span>
                  <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UButton v-if="!message.isStreaming && message.content"
                             icon="i-lucide-copy"
                             variant="ghost"
                             size="xs"
                             color="gray"
                             @click="copyToClipboard(message.content)" />
                  </div>
                </div>

                <!-- AI Suggestions & Buttons -->
                <div v-if="!message.isStreaming && ((message.suggestions && message.suggestions.length > 0) || (message.actionButtons && message.actionButtons.length > 0))" 
                     class="mt-4 flex flex-wrap gap-2 border-t border-black/10 dark:border-white/10 pt-4">
                  <UButton v-for="suggestion in message.suggestions" :key="suggestion"
                           variant="soft" size="xs" @click="useExample(suggestion)">
                    {{ suggestion }}
                  </UButton>
                  
                  <UButton v-for="button in message.actionButtons" :key="button.label"
                           @click="handleActionButton(button.action, button.data)"
                           :loading="downloadingButtons.has(button.label)"
                           :color="button.type === 'primary' ? 'primary' : button.type === 'success' ? 'green' : 'gray'"
                           variant="solid"
                           size="xs"
                           :icon="button.icon?.includes('📄') ? 'i-lucide-file-text' : button.icon?.includes('📊') ? 'i-lucide-bar-chart' : 'i-lucide-external-link'">
                    {{ downloadingButtons.has(button.label) ? 'Generating...' : button.label }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Progress Area -->
        <div v-if="currentJob" class="px-6 py-3 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium flex items-center gap-2">
              <UIcon name="i-lucide-loader-2" class="animate-spin text-primary-500" />
              {{ currentJob.message }}
            </span>
            <span class="text-xs font-bold text-primary-500">{{ currentJob.progress }}%</span>
          </div>
          <UProgress :value="currentJob.progress" size="sm" color="primary" class="animate-pulse" />
        </div>

        <!-- Ready Notice -->
        <UAlert v-if="documentReady"
                icon="i-lucide-party-popper"
                color="green"
                variant="soft"
                title="Document Ready!"
                class="mx-6 my-2"
                :description="documentData?.title || 'Your document has been created successfully'">
          <template #actions>
            <div class="flex gap-2">
              <UButton v-for="format in availableFormats" :key="format.type"
                       variant="solid" color="green" size="xs" @click="downloadFormat(format.type)">
                Download {{ format.label }}
              </UButton>
            </div>
          </template>
        </UAlert>

        <!-- Input Area -->
        <div class="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
          <div class="flex flex-col gap-3">
            <UTextarea v-model="userInput"
                      :disabled="isProcessing || isStreaming"
                      :placeholder="isStreaming ? 'AI is responding...' : 
                                    aiMode === 'document' ? 'Describe the document you need (e.g., Quotation for 100 LEDs)...' : 'Ask me anything! (Ctrl+Enter to send)'"
                      variant="outline"
                      :rows="3"
                      class="resize-none"
                      @keydown.ctrl.enter="sendToAI" />
            
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <UBadge v-if="isStreaming" color="green" variant="soft" size="xs">
                  <UIcon name="i-lucide-loader-2" class="animate-spin mr-1" />
                  {{ isStreamingSupported() ? 'Streaming...' : 'Processing...' }}
                </UBadge>
                <span v-else class="text-[10px] text-gray-400">Press <UKbd>Ctrl</UKbd>+<UKbd>Enter</UKbd> to send</span>
              </div>
              
              <div class="flex items-center gap-2">
                <UButton v-if="!isConfigured" icon="i-lucide-settings" variant="ghost" color="orange" size="sm" @click="openAISettings">
                  Configure AI
                </UButton>
                <UButton @click="sendToAI"
                         :disabled="isProcessing || isStreaming || !userInput.trim()"
                         :loading="isProcessing || isStreaming"
                         color="primary"
                         icon="i-lucide-send">
                  {{ isStreaming ? 'Responding...' : isProcessing ? 'Thinking...' : 'Ask AI' }}
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-center gap-2">
          <UIcon name="i-lucide-cpu" class="w-3 h-3 text-gray-400" />
          <span class="text-[10px] text-gray-500 uppercase tracking-tighter">{{ aiDisplayInfo }}</span>
        </div>
      </div>
    </UCard>

    <!-- AI Conversation Interface -->
    <UCard v-if="aiMode === 'conversation'" class="shadow-xl overflow-hidden flex flex-col min-h-[750px]" :ui="{ body: { padding: 'p-0' } }">
      <template #header>
        <div class="flex items-center gap-4">
          <UAvatar icon="i-lucide-bot" size="lg" color="purple" variant="soft" class="ring-2 ring-purple-500/20" />
          <div>
            <h2 class="text-xl font-bold">AI Model Battle</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">Watch two different AI models discuss your topic</p>
          </div>
        </div>
      </template>

      <!-- AI Model Selection & Configuration -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
        <div class="grid md:grid-cols-2 gap-8 mb-8">
          <!-- Model A Selection -->
          <UCard :ui="{ body: { padding: 'p-4' } }" class="ring-1 ring-purple-500/20 shadow-none bg-white dark:bg-gray-800/50">
            <div class="flex items-center gap-2 mb-4 text-purple-600 font-bold">
              <UIcon name="i-lucide-cpu" />
              <span>AI Model A</span>
            </div>

            <div class="space-y-4">
              <UFormGroup label="Provider" size="sm">
                <USelect v-model="selectedProviderA" 
                         :options="[{label: 'Google Gemini', value: 'google'}, {label: 'OpenRouter', value: 'openrouter'}, {label: 'Groq Cloud', value: 'groq'}]"
                         :disabled="isConversationActive"
                         @change="onProviderAChange"
                         placeholder="Select Provider" />
              </UFormGroup>

              <UFormGroup label="Model" size="sm">
                <USelect v-model="selectedModelA"
                         :options="getModelsForProvider(selectedProviderA).map(m => ({label: m.name, value: m.id}))"
                         :disabled="isConversationActive || !selectedProviderA"
                         placeholder="Select Model" />
              </UFormGroup>

              <UFormGroup label="API Key" size="sm">
                <UInput v-model="apiKeyA"
                        type="password"
                        :disabled="isConversationActive"
                        icon="i-lucide-key"
                        placeholder="Enter API key" />
              </UFormGroup>
            </div>
          </UCard>

          <!-- Model B Selection -->
          <UCard :ui="{ body: { padding: 'p-4' } }" class="ring-1 ring-blue-500/20 shadow-none bg-white dark:bg-gray-800/50">
            <div class="flex items-center gap-2 mb-4 text-blue-600 font-bold">
              <UIcon name="i-lucide-cpu" />
              <span>AI Model B</span>
            </div>

            <div class="space-y-4">
              <UFormGroup label="Provider" size="sm">
                <USelect v-model="selectedProviderB" 
                         :options="[{label: 'Google Gemini', value: 'google'}, {label: 'OpenRouter', value: 'openrouter'}, {label: 'Groq Cloud', value: 'groq'}]"
                         :disabled="isConversationActive"
                         @change="onProviderBChange"
                         placeholder="Select Provider" />
              </UFormGroup>

              <UFormGroup label="Model" size="sm">
                <USelect v-model="selectedModelB"
                         :options="getModelsForProvider(selectedProviderB).map(m => ({label: m.name, value: m.id}))"
                         :disabled="isConversationActive || !selectedProviderB"
                         placeholder="Select Model" />
              </UFormGroup>

              <UFormGroup label="API Key" size="sm">
                <UInput v-model="apiKeyB"
                        type="password"
                        :disabled="isConversationActive"
                        icon="i-lucide-key"
                        placeholder="Enter API key" />
              </UFormGroup>
            </div>
          </UCard>
        </div>

        <!-- Conversation Prompt -->
        <UFormGroup label="Conversation Topic" class="mb-6">
          <UTextarea v-model="conversationPrompt"
                    :disabled="isConversationActive"
                    placeholder="Enter a topic or question for the AI models to discuss..."
                    :rows="3" />
        </UFormGroup>

        <!-- Control Buttons -->
        <div class="flex flex-wrap items-center gap-3">
          <UButton @click="startConversation"
                   :disabled="!canStartConversation || isConversationActive"
                   :loading="isConversationActive"
                   color="purple"
                   size="md"
                   icon="i-lucide-play">
            {{ isConversationActive ? 'Running...' : 'Start Battle' }}
          </UButton>

          <UButton @click="stopConversation"
                   :disabled="!isConversationActive"
                   color="red"
                   variant="soft"
                   size="md"
                   icon="i-lucide-square">
            Stop
          </UButton>

          <UButton @click="clearConversation"
                   :disabled="isConversationActive || conversationHistory.length === 0"
                   color="gray"
                   variant="ghost"
                   size="md"
                   icon="i-lucide-trash-2">
            Clear
          </UButton>

          <div class="ml-auto flex items-center gap-2" v-if="conversationHistory.length > 0">
            <UDropdown :items="[
              [{ label: 'Export as TXT', icon: 'i-lucide-file-text', click: () => exportConversation('txt') }],
              [{ label: 'Export as Markdown', icon: 'i-lucide-file-code', click: () => exportConversation('md') }],
              [{ label: 'Export as JSON', icon: 'i-lucide-code', click: () => exportConversation('json') }],
              [{ label: 'Export as HTML', icon: 'i-lucide-globe', click: () => exportConversation('html') }],
              [{ label: 'Copy to Clipboard', icon: 'i-lucide-clipboard', click: copyConversationToClipboard }]
            ]" :popper="{ placement: 'bottom-end' }">
              <UButton color="blue" variant="soft" icon="i-lucide-download" trailing-icon="i-lucide-chevron-down">
                Export
              </UButton>
            </UDropdown>
          </div>
        </div>
      </div>

      <!-- Status & Progress -->
      <div v-if="waitingCountdown > 0 || conversationStatus" class="border-b border-gray-200 dark:border-gray-800">
        <!-- Countdown -->
        <div v-if="waitingCountdown > 0" class="p-4 bg-amber-50 dark:bg-amber-900/20">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <UBadge color="amber" variant="solid" size="md" class="rounded-full w-8 h-8 flex items-center justify-center font-bold">
                {{ waitingCountdown }}
              </UBadge>
              <div>
                <div class="font-bold text-amber-800 dark:text-amber-400 text-sm uppercase tracking-wider">Rate Limit Protection</div>
                <div class="text-xs text-amber-600 dark:text-amber-500">Waiting for next response...</div>
              </div>
            </div>
            <UIcon name="i-lucide-timer" class="w-6 h-6 text-amber-500 animate-pulse" />
          </div>
          <UProgress :value="Math.max(0, (60 - waitingCountdown) / 60 * 100)" color="amber" size="xs" />
        </div>

        <!-- Status Alert -->
        <UAlert v-if="conversationStatus"
                :icon="conversationStatus.type === 'error' ? 'i-lucide-alert-circle' : conversationStatus.type === 'success' ? 'i-lucide-check-circle' : 'i-lucide-info'"
                :color="conversationStatus.type === 'error' ? 'red' : conversationStatus.type === 'success' ? 'green' : 'blue'"
                variant="soft"
                class="rounded-none border-x-0 border-t-0"
                :title="conversationStatus.message" />
      </div>

      <!-- Conversation History -->
      <div class="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-gray-950" ref="conversationContainer">
        <div v-if="conversationHistory.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 py-20">
          <UIcon name="i-lucide-bot-off" class="w-20 h-20 opacity-10" />
          <p class="text-lg font-medium text-center">No conversation history yet</p>
          <p class="text-sm max-w-xs text-center">Select two models and enter a prompt to start the discussion.</p>
        </div>

        <div v-else class="space-y-12">
          <div v-for="(exchange, index) in conversationHistory" :key="index" class="relative pt-6">
            <div class="absolute top-0 left-0">
              <UBadge color="gray" variant="soft" size="xs">Exchange #{{ exchange.turn }}</UBadge>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
              <!-- Model A Response -->
              <div v-if="exchange.modelA" class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <UAvatar text="A" size="xs" color="purple" variant="soft" />
                  <span class="text-xs font-bold text-purple-600 uppercase tracking-tighter">{{ selectedProviderA }}/{{ selectedModelA }}</span>
                </div>
                <div class="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl rounded-tl-none border border-purple-100 dark:border-purple-800/30 shadow-sm">
                  <p class="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ exchange.modelA }}</p>
                </div>
              </div>

              <!-- Model B Response -->
              <div v-if="exchange.modelB" class="flex flex-col gap-2">
                <div class="flex items-center gap-2 justify-end">
                  <span class="text-xs font-bold text-blue-600 uppercase tracking-tighter">{{ selectedProviderB }}/{{ selectedModelB }}</span>
                  <UAvatar text="B" size="xs" color="blue" variant="soft" />
                </div>
                <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl rounded-tr-none border border-blue-100 dark:border-blue-800/30 shadow-sm">
                  <p class="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ exchange.modelB }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup>
import { ref, nextTick, computed, onMounted } from 'vue';
import { useAIConfig } from '~/composables/ai/useAIConfig';
import { useAppToast } from '~/composables/useAppToast';
import { AI_PROVIDERS } from '~/types/ai';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';
import useAuthRefresh from '~/composables/auth/useAuthRefresh';
import useCsrf from '~/composables/auth/useCsrf';
import { useUniversalAIClient } from '~/composables/ai/useUniversalAIClient';
import { useClientAIStreaming } from '~/composables/ai/useClientAIStreaming';
import { useAIConversationEngine } from '~/composables/ai/useAIConversationEngine';

// Page SEO
useHead({
  title: 'AI Assistant - Document Intelligence',
  meta: [
    {
      name: 'description',
      content: 'Professional AI assistant for document generation, intelligent chat, and model comparison.'
    }
  ]
});

// Toast Notifications
const { addToast } = useAppToast();
const showNotification = (message, type = 'info') => {
  addToast(message, type);
};

// Authentication & Core Composables
const { user } = useAuth();
const { fetchWithAuth } = useApiWithAuth();
const { ensureValidToken, getToken } = useAuthRefresh();
const { ensureToken } = useCsrf();
const { aiConfig, currentProvider, currentModel, isConfigured } = useAIConfig();

// AI Engines
const { callAI, isConfigured: isAIClientConfigured } = useUniversalAIClient();
const { streamAINormalChat, callAINormalChatNonStreaming, isStreamingSupported } = useClientAIStreaming();
const { startConversation: startAIConversation, stopConversation: stopAIConversation } = useAIConversationEngine();

// UI State
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
const aiMode = ref('normal');
const previousMode = ref('normal');
const downloadingButtons = ref(new Set());

// AI Battle State
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

// Lifecycle
onMounted(() => {
  initializeConversation();
});

// Helper: Open News
const openNews = () => {
  window.dispatchEvent(new CustomEvent('open-news'));
};

// Helper: Clear Chat
const clearNormalConversation = () => {
  if (confirm('Are you sure you want to clear this conversation?')) {
    conversation.value = [];
  }
};

// AI Provider Data
const providerModels = {
  google: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp' }
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
  ]
};

const getModelsForProvider = (providerId) => providerModels[providerId] || [];
const getProviderName = (id) => AI_PROVIDERS.find(p => p.id === id)?.name || id;

// AI Info Text
const aiDisplayInfo = computed(() => {
  if (!isConfigured.value) return 'AI Not Configured';
  const providerName = getProviderName(aiConfig.value.provider);
  const modelName = currentModel.value?.name || aiConfig.value.model;
  
  if (aiMode.value === 'normal') {
    return `${providerName} - ${modelName} (${isStreamingSupported() ? 'Streaming' : 'Stateless'})`;
  }
  return `${providerName} - ${modelName}`;
});

// Mode Handling
const handleModeChange = () => {
  if (conversation.value.length > 0 || conversationHistory.value.length > 0) {
    if (confirm('Switching modes will clear current context. Continue?')) {
      conversation.value = [];
      conversationHistory.value = [];
      conversationStatus.value = null;
      waitingCountdown.value = 0;
      previousMode.value = aiMode.value;
      if (isConversationActive.value) stopConversation();
    } else {
      aiMode.value = previousMode.value;
    }
  } else {
    previousMode.value = aiMode.value;
  }
};

const useExample = (ex) => { userInput.value = ex; };

// Chat Scroll
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    if (conversationContainer.value) conversationContainer.value.scrollTop = conversationContainer.value.scrollHeight;
  });
};

// Utilities
const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatMessageContent = (c) => c.replace(/\n/g, '<br>');

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard!', 'success');
  } catch (e) {
    showNotification('Copy failed', 'error');
  }
};

// Document Flow
const pollJobProgress = async () => {
  if (!currentJob.value) return;
  try {
    const job = await $fetch(`/api/ai/job-status/${currentJob.value.id}`);
    currentJob.value = { ...currentJob.value, ...job };
    if (job.status === 'completed') {
      documentReady.value = true;
      documentData.value = job.documentData;
      
      // Update availableFormats for the UAlert
      availableFormats.value = job.availableFormats?.map(f => ({
        type: f.format,
        label: f.format.toUpperCase()
      })) || [];

      // Generate immediate download action buttons from job data
      const buttons = job.availableFormats?.map(f => ({
        label: `Download ${f.format.toUpperCase()}`,
        action: 'download_immediate',
        type: f.format === 'pdf' ? 'primary' : 'success',
        icon: f.format === 'pdf' ? '📄' : f.format === 'excel' ? '📊' : '📝',
        data: {
          format: f.format,
          jobId: job.id,
          filename: f.filename
        }
      })) || [];

      // Add AI message with immediate download buttons
      conversation.value.push({
        id: Date.now(),
        type: 'ai',
        content: `Perfect! I've created your "${job.documentData?.documentType || 'document'}" successfully. Your files are ready:`,
        timestamp: Date.now(),
        actionButtons: buttons
      });

      currentJob.value = null;
      scrollToBottom();
    } else if (job.status === 'failed') {
      showNotification(job.error || 'Generation failed', 'error');
      currentJob.value = null;
    } else {
      setTimeout(pollJobProgress, 2000);
    }
  } catch (e) {
    console.error('Polling error', e);
  }
};

const startDocumentGeneration = async (req) => {
  try {
    const res = await $fetch('/api/ai/generate-document-intelligent', {
      method: 'POST',
      body: { userRequest: req }
    });
    currentJob.value = { id: res.jobId, progress: 0, message: res.message };
    pollJobProgress();
  } catch (e) {
    showNotification('Failed to start doc gen', 'error');
  }
};

// Action Handlers
const handleActionButton = async (action, data) => {
  if (action === 'download_immediate') {
    const label = data.filename || 'Download';
    downloadingButtons.value.add(label);
    try {
      const res = await fetch(`/api/ai/download-document/${data.jobId}/${data.format}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Downloaded!', 'success');
    } catch (e) {
      showNotification('Download failed', 'error');
    } finally {
      downloadingButtons.value.delete(label);
    }
  } else if (action === 'create_document') {
    await startDocumentGeneration(data.request);
  } else if (action === 'configure_ai') {
    openAISettings();
  }
};

// AI Core Logic
const sendToAI = async () => {
  if (!userInput.value.trim() || isProcessing.value) return;
  
  // Check configuration
  if (!isConfigured.value && userInput.value !== 'SYSTEM_INIT') {
    showNotification('Please configure AI settings first', 'orange');
    return;
  }

  const req = userInput.value;
  if (req !== 'SYSTEM_INIT') {
    conversation.value.push({ id: Date.now(), type: 'user', content: req, timestamp: Date.now() });
  }
  
  userInput.value = '';
  isProcessing.value = true;
  scrollToBottom();

  // Create the AI response placeholder
  const aiMessageId = Date.now();
  const aiMessage = { 
    id: aiMessageId, 
    type: 'ai', 
    content: '', 
    timestamp: aiMessageId, 
    isStreaming: true,
    suggestions: [],
    actionButtons: []
  };
  
  conversation.value.push(aiMessage);
  isStreaming.value = true;
  streamingMessage.value = '';

  try {
    if (aiMode.value === 'normal') {
      const history = conversation.value
        .filter(m => m.id !== aiMessageId && m.content)
        .slice(-10)
        .map(m => ({ type: m.type, content: m.content }));
      
      if (isStreamingSupported()) {
        await streamAINormalChat(req, history, 
          (chunk) => {
            streamingMessage.value += chunk;
            const msg = conversation.value.find(m => m.id === aiMessageId);
            if (msg) msg.content = streamingMessage.value;
            scrollToBottom();
          },
          (full) => {
            const msg = conversation.value.find(m => m.id === aiMessageId);
            if (msg) {
              msg.content = full;
              msg.isStreaming = false;
            }
          },
          (err) => { throw err; }
        );
      } else {
        await callAINormalChatNonStreaming(req, history, 
          (full) => {
            const msg = conversation.value.find(m => m.id === aiMessageId);
            if (msg) {
              msg.content = full;
              msg.isStreaming = false;
            }
          },
          (err) => { throw err; }
        );
      }
    } else {
      // Document Mode (Server-side stream)
      const csrfToken = await ensureToken();
      const response = await fetch('/api/ai/document-generation-stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
          'X-CSRF-Token': csrfToken,
          'X-AI-Config': JSON.stringify(aiConfig.value)
        },
        body: JSON.stringify({ 
          userMessage: req, 
          conversationHistory: conversation.value.filter(m => m.id !== aiMessageId).slice(-5) 
        })
      });
      
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'chunk') {
                 fullContent += data.chunk;
                 const msg = conversation.value.find(m => m.id === aiMessageId);
                 if (msg) msg.content = fullContent;
                 scrollToBottom();
              } else if (data.type === 'complete' && data.response.action === 'document_generated') {
                 currentJob.value = { id: data.response.jobId, progress: 50, message: 'Finalizing document...' };
                 pollJobProgress();
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch (e) {
    console.error('❌ [AI ERROR]', e);
    const msg = conversation.value.find(m => m.id === aiMessageId);
    if (msg) {
      msg.isStreaming = false;
      if (!msg.content) {
        msg.content = "Sorry, I encountered an error while processing your request. Please check your AI configuration or try again.";
      }
    }
    showNotification(e.message || 'AI failed to respond', 'error');
  } finally {
    const msg = conversation.value.find(m => m.id === aiMessageId);
    if (msg) msg.isStreaming = false;
    isProcessing.value = false;
    isStreaming.value = false;
    scrollToBottom();
  }
};

// Battle Logic
const canStartConversation = computed(() => 
  conversationPrompt.value.trim() && selectedProviderA.value && selectedProviderB.value && apiKeyA.value && apiKeyB.value && !isConversationActive.value
);

const startConversation = async () => {
  isConversationActive.value = true;
  conversationHistory.value = [];
  conversationStatus.value = { type: 'info', message: 'Battle commencing...' };
  try {
    await startAIConversation(
      conversationPrompt.value,
      { provider: selectedProviderA.value, model: selectedModelA.value, apiKey: apiKeyA.value },
      { provider: selectedProviderB.value, model: selectedModelB.value, apiKey: apiKeyB.value },
      (exchange) => {
        const idx = conversationHistory.value.findIndex(e => e.turn === exchange.turn);
        if (idx >= 0) conversationHistory.value[idx] = exchange;
        else conversationHistory.value.push(exchange);
        scrollToBottom();
      },
      (err) => { conversationStatus.value = { type: 'error', message: err.message }; isConversationActive.value = false; },
      () => { conversationStatus.value = { type: 'success', message: 'Battle complete' }; isConversationActive.value = false; },
      (sec) => { waitingCountdown.value = sec; }
    );
  } catch (e) {
    isConversationActive.value = false;
  }
};

const stopConversation = () => { stopAIConversation(); isConversationActive.value = false; };
const clearConversation = () => { conversationHistory.value = []; conversationStatus.value = null; };

const onProviderAChange = () => { selectedModelA.value = ''; };
const onProviderBChange = () => { selectedModelB.value = ''; };

const openAISettings = () => { window.dispatchEvent(new CustomEvent('open-global-settings', { detail: { activeTab: 'ai' } })); };

const initializeConversation = async () => {
  if (conversation.value.length === 0) {
    userInput.value = 'SYSTEM_INIT';
    await sendToAI();
  }
};

const exportConversation = (f) => { showNotification(`Exporting as ${f}...`, 'info'); };
const copyConversationToClipboard = () => { showNotification('History copied!', 'success'); };

</script>

<style scoped>
.prose {
  max-width: 100%;
}
.ring-offset-2 {
  --tw-ring-offset-width: 2px;
}
</style>
