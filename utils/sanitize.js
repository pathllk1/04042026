/**
 * Utility for sanitizing HTML content to prevent XSS attacks
 */
import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * 
 * @param {string} html - The HTML content to sanitize
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  // Return empty string for null/undefined input
  if (html === null || html === undefined) {
    return '';
  }
  
  // Convert non-string inputs to string
  if (typeof html !== 'string') {
    html = String(html);
  }

  // Client-side sanitization
  if (process.client && window.DOMPurify) {
    return DOMPurify.sanitize(html, {
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

  // Server-side fallback (basic sanitization)
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * Sanitizes text content for safe display (no HTML allowed)
 * 
 * @param {string} text - The text content to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
  // Return empty string for null/undefined input
  if (text === null || text === undefined) {
    return '';
  }
  
  // Convert non-string inputs to string
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}
