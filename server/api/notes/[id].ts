import { getFirestore } from 'firebase-admin/firestore';
import type { UpdateNoteDto, Note } from '../../models/Note';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createError, readBody } from 'h3';

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

  const db = getFirestore();
  const noteRef = db.collection('notes').doc(id);

  // GET - Get a specific note
  if (event.method === 'GET') {
    const doc = await noteRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const note = doc.data() as Note;
    if (note.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    return {
      id: doc.id,
      ...note
    };
  }

  // PUT - Update a note
  if (event.method === 'PUT') {
    const doc = await noteRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const existingNote = doc.data() as Note;
    if (existingNote.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    const body = await readBody(event);

    console.log('Received update data:', {
      keys: Object.keys(body),
      hasTitle: !!body.title,
      hasContent: !!body.content
    });

    // Extract title and content, ignoring CSRF token and other fields
    const { title, content } = body;

    // Sanitize user input
    const sanitizedTitle = title ? sanitizeText(title) : undefined;
    const sanitizedContent = content ? sanitizeHtml(content) : undefined;

    const updateData: Partial<Note> = {
      ...(sanitizedTitle && { title: sanitizedTitle }),
      ...(sanitizedContent && { content: sanitizedContent }),
      updatedAt: new Date()
    };

    await noteRef.update(updateData);

    return {
      message: 'Note updated successfully'
    };
  }

  // DELETE - Delete a note
  if (event.method === 'DELETE') {
    const doc = await noteRef.get();
    if (!doc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const note = doc.data() as Note;
    if (note.userId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    await noteRef.delete();

    return {
      message: 'Note deleted successfully'
    };
  }
});