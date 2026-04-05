import { defineEventHandler } from 'h3';
import { setCsrfToken } from '../../utils/csrf';

export default defineEventHandler((event) => {
  // Generate and set CSRF tokens in cookies
  const token = setCsrfToken(event);
  
  // Return the token in the response body as well
  return {
    token
  };
});
