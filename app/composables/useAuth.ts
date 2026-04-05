import { ref, computed } from 'vue'

export interface User {
  id: string
  username: string
  fullname: string
  role?: string
}

const user = ref<User | null>(null)
const isInitialized = ref(false)

export const useAuth = () => {
  const setUser = (newUser: User | null) => {
    user.value = newUser
  }

  const fetchUser = async () => {
    // If we already have a user, don't fetch again
    if (user.value) {
      isInitialized.value = true
      return
    }

    try {
      // Use useRequestHeaders to pass cookies during SSR
      const headers = useRequestHeaders(['cookie'])
      const res = await $fetch<{ user: User }>('/api/auth/me', { headers })
      setUser(res.user)
    } catch (err) {
      setUser(null)
    } finally {
      isInitialized.value = true
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      navigateTo('/auth')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const isLoggedIn = computed(() => !!user.value)

  return {
    user,
    setUser,
    fetchUser,
    logout,
    isLoggedIn,
    isInitialized
  }
}
