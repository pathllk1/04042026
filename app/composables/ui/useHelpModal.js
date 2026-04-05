import { ref } from 'vue'

// Global state for help modal
const isHelpModalOpen = ref(false)
const currentHelpTopic = ref('general')

export function useHelpModal() {
  // Open help modal with specific topic
  const openHelp = (topic = 'general') => {
    currentHelpTopic.value = topic
    isHelpModalOpen.value = true
  }

  // Close help modal
  const closeHelp = () => {
    isHelpModalOpen.value = false
  }

  // Context-aware help topics based on current route
  const getContextualHelpTopic = (route) => {
    const path = route.path

    // Map routes to help topics
    const routeToHelpMap = {
      '/': 'public/home',
      '/auth': 'public/login',
      '/register': 'public/register',
      '/signup': 'public/register',
      '/dashboard': 'user/dashboard',
      '/stock-market': 'stock-market/overview',
      '/ai': 'ai/assistant',
      '/expenses': 'financial/dashboard',
      '/wages': 'wages/dashboard',
      '/inventory': 'inventory/dashboard',
      '/documents': 'user/documents',
      '/admin': 'admin/dashboard'
    }

    // Check for exact match first
    if (routeToHelpMap[path]) {
      return routeToHelpMap[path]
    }

    // Check for partial matches
    if (path.startsWith('/stock-market')) {
      if (path.includes('analysis')) return 'stock-market/analysis'
      if (path.includes('nse')) return 'stock-market/nse-trading'
      return 'stock-market/overview'
    }

    if (path.startsWith('/ai')) {
      return 'ai/assistant'
    }

    if (path.startsWith('/expenses')) {
      return 'financial/dashboard'
    }

    if (path.startsWith('/wages')) {
      return 'wages/dashboard'
    }

    if (path.startsWith('/inventory')) {
      return 'inventory/dashboard'
    }

    if (path.startsWith('/admin')) {
      return 'admin/dashboard'
    }

    // Default fallback
    return 'general'
  }

  // Open contextual help based on current page
  const openContextualHelp = (route) => {
    const topic = getContextualHelpTopic(route)
    openHelp(topic)
  }

  return {
    isHelpModalOpen,
    currentHelpTopic,
    openHelp,
    closeHelp,
    openContextualHelp,
    getContextualHelpTopic
  }
}
