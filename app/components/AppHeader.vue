<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, isLoggedIn, logout } = useAuth()

const items = computed<NavigationMenuItem[]>(() => {
  const commonItems: NavigationMenuItem[] = [
    {
      label: 'Home',
      to: '/',
      active: route.path === '/'
    }
  ]

  if (isLoggedIn.value) {
    return [
      ...commonItems,
      {
        label: 'Master Roll',
        to: '/wages/master_roll',
        active: route.path === '/wages/master_roll'
      },
      {
        label: 'Profile',
        to: '/profile',
        active: route.path === '/profile'
      }
    ]
  }

  return [
    ...commonItems,
    {
      label: 'Auth',
      to: '/auth',
      active: route.path === '/auth'
    }
  ]
})
</script>

<template>
  <UHeader>
    <template #title>
      <Logo class="h-6 w-auto" />
    </template>

    <UNavigationMenu :items="items" />

    <template #right>
      <UColorModeButton />

      <template v-if="isLoggedIn && user">
        <UDropdownMenu
          :items="[
            [
              { label: user.fullname, slot: 'account', disabled: true },
              { label: 'Profile', to: '/profile', icon: 'i-lucide-user' },
              { label: 'Settings', icon: 'i-lucide-settings' }
            ],
            [
              { label: 'Logout', icon: 'i-lucide-log-out', color: 'error', onSelect: logout }
            ]
          ]"
        >
          <UAvatar
            :alt="user.fullname"
            size="sm"
            class="cursor-pointer"
          />
        </UDropdownMenu>
      </template>
      <template v-else>
        <UButton to="/auth" color="primary" variant="solid" size="sm">
          Login
        </UButton>
      </template>

      <UTooltip text="Open on GitHub" :kbds="['meta', 'G']">
        <UButton
          color="neutral"
          variant="ghost"
          to="https://github.com/nuxt/ui"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
        />
      </UTooltip>
    </template>
  </UHeader>
</template>
