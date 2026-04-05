// server/utils/csrf.ts
import { H3Event, createError, getCookie, setCookie, getRequestHeader, readBody, getQuery, readMultipartFormData, getRequestURL } from 'h3';
import crypto from 'crypto';
import { useRuntimeConfig } from '#imports';

// Generate a random CSRF token with high entropy
export function generateCsrfToken(): string {
  // Use 64 bytes (512 bits) for stronger security
  return crypto.randomBytes(64).toString('hex');
}

// Perform a timing-safe comparison of two strings
// This prevents timing attacks that could be used to guess the token
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    // Use crypto's timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  } catch (error) {
    // Fallback to regular comparison if crypto method fails
    return a === b;
  }
}

// Set CSRF token in a cookie
export function setCsrfToken(event: H3Event): string {
  const token = generateCsrfToken();
  const timestamp = Date.now();

  // Store the token with a timestamp to enable expiration checks
  const tokenData = `${token}:${timestamp}`;

  // Check if the request is actually using HTTPS
  const isSecure = getRequestURL(event).protocol === 'https:' || 
                   getRequestHeader(event, 'x-forwarded-proto') === 'https';

  // Set the CSRF token in a cookie with httpOnly: true for security
  setCookie(event, 'csrf_token', tokenData, {
    httpOnly: true, // Prevent JavaScript access for security
    secure: isSecure, // Only secure if actually using HTTPS
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    path: '/',
    // Set a reasonable expiration time (4 hours)
    maxAge: 4 * 60 * 60
  });

  // Also set a non-httpOnly cookie with just the token (not the timestamp) for the frontend
  // This is used only for the double-submit pattern
  setCookie(event, 'csrf_token_client', token, {
    httpOnly: false,
    secure: isSecure, // Only secure if actually using HTTPS
    sameSite: 'lax', // Use 'lax' to ensure the token is sent with navigation
    path: '/',
    maxAge: 4 * 60 * 60
  });

  return token;
}

// Validate CSRF token
export async function validateCsrfToken(event: H3Event): Promise<{ isValid: boolean; error?: string }> {
  // Get the CSRF token from the secure cookie (server-side only)
  const secureCookieData = getCookie(event, 'csrf_token');

  if (!secureCookieData) {
    return { isValid: false, error: 'Missing CSRF token cookie' };
  }

  // Extract token and timestamp from cookie data
  const [secureCookieToken, timestampStr] = secureCookieData.split(':');
  const timestamp = parseInt(timestampStr || '0', 10);

  // Check if token has expired (4 hours = 14400000 ms)
  const now = Date.now();
  const tokenAge = now - timestamp;
  const maxAge = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

  if (tokenAge > maxAge) {
    // Token has expired, generate a new one
    setCsrfToken(event);
    return { isValid: false, error: 'CSRF token expired' };
  }

  // Get the CSRF token from the request header
  const headerToken = getRequestHeader(event, 'X-CSRF-Token');

  // Get the CSRF token from query parameters
  const query = getQuery(event);
  const queryToken = query._csrf as string;

  // Check if it's a multipart/form-data request
  const contentType = getRequestHeader(event, 'content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  // For multipart/form-data requests, we need special handling
  if (isMultipart) {
    try {
      // Read the multipart form data
      const formData = await readMultipartFormData(event);

      // If we have form data, look for the CSRF token
      if (formData && formData.length > 0) {
        // Find the CSRF token field
        const csrfField = formData.find(field => field.name === '_csrf');

        // If we found a CSRF token field, extract the token
        if (csrfField && csrfField.data) {
          const formDataToken = Buffer.from(csrfField.data).toString('utf-8');

          // Validate the token using timing-safe comparison
          if (secureCookieToken && formDataToken && timingSafeEqual(secureCookieToken, formDataToken)) {
            // Store the form data in the context for downstream handlers
            event.context.formData = formData;
            return { isValid: true };
          }
        }
      }
    } catch (formDataError) {
      // If reading form data fails, continue with other token sources
      console.error('Error reading multipart form data:', formDataError);
    }
  }

  // Try to get token from JSON body if it exists
  let bodyToken;
  try {
    // Try to read the body if it hasn't been read yet and it's not a multipart request
    if (!event.context.body && !isMultipart) {
      try {
        const body = await readBody(event);
        // Store the body in the context for downstream handlers
        event.context.body = body;
        bodyToken = body?._csrf;
      } catch (readError) {
        // If we can't read the body, it might be empty or already consumed
        console.error('Error reading request body:', readError);
      }
    } else if (event.context.body) {
      bodyToken = event.context.body._csrf;
    }
  } catch (error) {
    // If there's an error reading the body, continue with other token sources
    console.error('Error processing request body:', error);
  }

  // The token from the request must match the token in the secure cookie
  const requestToken = headerToken || bodyToken || queryToken;

  if (!requestToken) {
    return { isValid: false, error: 'Missing CSRF token in request' };
  }

  // Check if the request token matches the secure cookie token using timing-safe comparison
  // This implements the double-submit cookie pattern
  const isValid = timingSafeEqual(secureCookieToken, requestToken);
  return {
    isValid,
    error: isValid ? undefined : 'CSRF token validation failed'
  };
}

// Middleware to check CSRF token for state-changing operations
export async function requireCsrfToken(event: H3Event): Promise<void> {
  const method = event.node.req.method;
  const path = event.path || event.node.req.url || '';

  // Only check CSRF token for state-changing operations
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return;
  }


  // Validate the CSRF token
  const { isValid, error } = await validateCsrfToken(event);

  if (!isValid) {
    console.error(`CSRF validation failed for ${method} ${path}: ${error}`);

    throw createError({
      statusCode: 403,
      statusMessage: error || 'Invalid or missing CSRF token'
    });
  }

}
