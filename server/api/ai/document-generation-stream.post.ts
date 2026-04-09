import { defineEventHandler, readBody, setResponseHeaders } from 'h3';
import { getAIConfigFromUser } from '../../utils/aiService';
import { AIDocumentIntelligence } from '../../utils/aiDocumentIntelligence';
import { AIService } from '../../utils/aiService';
import { IntelligentExcelGenerator } from '../../utils/intelligentGenerators/excelGenerator';
import { IntelligentPDFGenerator } from '../../utils/intelligentGenerators/pdfGenerator';
import { IntelligentWordGenerator } from '../../utils/intelligentGenerators/wordGenerator';
import { JobManager } from '../../utils/jobManager';

// Helper function to log detailed errors
function logError(message: string, error: any) {
  console.error(`[AI DOCUMENT GENERATION ERROR] ${message}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}

// Note: getFirmData function removed as it's no longer needed in the new flow
// The AI streaming response provides all necessary document data

export default defineEventHandler(async (event) => {
  console.log('📄 [DOC GEN] Starting document generation stream request');
  
  // Set SSE headers for streaming
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // Get user information
    const userId = event.context.userId;
    const firmId = event.context.firmId;

    if (!userId) {
      event.node.res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Authentication required'
      })}\n\n`);
      event.node.res.end();
      return;
    }

    const body = await readBody(event);
    const { userMessage, documentType = 'auto-detect', conversationHistory = [] } = body;

    console.log('📋 [DOC GEN] Request details:', {
      userMessage: userMessage?.substring(0, 100) + '...',
      documentType,
      historyLength: conversationHistory.length,
      userId,
      firmId,
      timestamp: new Date().toISOString()
    });

    if (!userMessage) {
      event.node.res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'User message is required for document generation'
      })}\n\n`);
      event.node.res.end();
      return;
    }

    // Create background job for file generation
    const job = JobManager.createJob({
      type: 'ai-document-generation-stream',
      userRequest: userMessage.trim(),
      userId,
      firmId,
      status: 'processing',
      progress: 0,
      message: 'AI is analyzing your request...',
      createdAt: new Date(),
      estimatedDuration: 45 // seconds
    });

    console.log('📋 [DOC GEN] Created job:', job.id);

    // Get AI configuration
    console.log('🔧 [DOC GEN] Getting AI configuration...');
    const aiConfig = await getAIConfigFromUser(event);

    if (!aiConfig.apiKey) {
      event.node.res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'AI configuration not found. Please configure your AI settings.'
      })}\n\n`);
      event.node.res.end();
      return;
    }

    console.log('🤖 [DOC GEN] Using AI provider:', aiConfig.provider);

    // NOTE: We will NOT start separate background processing here
    // The AI streaming response will provide the document data, then we'll generate files
    // This eliminates duplicate AI processing

    if (aiConfig.provider === 'google') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
      const model = genAI.getGenerativeModel({ model: aiConfig.model });

      // Create specialized document generation prompt
      const documentPrompt = `You are an expert document generation AI. Your task is to analyze the user's request and create professional business documents.

USER REQUEST: ${userMessage}

DOCUMENT TYPE: ${documentType}

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ?
  conversationHistory.slice(-3).map((msg: any) => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
  : 'This is a new document generation request.'}

INSTRUCTIONS:
1. Analyze the user's request to determine the exact document type needed
2. Extract all relevant data (items, prices, quantities, client info, terms, etc.)
3. Create a professional, well-structured document
4. Generate appropriate download action buttons based on document type:
   - Letters/Applications/Formal documents: PDF + Word
   - Invoices/Quotations/Bills: PDF + Excel
   - Reports/Proposals/Articles: PDF + Word
   - Data tables/Lists/Spreadsheets: PDF + Excel
5. Respond in the user's preferred language
6. Use real data only - no placeholders or mock content
7. Choose the most effective format combination for the specific document type

RESPONSE FORMAT: Return ONLY a valid JSON object:
{
  "message": "Professional response about the document being created",
  "documentContent": {
    "type": "quotation|invoice|report|contract|template",
    "title": "Document title",
    "client": "Client name if mentioned",
    "items": [
      {
        "description": "Item description",
        "quantity": "number",
        "unit": "unit type",
        "rate": "price per unit",
        "amount": "total amount"
      }
    ],
    "subtotal": "calculated subtotal",
    "taxes": "tax information",
    "total": "final total",
    "terms": "payment and delivery terms",
    "additionalInfo": "any other relevant information"
  },
  "actionButtons": [
    // AI should determine the most appropriate formats based on document type
    // For letters/formal documents: PDF + Word
    // For invoices/quotations: PDF + Excel
    // For reports: PDF + Word
    // For data-heavy documents: PDF + Excel
    // Example formats (AI should customize based on document type):
    {
      "label": "📄 Download PDF",
      "action": "download_document",
      "type": "primary",
      "icon": "📄",
      "data": {
        "format": "pdf",
        "documentType": "detected document type",
        "request": "${userMessage}",
        "details": "document details from documentContent"
      }
    },
    {
      "label": "� Download Word",
      "action": "download_document",
      "type": "success",
      "icon": "�",
      "data": {
        "format": "word",
        "documentType": "detected document type",
        "request": "${userMessage}",
        "details": "document details from documentContent"
      }
    }
  ]
}

Analyze the request and generate the appropriate document: ${userMessage}`;

      // Start chat and get streaming response
      console.log('💬 [DOC GEN] Starting document generation with AI...');
      const chat = model.startChat({
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent document generation
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });

      const result = await chat.sendMessageStream(documentPrompt);
      console.log('📥 [DOC GEN] Got stream result, processing chunks...');

      let fullResponse = '';
      let chunkCount = 0;

      // Stream chunks to client
      for await (const chunk of result.stream) {
        chunkCount++;
        const chunkText = chunk.text();
        
        if (chunkText) {
          fullResponse += chunkText;
          
          console.log(`📦 [DOC GEN] Chunk ${chunkCount}:`, {
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

      console.log('✅ [DOC GEN] Finished streaming, parsing response...');

      // Parse the JSON response
      let parsedResponse = null;
      try {
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log('🎯 [DOC GEN] Successfully parsed document response:', {
            hasDocumentContent: !!parsedResponse.documentContent,
            documentType: parsedResponse.documentContent?.type,
            itemsCount: parsedResponse.documentContent?.items?.length || 0,
            jobId: parsedResponse.jobId
          });

          // Update job with AI-generated document data and start file generation
          JobManager.updateJob(job.id, {
            progress: 50,
            message: 'AI analysis complete, generating files...',
            documentData: parsedResponse.documentContent
          });

          // Generate files immediately using the AI-provided document data
          generateFilesFromAIData(job.id, parsedResponse.documentContent, userId, firmId, aiConfig);
        }
      } catch (parseError: any) {
        console.error('❌ [DOC GEN] Failed to parse JSON response:', parseError.message);
        parsedResponse = {
          message: fullResponse,
          documentContent: null,
          jobId: job.id
        };
      }

      // Send completion event with job ID for polling
      event.node.res.write(`data: ${JSON.stringify({
        type: 'complete',
        response: {
          message: parsedResponse?.message || fullResponse,
          documentContent: parsedResponse?.documentContent || null,
          jobId: job.id,
          action: 'document_generated'
        }
      })}\n\n`);

    } else {
      event.node.res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Document generation currently supports Google Gemini only. Please configure Google AI.'
      })}\n\n`);
    }

    event.node.res.end();

  } catch (error: any) {
    console.error('💥 [DOC GEN] Error in document generation:', error);
    logError('Document generation failed', error);

    event.node.res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message || 'Failed to generate document'
    })}\n\n`);
    event.node.res.end();
  }
});

// Generate files directly from AI-provided document data (NO duplicate AI processing)
async function generateFilesFromAIData(
  jobId: string,
  documentContent: any,
  userId: string,
  firmId: string,
  aiConfig: any
): Promise<void> {
  try {
    console.log('⚡ [FILE GEN] Starting file generation from AI data for job:', jobId, 'for user:', userId, 'firm:', firmId);

    if (!documentContent) {
      throw new Error('No document content provided by AI');
    }

    // Initialize AI service for format optimization only (no duplicate content generation)
    const aiService = new AIService(aiConfig);
    const aiDocumentIntelligence = new AIDocumentIntelligence(aiService);

    // Step 1: Determine optimal formats based on document type
    JobManager.updateJob(jobId, {
      progress: 60,
      message: 'Determining optimal file formats...'
    });

    const documentType = documentContent.type?.toLowerCase() || '';
    const secondaryFormat = documentType.includes('invoice') ||
                           documentType.includes('quotation') ||
                           documentType.includes('bill') ? 'excel' : 'word';

    console.log(`📊 [FILE GEN] Document type: ${documentContent.type}, Secondary format: ${secondaryFormat}`);

    // Step 2: Create enriched document structure from AI data
    const enrichedDocument = {
      documentType: documentContent.type || 'Document',
      title: documentContent.title || 'AI Generated Document',
      structure: {
        sections: documentContent.items ? [{
          name: 'Content',
          content: documentContent,
          type: 'text' as const,
          formatting: {}
        }] : []
      },
      metadata: {
        purpose: 'User requested document',
        audience: 'General',
        formality: 'formal' as const,
        urgency: 'medium' as const
      },
      suggestedImprovements: [],
      exportRecommendations: {
        excel: 'Use for data-heavy content',
        word: 'Best for text documents',
        pdf: 'Final formatted version'
      },
      enrichedContent: documentContent,
      businessData: null,
      generatedAt: new Date()
    };

    // Step 3: Optimize for different formats (minimal AI calls for format optimization only)
    JobManager.updateJob(jobId, {
      progress: 75,
      message: 'Optimizing document for different formats...'
    });

    const [pdfStructure, secondaryStructure] = await Promise.all([
      aiDocumentIntelligence.optimizeForFormat(enrichedDocument, 'pdf'),
      aiDocumentIntelligence.optimizeForFormat(enrichedDocument, secondaryFormat)
    ]);

    // Step 4: Generate actual files
    JobManager.updateJob(jobId, {
      progress: 90,
      message: 'Creating downloadable files...'
    });

    const [secondaryBuffer, pdfBuffer] = await Promise.all([
      secondaryFormat === 'excel'
        ? IntelligentExcelGenerator.generate(secondaryStructure)
        : IntelligentWordGenerator.generate(secondaryStructure),
      IntelligentPDFGenerator.generate(pdfStructure)
    ]);

    // Step 5: Store files and complete job
    const files = {
      [secondaryFormat]: {
        buffer: secondaryBuffer,
        filename: `${documentContent.type?.replace(/\s+/g, '_') || 'Document'}_${Date.now()}.${secondaryFormat === 'excel' ? 'xlsx' : 'docx'}`,
        size: secondaryBuffer.length
      },
      pdf: {
        buffer: pdfBuffer,
        filename: `${documentContent.type?.replace(/\s+/g, '_') || 'Document'}_${Date.now()}.pdf`,
        size: pdfBuffer.length
      }
    };

    const availableFormats = [
      {
        format: secondaryFormat,
        size: files[secondaryFormat].size,
        downloadUrl: `/api/ai/download-document/${jobId}/${secondaryFormat}`,
        filename: files[secondaryFormat].filename
      },
      {
        format: 'pdf',
        size: files.pdf.size,
        downloadUrl: `/api/ai/download-document/${jobId}/pdf`,
        filename: files.pdf.filename
      }
    ];

    JobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Document generation completed successfully!',
      completedAt: new Date(),
      files,
      availableFormats,
      documentData: enrichedDocument
    });

    console.log('✅ [FILE GEN] File generation completed for job:', jobId);

  } catch (error: any) {
    console.error('❌ [FILE GEN] File generation failed for job:', jobId, error);
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error.message,
      message: `File generation failed: ${error.message}`,
      completedAt: new Date()
    });
  }
}
