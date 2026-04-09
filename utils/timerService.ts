import { ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { CURRENT_PRICES_REFRESH_MINUTES } from './pouchDBService';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Timer state
export const timerMinutes = ref(CURRENT_PRICES_REFRESH_MINUTES);
export const timerSeconds = ref(0);
export const timerActive = ref(false);
export const timerInterval = ref<ReturnType<typeof setInterval> | null>(null);

// Last timer sync with localStorage
let lastSync = Date.now();

// Timer storage keys
const TIMER_STATE_KEY = 'nseTimerState';
const TIMER_LAST_ACTIVE_KEY = 'nseTimerLastActive';

/**
 * Initialize the timer service
 */
export function initTimerService() {
  if (isBrowser) {
    // Record that the timer page is active now
    try {
      // Check if localStorage is available
      if (localStorage) {
        // Set the last active timestamp
        localStorage.setItem(TIMER_LAST_ACTIVE_KEY, Date.now().toString());
      }
    } catch (error) {
      console.error('[Timer] Error recording active time:', error);
    }

    // Try to restore timer state from localStorage
    restoreTimerState();

    // Set up timer sync interval (sync every 5 seconds)
    const syncInterval = setInterval(() => {
      if (timerActive.value) {
        saveTimerState();
        // Also update the last active timestamp
        try {
          localStorage.setItem(TIMER_LAST_ACTIVE_KEY, Date.now().toString());
        } catch (error) {
          console.error('[Timer] Error updating active time:', error);
        }
      }
    }, 5000);

    // Set up a watch on the timer values to save state when they change
    watch([timerMinutes, timerSeconds, timerActive], () => {
      if (timerActive.value) {
        saveTimerState();
      }
    });

    // Set up event listeners for page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Page is being hidden (user navigating away)
          if (timerActive.value) {
            saveTimerState(true); // Force save
          }
        } else {
          // Page is becoming visible again
          restoreTimerState();
        }
      });
    }

    // Set up beforeunload event to save state when leaving the page
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (timerActive.value) {
          saveTimerState(true); // Force save
        }
      });
    }

    // Clean up on component unmount
    onBeforeUnmount(() => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }

      // Force save state on unmount
      if (timerActive.value) {
        saveTimerState(true); // Force save
      }
    });
  }
}

/**
 * Start the refresh timer
 * @param callback Function to call when timer reaches zero
 */
export function startTimer(callback: () => void) {
  if (isBrowser) {
    // If timer is already active, don't start a new one
    if (timerActive.value && timerInterval.value) {
      return;
    }

    // Set timer to active
    timerActive.value = true;

    // Check if we need to trigger an immediate refresh
    // This happens if the timer expired while the page was inactive
    const needsImmediateRefresh = timerMinutes.value === CURRENT_PRICES_REFRESH_MINUTES &&
                                 timerSeconds.value === 0 &&
                                 localStorage.getItem(TIMER_STATE_KEY) !== null;

    if (needsImmediateRefresh) {
      // Call the callback function
      if (callback && typeof callback === 'function') {
        callback();
      }
    }

    // Force save initial state immediately
    saveTimerState(true); // Force save

    // Update the last active timestamp
    try {
      localStorage.setItem(TIMER_LAST_ACTIVE_KEY, Date.now().toString());
    } catch (error) {
      console.error('[Timer] Error updating active time:', error);
    }

    // Set up interval to update timer every second
    timerInterval.value = setInterval(() => {
      // Decrement seconds
      if (timerSeconds.value > 0) {
        timerSeconds.value--;
      }
      // Decrement minutes and reset seconds
      else if (timerMinutes.value > 0) {
        timerMinutes.value--;
        timerSeconds.value = 59;
      }
      // Timer reached zero
      else {
        // Reset timer
        resetTimer();

        // Call the callback function
        if (callback && typeof callback === 'function') {
          callback();
        }

        // Restart timer
        timerMinutes.value = CURRENT_PRICES_REFRESH_MINUTES;
        timerSeconds.value = 0;
        timerActive.value = true;

        // Save the new timer state
        saveTimerState(true);
      }
    }, 1000);
  }
}

/**
 * Reset the timer
 */
export function resetTimer() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }

  timerActive.value = false;

  // Clear timer state in localStorage
  if (isBrowser && localStorage) {
    try {
      localStorage.removeItem(TIMER_STATE_KEY);
    } catch (error) {
      console.error('[Timer] Error removing timer state from localStorage:', error);
    }
  }
}

/**
 * Save timer state to localStorage
 * @param force Force save even if the timer is not active or the time since last save is less than 5 seconds
 */
function saveTimerState(force = false) {
  if (isBrowser && localStorage) {
    const now = Date.now();

    

    // Only save if timer is active and it's been at least 5 seconds since last save, or if force is true
    if (force || (timerActive.value && (now - lastSync > 5000))) {
      const state = {
        minutes: timerMinutes.value,
        seconds: timerSeconds.value,
        timestamp: now,
        active: timerActive.value
      };

      try {
        // Save the timer state
        localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
        lastSync = now;
      } catch (error) {
        console.error('[Timer] Error saving timer state to localStorage:', error);
      }
    } else {
      
    }
  }
}

/**
 * Restore timer state from localStorage
 */
function restoreTimerState() {
  if (isBrowser && localStorage) {
    try {
      

      // Get the last time the timer page was active
      const lastActiveStr = localStorage.getItem(TIMER_LAST_ACTIVE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
      const now = Date.now();
      const timeSinceLastActive = Math.floor((now - lastActive) / 1000);

     

      // Get the saved timer state
      const stateJson = localStorage.getItem(TIMER_STATE_KEY);
      

      // List all localStorage keys to help debug
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        const elapsed = Math.floor((now - state.timestamp) / 1000);

    

        // Calculate remaining time
        let totalSeconds = (state.minutes * 60) + state.seconds - elapsed;

        // If timer should still be running and was active
        if (totalSeconds > 0 && state.active) {
          // Calculate new minutes and seconds
          timerMinutes.value = Math.floor(totalSeconds / 60);
          timerSeconds.value = totalSeconds % 60;
          timerActive.value = true;
        }
        // Timer would have expired or was not active
        else {
          // If the timer expired while the page was not active, we need to trigger a refresh
          if (totalSeconds <= 0 && state.active && timeSinceLastActive > 60) {
            // Reset to full duration
            timerMinutes.value = CURRENT_PRICES_REFRESH_MINUTES;
            timerSeconds.value = 0;
            timerActive.value = true;
          } else {
            // Reset to full duration
            timerMinutes.value = CURRENT_PRICES_REFRESH_MINUTES;
            timerSeconds.value = 0;
            timerActive.value = false;
          }
        }
      } else {
        // No saved state, set to full duration
        timerMinutes.value = CURRENT_PRICES_REFRESH_MINUTES;
        timerSeconds.value = 0;
      }
    } catch (error) {
      console.error('[Timer] Error restoring timer state:', error);

      // Reset to full duration on error
      timerMinutes.value = CURRENT_PRICES_REFRESH_MINUTES;
      timerSeconds.value = 0;
    }
  }
}
