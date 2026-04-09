import PDFDocument from 'pdfkit';

/**
 * API endpoint for generating PDF documents from AI-generated content
 * 
 * @param {Object} event - The H3 event object
 * @returns {Buffer} - PDF file as buffer
 */
export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);
    const { content, title, filename } = body;

    if (!content) {
      throw createError({
        statusCode: 400,
        message: 'Content is required'
      });
    }

    // Create a new PDF document
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      size: 'A4',
      info: {
        Title: title || 'AI Generated Document',
        Author: 'AI Assistant',
        Subject: 'AI Generated Content',
        Keywords: 'ai, document, pdf',
        Creator: 'AI Assistant',
        Producer: 'PDFKit'
      }
    });

    // Collect the PDF data chunks
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Create a promise that resolves when the PDF is complete
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Add title if provided
    if (title) {
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor('#4F46E5') // Indigo
         .text(title, { align: 'center' });
      
      doc.moveDown(1);
    }

    // Add content
    doc.font('Helvetica')
       .fontSize(12)
       .fillColor('#000000')
       .text(content, {
         align: 'left',
         lineGap: 5
       });

    // Finalize the PDF
    doc.end();

    // Wait for the PDF to be generated
    const buffer = await pdfPromise;

    // Set response headers for file download
    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename || 'document'}.pdf"`,
      'Content-Length': buffer.length
    });

    // Return the PDF buffer
    return buffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate PDF'
    });
  }
});
