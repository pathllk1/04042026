import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);
    const { chatHistory, title, filename } = body;

    if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Chat history is required and must be an array'
      });
    }

    // Generate HTML content for the chat
    const htmlContent = generateHtmlContent(chatHistory, title);

    // Set response headers for HTML download
    setResponseHeaders(event, {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="${filename || 'ai-chat'}.html"`
    });

    // Return the HTML content
    return htmlContent;
  } catch (error) {
    console.error('Error generating chat export:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate export'
    });
  }
});

// Function to generate HTML content
function generateHtmlContent(chatHistory, title) {
  const pageTitle = title || 'AI Chat Conversation';
  const now = new Date();
  const timestamp = `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

  // Generate chat messages HTML
  const messagesHtml = chatHistory.map(message => {
    const isUser = message.isUser;
    const label = isUser ? 'You' : 'AI Assistant';
    const messageTime = message.timestamp ? new Date(message.timestamp).toLocaleString() : '';

    // Strip HTML tags from content for safety
    const plainContent = message.content.replace(/<[^>]*>/g, '');

    // Format code blocks
    const formattedContent = plainContent
      .replace(/```([\s\S]*?)```/g, (_, code) => `<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${code}</pre>`)
      .replace(/`([^`]+)`/g, (_, code) => `<code style="background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${code}</code>`);

    return `
      <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; color: ${isUser ? '#4F46E5' : '#10B981'};">${label}</div>
        ${messageTime ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 5px;">${messageTime}</div>` : ''}
        <div style="background-color: ${isUser ? '#EEF2FF' : '#F3F4F6'}; padding: 10px; border-radius: 5px;">
          ${formattedContent.replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
  }).join('');

  // Complete HTML document
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageTitle}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        h1 {
          text-align: center;
          color: #4F46E5;
          margin-bottom: 10px;
        }
        .timestamp {
          text-align: center;
          color: #6B7280;
          margin-bottom: 30px;
          font-size: 14px;
        }
        .chat-container {
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 20px;
          background-color: white;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      </style>
    </head>
    <body>
      <h1>${pageTitle}</h1>
      <div class="timestamp">Generated on ${timestamp}</div>
      <div class="chat-container">
        ${messagesHtml}
      </div>
    </body>
    </html>
  `;
}
