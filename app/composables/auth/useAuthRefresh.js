/**
 * Authentication utility for token refresh and management
 * This composable centralizes token refresh functionality for use across the application
 */

// Dynamic HTTPS detection for cookie security
const isSecureConnection = () => {
  if (process.server) return false; // Safe server-side default
  if (process.client) {
    return window.location.protocol === 'https:' ||
           window.location.hostname === 'localhost' ||  // Dev safety
           window.location.hostname === '127.0.0.1';   // Dev safety
  }
  return false; // Safe fallback
};

export default function useAuthRefresh() {
  // Configure cookies with proper persistence settings
  const accessCookie = useCookie('access_token', {
    default: () => null,
    maxAge: 60 * 15, // 15 minutes (matches JWT expiry)
    secure: isSecureConnection(),
    sameSite: 'lax',
    httpOnly: false // Allow client-side access for token refresh
  });

  const refreshCookie = useCookie('refresh_token', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 7, // 7 days (matches JWT expiry)
    secure: isSecureConnection(),
    sameSite: 'lax',
    httpOnly: false // Allow client-side access for token refresh
  });

  /**
   * Get token from cookie with localStorage fallback
   * @param {string} key - The key to retrieve (token or refreshToken)
   * @returns {string|null} - The token value or null
   */
  const getTokenWithFallback = (key) => {
    // First try to get from cookie
    const cookieValue = key === 'access_token' ? accessCookie.value : refreshCookie.value;
    if (cookieValue) {
      return cookieValue;
    }

    // Fallback to localStorage if available (client-side only)
    if (process.client && typeof localStorage !== 'undefined') {
      try {
        const localValue = localStorage.getItem(key);
        if (localValue) {
          // If found in localStorage, restore to cookie for future use
          if (key === 'access_token') {
            accessCookie.value = localValue;
          } else {
            refreshCookie.value = localValue;
          }
          return localValue;
        }
      } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
      }
    }

    return null;
  };

  /**
   * Set token in both cookie and localStorage
   * @param {string} key - The key to set (token or refreshToken)
   * @param {string} value - The token value
   */
  const setTokenWithBackup = (key, value) => {
    // Set in cookie
    if (key === 'access_token') {
      accessCookie.value = value;
    } else {
      refreshCookie.value = value;
    }

    // Backup to localStorage if available (client-side only)
    if (process.client && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error(`Error storing ${key} in localStorage:`, error);
      }
    }
  };

  /**
   * Clear token from both cookie and localStorage
   * @param {string} key - The key to clear (token or refreshToken)
   */
  const clearToken = (key) => {
    // Clear from cookie
    if (key === 'access_token') {
      accessCookie.value = null;
    } else {
      refreshCookie.value = null;
    }

    // Clear from localStorage if available (client-side only)
    if (process.client && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing ${key} from localStorage:`, error);
      }
    }
  };

  /**
   * Check if the token is expired
   * @param {string} token - The JWT token to check
   * @returns {boolean} - True if token is expired, false otherwise
   */
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      const payload = decodeToken(token);
      if (!payload || !payload.exp) return true;

      // The exp field is in seconds; convert to milliseconds
      const expTime = payload.exp * 1000;
      return Date.now() > expTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  };

  /**
   * Decode the JWT payload
   * @param {string} token - The JWT token to decode
   * @returns {object|null} - The decoded token payload or null
   */
  const decodeToken = (token) => {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      console.error('Invalid token format');
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('Invalid JWT format: Expected 3 parts');
        return null;
      }

      const payloadBase64 = parts[1];

      // Server-side decoding
      if (process.server) {
        try {
          return JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        } catch (e) {
          console.error('Server-side decode error:', e);
          return null;
        }
      } 
      // Client-side decoding
      else {
        try {
          const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          return JSON.parse(jsonPayload);
        } catch (e) {
          // Fallback to simpler approach if the above fails
          try {
            return JSON.parse(atob(payloadBase64));
          } catch (e2) {
            console.error('Client-side decode error:', e2);
            return null;
          }
        }
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  /**
   * Ensure a valid token is available before proceeding with an operation
   * @returns {Promise<boolean>} - True if a valid token is available, false otherwise
   */
  const ensureValidToken = async () => {
    try {
      const accessToken = getTokenWithFallback('access_token');
      const refreshToken = getTokenWithFallback('refresh_token');

      // If no tokens exist, authentication is not possible
      if (!accessToken && !refreshToken) {
        console.log('No tokens available - authentication required');
        return false;
      }

      // In this app, the server middleware automatically handles token refresh 
      // if refresh_token is present in cookies. So as long as we have 
      // either a valid access_token OR a refresh_token, we are good.
      const isAccessValid = accessToken && !isTokenExpired(accessToken);
      const isRefreshValid = refreshToken && !isTokenExpired(refreshToken);

      return isAccessValid || isRefreshValid;
    } catch (error) {
      console.error('Error ensuring valid token:', error);
      return false;
    }
  };

  return {
    isTokenExpired,
    ensureValidToken,
    getToken: () => getTokenWithFallback('access_token'),
    getRefreshToken: () => getTokenWithFallback('refresh_token'),
    setTokenWithBackup,
    clearToken,
    // Legacy methods for backward compatibility
    getTokenDirect: () => accessCookie.value,
    getRefreshTokenDirect: () => refreshCookie.value
  };
} 
 