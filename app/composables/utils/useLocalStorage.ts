// composables/useLocalStorage.ts

/**
 * Composable for safely handling localStorage operations in an SSR environment
 * Ensures localStorage is only accessed on the client side
 */
export default function useLocalStorage() {
  /**
   * Safely get an item from localStorage
   * @param {string} key - The key to retrieve from localStorage
   * @param {any} defaultValue - Default value to return if key doesn't exist or in SSR context
   * @returns {any} - The stored value or defaultValue
   */
  const getItem = <T>(key: string, defaultValue: T): T => {
    // Only access localStorage on the client side
    if (process.client) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          return JSON.parse(item) as T;
        }
      } catch (error) {
        console.error(`Error getting item from localStorage: ${key}`, error);
      }
    }
    return defaultValue;
  };

  /**
   * Safely set an item in localStorage
   * @param {string} key - The key to set in localStorage
   * @param {any} value - The value to store
   * @returns {boolean} - True if successful, false otherwise
   */
  const setItem = <T>(key: string, value: T): boolean => {
    // Only access localStorage on the client side
    if (process.client) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error(`Error setting item in localStorage: ${key}`, error);
      }
    }
    return false;
  };

  /**
   * Safely remove an item from localStorage
   * @param {string} key - The key to remove from localStorage
   * @returns {boolean} - True if successful, false otherwise
   */
  const removeItem = (key: string): boolean => {
    // Only access localStorage on the client side
    if (process.client) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`Error removing item from localStorage: ${key}`, error);
      }
    }
    return false;
  };

  return {
    getItem,
    setItem,
    removeItem
  };
}