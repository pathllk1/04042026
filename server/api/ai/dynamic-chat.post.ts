import { GoogleGenerativeAI } from '@google/generative-ai';
import AIHistory from '../../models/AIHistory';

// Helper function to extract conversation summary and patterns
function extractConversationSummary(conversationHistory: any[]): string {
  if (!conversationHistory || conversationHistory.length === 0) {
    return 'New conversation - no previous context';
  }

  const topics = new Set<string>();
  const userPreferences = new Set<string>();
  const documentRequests = [];
  let questionCount = 0;

  for (const msg of conversationHistory) {
    if (msg.type === 'user') {
      const content = msg.content.toLowerCase();

      // Extract topics
      if (content.includes('gst') || content.includes('tax')) topics.add('taxation');
      if (content.includes('invoice') || content.includes('bill')) topics.add('invoicing');
      if (content.includes('quotation') || content.includes('quote')) topics.add('quotations');
      if (content.includes('contract') || content.includes('agreement')) topics.add('contracts');
      if (content.includes('project') || content.includes('proposal')) topics.add('project_management');
      if (content.includes('business') || content.includes('company')) topics.add('business_operations');
      if (content.includes('weather') || content.includes('news')) topics.add('real_time_info');

      // Detect document requests
      if (content.includes('create') || content.includes('generate') || content.includes('make')) {
        documentRequests.push(content.substring(0, 50) + '...');
      }

      // Count questions
      if (content.includes('?') || content.startsWith('what') || content.startsWith('how') || content.startsWith('why')) {
        questionCount++;
      }
    }
  }

  return `
Topics discussed: ${Array.from(topics).join(', ') || 'general conversation'}
Document requests: ${documentRequests.length} (${documentRequests.slice(-2).join('; ')})
Questions asked: ${questionCount}
Conversation length: ${conversationHistory.length} messages
User engagement: ${conversationHistory.length > 10 ? 'high' : conversationHistory.length > 5 ? 'medium' : 'low'}
`.trim();
}

// Function to retrieve persistent memory from database
async function retrievePersistentMemory(userId: string): Promise<string> {
  try {
    // Get recent AI chat history for this user
    const recentHistory = await AIHistory.find({
      userId,
      type: 'chat'
    })
    .sort({ createdAt: -1 })
    .limit(20) // Last 20 chat interactions
    .lean();

    if (!recentHistory || recentHistory.length === 0) {
      return 'No previous conversation history';
    }

    // Extract patterns and preferences
    const topics = new Set<string>();
    const preferences = new Set<string>();
    const documentTypes = new Set<string>();

    for (const entry of recentHistory) {
      const question = entry.question.toLowerCase();
      const answer = entry.answer.toLowerCase();

      // Extract topics from questions
      if (question.includes('gst') || answer.includes('gst')) topics.add('GST/taxation');
      if (question.includes('invoice') || answer.includes('invoice')) topics.add('invoicing');
      if (question.includes('quotation') || answer.includes('quotation')) topics.add('quotations');
      if (question.includes('contract') || answer.includes('contract')) topics.add('contracts');
      if (question.includes('business') || answer.includes('business')) topics.add('business operations');

      // Extract document creation patterns
      if (question.includes('create') || question.includes('generate')) {
        const docMatch = question.match(/(invoice|quotation|contract|agreement|proposal|letter)/);
        if (docMatch) documentTypes.add(docMatch[1]);
      }
    }

    return `
Previous topics of interest: ${Array.from(topics).join(', ') || 'general conversation'}
Document types created: ${Array.from(documentTypes).join(', ') || 'none yet'}
Total previous interactions: ${recentHistory.length}
Last interaction: ${recentHistory[0]?.createdAt ? new Date(recentHistory[0].createdAt).toLocaleDateString() : 'unknown'}
User engagement pattern: ${recentHistory.length > 15 ? 'highly active' : recentHistory.length > 8 ? 'moderately active' : 'new user'}
`.trim();

  } catch (error) {
    return 'Unable to retrieve previous conversation history';
  }
}

// Function to save conversation to persistent memory
async function saveToPersistentMemory(userId: string, userMessage: string, aiResponse: string): Promise<void> {
  try {
    await AIHistory.create({
      userId,
      type: 'chat',
      question: userMessage,
      answer: aiResponse,
      metadata: {
        model: 'gemini-2.5-flash',
        timestamp: new Date(),
        source: 'dynamic-chat'
      }
    });
  } catch (error) {
    // Don't throw error - memory saving is not critical for functionality
  }
}

export default defineEventHandler(async (event) => {
  try {
    const { userMessage, conversationHistory } = await readBody(event);

    if (!userMessage) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User message is required'
      });
    }



    // Handle system initialization
    if (userMessage === 'SYSTEM_INIT') {
      return {
        message: "Hello! I'm your AI Assistant. I can help you with absolutely anything - answer questions, provide explanations, offer guidance, solve problems, and create professional documents when needed. What would you like to explore today?",
        action: "chat",
        suggestions: [
          "What can you help me with?",
          "Explain a business concept to me",
          "Create a professional document",
          "Help me solve a problem"
        ],
        actionButtons: [
          {
            label: "Ask a Question",
            action: "ask_followup",
            type: "primary",
            icon: "💡",
            data: { question: "What is " }
          },
          {
            label: "Get Guidance",
            action: "ask_followup",
            type: "secondary",
            icon: "🎯",
            data: { question: "Help me understand " }
          }
        ]
      };
    }

    // Initialize AI using runtime config like other endpoints
    const config = useRuntimeConfig();
    const apiKey = config.googleAiApiKey;
    if (!apiKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Google AI API key is not configured'
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use same working model as other AI endpoints
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Get user context for memory
    const userId = event.context.userId;
    const firmId = event.context.user?.firmId;

    // Retrieve persistent memory from database
    const persistentMemory = await retrievePersistentMemory(userId);

    // Build enhanced conversation context with better memory
    const recentContext = conversationHistory
      ?.slice(-10) // Increased to last 10 messages for better context
      ?.map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      ?.join('\n') || '';

    // Extract key topics and patterns from conversation history
    const conversationSummary = extractConversationSummary(conversationHistory || []);

    // Build comprehensive context with persistent memory
    const conversationContext = `
RECENT CONVERSATION:
${recentContext}

CONVERSATION SUMMARY:
${conversationSummary}

PERSISTENT MEMORY (from previous sessions):
${persistentMemory}

USER CONTEXT:
- User ID: ${userId}
- Firm ID: ${firmId}
- Session: Current conversation with persistent memory
`;

    // Create dynamic AI prompt with enhanced memory
    const aiPrompt = `
You are an intelligent AI assistant with excellent memory and contextual understanding. You remember previous conversations and build upon them naturally.

CONVERSATION CONTEXT & MEMORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

MEMORY INSTRUCTIONS:
- Remember and reference previous topics we've discussed
- Build upon earlier conversations naturally
- Recall user's preferences and patterns from our chat history
- Reference previous document requests or questions when relevant
- Maintain conversation continuity and context
- Show that you understand the ongoing conversation flow

YOUR CAPABILITIES:
1. Answer questions based on your training knowledge (up to your knowledge cutoff)
2. Provide explanations and guidance on various topics
3. Help with business, technical, or personal topics
4. Create professional documents when specifically requested
5. Offer suggestions and follow-up questions
6. Be conversational and helpful

IMPORTANT LIMITATIONS:
- You do NOT have access to real-time information (weather, news, stock prices, etc.)
- You do NOT have internet access to fetch current data
- You do NOT have access to live databases or APIs
- If asked for real-time information, be honest about your limitations and suggest alternatives

RESPONSE INSTRUCTIONS:
- Analyze the user's message to understand their intent
- If they're asking a question, provide a helpful answer based on your knowledge
- If they ask for real-time data you don't have, be honest and suggest where they can find it
- If they want a document created, acknowledge and offer to create it
- If they need clarification, ask follow-up questions
- Always be helpful, professional, and conversational
- Never use placeholder text like [Temperature] or [Data] - be specific or admit limitations
- Provide relevant suggestions for follow-up questions or actions

RESPONSE FORMAT: Return ONLY a valid JSON object:
{
  "message": "Your conversational response to the user",
  "action": "chat|create_document|ask_clarification",
  "documentDetails": {
    "documentType": "type if document creation detected",
    "confidence": "high|medium|low"
  },
  "suggestions": [
    "Follow-up question 1",
    "Follow-up question 2",
    "Related topic 3"
  ],
  "actionButtons": [
    {
      "label": "Button text",
      "action": "create_document|ask_followup|explain_more",
      "type": "primary|success|secondary",
      "icon": "emoji",
      "data": { "any": "relevant data" }
    }
  ]
}

DOCUMENT DETECTION:
If the user is asking to "create", "generate", "make", "prepare" any document (quotation, invoice, agreement, certificate, proposal, etc.), set action to "create_document" and provide documentDetails.

DOCUMENT CREATION GUIDELINES:
When creating documents, ensure they are:
- PROFESSIONAL but SIMPLE - avoid unnecessary complexity
- CLEAR and EASY TO UNDERSTAND - use plain language
- WELL-STRUCTURED - organized with clear sections
- PRACTICAL - focus on essential information only
- USER-FRIENDLY - avoid jargon and overly technical terms
- CLEAN FORMATTING - simple, readable layout
- BUSINESS-APPROPRIATE - maintain professional standards without being overly formal

EXAMPLES:
- "What is GST?" → action: "chat", provide explanation based on knowledge
- "Create a quotation" → action: "create_document", documentType: "quotation"
- "How to calculate taxes?" → action: "chat", provide guidance based on knowledge
- "Make an invoice for services" → action: "create_document", documentType: "invoice"
- "What's the weather today?" → action: "chat", explain you don't have real-time weather data, suggest checking weather apps/websites
- "Current stock price of Apple?" → action: "chat", explain you don't have real-time stock data, suggest checking financial websites
`;

    // Call AI
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    let text = response.text().trim();

    // Clean up response
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse AI response
    let aiResponse;
    try {
      aiResponse = JSON.parse(text);
    } catch (parseError) {
      // Fallback response
      aiResponse = {
        message: "I understand your request. Let me help you with that. Could you provide a bit more detail about what you need?",
        action: "chat",
        suggestions: [
          "Tell me more about your requirements",
          "What specific information do you need?",
          "How can I assist you better?"
        ],
        actionButtons: []
      };
    }



    // Save conversation to persistent memory (don't await to avoid blocking response)
    if (userId) {
      saveToPersistentMemory(userId, userMessage, aiResponse.message).catch(() => {
        // Silent fail - memory saving is not critical
      });
    }

    return aiResponse;

  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `AI chat failed: ${error.message}`
    });
  }
});
