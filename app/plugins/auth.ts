export default defineNuxtPlugin(async (nuxtApp) => {
  const { fetchUser } = useAuth()

  // Run this on both client and server to ensure state is hydrated correctly
  // This executes before any route middleware
  await fetchUser()
})
