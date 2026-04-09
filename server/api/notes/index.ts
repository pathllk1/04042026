import { getFirestore } from 'firebase-admin/firestore';
import type { CreateNoteDto, Note } from '../../models/Note';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createError } from 'h3';

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

  const db = getFirestore();

  // GET - List all notes for the user
  if (event.method === 'GET') {
    const notesRef = db.collection('notes');
    const snapshot = await notesRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // POST - Create a new note
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      console.log('Received note data:', {
        title: body.title,
        contentLength: body.content ? body.content.length : 0,
        keys: Object.keys(body)
      });

      // Extract title and content, ignoring CSRF token and other fields
      const { title, content } = body;

      if (!title || !content) {
        console.error('Missing required fields:', {
          hasTitle: !!title,
          hasContent: !!content,
          bodyKeys: Object.keys(body)
        });
        throw createError({
          statusCode: 400,
          message: 'Title and content are required'
        });
      }

      // Sanitize user input
      const sanitizedTitle = sanitizeText(title);
      const sanitizedContent = sanitizeHtml(content);

      const note: Note = {
        title: sanitizedTitle,
        content: sanitizedContent,
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('notes').add(note);
      const newNote = await docRef.get();

      const noteData = newNote.data();
      const response = {
        id: docRef.id,
        ...noteData
      };

      return response;
    } catch (error) {
      throw error;
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});