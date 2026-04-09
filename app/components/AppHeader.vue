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
        label: 'Wages',
        icon: 'i-lucide-banknote',
        children: [
          {
            label: 'Master Roll',
            to: '/wages/master_roll',
            icon: 'i-lucide-users',
            description: 'Manage employee database and master roll',
            active: route.path === '/wages/master_roll'
          },
          {
            label: 'Dashboard',
            to: '/wages/dashboard',
            icon: 'i-lucide-layout-dashboard',
            description: 'Overview of wages and statistics',
            active: route.path === '/wages/dashboard'
          },
          {
            label: 'Wages Management',
            to: '/wages',
            icon: 'i-lucide-hand-coins',
            description: 'Process and manage monthly wages',
            active: route.path === '/wages'
          },
          {
            label: 'Edit Wages',
            to: '/wages/edit',
            icon: 'i-lucide-file-edit',
            description: 'Modify existing wage records',
            active: route.path === '/wages/edit'
          },
          {
            label: 'Employee Advances',
            to: '/wages/employee-advances',
            icon: 'i-lucide-wallet',
            description: 'Manage advances and recoveries',
            active: route.path === '/wages/employee-advances'
          },
          {
            label: 'Reports',
            to: '/wages/report',
            icon: 'i-lucide-file-text',
            description: 'Generate wage and payment reports',
            active: route.path === '/wages/report'
          }
        ]
      }
    ]
  }

  return [
    ...commonItems,
    {
      label: 'Login',
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
