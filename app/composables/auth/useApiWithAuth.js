/**
 * API utility for making authenticated requests with automatic token refresh
 * Use this composable for any API calls that require authentication
 */
import { navigateTo } from '#app';
import useAuthRefresh from '~/composables/auth/useAuthRefresh';
import useCsrf from '~/composables/auth/useCsrf';

export default function useApiWithAuth() {
  const { ensureValidToken, getToken, clearToken } = useAuthRefresh();
  const { ensureToken } = useCsrf();

  /**
   * Make an authenticated API request with automatic token refresh
   *
   * @param {string} url - The API endpoint to call
   * @param {Object} options - Fetch options (method, body, etc.)
   * @returns {Promise<any>} - The API response
   */
  const fetchWithAuth = async (url, options = {}) => {
    // Skip authentication for auth-related endpoints to avoid circular dependencies
    const skipAuthPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/forgot-password', // Password reset request - must be public
      '/api/auth/reset-password',  // Password reset confirmation - must be public
      '/api/auth/validate-password', // Password validation - used on public pages
      '/api/tools/languages', // Public language list API
      '/api/tools/translate' // Public translation API
    ];
    if (skipAuthPaths.some(path => url.includes(path))) {
      return $fetch(url, options);
    }

    try {
      // Note: We don't throw here if tokens are missing because they might be httpOnly 
      // and invisible to the client. We let the request proceed and let the server 
      // handle authentication via cookies.
      await ensureValidToken();

      // Get the current token
      const token = getToken();

      // Set up headers
      if (!options.headers) {
        options.headers = {};
      }

      // Only add Authorization header if we actually have a token
      if (token) {
        options.headers.Authorization = `Bearer ${token}`;
      }

      // Add CSRF token for state-changing operations
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
        try {
          // Ensure we have a valid CSRF token
          const csrfToken = await ensureToken();

          if (csrfToken) {

            // Add the token to the header
            options.headers['X-CSRF-Token'] = csrfToken;

            // Check if we're dealing with FormData
            const isFormData = options.body instanceof FormData || options.isFormData === true;

            // If it's FormData, add the token to the FormData object
            if (isFormData && options.body instanceof FormData) {
              // Add CSRF token to FormData if it doesn't already have it
              if (!options.body.has('_csrf')) {
                options.body.append('_csrf', csrfToken);
              }
            }
            // If there's a body and it's a string (JSON), add the token to the JSON body
            else if (options.body && typeof options.body === 'string') {
              try {
                const body = JSON.parse(options.body);
                body._csrf = csrfToken;
                options.body = JSON.stringify(body);
              } catch (e) {
                console.error('Error adding CSRF token to request body:', e);
              }
            }
            // If body is an object but not FormData, add the token directly
            else if (options.body && typeof options.body === 'object' && !isFormData) {
              options.body._csrf = csrfToken;
            }
            // If no body exists, create one with the CSRF token
            else if (!options.body) {
              options.body = { _csrf: csrfToken };

              // Ensure content type is set for JSON
              if (!options.headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/json';
              }

              // Stringify if needed
              if (options.headers['Content-Type'] === 'application/json') {
                options.body = JSON.stringify(options.body);
              }
            }
          }
        } catch (error) {
          console.error('Error handling CSRF token:', error);
        }
      }

      // Make the authenticated request
      // Nuxt's $fetch automatically includes cookies in both client and server (if configured)
      const response = await $fetch(url, options);
      return response;
    } catch (error) {

      // If it's an authentication error, redirect to login
      if (error.statusCode === 401 ||
          error.response?.status === 401 ||
          error.message?.includes('Authentication') ||
          error.message?.includes('Unauthorized')) {

        // Clear tokens and redirect on the client
        if (process.client) {
          clearToken('access_token');
          clearToken('refresh_token');

          // Use setTimeout to avoid navigation during render
          setTimeout(() => {
            navigateTo('/auth');
          }, 0);
        }
      }

      // Extract error message from the response data if available
      if (error.data && error.data.message) {
        error.message = error.data.message;
      }

      throw error;
    }
  };

  /**
   * HTTP GET with authentication
   */
  const get = (url, options = {}) => {
    return fetchWithAuth(url, { ...options, method: 'GET' });
  };

  /**
   * HTTP POST with authentication
   */
  const post = async (url, data, options = {}) => {
    // Ensure options is initialized properly
    const fetchOptions = { ...options };

    // Ensure headers are set correctly
    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    // Check if we're dealing with FormData
    const isFormData = data instanceof FormData || fetchOptions.isFormData === true;

    // Set Content-Type if not already set and not FormData
    if (!fetchOptions.headers['Content-Type'] && !isFormData) {
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    // If it's FormData, remove Content-Type to let the browser set it with boundary
    if (isFormData) {
      delete fetchOptions.headers['Content-Type'];
    }

    // Get CSRF token
    let csrfToken;
    try {
      // Ensure we have a valid CSRF token
      csrfToken = await ensureToken();
    } catch (error) {
      csrfToken = null;
    }

    // Add CSRF token to the data if it's a regular object
    let bodyData = data;
    if (data && typeof data === 'object' && !isFormData) {
      // Add CSRF token to the data object
      if (csrfToken) {
        bodyData = { ...data, _csrf: csrfToken };
      }

      // Stringify if Content-Type is application/json
      if (fetchOptions.headers['Content-Type'] === 'application/json') {
        bodyData = JSON.stringify(bodyData);
      }
    }

    // If it's FormData and we have a CSRF token, add it to the FormData
    if (isFormData && data instanceof FormData && csrfToken) {
      // Add CSRF token to FormData if it doesn't already have it
      if (!data.has('_csrf')) {
        data.append('_csrf', csrfToken);
      }
    }

    // Make the POST request
    return fetchWithAuth(url, {
      ...fetchOptions,
      method: 'POST',
      body: bodyData
    });
  };

  /**
   * HTTP PUT with authentication
   */
  const put = async (url, data, options = {}) => {
    // Ensure options is initialized properly
    const fetchOptions = { ...options };

    // Ensure headers are set correctly
    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    // Check if we're dealing with FormData
    const isFormData = data instanceof FormData || fetchOptions.isFormData === true;

    // Set Content-Type if not already set and not FormData
    if (!fetchOptions.headers['Content-Type'] && !isFormData) {
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    // If it's FormData, remove Content-Type to let the browser set it with boundary
    if (isFormData) {
      delete fetchOptions.headers['Content-Type'];
    }

    // Get CSRF token
    let csrfToken;
    try {
      // Ensure we have a valid CSRF token
      csrfToken = await ensureToken();
    } catch (error) {
      csrfToken = null;
    }

    // Add CSRF token to the data if it's a regular object
    let bodyData = data;
    if (data && typeof data === 'object' && !isFormData) {
      // Add CSRF token to the data object
      if (csrfToken) {
        bodyData = { ...data, _csrf: csrfToken };
      }

      // Stringify if Content-Type is application/json
      if (fetchOptions.headers['Content-Type'] === 'application/json') {
        bodyData = JSON.stringify(bodyData);
      }
    }

    // If it's FormData and we have a CSRF token, add it to the FormData
    if (isFormData && data instanceof FormData && csrfToken) {
      // Add CSRF token to FormData if it doesn't already have it
      if (!data.has('_csrf')) {
        data.append('_csrf', csrfToken);
      }
    }

    // Make the PUT request
    return fetchWithAuth(url, {
      ...fetchOptions,
      method: 'PUT',
      body: bodyData
    });
  };

  /**
   * HTTP PATCH with authentication
   */
  const patch = async (url, data, options = {}) => {
    // Ensure options is initialized properly
    const fetchOptions = { ...options };

    // Ensure headers are set correctly
    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    // Check if we're dealing with FormData
    const isFormData = data instanceof FormData || fetchOptions.isFormData === true;

    // Set Content-Type if not already set and not FormData
    if (!fetchOptions.headers['Content-Type'] && !isFormData) {
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    // If it's FormData, remove Content-Type to let the browser set it with boundary
    if (isFormData) {
      delete fetchOptions.headers['Content-Type'];
    }

    // Ensure we have a valid CSRF token
    const csrfToken = await ensureToken();

    // Add CSRF token to the data if it's a regular object
    let bodyData = data;
    if (data && typeof data === 'object' && !isFormData) {
      // Add CSRF token to the data object
      if (csrfToken) {
        bodyData = { ...data, _csrf: csrfToken };
      }

      // Stringify if Content-Type is application/json
      if (fetchOptions.headers['Content-Type'] === 'application/json') {
        bodyData = JSON.stringify(bodyData);
      }
    }

    // If it's FormData and we have a CSRF token, add it to the FormData
    if (isFormData && data instanceof FormData && csrfToken) {
      // Add CSRF token to FormData if it doesn't already have it
      if (!data.has('_csrf')) {
        data.append('_csrf', csrfToken);
      }
    }

    // Make the PATCH request
    return fetchWithAuth(url, {
      ...fetchOptions,
      method: 'PATCH',
      body: bodyData
    });
  };

  /**
   * HTTP DELETE with authentication
   */
  const del = async (url, options = {}) => {
    // Ensure options is initialized properly
    const fetchOptions = { ...options };

    // Ensure headers are set correctly
    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    // Ensure we have a valid CSRF token
    const csrfToken = await ensureToken();

    if (csrfToken) {
      // Add the token to the header
      fetchOptions.headers['X-CSRF-Token'] = csrfToken;

      // For DELETE requests, we might need to add a body with the CSRF token
      // if the server expects it in the body as well
      if (!fetchOptions.body) {
        fetchOptions.body = JSON.stringify({ _csrf: csrfToken });

        // Set Content-Type for JSON
        if (!fetchOptions.headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      }
    }

    return fetchWithAuth(url, { ...fetchOptions, method: 'DELETE' });
  };

  return {
    fetchWithAuth,
    get,
    post,
    put,
    patch,
    delete: del
  };
}