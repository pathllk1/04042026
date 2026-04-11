import NoteModel from '../../models/Note';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createError, readBody, defineEventHandler } from 'h3';

// Create a DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Sanitize HTML content
function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Check if the content already contains HTML entities
  if (html.includes('&lt;') && html.includes('&gt;')) {
    // Create a temporary div to decode the entities
    const window = new JSDOM('').window;
    const tempDiv = window.document.createElement('div');
    tempDiv.innerHTML = html;
    const decodedContent = tempDiv.textContent || '';

    // Sanitize the decoded content
    return purify.sanitize(decodedContent, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table',
        'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'src', 'alt', 'class', 'style', 'width', 'height'
      ],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    });
  }

  // Regular sanitization for normal HTML content
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table',
      'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'src', 'alt', 'class', 'style', 'width', 'height'
    ],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

// Sanitize text content
function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId;
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  // GET - Get a specific note
  if (event.method === 'GET') {
    try {
      const note = await NoteModel.findOne({ _id: id, userId });
      if (!note) {
        throw createError({
          statusCode: 404,
          message: 'Note not found'
        });
      }

      return {
        id: note._id,
        title: note.title,
        content: note.content,
        userId: note.userId,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      };
    } catch (error: any) {
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to fetch note'
      });
    }
  }

  // PUT - Update a note
  if (event.method === 'PUT') {
    try {
      const body = await readBody(event);
      const { title, content } = body;

      // Sanitize user input
      const updateData: any = {};
      if (title) updateData.title = sanitizeText(title);
      if (content) updateData.content = sanitizeHtml(content);

      const updatedNote = await NoteModel.findOneAndUpdate(
        { _id: id, userId },
        { $set: updateData },
        { new: true }
      );

      if (!updatedNote) {
        throw createError({
          statusCode: 404,
          message: 'Note not found or unauthorized'
        });
      }

      return {
        id: updatedNote._id,
        title: updatedNote.title,
        content: updatedNote.content,
        userId: updatedNote.userId,
        createdAt: updatedNote.createdAt,
        updatedAt: updatedNote.updatedAt
      };
    } catch (error: any) {
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to update note'
      });
    }
  }

  // DELETE - Delete a note
  if (event.method === 'DELETE') {
    try {
      const result = await NoteModel.deleteOne({ _id: id, userId });
      
      if (result.deletedCount === 0) {
        throw createError({
          statusCode: 404,
          message: 'Note not found or unauthorized'
        });
      }

      return {
        message: 'Note deleted successfully'
      };
    } catch (error: any) {
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to delete note'
      });
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
