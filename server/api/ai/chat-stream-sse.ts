import { AIService, getAIConfigFromUser } from '../../utils/aiService';
import { defineEventHandler, readBody, createError, setResponseHeaders } from 'h3';
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
  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)
    // Get request body
    const body = await readBody(event);
    const { message, history = [] } = body;

    // Validate required fields
    if (!message) {
      event.node.res.write(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
      event.node.res.end();
      return;
    }

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(googleAiKey);

    // Use Gemini 2.5 Flash model - the latest stable and efficient model from Google
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Format chat history for the Gemini API
    let formattedHistory = [];

    // Only include history if it's not empty
    if (history.length > 0) {
      formattedHistory = history.map((msg: ChatMessage) => ({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
    }

    // Start a chat session with optimized parameters for Gemini 2.5 Flash
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
      },
      // Safety settings to ensure appropriate content
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        } as any,
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        } as any,
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        } as any,
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        } as any
      ]
    });

    // Simple system instructions without thinking steps
    const systemInstructions = `You are a helpful AI assistant powered by Google's Gemini 2.5 Flash model. Provide direct, concise answers without showing your reasoning process or breaking down your thinking. Just answer the question directly.

Now, respond to this: `;

    // Send message and get stream
    const result = await chat.sendMessageStream(systemInstructions + message);
    
    // Track the full response for final message
    let fullResponse = '';

    // Stream chunks directly to client as they arrive
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // Send chunk as SSE event
      event.node.res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      
      // Flush to ensure immediate delivery
      if (event.node.res.flush) {
        event.node.res.flush();
      }
    }

    // Send the complete response as a final event
    event.node.res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
    
    // End the response
    event.node.res.end();
  } catch (error: any) {
    // Log detailed error information
    logError('Error generating streaming answer with Google AI', error);

    // Send error as SSE event
    let errorMessage = 'Failed to generate streaming answer';
    
    // Check for specific error types
    if (error.message && error.message.includes('timeout')) {
      errorMessage = 'The request took too long to process. Please try again.';
    } else if (error.message && error.message.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (error.message && error.message.includes('authenticate')) {
      errorMessage = 'Authentication failed with the AI service.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    event.node.res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    event.node.res.end();
  }
});
