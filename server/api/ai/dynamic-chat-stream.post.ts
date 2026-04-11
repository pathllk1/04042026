import { defineEventHandler, readBody, setResponseHeaders } from 'h3';
import { AIService, getAIConfigFromUser } from '../../utils/aiService';

// In-memory store for streaming jobs
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

// Cleanup old jobs
setInterval(() => {
  const now = new Date();
  for (const [jobId, job] of streamingJobs.entries()) {
    if (now.getTime() - job.createdAt.getTime() > 60 * 60 * 1000) {
      streamingJobs.delete(jobId);
    }
  }
}, 5 * 60 * 1000);

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { userMessage, conversationHistory = [], mode = 'direct', jobId } = body;

    if (mode === 'background') {
      return await handleBackgroundMode(event, userMessage, conversationHistory);
    } else if (mode === 'sse' && jobId) {
      return await handleSSEMode(event, jobId);
    } else {
      return await handleDirectMode(event, userMessage, conversationHistory);
    }
  } catch (error: any) {
    console.error('💥 [AI STREAM] Error in main handler:', error);
    throw error;
  }
});

async function handleBackgroundMode(event: any, userMessage: string, conversationHistory: any[]) {
  if (!userMessage) throw createError({ statusCode: 400, message: 'User message is required' });

  const aiConfig = await getAIConfigFromUser(event);
  const jobId = `ai_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  streamingJobs.set(jobId, {
    status: 'pending',
    chunks: [],
    fullResponse: '',
    createdAt: new Date(),
    lastUpdated: new Date()
  });

  processBackgroundJob(jobId, userMessage, conversationHistory, aiConfig).catch(console.error);

  return { jobId, status: 'pending', message: 'Background job started' };
}

async function handleSSEMode(event: any, jobId: string) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const job = streamingJobs.get(jobId);
  if (!job) {
    event.node.res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
    event.node.res.end();
    return;
  }

  const pollInterval = setInterval(() => {
    const currentJob = streamingJobs.get(jobId);
    if (!currentJob) {
      clearInterval(pollInterval);
      event.node.res.end();
      return;
    }

    const newChunks = currentJob.chunks.slice(job.chunks.length);
    for (const chunk of newChunks) {
      event.node.res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
    }
    job.chunks = [...currentJob.chunks];

    if (currentJob.status === 'completed' || currentJob.status === 'error') {
      clearInterval(pollInterval);
      if (currentJob.status === 'completed') {
        event.node.res.write(`data: ${JSON.stringify({ type: 'complete', response: currentJob.parsedResponse })}\n\n`);
      } else {
        event.node.res.write(`data: ${JSON.stringify({ type: 'error', error: currentJob.error })}\n\n`);
      }
      event.node.res.end();
    }
  }, 500);

  event.node.req.on('close', () => clearInterval(pollInterval));
}

async function handleDirectMode(event: any, userMessage: string, conversationHistory: any[]) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    const aiConfig = await getAIConfigFromUser(event);
    const aiService = new AIService(aiConfig);

    const apiHistory = conversationHistory.map((msg: any) => ({
      role: (msg.type === 'user' || msg.role === 'user') ? 'user' : 'assistant',
      content: msg.content
    }));

    const systemPrompt = `You are an intelligent AI assistant. Respond with ONLY a valid JSON object:
{
  "message": "Your conversational response",
  "action": "chat|create_document",
  "suggestions": ["follow-up 1", "follow-up 2"],
  "actionButtons": []
}`;

    let fullResponse = '';
    await aiService.generateContentStream({
      prompt: userMessage,
      systemPrompt,
      conversationHistory: apiHistory,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens
    }, (chunk) => {
      fullResponse += chunk;
      event.node.res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
    });

    // Parse final result
    let parsedResponse = { message: fullResponse, action: 'chat', suggestions: [], actionButtons: [] };
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (e) {}

    event.node.res.write(`data: ${JSON.stringify({ type: 'complete', response: parsedResponse })}\n\n`);
    event.node.res.end();

  } catch (error: any) {
    event.node.res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    event.node.res.end();
  }
}

async function processBackgroundJob(jobId: string, userMessage: string, conversationHistory: any[], aiConfig: any) {
  const job = streamingJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'streaming';
    const aiService = new AIService(aiConfig);
    const apiHistory = conversationHistory.map((msg: any) => ({
      role: (msg.type === 'user' || msg.role === 'user') ? 'user' : 'assistant',
      content: msg.content
    }));

    const systemPrompt = `You are a professional assistant. Respond with ONLY a valid JSON object including message, action, and actionButtons.`;

    await aiService.generateContentStream({
      prompt: userMessage,
      systemPrompt,
      conversationHistory: apiHistory
    }, (chunk) => {
      job.chunks.push(chunk);
      job.fullResponse += chunk;
      job.lastUpdated = new Date();
    });

    let parsedResponse = { message: job.fullResponse, action: 'chat', suggestions: [], actionButtons: [] };
    try {
      const jsonMatch = job.fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (e) {}

    job.parsedResponse = parsedResponse;
    job.status = 'completed';
  } catch (error: any) {
    job.status = 'error';
    job.error = error.message;
  }
}
