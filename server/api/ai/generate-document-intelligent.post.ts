import { AIDocumentIntelligence } from '../../utils/aiDocumentIntelligence';
import { IntelligentExcelGenerator } from '../../utils/intelligentGenerators/excelGenerator';
import { IntelligentPDFGenerator } from '../../utils/intelligentGenerators/pdfGenerator';
import { IntelligentWordGenerator } from '../../utils/intelligentGenerators/wordGenerator';
import { JobManager } from '../../utils/jobManager';
import { AIService, getAIConfigFromUser } from '../../utils/aiService';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userRequest, additionalContext } = body;

    // Validate input
    if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User request is required and must be a non-empty string'
      });
    }

    // Get user information
    const userId = event.context.userId;
    const firmId = event.context.user?.firmId;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      });
    }



    // Create background job for intelligent document generation
    const job = JobManager.createJob({
      type: 'ai-document-generation',
      userRequest: userRequest.trim(),
      additionalContext: additionalContext || '',
      userId,
      firmId,
      status: 'queued',
      progress: 0,
      message: 'AI is analyzing your request...',
      createdAt: new Date(),
      estimatedDuration: 60 // seconds
    });



    // Start background processing (don't await)
    processIntelligentDocumentGeneration(
      job.id,
      userRequest.trim(),
      additionalContext || '',
      userId,
      firmId,
      event
    ).catch(error => {
      JobManager.updateJob(job.id, {
        status: 'failed',
        progress: 0,
        error: error.message,
        message: `AI processing failed: ${error.message}`,
        completedAt: new Date()
      });
    });

    return {
      success: true,
      jobId: job.id,
      message: 'AI is analyzing your request and creating the document...',
      estimatedTime: '30-60 seconds',
      status: 'queued'
    };

  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to start AI document generation'
    });
  }
});

async function processIntelligentDocumentGeneration(
  jobId: string,
  userRequest: string,
  additionalContext: string,
  userId: string,
  firmId: string,
  event: any
): Promise<void> {
  try {
    // Initialize AI service with user configuration
    const aiConfig = await getAIConfigFromUser(event)
    const aiService = new AIService(aiConfig)
    const aiDocumentIntelligence = new AIDocumentIntelligence(aiService)

    // Step 1: Get firm data for context
    JobManager.updateJob(jobId, {
      status: 'processing',
      progress: 5,
      message: 'Gathering business context...'
    });

    const firmData = await getFirmData(firmId);

    // Step 2: AI analyzes and structures the document
    JobManager.updateJob(jobId, {
      progress: 15,
      message: 'AI is analyzing your request and determining document structure...'
    });

    const documentStructure = await aiDocumentIntelligence.analyzeAndStructure(userRequest, firmData);



    // Step 3: AI generates rich content
    JobManager.updateJob(jobId, {
      progress: 35,
      message: 'AI is generating professional content...'
    });

    const enrichedDocument = await aiDocumentIntelligence.generateContent(documentStructure, additionalContext);

    // Step 4: AI determines optimal formats and optimizes document
    JobManager.updateJob(jobId, {
      progress: 55,
      message: 'AI is determining optimal formats and optimizing document...'
    });

    // AI determines the best secondary format based on document type
    const documentType = enrichedDocument.documentType.toLowerCase();
    const isDataHeavy = documentType.includes('invoice') ||
                       documentType.includes('quotation') ||
                       documentType.includes('bill') ||
                       documentType.includes('table') ||
                       documentType.includes('list') ||
                       documentType.includes('spreadsheet');

    const secondaryFormat = isDataHeavy ? 'excel' : 'word';
    console.log(`📊 [DOC GEN] Document type: ${enrichedDocument.documentType}, Secondary format: ${secondaryFormat}`);

    const [secondaryStructure, pdfStructure] = await Promise.all([
      aiDocumentIntelligence.optimizeForFormat(enrichedDocument, secondaryFormat),
      aiDocumentIntelligence.optimizeForFormat(enrichedDocument, 'pdf')
    ]);

    // Step 5: Generate actual files
    JobManager.updateJob(jobId, {
      progress: 80,
      message: 'AI is creating downloadable files...'
    });

    const [secondaryBuffer, pdfBuffer] = await Promise.all([
      secondaryFormat === 'excel'
        ? IntelligentExcelGenerator.generate(secondaryStructure)
        : IntelligentWordGenerator.generate(secondaryStructure),
      IntelligentPDFGenerator.generate(pdfStructure)
    ]);

    // Step 6: Store files temporarily (in production, use proper file storage)
    const files = {
      [secondaryFormat]: {
        buffer: secondaryBuffer,
        filename: `${enrichedDocument.documentType.replace(/\s+/g, '_')}_${Date.now()}.${secondaryFormat === 'excel' ? 'xlsx' : 'docx'}`,
        size: secondaryBuffer.length
      },
      pdf: {
        buffer: pdfBuffer,
        filename: `${enrichedDocument.documentType.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
        size: pdfBuffer.length
      }
    };

    // Step 7: Complete the job
    JobManager.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Document created successfully! Ready for download.',
      documentData: enrichedDocument,
      files: files,
      completedAt: new Date(),
      summary: {
        documentType: enrichedDocument.documentType,
        title: enrichedDocument.title,
        sectionsCount: enrichedDocument.structure?.sections?.length || 0,
        filesGenerated: Object.keys(files).length,
        totalSize: Object.values(files).reduce((sum, file) => sum + file.size, 0)
      }
    });



  } catch (error) {
    JobManager.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error.message,
      message: `AI processing failed: ${error.message}`,
      completedAt: new Date()
    });
  }
}

async function getFirmData(firmId: string): Promise<any> {
  try {
    // REAL DATA ONLY - No static or fallback data allowed
    console.log('⚠️ [FIRM DATA] Real firm data fetching not implemented yet for firmId:', firmId);

    // Return null instead of any static/mock data to comply with real-data-only requirement
    // The AI system will work without firm context if no real data is available
    return null;
  } catch (error) {
    console.error('Failed to fetch firm data:', error);
    // Never return fallback data - strict real data only requirement
    return null;
  }
}
