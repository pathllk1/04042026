import { defineEventHandler, readBody, setResponseHeaders } from 'h3';
import { getAIConfigFromUser } from '../../utils/aiService';

// Helper function to log detailed errors
function logError(message: string, error: any) {
  console.error(`[AI NORMAL CHAT ERROR] ${message}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}

export default defineEventHandler(async (event) => {
  console.log('💬 [NORMAL CHAT] Starting normal chat stream request');
  
  // Set SSE headers for streaming
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    const body = await readBody(event);
    const { userMessage, conversationHistory = [] } = body;
    
    console.log('📝 [NORMAL CHAT] Request details:', {
      userMessage: userMessage?.substring(0, 100) + '...',
      historyLength: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    if (!userMessage) {
      event.node.res.write(`data: ${JSON.stringify({ error: 'User message is required' })}\n\n`);
      event.node.res.end();
      return;
    }

    // Get AI configuration
    console.log('🔧 [NORMAL CHAT] Getting AI configuration...');
    const aiConfig = await getAIConfigFromUser(event);
    
    if (!aiConfig.apiKey) {
      event.node.res.write(`data: ${JSON.stringify({ error: 'AI configuration not found. Please configure your AI settings.' })}\n\n`);
      event.node.res.end();
      return;
    }

    console.log('🤖 [NORMAL CHAT] Using AI provider:', aiConfig.provider);

    if (aiConfig.provider === 'google') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
      const model = genAI.getGenerativeModel({ model: aiConfig.model });

      // Format conversation history for Gemini
      let formattedHistory = conversationHistory
        .filter((msg: any) => msg.type && msg.content)
        .map((msg: any) => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Ensure proper history format
      if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        formattedHistory = formattedHistory.slice(1);
      }

      // Create simple conversational prompt
      const chatPrompt = `You are a helpful AI assistant for normal conversation and questions.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-5).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is the start of the conversation.'}

USER MESSAGE: ${userMessage}

INSTRUCTIONS:
1. Provide helpful, conversational responses
2. Answer questions and provide explanations
3. Respond in the user's preferred language
4. Be direct and informative
5. Do not use placeholder text or fake data
6. Be honest about limitations regarding real-time data
7. For document generation requests, suggest using the document generation mode
8. Respond naturally - do not use JSON format

Respond conversationally to: ${userMessage}`;

      // Start chat and get streaming response
      console.log('💬 [NORMAL CHAT] Starting conversation with AI...');
      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      const result = await chat.sendMessageStream(chatPrompt);
      console.log('📥 [NORMAL CHAT] Got stream result, processing chunks...');

      let fullResponse = '';
      let chunkCount = 0;

      // Stream chunks to client
      for await (const chunk of result.stream) {
        chunkCount++;
        const chunkText = chunk.text();
        
        if (chunkText) {
          fullResponse += chunkText;
          
          console.log(`📦 [NORMAL CHAT] Chunk ${chunkCount}:`, {
            length: chunkText.length,
            preview: chunkText.substring(0, 50) + '...'
          });

          // Send chunk as SSE event
          event.node.res.write(`data: ${JSON.stringify({ 
            type: 'chunk',
            chunk: chunkText 
          })}\n\n`);
        }
      }

      console.log('✅ [NORMAL CHAT] Finished streaming conversation');

      // Send completion event
      event.node.res.write(`data: ${JSON.stringify({ 
        type: 'complete',
        response: {
          message: fullResponse,
          action: 'chat',
          suggestions: [],
          actionButtons: []
        }
      })}\n\n`);

    } else {
      event.node.res.write(`data: ${JSON.stringify({ 
        error: 'Normal chat currently supports Google Gemini only. Please configure Google AI.' 
      })}\n\n`);
    }

    event.node.res.end();

  } catch (error: any) {
    console.error('💥 [NORMAL CHAT] Error in normal chat:', error);
    logError('Normal chat failed', error);

    event.node.res.write(`data: ${JSON.stringify({ 
      error: error.message || 'Failed to process chat message' 
    })}\n\n`);
    event.node.res.end();
  }
});
