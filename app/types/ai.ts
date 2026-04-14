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
  maxTokens: number // Full context window
  defaultMaxTokens?: number // Recommended default for requests (e.g. due to TPM limits)
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
        id: 'gemini-3.1-flash',
        name: 'Gemini 3.1 Flash',
        description: 'Latest 2026 workhorse model, optimized for speed and cost-efficiency',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.075, output: 0.30 }
      },
      {
        id: 'gemini-3.1-pro',
        name: 'Gemini 3.1 Pro',
        description: 'Advanced 2026 model for complex reasoning, coding, and agentic tasks',
        maxTokens: 2097152,
        costPer1kTokens: { input: 1.25, output: 5.00 }
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        description: 'High-scale, ultra-low latency model for simple tasks',
        maxTokens: 8192,
        costPer1kTokens: { input: 0.037, output: 0.15 }
      },
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Exp',
        description: 'Legacy experimental multimodal model',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.075, output: 0.30 }
      },
      {
        id: 'gemma-4-31b',
        name: 'Gemma 4 31B',
        description: 'Google\'s latest open model (April 2026), top-tier performance',
        maxTokens: 262144,
        costPer1kTokens: { input: 0.15, output: 0.15 }
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
        description: 'Omni model for text, audio, and vision',
        maxTokens: 128000,
        costPer1kTokens: { input: 2.50, output: 10.00 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Small, efficient model for fast responses',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.15, output: 0.60 }
      },
      {
        id: 'o1-preview',
        name: 'OpenAI o1 Preview',
        description: 'Reasoning model for complex problem solving',
        maxTokens: 128000,
        costPer1kTokens: { input: 15.00, output: 60.00 }
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
        description: 'Most intelligent model with high performance',
        maxTokens: 200000,
        costPer1kTokens: { input: 3.00, output: 15.00 }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model with great intelligence',
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
      // Free Models - April 2026 Latest
      {
        id: 'google/gemma-4-31b:free',
        name: '🆓 Gemma 4 31B (Free)',
        description: 'Latest Google multimodal open model - FREE',
        maxTokens: 262144,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'meta-llama/llama-4-scout:free',
        name: '🆓 Llama 4 Scout (Free)',
        description: 'Latest efficient Llama 4 model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'qwen/qwen-3-coder-480b:free',
        name: '🆓 Qwen 3 Coder 480B (Free)',
        description: 'Top-tier coding specialist model - FREE',
        maxTokens: 262144,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'openai/gpt-oss-120b:free',
        name: '🆓 OpenAI GPT-OSS 120B (Free)',
        description: 'OpenAI\'s flagship open-weight reasoning model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'deepseek/deepseek-r1:free',
        name: '🆓 DeepSeek R1 (Free)',
        description: 'Powerful reasoning/thinking model - FREE',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: '🆓 Llama 3.3 70B Instruct (Free)',
        description: 'High-performance general purpose model - FREE',
        maxTokens: 131072,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'google/gemini-2.5-pro-exp:free',
        name: '🆓 Gemini 2.5 Pro Exp (Free)',
        description: 'Experimental Gemini preview - FREE',
        maxTokens: 1048576,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },
      {
        id: 'microsoft/phi-4-mini-instruct:free',
        name: '🆓 Phi-4 Mini (Free)',
        description: 'Microsoft\'s latest compact model - FREE',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.00, output: 0.00 }
      },

      // Premium Models
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini 3.1 Pro',
        description: 'Google\'s latest flagship model',
        maxTokens: 2097152,
        costPer1kTokens: { input: 1.25, output: 5.00 }
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
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        description: 'Flagship reasoning open-weight model',
        maxTokens: 131072,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.50, output: 0.75 }
      },
      {
        id: 'meta-llama/llama-4-scout-17b',
        name: 'Llama 4 Scout 17B',
        description: 'Ultra-efficient 2026 Llama model',
        maxTokens: 131072,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.10, output: 0.15 }
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'Powerful general purpose Llama model',
        maxTokens: 128000,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.59, output: 0.79 }
      },
      {
        id: 'qwen/qwen3-32b',
        name: 'Qwen 3 32B',
        description: 'Alibaba\'s latest 2026 multilingual model',
        maxTokens: 131072,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.29, output: 0.59 }
      },
      {
        id: 'deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 Distill Llama 70B',
        description: 'Advanced reasoning model on Groq hardware',
        maxTokens: 128000,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.75, output: 0.99 }
      },
      {
        id: 'mistral-saba-24b',
        name: 'Mistral Saba 24B',
        description: 'Mistral\'s latest high-efficiency model',
        maxTokens: 32768,
        defaultMaxTokens: 4096,
        costPer1kTokens: { input: 0.79, output: 0.79 }
      }
    ]
  }
]

// Default AI Configuration
export const DEFAULT_AI_CONFIG: AIConfiguration = {
  provider: 'google',
  apiKey: '',
  model: 'gemini-3.1-flash',
  temperature: 0.7,
  maxTokens: 8192
}

// Default Extended AI Configuration
export const DEFAULT_AI_CONFIG_EXTENDED: AIConfigurationExtended = {
  currentProvider: 'google',
  currentModel: 'gemini-3.1-flash',
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
