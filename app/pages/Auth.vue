<script setup lang="ts">
import { ref } from 'vue'
const { addToast } = useAppToast()
const { setUser } = useAuth()

const activeTab = ref<'login' | 'register'>('login')

// Forms
const loginForm = ref({ username: '', password: '' })
const registerForm = ref({ username: '', fullname: '', email: '', password: '', firmId: '' })

// Loading states
const loginLoading = ref(false)
const registerLoading = ref(false)

// Login
const handleLogin = async () => {
  loginLoading.value = true
  try {
    const res = await $fetch<{ message: string; user: any }>('/api/auth/login', { method: 'POST', body: loginForm.value })
    
    // Set user in global state
    setUser(res.user)
    
    addToast(res.message || 'Logged in successfully', 'success')
    console.log('User data:', res) // Log user data for demonstration
    loginForm.value = { username: '', password: '' }
    
    // Redirect to profile or home
    navigateTo('/profile')
  } catch (err: any) {
    addToast(err?.data?.statusMessage || 'Login failed', 'error')
    console.error('Login error:', err) // Log error details for debugging
  } finally {
    loginLoading.value = false
  }
}

// Register
const handleRegister = async () => {
  registerLoading.value = true
  try {
    const res = await $fetch('/api/auth/register', { method: 'POST', body: registerForm.value })
    addToast(res.message || 'Registered successfully', 'success')
    activeTab.value = 'login'
    registerForm.value = { username: '', fullname: '', email: '', password: '', firmId: '' }
  } catch (err: any) {
    addToast(err?.data?.statusMessage || 'Registration failed', 'error')
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
    <div class="w-full max-w-lg">
      <UCard class="p-8 shadow-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">

        <!-- Tabs -->
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Login', value: 'login', icon: 'i-lucide-log-in' },
            { label: 'Register', value: 'register', icon: 'i-lucide-user-plus' }
          ]"
          class="mb-6"
        />

        <!-- LOGIN -->
        <div v-if="activeTab === 'login'" class="space-y-4">
          <UForm @submit.prevent="handleLogin">
            <UFormField label="Username">
              <UInput v-model="loginForm.username" placeholder="Your username" required class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="loginForm.password" type="password" placeholder="********" required class="w-full" />
            </UFormField>
            <UButton type="submit" color="primary" block :loading="loginLoading" icon="i-lucide-log-in" class="mt-4">
              Login
            </UButton>
          </UForm>
        </div>

        <!-- REGISTER -->
        <div v-else class="space-y-4">
          <UForm @submit.prevent="handleRegister">
            <UFormField label="Username">
              <UInput v-model="registerForm.username" placeholder="Your username" required class="w-full" />
            </UFormField>
            <UFormField label="Full Name">
              <UInput v-model="registerForm.fullname" placeholder="Your full name" required class="w-full" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="registerForm.email" type="email" placeholder="you@example.com" required class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="registerForm.password" type="password" placeholder="********" required class="w-full" />
            </UFormField>
            <UFormField label="Firm ID">
              <UInput v-model="registerForm.firmId" placeholder="Enter firm ID" required class="w-full" />
            </UFormField>
            <UButton type="submit" color="primary" block :loading="registerLoading" icon="i-lucide-user-plus" class="mt-4">
              Register
            </UButton>
          </UForm>
        </div>

        <!-- Footer links -->
        <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p v-if="activeTab === 'login'">
            Don't have an account?
            <button class="text-blue-600 dark:text-blue-400 font-medium" @click="activeTab = 'register'">Register</button>
          </p>
          <p v-else>
            Already have an account?
            <button class="text-blue-600 dark:text-blue-400 font-medium" @click="activeTab = 'login'">Login</button>
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<style scoped>
.u-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}
</style>