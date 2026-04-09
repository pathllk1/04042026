// AI Configuration Types
export interface AIProvider {
  id: string
  name: string
  description: string
  models: AIModel[]
  apiKeyRequired: boolean
  baseUrl?: string
  headers?: Record<string, string>
}

// Dynamic Provider Handler Interface
export interface AIProviderHandler {
  id: string
  name: string
  detect: (config: AIConfiguration) => boolean
  buildRequest: (prompt: string, config: AIConfiguration, systemPrompt?: string) => {
    url: string
    options: RequestInit
  }
  parseResponse: (response: any) => string
  getDefaultBaseUrl: () => string
  getDefaultHeaders: (apiKey: string) => Record<string, string>
}

export interface AIModel {
  id: string
  name: string
  description: string
  maxTokens: number
  costPer1kTokens?: {
    input: number
    output: number
  }
}

export interface AIConfiguration {
  provider: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  customSettings?: Record<string, any>
}

// New interface for storing multiple API keys per provider
export interface AIProviderKeys {
  [providerId: string]: string // providerId -> apiKey
}

// New interface for storing API keys per model (more granular)
export interface AIModelKeys {
  [modelId: string]: string // modelId -> apiKey (e.g., "openrouter/gpt-4" -> "sk-...")
}

// Custom provider configuration for 100% dynamic support
export interface CustomAIProvider {
  id: string // Unique identifier (user-generated)
  name: string // Display name (e.g., "Groq", "Local Ollama")
  baseUrl: string // API endpoint (e.g., "https://api.groq.com/openai/v1")
  apiKeyHeader: string // Header name (e.g., "Authorization", "X-API-Key")
  apiKeyPrefix: string // Prefix (e.g., "Bearer ", "")
  requestFormat: 'openai' | 'anthropic' | 'google' | 'custom' // Request structure
  responseFormat: 'openai' | 'anthropic' | 'google' | 'custom' // Response structure
  models: string[] // Available models (user-defined)
  supportsStreaming?: boolean
  supportsSystemPrompt?: boolean
  maxTokensLimit?: number
  customHeaders?: Record<string, string> // Additional headers
  customRequestTransform?: string // JSON path transformations
  customResponseTransform?: string // JSON path transformations
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Enhanced configuration with multi-provider AND multi-model support + Custom providers
export interface AIConfigurationExtended {
  currentProvider: string
  currentModel: string
  temperature?: number
  maxTokens?: number
  customSettings?: Record<string, any>
  // Store API keys for each provider separately (backward compatibility)
  providerKeys: AIProviderKeys
  // Store API keys for each model separately (new granular approach)
  modelKeys: AIModelKeys
  // Store last used model for each provider
  providerModels: Record<string, string>
  // Store preferred settings per model
  modelSettings: Record<string, { temperature?: number; maxTokens?: number }>
  // Custom providers (100% dynamic)
  customProviders: Record<string, CustomAIProvider>
  // Active custom provider configurations
  activeCustomProviders: string[]
}

export interface AIUsageStats {
  totalRequests: number
  totalTokensUsed: number
  estimatedCost: number
  lastUsed: Date
  provider: string
  model: string
}

// Supported AI Providers Configuration
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Google\'s Gemini AI models',
    apiKeyRequired: true,
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Latest stable Gemini model with fast response times',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.075, output: 0.30 }
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Most advanced Gemini model for complex reasoning tasks',
        maxTokens: 2097152,
        costPer1kTokens: { input: 1.25, output: 5.00 }
      },
      {
        id: 'gemini-2.5-flash-lite-preview-06-17',
        name: 'Gemini 2.5 Flash Lite Preview',
        description: 'Lightweight preview version for testing',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.037, output: 0.15 }
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Previous generation advanced reasoning model',
        maxTokens: 2097152,
        costPer1kTokens: { input: 1.25, output: 5.00 }
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Previous generation fast model for everyday tasks',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.075, output: 0.30 }
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI\'s GPT models',
    apiKeyRequired: true,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most advanced GPT-4 model',
        maxTokens: 128000,
        costPer1kTokens: { input: 2.50, output: 10.00 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Affordable and intelligent small model',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.15, output: 0.60 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective',
        maxTokens: 16385,
        costPer1kTokens: { input: 0.50, output: 1.50 }
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Anthropic\'s Claude AI models',
    apiKeyRequired: true,
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model with best performance',
        maxTokens: 200000,
        costPer1kTokens: { input: 3.00, output: 15.00 }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest and most compact model',
        maxTokens: 200000,
        costPer1kTokens: { input: 0.25, output: 1.25 }
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access to multiple AI models through OpenRouter',
    apiKeyRequired: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      // Free Models - Google
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: '🆓 Gemini 2.0 Flash Experimental (Free)',
        description: 'Google\'s latest multimodal model - FREE',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'google/gemini-2.0-flash-thinking-exp:free',
        name: '🆓 Gemini 2.0 Flash Thinking (Free)',
        description: 'Google\'s reasoning model with thinking process - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'google/gemma-2-9b-it:free',
        name: '🆓 Gemma 2 9B (Free)',
        description: 'Google\'s open-source model - FREE',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Free Models - Meta Llama
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: '🆓 Llama 3.2 3B (Free)',
        description: 'Meta\'s efficient small model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'meta-llama/llama-3.2-1b-instruct:free',
        name: '🆓 Llama 3.2 1B (Free)',
        description: 'Meta\'s ultra-compact model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct:free',
        name: '🆓 Llama 3.1 8B (Free)',
        description: 'Meta\'s balanced performance model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'shisa-ai/shisa-v2-llama-3.3-70b:free',
        name: '🆓 Shisa V2 Llama 3.3 70B (Free)',
        description: 'Enhanced Llama 3.3 70B model - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Free Models - Microsoft
      {
        id: 'microsoft/phi-3-mini-128k-instruct:free',
        name: '🆓 Phi-3 Mini 128K (Free)',
        description: 'Microsoft\'s compact model with large context - FREE',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'microsoft/phi-3-medium-128k-instruct:free',
        name: '🆓 Phi-3 Medium 128K (Free)',
        description: 'Microsoft\'s medium-sized model - FREE',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Free Models - Qwen/Alibaba
      {
        id: 'qwen/qwen-2.5-7b-instruct:free',
        name: '🆓 Qwen 2.5 7B (Free)',
        description: 'Alibaba\'s multilingual model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'qwen/qwen-2.5-coder-7b-instruct:free',
        name: '🆓 Qwen 2.5 Coder 7B (Free)',
        description: 'Alibaba\'s coding specialist model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Free Models - DeepSeek (Latest R1 Series)
      {
        id: 'deepseek/deepseek-r1-distill-llama-70b:free',
        name: '🆓 DeepSeek R1 Distill Llama 70B (Free)',
        description: 'DeepSeek\'s latest reasoning model based on Llama 70B - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-r1-distill-qwen-14b:free',
        name: '🆓 DeepSeek R1 Distill Qwen 14B (Free)',
        description: 'DeepSeek\'s reasoning model based on Qwen 14B - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-r1-distill-qwen-32b:free',
        name: '🆓 DeepSeek R1 Distill Qwen 32B (Free)',
        description: 'DeepSeek\'s larger reasoning model based on Qwen 32B - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-v3-base:free',
        name: '🆓 DeepSeek V3 Base (Free)',
        description: 'DeepSeek\'s base model for general tasks - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-chat-v3-0324:free',
        name: '🆓 DeepSeek Chat V3 0324 (Free)',
        description: 'DeepSeek V3 chat model from March 2024 - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-r1:free',
        name: '🆓 DeepSeek R1 (Free)',
        description: 'DeepSeek R1 reasoning model - FREE',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Free Models - Other Providers
      {
        id: 'huggingfaceh4/zephyr-7b-beta:free',
        name: '🆓 Zephyr 7B Beta (Free)',
        description: 'HuggingFace\'s fine-tuned model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'openchat/openchat-7b:free',
        name: '🆓 OpenChat 7B (Free)',
        description: 'Open-source conversational model - FREE',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'mistralai/mistral-7b-instruct:free',
        name: '🆓 Mistral 7B Instruct (Free)',
        description: 'Mistral\'s instruction-tuned model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'nous-research/nous-hermes-2-mixtral-8x7b-dpo:free',
        name: '🆓 Nous Hermes 2 Mixtral 8x7B (Free)',
        description: 'Nous Research fine-tuned Mixtral model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'cognitivecomputations/dolphin-2.6-mixtral-8x7b:free',
        name: '🆓 Dolphin 2.6 Mixtral 8x7B (Free)',
        description: 'Cognitive Computations fine-tuned model - FREE',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'gryphe/mythomax-l2-13b:free',
        name: '🆓 MythoMax L2 13B (Free)',
        description: 'Creative writing and roleplay model - FREE',
        maxTokens: 4096,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Premium Models - Latest & Best
      {
        id: 'google/gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Experimental',
        description: 'Google\'s cutting-edge multimodal model',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.075, output: 0.30 }
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic\'s most capable model',
        maxTokens: 200000,
        costPer1kTokens: { input: 3.00, output: 15.00 }
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        description: 'OpenAI\'s flagship multimodal model',
        maxTokens: 128000,
        costPer1kTokens: { input: 2.50, output: 10.00 }
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and affordable GPT-4 model',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.15, output: 0.60 }
      },

      // DeepSeek Models
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat',
        description: 'DeepSeek\'s conversational AI model',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.14, output: 0.28 }
      },
      {
        id: 'deepseek/deepseek-coder',
        name: 'DeepSeek Coder',
        description: 'DeepSeek\'s specialized coding model',
        maxTokens: 64000,
        costPer1kTokens: { input: 0.14, output: 0.28 }
      },

      // Qwen Models
      {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        description: 'Alibaba\'s large multilingual model',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.40, output: 1.20 }
      },
      {
        id: 'qwen/qwen-2.5-coder-32b-instruct',
        name: 'Qwen 2.5 Coder 32B',
        description: 'Alibaba\'s specialized coding model',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.20, output: 0.60 }
      },

      // Meta Llama Models
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        description: 'Meta\'s largest open-source model',
        maxTokens: 131072,
        costPer1kTokens: { input: 3.00, output: 3.00 }
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        description: 'Meta\'s efficient large model',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.52, output: 0.75 }
      },
      {
        id: 'meta-llama/llama-3.2-90b-vision-instruct',
        name: 'Llama 3.2 90B Vision',
        description: 'Meta\'s multimodal vision model',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.90, output: 0.90 }
      },

      // Mistral Models
      {
        id: 'mistralai/mistral-large',
        name: 'Mistral Large',
        description: 'Mistral\'s flagship model',
        maxTokens: 128000,
        costPer1kTokens: { input: 2.00, output: 6.00 }
      },
      {
        id: 'mistralai/codestral-mamba',
        name: 'Codestral Mamba',
        description: 'Mistral\'s specialized coding model',
        maxTokens: 256000,
        costPer1kTokens: { input: 0.25, output: 0.25 }
      },

      // Specialized Models
      {
        id: 'perplexity/llama-3.1-sonar-large-128k-online',
        name: 'Perplexity Sonar Large Online',
        description: 'Real-time web search capabilities',
        maxTokens: 127072,
        costPer1kTokens: { input: 1.00, output: 1.00 }
      },
      {
        id: 'x-ai/grok-beta',
        name: 'Grok Beta',
        description: 'xAI\'s conversational model',
        maxTokens: 131072,
        costPer1kTokens: { input: 5.00, output: 15.00 }
      },
      {
        id: 'cohere/command-r-plus',
        name: 'Command R+',
        description: 'Cohere\'s enterprise-grade model',
        maxTokens: 128000,
        costPer1kTokens: { input: 2.50, output: 10.00 }
      }
    ]
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    description: 'Ultra-fast AI inference powered by Groq LPU™ technology',
    apiKeyRequired: true,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'Meta\'s latest Llama model with 128k context',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.59, output: 0.79 }
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: 'Fast and efficient model for quick responses',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.05, output: 0.08 }
      },
      {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B',
        description: 'Powerful model for complex reasoning tasks',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.59, output: 0.79 }
      },
      {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        description: 'Fast and cost-effective model',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.05, output: 0.08 }
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        description: 'Google\'s efficient instruction-tuned model',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.20, output: 0.20 }
      },
      {
        id: 'qwen/qwen3-32b',
        name: 'Qwen 3 32B',
        description: 'Alibaba\'s advanced multilingual model',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.29, output: 0.59 }
      },
      {
        id: 'deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 Distill Llama 70B',
        description: 'Advanced reasoning model with 128k context',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.75, output: 0.99 }
      },
      {
        id: 'mistral-saba-24b',
        name: 'Mistral Saba 24B',
        description: 'Mistral\'s latest efficient model',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.79, output: 0.79 }
      },
      {
        id: 'whisper-large-v3-turbo',
        name: 'Whisper Large v3 Turbo',
        description: 'Fast speech-to-text transcription',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.04, output: 0.04 }
      },
      {
        id: 'whisper-large-v3',
        name: 'Whisper Large v3',
        description: 'High-quality speech-to-text transcription',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.06, output: 0.06 }
      },
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        description: 'OpenAI\'s open-source 120B parameter model',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.50, output: 0.75 }
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT OSS 20B',
        description: 'OpenAI\'s open-source 20B parameter model',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.20, output: 0.30 }
      },
      {
        id: 'meta-llama/llama-guard-4-12b',
        name: 'Llama Guard 4 12B',
        description: 'Meta\'s safety and content moderation model',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.15, output: 0.20 }
      }
    ]
  }
]

// Default AI Configuration
export const DEFAULT_AI_CONFIG: AIConfiguration = {
  provider: 'google',
  apiKey: '',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 8192
}

// Default Extended AI Configuration with multi-provider, multi-model, and custom provider support
export const DEFAULT_AI_CONFIG_EXTENDED: AIConfigurationExtended = {
  currentProvider: 'google',
  currentModel: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 8192,
  providerKeys: {}, // Will store API keys for each provider (backward compatibility)
  modelKeys: {}, // Will store API keys for each model (new granular approach)
  providerModels: {}, // Will store last used model for each provider
  modelSettings: {}, // Will store preferred settings per model
  customProviders: {}, // Will store custom provider configurations
  activeCustomProviders: [] // Will store active custom provider IDs
}

// Example custom provider templates (for UI)
export const CUSTOM_PROVIDER_TEMPLATES = [
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    requestFormat: 'openai',
    responseFormat: 'openai',
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxTokensLimit: 32768,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ollama',
    name: 'Local Ollama',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyHeader: '',
    apiKeyPrefix: '',
    requestFormat: 'openai',
    responseFormat: 'openai',
    models: ['llama3:70b', 'codellama:34b', 'mistral:7b', 'phi3:14b'],
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxTokensLimit: 32768,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    requestFormat: 'openai',
    responseFormat: 'openai',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxTokensLimit: 32768,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// AI Request/Response Types
export interface AIRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}

export interface AIResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  model: string
  provider: string
  finishReason?: string
  reasoning?: string // For reasoning models like DeepSeek R1
}

export interface AIError {
  code: string
  message: string
  provider: string
  details?: any
}
