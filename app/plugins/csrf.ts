export default defineNuxtPlugin((nuxtApp) => {
  const csrfToken = useCookie('csrf_token_client')

  // We use a global interceptor for $fetch (which powers useFetch and useAsyncData)
  // This will automatically attach the CSRF token to relevant requests
  const excludedUrls = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/csrf/token'
  ]

  // Intercepting $fetch calls
  const originalFetch = globalThis.$fetch

  globalThis.$fetch = originalFetch.create({
    onRequest({ request, options }) {
      const method = (options.method || 'GET').toUpperCase()
      const url = request.toString()

      // 1. Only for mutating methods
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      
      // 2. Check if URL is in the exclusion list
      const isPublic = excludedUrls.some(excluded => url.includes(excluded))

      // 3. Attach token if it exists and it's a mutation on a non-public route
      if (isMutation && !isPublic && csrfToken.value) {
        options.headers = (options.headers || {}) as Record<string, string>
        
        // Use standard header name for CSRF
        if (options.headers instanceof Headers) {
          options.headers.set('X-CSRF-Token', csrfToken.value)
        } else {
          options.headers['X-CSRF-Token'] = csrfToken.value
        }
      }
    }
  })
})
