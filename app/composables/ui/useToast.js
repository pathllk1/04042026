/**
 * Composable for showing toast notifications
 *
 * @returns {Object} Toast methods
 */
export default function useToast() {
  /**
   * Show a toast notification
   *
   * @param {Object} options - Toast options
   * @param {string} options.message - Toast message
   * @param {string} [options.title] - Toast title (optional)
   * @param {string} [options.type] - Toast type: 'success', 'error', 'warning', 'info', 'loading' (default: 'info')
   * @param {number} [options.duration] - Duration in milliseconds (default: 3000, 0 for infinite)
   * @param {string} [options.id] - Unique ID for the toast (for dismissing later)
   * @param {string} [options.position] - Position of the toast (default: 'top-right')
   */
  const showToast = (options) => {
    if (typeof window === 'undefined') return;

    // Create and dispatch custom event
    const event = new CustomEvent('show-toast', {
      detail: {
        message: options.message,
        title: options.title || '',
        type: options.type || 'info',
        duration: options.duration !== undefined ? options.duration : 3000,
        id: options.id || `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: options.position || 'top-right'
      }
    });

    window.dispatchEvent(event);

  };

  /**
   * Show a success toast
   *
   * @param {string} message - Toast message
   * @param {Object|string} [options] - Options object or title string
   * @param {number} [duration] - Duration in milliseconds (default: 3000)
   * @returns {string} Toast ID
   */
  const success = (message, options, duration) => {
    // Handle the case where options is a string (title)
    if (typeof options === 'string') {
      options = { title: options, duration };
    } else if (typeof options === 'number') {
      options = { duration: options };
    } else if (!options) {
      options = {};
    }

    const toastOptions = {
      message,
      type: 'success',
      ...options
    };

    showToast(toastOptions);
    return toastOptions.id;
  };

  /**
   * Show an error toast
   *
   * @param {string} message - Toast message
   * @param {Object|string} [options] - Options object or title string
   * @param {number} [duration] - Duration in milliseconds (default: 3000)
   * @returns {string} Toast ID
   */
  const error = (message, options, duration) => {
    // Handle the case where options is a string (title)
    if (typeof options === 'string') {
      options = { title: options, duration };
    } else if (typeof options === 'number') {
      options = { duration: options };
    } else if (!options) {
      options = {};
    }

    const toastOptions = {
      message,
      type: 'error',
      ...options
    };

    showToast(toastOptions);
    return toastOptions.id;
  };

  /**
   * Show a warning toast
   *
   * @param {string} message - Toast message
   * @param {Object|string} [options] - Options object or title string
   * @param {number} [duration] - Duration in milliseconds (default: 3000)
   * @returns {string} Toast ID
   */
  const warning = (message, options, duration) => {
    // Handle the case where options is a string (title)
    if (typeof options === 'string') {
      options = { title: options, duration };
    } else if (typeof options === 'number') {
      options = { duration: options };
    } else if (!options) {
      options = {};
    }

    const toastOptions = {
      message,
      type: 'warning',
      ...options
    };

    showToast(toastOptions);
    return toastOptions.id;
  };

  /**
   * Show an info toast
   *
   * @param {string} message - Toast message
   * @param {Object|string} [options] - Options object or title string
   * @param {number} [duration] - Duration in milliseconds (default: 3000)
   * @returns {string} Toast ID
   */
  const info = (message, options, duration) => {
    // Handle the case where options is a string (title)
    if (typeof options === 'string') {
      options = { title: options, duration };
    } else if (typeof options === 'number') {
      options = { duration: options };
    } else if (!options) {
      options = {};
    }

    const toastOptions = {
      message,
      type: 'info',
      ...options
    };

    showToast(toastOptions);
    return toastOptions.id;
  };

  /**
   * Show a loading toast
   *
   * @param {string} message - Toast message
   * @param {Object} [options] - Additional options
   * @returns {string} Toast ID for dismissing later
   */
  const loading = (message, options = {}) => {
    const toastId = 'loading-' + Date.now();

    showToast({
      message,
      type: 'loading',
      duration: 0, // Infinite duration until dismissed
      id: toastId,
      ...options
    });

    return toastId;
  };

  /**
   * Dismiss a specific toast by ID
   *
   * @param {string} toastId - ID of the toast to dismiss
   */
  const dismiss = (toastId) => {
    if (typeof window === 'undefined') return;

    // Create and dispatch custom event
    const event = new CustomEvent('dismiss-toast', {
      detail: { id: toastId }
    });

    window.dispatchEvent(event);
  };

  return {
    showToast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss
  };
}
