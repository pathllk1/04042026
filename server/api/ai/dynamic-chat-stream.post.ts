import { defineEventHandler, readBody, setResponseHeaders } from 'h3';
import { useAIApi } from '../../../composables/ai/useAIApi';
import { getAIConfigFromUser } from '../../utils/aiService';
import { useRuntimeConfig } from '#imports';

// Helper function to log detailed errors
function logError(message: string, error: any) {
  const config = useRuntimeConfig();
  console.error(`[AI DYNAMIC CHAT STREAM ERROR] ${message}:`, {
    message: error.message,
    stack: error.stack,
    details: error.details || 'No additional details',
    timestamp: new Date().toISOString(),
    environment: config.public.nodeEnv
  });
}

// In-memory store for streaming jobs (in production, use Redis or database)
const streamingJobs = new Map<string, {
  status: 'pending' | 'streaming' | 'completed' | 'error';
  chunks: string[];
  fullResponse: string;
  error?: string;
  isPartial?: boolean;
  parsedResponse?: {
    message: string;
    action: string;
    suggestions?: string[];
    actionButtons?: Array<{
      label: string;
      action: string;
      type: string;
      icon: string;
      data: any;
    }>;
  };
  createdAt: Date;
  lastUpdated: Date;
}>();

// Cleanup old jobs (prevent memory leaks)
setInterval(() => {
  const now = new Date();
  for (const [jobId, job] of streamingJobs.entries()) {
    // Remove jobs older than 1 hour
    if (now.getTime() - job.createdAt.getTime() > 60 * 60 * 1000) {
      streamingJobs.delete(jobId);
      console.log(`🧹 [AI STREAM] Cleaned up old job: ${jobId}`);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

export default defineEventHandler(async (event) => {
  console.log('🚀 [AI STREAM] Starting dynamic chat stream request');

  try {
    // Get request body
    const body = await readBody(event);
    let { userMessage, conversationHistory = [], mode = 'direct', jobId } = body;

    console.log('📋 [AI STREAM] Request mode:', { mode, jobId, hasUserMessage: !!userMessage });

    // Handle different modes
    if (mode === 'background') {
      return await handleBackgroundMode(event, userMessage, conversationHistory);
    } else if (mode === 'sse' && jobId) {
      return await handleSSEMode(event, jobId);
    } else {
      // Default: direct streaming mode
      return await handleDirectMode(event, userMessage, conversationHistory);
    }
  } catch (error: any) {
    console.error('💥 [AI STREAM] Error in main handler:', error);
    throw error;
  }
});

// Handle background job creation
async function handleBackgroundMode(event: any, userMessage: string, conversationHistory: any[]) {
  console.log('🔄 [AI STREAM] Starting background job mode');

  if (!userMessage) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User message is required'
    });
  }

  // Get AI configuration from user
  console.log('🔧 [AI STREAM] Getting AI configuration for background job...');
  const aiConfig = await getAIConfigFromUser(event);
  console.log('🔧 [AI STREAM] AI Config for background job:', {
    provider: aiConfig.provider,
    model: aiConfig.model,
    hasApiKey: !!aiConfig.apiKey,
    apiKeyLength: aiConfig.apiKey?.length || 0
  });

  if (!aiConfig.apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'AI configuration not found. Please configure your AI settings.'
    });
  }

  // Generate unique job ID
  const jobId = `ai_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Initialize job
  streamingJobs.set(jobId, {
    status: 'pending',
    chunks: [],
    fullResponse: '',
    createdAt: new Date(),
    lastUpdated: new Date()
  });

  console.log('📝 [AI STREAM] Created background job:', jobId);

  // Start background processing (don't await) - pass AI config
  processBackgroundJob(jobId, userMessage, conversationHistory, aiConfig).catch((error: any) => {
    console.error(`❌ [AI STREAM] Background job ${jobId} failed:`, error);
    const job = streamingJobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
      job.lastUpdated = new Date();
    }
  });

  // Return job ID immediately
  return {
    jobId,
    status: 'pending',
    message: 'Background job started'
  };
}

// Handle SSE connection for job updates
async function handleSSEMode(event: any, jobId: string) {
  console.log('📡 [AI STREAM] Starting SSE mode for job:', jobId);

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const job = streamingJobs.get(jobId);
  if (!job) {
    event.node.res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
    event.node.res.end();
    return;
  }

  // Send current status
  event.node.res.write(`data: ${JSON.stringify({
    type: 'status',
    status: job.status,
    chunksCount: job.chunks.length
  })}\n\n`);

  // If job is completed, send all data and close
  if (job.status === 'completed' || job.status === 'error') {
    if (job.status === 'completed') {
      // Send all chunks
      for (const chunk of job.chunks) {
        event.node.res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
      }
      // Send completion with parsed response data
      const completionResponse = job.parsedResponse || {
        message: job.fullResponse,
        action: 'chat',
        suggestions: [],
        actionButtons: []
      };

      event.node.res.write(`data: ${JSON.stringify({
        type: 'complete',
        response: {
          message: completionResponse.message,
          action: completionResponse.action,
          suggestions: completionResponse.suggestions || [],
          actionButtons: completionResponse.actionButtons || [],
          isPartial: job.isPartial
        }
      })}\n\n`);
    } else {
      event.node.res.write(`data: ${JSON.stringify({ error: job.error })}\n\n`);
    }
    event.node.res.end();
    return;
  }

  // For pending/streaming jobs, keep connection open and poll
  const pollInterval = setInterval(() => {
    const currentJob = streamingJobs.get(jobId);
    if (!currentJob) {
      clearInterval(pollInterval);
      event.node.res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
      event.node.res.end();
      return;
    }

    // Send new chunks if any
    const newChunks = currentJob.chunks.slice(job.chunks.length);
    for (const chunk of newChunks) {
      event.node.res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
    }
    job.chunks = [...currentJob.chunks]; // Update local reference

    // Check if job is completed
    if (currentJob.status === 'completed' || currentJob.status === 'error') {
      clearInterval(pollInterval);

      if (currentJob.status === 'completed') {
        // Send completion with parsed response data
        const completionResponse = currentJob.parsedResponse || {
          message: currentJob.fullResponse,
          action: 'chat',
          suggestions: [],
          actionButtons: []
        };

        event.node.res.write(`data: ${JSON.stringify({
          type: 'complete',
          response: {
            message: completionResponse.message,
            action: completionResponse.action,
            suggestions: completionResponse.suggestions || [],
            actionButtons: completionResponse.actionButtons || [],
            isPartial: currentJob.isPartial
          }
        })}\n\n`);
      } else {
        event.node.res.write(`data: ${JSON.stringify({ error: currentJob.error })}\n\n`);
      }
      event.node.res.end();
    }
  }, 500); // Poll every 500ms

  // Cleanup on client disconnect
  event.node.req.on('close', () => {
    console.log('🔌 [AI STREAM] Client disconnected from SSE');
    clearInterval(pollInterval);
  });
}

// Handle direct streaming mode (original implementation)
async function handleDirectMode(event: any, userMessage: string, conversationHistory: any[]) {
  console.log('⚡ [AI STREAM] Starting direct streaming mode');

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    console.log('📝 [AI STREAM] Request body:', {
      userMessage,
      conversationHistoryLength: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!userMessage) {
      console.error('❌ [AI STREAM] No user message provided');
      event.node.res.write(`data: ${JSON.stringify({ error: 'User message is required' })}\n\n`);
      event.node.res.end();
      return;
    }

    // Get AI configuration from user
    console.log('🔧 [AI STREAM] Getting AI configuration...');
    const aiConfig = await getAIConfigFromUser(event);
    console.log('🔧 [AI STREAM] AI Config:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey,
      apiKeyLength: aiConfig.apiKey?.length || 0
    });

    if (!aiConfig.apiKey) {
      console.error('❌ [AI STREAM] No API key found in AI configuration');
      event.node.res.write(`data: ${JSON.stringify({ error: 'AI configuration not found. Please configure your AI settings.' })}\n\n`);
      event.node.res.end();
      return;
    }

    // Handle system initialization - convert to AI greeting request
    if (userMessage === 'SYSTEM_INIT') {
      userMessage = 'Please introduce yourself as an AI assistant and explain what you can help with. Be concise and professional.';
    }

    // Import AI service dynamically based on provider
    console.log('🤖 [AI STREAM] Setting up AI provider:', aiConfig.provider);

    if (aiConfig.provider === 'google') {
      console.log('🟢 [AI STREAM] Using Google Gemini provider');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
      const model = genAI.getGenerativeModel({ model: aiConfig.model });

      // Format conversation history for Gemini
      console.log('📚 [AI STREAM] Formatting conversation history...');
      let formattedHistory = conversationHistory
        .filter((msg: any) => msg.type && msg.content)
        .map((msg: any) => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Gemini requires chat history to start with 'user' role
      // If the first message is from 'model', remove it or adjust the history
      if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        console.log('🔧 [AI STREAM] First message is from model, adjusting history...');
        // Remove the first model message to ensure we start with user
        formattedHistory = formattedHistory.slice(1);
      }

      // Ensure we have alternating user/model pattern (Gemini requirement)
      const validatedHistory = [];
      let expectedRole = 'user';

      for (const msg of formattedHistory) {
        if (msg.role === expectedRole) {
          validatedHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else {
          console.log(`⚠️ [AI STREAM] Skipping message with unexpected role: ${msg.role}, expected: ${expectedRole}`);
        }
      }

      console.log('📚 [AI STREAM] Formatted history:', {
        originalLength: conversationHistory.length,
        filteredLength: formattedHistory.length,
        validatedLength: validatedHistory.length,
        history: validatedHistory.slice(-2) // Show last 2 for debugging
      });

      // Use the validated history
      formattedHistory = validatedHistory;

      // Create AI prompt for dynamic chat
      const aiPrompt = `You are a helpful AI assistant. Analyze the user's message and provide a conversational response.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-5).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is the start of the conversation.'}

USER MESSAGE: ${userMessage}

INSTRUCTIONS:
- Provide a helpful, conversational response
- Be direct and informative
- If the user asks for document creation, acknowledge it but focus on the conversational response
- Do not use placeholder text or fake data
- Be honest about limitations regarding real-time data

Respond naturally and helpfully to: ${userMessage}`;

      // Start chat with history
      console.log('💬 [AI STREAM] Starting chat session with Gemini...');
      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      // Send message and get stream
      console.log('📤 [AI STREAM] Sending message to Gemini with prompt length:', aiPrompt.length);
      const result = await chat.sendMessageStream(aiPrompt);
      console.log('📥 [AI STREAM] Got stream result from Gemini, starting to process chunks...');

      // Track the full response
      let fullResponse = '';
      let chunkCount = 0;
      let streamError = null;

      // Stream chunks to client with error handling
      try {
        for await (const chunk of result.stream) {
          chunkCount++;

          try {
            const chunkText = chunk.text();
            if (chunkText) {
              fullResponse += chunkText;

              console.log(`📦 [AI STREAM] Chunk ${chunkCount}:`, {
                hasText: !!chunkText,
                textLength: chunkText?.length || 0,
                textPreview: chunkText?.substring(0, 50) + (chunkText?.length > 50 ? '...' : ''),
                fullResponseLength: fullResponse.length
              });

              // Send chunk as SSE event
              const dataToSend = JSON.stringify({
                type: 'chunk',
                chunk: chunkText
              });
              console.log(`📡 [AI STREAM] Sending chunk ${chunkCount} to client:`, dataToSend.substring(0, 100) + '...');
              event.node.res.write(`data: ${dataToSend}\n\n`);

              // Flush to ensure immediate delivery
              if ((event.node.res as any).flush) {
                (event.node.res as any).flush();
              }
            }
          } catch (chunkError: any) {
            console.error(`❌ [AI STREAM] Error processing chunk ${chunkCount}:`, chunkError.message);
            // Continue processing other chunks
            continue;
          }
        }
      } catch (streamingError: any) {
        console.error('⚠️ [AI STREAM] Stream parsing error occurred:', streamingError.message);
        streamError = streamingError;

        // If we have partial response, we can still send it
        if (fullResponse.length > 0) {
          console.log('📝 [AI STREAM] Partial response available, will send what we have');
        }
      }

      // Handle completion - even if there was a streaming error
      if (streamError && fullResponse.length === 0) {
        // No content received, this is a real error - no fallbacks allowed
        throw streamError;
      }

      console.log('✅ [AI STREAM] Finished streaming Gemini response:', {
        totalChunks: chunkCount,
        totalContentLength: fullResponse.length,
        contentPreview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : ''),
        hadStreamError: !!streamError,
        isPartialResponse: !!streamError && fullResponse.length > 0
      });

      // Try to parse JSON response for action buttons and suggestions
      let parsedResponse = null;
      try {
        // Look for JSON in the response
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log(`🎯 [AI STREAM] Direct mode parsed JSON response:`, {
            hasMessage: !!parsedResponse.message,
            hasActionButtons: !!(parsedResponse.actionButtons && parsedResponse.actionButtons.length > 0),
            hasSuggestions: !!(parsedResponse.suggestions && parsedResponse.suggestions.length > 0),
            actionButtonsCount: parsedResponse.actionButtons?.length || 0
          });
        }
      } catch (parseError: any) {
        console.warn(`⚠️ [AI STREAM] Direct mode could not parse JSON response:`, parseError.message);
        // Use the raw response as message
        parsedResponse = {
          message: fullResponse,
          action: 'chat',
          suggestions: [],
          actionButtons: []
        };
      }

      // Send completion event with parsed response data
      const completionResponse = parsedResponse || {
        message: fullResponse,
        action: 'chat',
        suggestions: [],
        actionButtons: []
      };

      const completionData = JSON.stringify({
        type: 'complete',
        response: {
          message: completionResponse.message,
          action: completionResponse.action,
          suggestions: completionResponse.suggestions || [],
          actionButtons: completionResponse.actionButtons || [],
          isPartial: !!streamError
        }
      });

      console.log('🏁 [AI STREAM] Sending completion event:', {
        isPartial: !!streamError,
        responseLength: fullResponse.length,
        hasActionButtons: !!(completionResponse.actionButtons && completionResponse.actionButtons.length > 0),
        actionButtonsCount: completionResponse.actionButtons?.length || 0,
        preview: completionData.substring(0, 150) + '...'
      });
      event.node.res.write(`data: ${completionData}\n\n`);

      // If there was a stream error but we got partial content, log it as a warning
      if (streamError && fullResponse.length > 0) {
        console.warn('⚠️ [AI STREAM] Completed with partial response due to stream error:', streamError.message);
      }

    } else {
      console.error('❌ [AI STREAM] Unsupported provider for streaming:', aiConfig.provider);
      // For other providers, fall back to non-streaming for now
      event.node.res.write(`data: ${JSON.stringify({
        error: 'Streaming not yet supported for this AI provider. Please use Google Gemini for streaming responses.'
      })}\n\n`);
    }

    console.log('🔚 [AI STREAM] Ending response stream');
    // End the response
    event.node.res.end();

  } catch (error: any) {
    console.error('💥 [AI STREAM] Error in dynamic chat streaming:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    });
    logError('Error in dynamic chat streaming', error);

    // Send error as SSE event
    let errorMessage = 'Failed to generate streaming response';

    if (error.message && error.message.includes('timeout')) {
      errorMessage = 'The request took too long to process. Please try again.';
    } else if (error.message && error.message.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (error.message && error.message.includes('authenticate')) {
      errorMessage = 'Authentication failed with the AI service.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.log('❌ [AI STREAM] Sending error to client:', errorMessage);
    event.node.res.write(`data: ${JSON.stringify({
      type: 'error',
      error: errorMessage
    })}\n\n`);

    console.log('🔚 [AI STREAM] Ending response stream due to error');
    event.node.res.end();
  }
}

// Background job processing function with real AI processing
async function processBackgroundJob(jobId: string, userMessage: string, conversationHistory: any[], aiConfig?: any) {
  console.log(`🔄 [AI STREAM] Processing background job: ${jobId}`);

  const job = streamingJobs.get(jobId);
  if (!job) {
    console.error(`❌ [AI STREAM] Job ${jobId} not found`);
    return;
  }

  try {
    job.status = 'streaming';
    job.lastUpdated = new Date();

    // Use provided AI config or get default (you'd need to pass this from the main handler)
    if (!aiConfig) {
      console.error(`❌ [AI STREAM] No AI config provided for background job ${jobId}`);
      throw new Error('AI configuration required for background processing');
    }

    console.log(`🤖 [AI STREAM] Background job ${jobId} using AI provider:`, aiConfig.provider);

    if (aiConfig.provider === 'google') {
      console.log(`🟢 [AI STREAM] Background job ${jobId} using Google Gemini provider`);
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
      const model = genAI.getGenerativeModel({ model: aiConfig.model });

      // Format conversation history for Gemini (same logic as direct mode)
      console.log(`📚 [AI STREAM] Background job ${jobId} formatting conversation history...`);
      let formattedHistory = conversationHistory
        .filter((msg: any) => msg.type && msg.content)
        .map((msg: any) => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Gemini requires chat history to start with 'user' role
      if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        console.log(`🔧 [AI STREAM] Background job ${jobId} adjusting history - first message is from model`);
        formattedHistory = formattedHistory.slice(1);
      }

      // Ensure alternating user/model pattern
      const validatedHistory = [];
      let expectedRole = 'user';

      for (const msg of formattedHistory) {
        if (msg.role === expectedRole) {
          validatedHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else {
          console.log(`⚠️ [AI STREAM] Background job ${jobId} skipping message with unexpected role: ${msg.role}, expected: ${expectedRole}`);
        }
      }

      console.log(`📚 [AI STREAM] Background job ${jobId} formatted history:`, {
        originalLength: conversationHistory.length,
        filteredLength: formattedHistory.length,
        validatedLength: validatedHistory.length
      });

      // Create AI prompt for dynamic chat with action button generation
      const aiPrompt = `You are an intelligent AI assistant that can help with anything and dynamically generate action buttons based on user needs.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-5).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is the start of the conversation.'}

USER MESSAGE: ${userMessage}

CAPABILITIES:
- Answer questions and provide explanations in user's preferred language
- Generate professional documents (Excel, Word, PDF, Quotations, Invoices, Reports)
- Create business documents: quotations, invoices, contracts, reports, templates, forms
- Provide guidance and problem-solving
- Offer follow-up suggestions and actions

DOCUMENT DETECTION KEYWORDS (in any language):
- Quotation/কোটেশন/उद्धरण: quotation, quote, estimate, কোটেশন, দাম, উদ্ধৃতি
- Invoice/ইনভয়েস/चालान: invoice, bill, চালান, বিল, ইনভয়েস
- Report/রিপোর্ট/रिपोर्ट: report, রিপোর্ট, প্রতিবেদন
- Contract/চুক্তি/अनुबंध: contract, agreement, চুক্তি, চুক্তিপত্র
- Template/টেমপ্লেট/टेम्पलेट: template, format, টেমপ্লেট, ফরম্যাট

INSTRUCTIONS:
1. Respond in the user's preferred language (maintain language consistency)
2. Analyze if the user is requesting document creation (quotation, invoice, report, etc.)
3. If document creation is detected, ALWAYS provide action buttons for document generation
4. Generate appropriate action buttons dynamically based on the request
5. Be direct and informative
6. Do not use placeholder text or fake data
7. Be honest about limitations regarding real-time data

RESPONSE FORMAT: You must respond with ONLY a valid JSON object in this exact format:
{
  "message": "Your conversational response to the user (in their preferred language)",
  "action": "chat|create_document",
  "suggestions": [
    "Follow-up question 1",
    "Follow-up question 2",
    "Related topic 3"
  ],
  "actionButtons": [
    {
      "label": "Button text (in user's language)",
      "action": "create_document|ask_followup|explain_more|configure_ai",
      "type": "primary|success|secondary",
      "icon": "📄|🧾|�|📋|�💡|🎯|⚙️",
      "data": {
        "request": "original user request for document creation",
        "documentType": "quotation|invoice|report|contract|template",
        "question": "follow-up question if applicable",
        "topic": "topic to explain more if applicable",
        "details": {
          "items": "extracted item details if applicable",
          "pricing": "extracted pricing if applicable",
          "client": "client name if mentioned"
        }
      }
    }
  ]
}

FOR DOCUMENT GENERATION REQUESTS:
- Set action to "create_document"
- Always include actionButtons with create_document action
- Extract and include structured data in the data.details field
- Use appropriate document type (quotation, invoice, report, etc.)
- Label buttons in user's preferred language

EXAMPLES OF DYNAMIC ACTION BUTTONS:
- If user asks for quotation/কোটেশন: Create "📄 Generate Quotation Document" button with create_document action
- If user asks for invoice/ইনভয়েস: Create "🧾 Create Invoice Document" button with create_document action
- If user asks for a report/রিপোর্ট: Create "📊 Generate Report Document" button with create_document action
- If user asks for a contract/চুক্তি: Create "📄 Create Contract Document" button with create_document action
- If user provides item lists/pricing: Create "📋 Create Professional Document" button with create_document action
- If user asks about a topic: Create "💡 Learn More" button with explain_more action
- If user needs clarification: Create "❓ Ask Follow-up" button with ask_followup action

IMPORTANT FOR DOCUMENT REQUESTS:
- Always detect when user provides structured data (items, prices, quantities)
- Always provide document generation buttons for business documents
- Include the original request data in the button's data field
- Specify the document type (quotation, invoice, report, etc.)

Current user request analysis:
- Does it contain item lists, prices, or quantities? → Generate document button
- Does it ask for quotation/invoice/report? → Generate document button
- Does it provide business data? → Generate document button

Analyze this request and respond with appropriate JSON: ${userMessage}`;

      // Start chat with history
      console.log(`💬 [AI STREAM] Background job ${jobId} starting chat session with Gemini...`);
      const chat = model.startChat({
        history: validatedHistory,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      // Send message and get stream
      console.log(`📤 [AI STREAM] Background job ${jobId} sending message to Gemini with prompt length:`, aiPrompt.length);
      const result = await chat.sendMessageStream(aiPrompt);
      console.log(`📥 [AI STREAM] Background job ${jobId} got stream result from Gemini, starting to process chunks...`);

      let chunkCount = 0;
      let streamError = null;

      // Stream chunks and store in job
      try {
        for await (const chunk of result.stream) {
          chunkCount++;

          try {
            const chunkText = chunk.text();
            if (chunkText) {
              job.chunks.push(chunkText);
              job.fullResponse += chunkText;
              job.lastUpdated = new Date();

              console.log(`📦 [AI STREAM] Background job ${jobId} chunk ${chunkCount}:`, {
                hasText: !!chunkText,
                textLength: chunkText?.length || 0,
                textPreview: chunkText?.substring(0, 50) + (chunkText?.length > 50 ? '...' : ''),
                fullResponseLength: job.fullResponse.length
              });
            }
          } catch (chunkError: any) {
            console.error(`❌ [AI STREAM] Background job ${jobId} error processing chunk ${chunkCount}:`, chunkError.message);
            continue;
          }
        }
      } catch (streamingError: any) {
        console.error(`⚠️ [AI STREAM] Background job ${jobId} stream parsing error:`, streamingError.message);
        streamError = streamingError;

        if (job.fullResponse.length > 0) {
          console.log(`📝 [AI STREAM] Background job ${jobId} partial response available`);
        }
      }

      // Handle completion
      if (streamError && job.fullResponse.length === 0) {
        throw streamError;
      }

      console.log(`✅ [AI STREAM] Background job ${jobId} finished streaming Gemini response:`, {
        totalChunks: chunkCount,
        totalContentLength: job.fullResponse.length,
        contentPreview: job.fullResponse.substring(0, 100) + (job.fullResponse.length > 100 ? '...' : ''),
        hadStreamError: !!streamError,
        isPartialResponse: !!streamError && job.fullResponse.length > 0
      });

      // Try to parse JSON response for action buttons and suggestions
      let parsedResponse = null;
      try {
        // Look for JSON in the response
        const jsonMatch = job.fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log(`🎯 [AI STREAM] Background job ${jobId} parsed JSON response:`, {
            hasMessage: !!parsedResponse.message,
            hasActionButtons: !!(parsedResponse.actionButtons && parsedResponse.actionButtons.length > 0),
            hasSuggestions: !!(parsedResponse.suggestions && parsedResponse.suggestions.length > 0),
            actionButtonsCount: parsedResponse.actionButtons?.length || 0
          });
        }
      } catch (parseError: any) {
        console.warn(`⚠️ [AI STREAM] Background job ${jobId} could not parse JSON response:`, parseError.message);
        // Use the raw response as message
        parsedResponse = {
          message: job.fullResponse,
          action: 'chat',
          suggestions: [],
          actionButtons: []
        };
      }

      // Store parsed response data in job
      job.parsedResponse = parsedResponse;
      job.isPartial = !!streamError;
      job.status = 'completed';
      job.lastUpdated = new Date();

      if (streamError && job.fullResponse.length > 0) {
        console.warn(`⚠️ [AI STREAM] Background job ${jobId} completed with partial response due to stream error:`, streamError.message);
      }

    } else {
      throw new Error(`Streaming not yet supported for AI provider: ${aiConfig.provider}. Please use Google Gemini for streaming responses.`);
    }

  } catch (error: any) {
    console.error(`❌ [AI STREAM] Background job ${jobId} error:`, error);
    job.status = 'error';
    job.error = error.message;
    job.lastUpdated = new Date();
  }
}
