/**
 * Composable for managing CSRF tokens
 * Use this to get the current CSRF token and include it in API requests
 *
 * This implements the double-submit cookie pattern for CSRF protection:
 * 1. Server sets a secure HttpOnly cookie with the token
 * 2. Server also sets a non-HttpOnly cookie with the same token
 * 3. Client reads the non-HttpOnly cookie and includes it in requests
 * 4. Server validates that the token in the request matches the HttpOnly cookie
 */
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useCookie, useRuntimeConfig } from '#app';

export default function useCsrf() {
  // Store the CSRF token in a reactive reference
  const csrfToken = ref(null);

  // Get the runtime config to check if we're in production
  const config = useRuntimeConfig();
  const isProd = computed(() => config.public.nodeEnv === 'production');

  // Track when the token was last fetched
  const lastFetchTime = ref(0);

  // Check if token needs refreshing (older than 1 hour)
  const needsRefresh = computed(() => {
    const now = Date.now();
    const tokenAge = now - lastFetchTime.value;
    // Refresh after 1 hour (3600000 ms)
    return tokenAge > 3600000;
  });

  // Get the CSRF token from the client-accessible cookie
  const getCsrfToken = () => {
    // Try to get the token from the client-accessible cookie
    const tokenCookie = useCookie('csrf_token_client', {
      // Ensure cookie is secure in production
      secure: isProd.value,
      sameSite: 'lax',
      path: '/'
    });

    const token = tokenCookie.value;

    // If we have a token, update the ref and return it
    if (token) {
      csrfToken.value = token;
      return token;
    }

    // If we don't have a token in the cookie, check if we have one in the ref
    if (csrfToken.value) {
      return csrfToken.value;
    }

    // No token found
    return null;
  };

  // Fetch a new CSRF token from the server
  const fetchCsrfToken = async (force = false) => {
    try {
      // Don't fetch a new token if we already have one and it's not expired
      // unless force=true is specified
      if (!force && csrfToken.value && !needsRefresh.value) {
        return csrfToken.value;
      }

      // Make a GET request to a simple endpoint to get a new CSRF token
      // Use native fetch to avoid potential circular dependencies with $fetch
      const response = await fetch('/api/csrf/token?_t=' + Date.now(), {
        method: 'GET',
        credentials: 'include' // Ensure cookies are sent with the request
      });

      if (!response.ok) {
        console.warn(`CSRF token fetch failed with status: ${response.status}`);
        // Try to get existing token from cookie as fallback
        const existingToken = getCsrfToken();
        if (existingToken) {
          return existingToken;
        }
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
      }

      const data = await response.json();

      // Update the last fetch time
      lastFetchTime.value = Date.now();

      // Check if the token was set in the client-accessible cookie
      const tokenCookie = useCookie('csrf_token_client', {
        secure: isProd.value,
        sameSite: 'lax',
        path: '/'
      });

      const clientToken = tokenCookie.value;

      if (clientToken) {
        csrfToken.value = clientToken;
        return clientToken;
      }

      // If no cookie was set but we got a token in the response, use that
      if (data && data.token) {
        csrfToken.value = data.token;

        // Manually set the cookie
        tokenCookie.value = data.token;

        return data.token;
      }

      console.warn('No CSRF token found in response or cookies');
      return null;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      // Don't throw the error further to prevent authentication cascading failures
      return null;
    }
  };

  // Track the refresh interval for proper cleanup
  let csrfRefreshInterval = null;

  // Initialize the CSRF token
  onMounted(async () => {
    console.log('CSRF: Component mounted - initializing token');

    // First try to get an existing token
    const existingToken = getCsrfToken();

    // If no token exists or it needs refreshing, fetch a new one
    if (!existingToken || needsRefresh.value) {
      await fetchCsrfToken();
    }

    // Set up a timer to periodically check and refresh the token if needed
    if (process.client) {
      console.log('CSRF: Starting refresh interval (15 minutes)');

      // Check every 15 minutes if token needs refreshing
      csrfRefreshInterval = setInterval(() => {
        if (needsRefresh.value) {
          console.log('CSRF: Auto-refreshing token');
          fetchCsrfToken().catch(err => {
            console.error('Error refreshing CSRF token:', err);
          });
        }
      }, 15 * 60 * 1000); // 15 minutes
    }
  });

  // Clean up interval on component unmount
  onUnmounted(() => {
    console.log('CSRF: Component unmounting - cleaning up refresh interval');

    if (csrfRefreshInterval) {
      clearInterval(csrfRefreshInterval);
      csrfRefreshInterval = null;
    }
  });

  /**
   * Ensure we have a valid CSRF token
   * This is useful before making API requests
   */
  const ensureToken = async () => {
    let token = getCsrfToken();

    // If no token or token needs refreshing, fetch a new one
    if (!token || needsRefresh.value) {
      token = await fetchCsrfToken();
    }

    return token;
  };

  return {
    csrfToken,
    getCsrfToken,
    fetchCsrfToken,
    ensureToken,
    needsRefresh
  };
}
