import { AIService, getAIConfigFromUser } from '../../utils/aiService';
import { defineEventHandler, readBody, createError } from 'h3';
import { useRuntimeConfig } from '#imports';

// Helper function to log detailed errors in production
function logError(message: string, error: any) {
  const config = useRuntimeConfig();
  console.error(`[AI API ERROR] ${message}:`, {
    message: error.message,
    stack: error.stack,
    details: error.details || 'No additional details',
    timestamp: new Date().toISOString(),
    environment: config.public.nodeEnv
  });
}

interface ChatMessage {
  isUser: boolean;
  content: string;
}

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    
    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)

    // Log the environment for debugging
    console.log(`[AI API] Running in ${config.public.nodeEnv} environment on ${config.NETLIFY ? 'Netlify' : 'local server'}`);
    console.log(`[AI API] Using AI provider: ${aiConfig.provider}`);
    console.log(`[AI API] Using AI model: ${aiConfig.model}`);

    // Add a timeout to prevent function from hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 25 seconds')), 25000);
    });
    // Get request body
    const body = await readBody(event);
    const { message, history = [] } = body;

    // Validate required fields
    if (!message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Message is required',
      });
    }

    // Create a promise that will race against the timeout
    const responsePromise = (async () => {
      // Format chat history for the AI service
      const conversationHistory = history.map((msg: ChatMessage) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      }));

      // System instructions
      const systemPrompt = `You are a helpful AI assistant. Provide direct, concise answers without showing your reasoning process or breaking down your thinking. Just answer the question directly.`;

      // Generate response using AI service
      const result = await aiService.generateContent({
        prompt: message,
        systemPrompt,
        conversationHistory,
        temperature: 0.7,
        maxTokens: 8192
      });

      return { answer: result.content };
    })();

    // Race the API call against the timeout
    return await Promise.race([responsePromise, timeoutPromise]);

  } catch (error: any) {
    // Log detailed error information
    logError('Error generating answer with Google AI', error);

    // Check for specific error types
    if (error.message && error.message.includes('timeout')) {
      throw createError({
        statusCode: 504, // Gateway Timeout
        statusMessage: 'The request took too long to process. Please try again.',
      });
    } else if (error.message && error.message.includes('quota')) {
      throw createError({
        statusCode: 429, // Too Many Requests
        statusMessage: 'API quota exceeded. Please try again later.',
      });
    } else if (error.message && error.message.includes('authenticate')) {
      throw createError({
        statusCode: 401, // Unauthorized
        statusMessage: 'Authentication failed with the AI service.',
      });
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Failed to generate answer',
      });
    }
  }
});
