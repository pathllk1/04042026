import { useHead } from '#app'
import { ref } from 'vue'

// Global state to store current page title and description
const currentTitle = ref('')
const currentDescription = ref('')
const appName = ref('Nuxt Application')

/**
 * Composable for setting page title and meta information
 * @param title - The page title
 * @param description - Meta description (optional)
 * @param customAppName - Optional custom app name to use instead of default
 */
export const usePageTitle = (title: string, description?: string, customAppName?: string) => {
  // Update global state
  currentTitle.value = title
  currentDescription.value = description || `${title} page of ${appName.value}`
  
  // If custom app name is provided, update it
  if (customAppName) {
    appName.value = customAppName
  }
  
  // Set the page title and meta tags
  useHead({
    title: title,
    titleTemplate: (title) => {
      return title ? `${title} | ${appName.value}` : appName.value
    },
    meta: [
      {
        name: 'description',
        content: currentDescription.value
      }
    ]
  })

  return { 
    title: currentTitle, 
    description: currentDescription,
    appName
  }
}

// Export the reactive references so they can be accessed from anywhere
export const useCurrentPageInfo = () => {
  return {
    currentTitle,
    currentDescription,
    appName
  }
}