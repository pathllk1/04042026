import { defineEventHandler } from 'h3';
import { requireCsrfToken } from '../utils/csrf';

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event);
  
  // Skip CSRF for auth routes as they are used to establish the session/token
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register')) {
    return;
  }

  // Apply CSRF protection to all other state-changing requests
  await requireCsrfToken(event);
});
