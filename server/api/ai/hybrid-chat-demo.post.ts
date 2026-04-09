import { defineEventHandler, readBody } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { message, mode = 'direct' } = body;

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Message is required'
    });
  }

  console.log(`🚀 [HYBRID DEMO] Mode: ${mode}, Message: ${message}`);

  if (mode === 'background') {
    // Step 1: Start background job with real AI processing
    try {
      const jobResponse = await $fetch('/api/ai/dynamic-chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward authentication headers if needed
          'Authorization': getHeader(event, 'authorization') || '',
          'X-CSRF-Token': getHeader(event, 'x-csrf-token') || '',
          'X-AI-Config': getHeader(event, 'x-ai-config') || ''
        },
        body: {
          userMessage: message,
          conversationHistory: [],
          mode: 'background'
        }
      });

      return {
        approach: 'background + sse',
        step: 1,
        jobId: jobResponse.jobId,
        status: jobResponse.status,
        message: 'Real AI background job started with your configured AI provider.',
        nextStep: `Connect to SSE: POST /api/ai/dynamic-chat-stream with { mode: 'sse', jobId: '${jobResponse.jobId}' }`,
        instructions: [
          '1. Background job is now processing your message with real AI',
          '2. Use the jobId to connect to SSE endpoint for real-time updates',
          '3. You will receive streaming chunks as the AI generates the response',
          '4. The job survives connection drops and can be reconnected to'
        ]
      };
    } catch (error: any) {
      return {
        approach: 'background + sse',
        error: 'Failed to start background job',
        details: error.message,
        suggestion: 'Make sure your AI configuration is set up properly'
      };
    }
  } else {
    // Direct streaming mode
    return {
      approach: 'direct streaming',
      message: 'Use direct SSE connection to /api/ai/dynamic-chat-stream with real AI processing',
      example: 'POST /api/ai/dynamic-chat-stream with { userMessage: "hello", mode: "direct" }',
      benefits: [
        'Real-time streaming response',
        'Immediate connection',
        'Uses your configured AI provider',
        'No background job overhead'
      ]
    };
  }
});
