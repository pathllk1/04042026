<script setup lang="ts">
const { user, isLoggedIn, logout } = useAuth()

// Middleware to redirect if not logged in
definePageMeta({
  middleware: [
    function () {
      const { isLoggedIn } = useAuth()
      if (!isLoggedIn.value) {
        return navigateTo('/auth')
      }
    }
  ]
})
</script>

<template>
  <UContainer class="py-10">
    <UCard v-if="user" class="max-w-2xl mx-auto shadow-xl">
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">User Profile</h1>
          <UButton color="red" variant="soft" icon="i-lucide-log-out" @click="logout">
            Logout
          </UButton>
        </div>
      </template>

      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <UAvatar
            :alt="user.fullname"
            size="xl"
            class="bg-blue-100 text-blue-600 font-bold"
          />
          <div>
            <h2 class="text-xl font-semibold">{{ user.fullname }}</h2>
            <p class="text-gray-500">@{{ user.username }}</p>
          </div>
        </div>

        <USeparator />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p class="text-sm text-gray-400">User ID</p>
            <p class="font-mono">{{ user.id }}</p>
          </div>
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p class="text-sm text-gray-400">Role</p>
            <p class="capitalize">{{ user.role || 'User' }}</p>
          </div>
        </div>
      </div>
    </UCard>
    
    <div v-else class="text-center py-20">
      <p class="text-gray-500 mb-4">You are not logged in.</p>
      <UButton to="/auth" color="primary">Go to Login</UButton>
    </div>
  </UContainer>
</template>
