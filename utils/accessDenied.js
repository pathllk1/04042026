/**
 * Utility function to show access denied messages
 * 
 * This function can be used from anywhere in the application to show
 * a standardized access denied message when a user tries to access
 * a restricted area.
 */
export function showAccessDenied(message = 'Access denied: Admin privileges required') {
  // Create and dispatch custom event for toast notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: {
        title: 'Access Denied',
        message: message,
        type: 'error',
        duration: 5000
      }
    }));
  }
  
  // Log the access attempt for debugging
  console.error(`Access denied: ${message}`);
}
