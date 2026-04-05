/**
 * Centralized logout composable that handles complete cleanup of ALL localStorage data
 * This ensures that when a user logs out, ALL localStorage data is cleared completely
 * to prevent settings from being shared between different users for privacy/security reasons
 */

import { useRouter, useCookie } from '#app'

export const useLogout = () => {
  const router = useRouter()

  /**
   * Get all localStorage keys that should be cleared on logout
   * This includes all user-specific data and settings
   */
  const getLocalStorageKeysToClean = (): string[] => {
    return [
      // Authentication data
      'token',
      'refreshToken', 
      'user',
      'authData',
      
      // AI Configuration (user-specific settings and API keys)
      'ai_configuration',
      'ai_configuration_extended', 
      'ai_usage_stats',
      
      // Application settings (user preferences)
      'app_settings',
      
      // API keys (user-specific)
      'ilovepdf_api_key',
      'huggingface_api_key',
      'gstApiSettings',
      'adobe_pdf_credentials',
      
      // Weather data (user's saved cities)
      'weather_saved_cities',
      
      // Inventory data (user-specific)
      'inventoryBills',
      'inventoryColumnSettings',
      'inventory_auto_save_data', // Auto-save data
      'inventory_form_data', // Form data
      
      // Timer data (user-specific)
      'timer_state',
      'timer_last_active',
      
      // Notes data (if any)
      'notes_data',
      'user_notes',
      
      // Any other user-specific data that might be added in the future
      // We'll also do a pattern-based cleanup for common prefixes
    ]
  }

  /**
   * Get localStorage key patterns that should be cleared
   * This helps catch dynamically generated keys
   */
  const getLocalStoragePatterns = (): string[] => {
    return [
      'inventory_', // Any inventory-related data
      'timer_', // Any timer-related data
      'user_', // Any user-prefixed data
      'ai_', // Any AI-related data
      'auth_', // Any auth-related data
      'settings_', // Any settings data
      'cache_', // Any cached user data
      'temp_', // Any temporary user data
    ]
  }

  /**
   * Clear all localStorage data for the current user
   * This ensures complete cleanup when logging out to prevent settings
   * from being shared between different users for privacy/security reasons
   */
  const clearAllUserData = (): void => {
    if (typeof window === 'undefined') return

    try {
      console.log('🧹 Starting complete localStorage cleanup...')

      // Get count of items before clearing
      const itemCountBefore = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.length
        : 0

      console.log(`📊 Found ${itemCountBefore} localStorage items to clear`)

      // Clear ALL localStorage data for complete privacy/security
      if (typeof window !== 'undefined' && window.localStorage) {
        // Log all keys that will be cleared (for debugging)
        const allKeys = Object.keys(window.localStorage)
        if (allKeys.length > 0) {
          console.log('🗑️ Clearing all localStorage keys:', allKeys)
        }

        // Clear everything
        window.localStorage.clear()

        console.log('✅ All localStorage data has been cleared')
        console.log('✨ localStorage is now completely empty')
      }
    } catch (error) {
      console.error('❌ Error during localStorage cleanup:', error)
    }
  }

  /**
   * Clear authentication cookies
   */
  const clearAuthCookies = (): void => {
    try {
      // Clear cookies using Nuxt's useCookie
      const tokenCookie = useCookie('token')
      const refreshCookie = useCookie('refreshToken')
      
      tokenCookie.value = null
      refreshCookie.value = null
      
      console.log('🍪 Authentication cookies cleared')
    } catch (error) {
      console.error('❌ Error clearing cookies:', error)
    }
  }

  /**
   * Perform complete logout with full data cleanup
   * This is the main logout function that should be used throughout the app
   */
  const performLogout = async (redirectTo: string = '/auth'): Promise<void> => {
    try {
      console.log('🚪 Starting complete logout process...')
      
      // 1. Clear all localStorage data
      clearAllUserData()
      
      // 2. Clear authentication cookies
      clearAuthCookies()
      
      // 3. Call server logout endpoint to invalidate server-side sessions
      try {
        await $fetch('/api/auth/logout', {
          method: 'POST'
        })
        console.log('✅ Server-side logout completed')
      } catch (error) {
        // Don't fail the logout if server call fails
        console.warn('⚠️ Server logout failed, but continuing with client cleanup:', error)
      }
      
      // 4. Redirect to login page
      console.log(`🔄 Redirecting to ${redirectTo}`)
      await router.push(redirectTo)
      
      console.log('✅ Complete logout process finished')
      
    } catch (error) {
      console.error('❌ Error during logout process:', error)
      // Even if there's an error, try to redirect to login
      try {
        await router.push(redirectTo)
      } catch (redirectError) {
        console.error('❌ Failed to redirect after logout error:', redirectError)
      }
    }
  }

  /**
   * Emergency logout - clears everything and redirects immediately
   * Use this when you need to force logout due to security issues
   */
  const emergencyLogout = (): void => {
    console.log('🚨 Emergency logout initiated')
    
    // Clear everything immediately
    clearAllUserData()
    clearAuthCookies()
    
    // Force redirect
    if (typeof window !== 'undefined') {
      window.location.href = '/auth'
    }
  }

  /**
   * Get information about what data will be cleared
   * Useful for showing users what will happen when they logout
   */
  const getDataToBeClearedInfo = (): { keys: string[], patterns: string[], description: string } => {
    return {
      keys: getLocalStorageKeysToClean(),
      patterns: getLocalStoragePatterns(),
      description: 'All user settings, preferences, saved data, API keys, and cached information will be cleared to ensure the next user gets a fresh start.'
    }
  }

  return {
    performLogout,
    emergencyLogout,
    clearAllUserData,
    clearAuthCookies,
    getDataToBeClearedInfo
  }
}
