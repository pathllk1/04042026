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

  console.log(`🧪 [DYNAMIC BUTTONS TEST] Testing with message: "${message}"`);

  // Test different types of requests that should generate action buttons
  const testCases = [
    {
      trigger: ['report', 'generate report', 'create report'],
      expectedButtons: ['📊 Generate Report'],
      description: 'Should generate document creation button for reports'
    },
    {
      trigger: ['contract', 'create contract', 'draft contract'],
      expectedButtons: ['📄 Create Contract'],
      description: 'Should generate document creation button for contracts'
    },
    {
      trigger: ['explain', 'tell me more', 'learn more'],
      expectedButtons: ['💡 Learn More'],
      description: 'Should generate explanation button'
    },
    {
      trigger: ['help', 'guide', 'how to'],
      expectedButtons: ['🎯 Get Guidance'],
      description: 'Should generate guidance button'
    }
  ];

  // Check which test case matches
  const matchedCase = testCases.find(testCase => 
    testCase.trigger.some(trigger => 
      message.toLowerCase().includes(trigger.toLowerCase())
    )
  );

  if (mode === 'test') {
    return {
      message: `Testing dynamic action buttons for: "${message}"`,
      matchedCase: matchedCase ? {
        description: matchedCase.description,
        expectedButtons: matchedCase.expectedButtons
      } : null,
      instructions: [
        '1. Send this message to the AI streaming endpoint',
        '2. Check if the AI generates appropriate action buttons',
        '3. Verify the buttons match the expected functionality',
        '4. Test button actions work correctly'
      ],
      testEndpoint: '/api/ai/dynamic-chat-stream',
      testPayload: {
        userMessage: message,
        conversationHistory: [],
        mode: 'direct'
      }
    };
  }

  // Forward to actual AI streaming endpoint for real testing
  try {
    const response = await $fetch('/api/ai/dynamic-chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getHeader(event, 'authorization') || '',
        'X-CSRF-Token': getHeader(event, 'x-csrf-token') || '',
        'X-AI-Config': getHeader(event, 'x-ai-config') || ''
      },
      body: {
        userMessage: message,
        conversationHistory: [],
        mode: mode
      }
    });

    return {
      testResult: 'success',
      message: 'Request forwarded to AI streaming endpoint',
      response: response,
      expectedCase: matchedCase
    };
  } catch (error: any) {
    return {
      testResult: 'error',
      message: 'Failed to forward to AI streaming endpoint',
      error: error.message,
      suggestion: 'Make sure AI configuration is set up and streaming endpoint is working'
    };
  }
});
