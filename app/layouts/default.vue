<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import GlobalSettingsPopup from '~/components/tools/GlobalSettingsPopup.vue'
import CalculatorModal from '~/components/tools/CalculatorModal.vue'
import TranslatorModal from '~/components/tools/TranslatorModal.vue'
import WeatherModal from '~/components/tools/WeatherModal.vue'
import PdfToolsModal from '~/components/tools/PdfToolsModal.vue'
import TaskManagerModal from '~/components/tools/TaskManagerModal.vue'
import TodoListModal from '~/components/tools/TodoListModal.vue'
import TextToImageModal from '~/components/tools/TextToImageModal.vue'
import NotesModal from '~/components/tools/NotesModal.vue'
import NewsModal from '~/components/tools/NewsModal.vue'

const isMobileMenuOpen = ref(false)
const isSidebarCollapsed = ref(true)
const isWagesDropdownOpen = ref(false)
const showSettingsModal = ref(false)

// Tool modals state
const showCalculatorModal = ref(false)
const showTranslatorModal = ref(false)
const showWeatherModal = ref(false)
const showPdfToolsModal = ref(false)
const showTaskManagerModal = ref(false)
const showTodoListModal = ref(false)
const showTextToImageModal = ref(false)
const showNotesModal = ref(false)
const showNewsModal = ref(false)
const currentNote = ref(undefined)

const { user, isLoggedIn, logout } = useAuth()
const route = useRoute()

const handleNotesSubmit = async (data) => {
  // Refresh notes list after submission
  showNotesModal.value = false
  currentNote.value = undefined
  // Trigger a refresh event for NotesTab to fetch updated notes
  window.dispatchEvent(new CustomEvent('notes-updated'))
}

const navigation = [
  { label: 'Home', to: '/', icon: 'i-heroicons-home', iconClass: 'text-blue-500' }
]

const documentsMenu = [
  { label: 'Documents', to: '/documents', icon: 'i-lucide-file-text', iconClass: 'text-orange-500', description: 'Manage your important documents' }
]

const wagesMenuItems = [
  { label: 'Master Roll', to: '/wages/master_roll', icon: 'i-lucide-users', iconClass: 'text-emerald-500', description: 'Manage employee database and master roll' },
  { label: 'Dashboard', to: '/wages/dashboard', icon: 'i-lucide-layout-dashboard', iconClass: 'text-cyan-500', description: 'Overview of wages and statistics' },
  { label: 'Wages Management', to: '/wages', icon: 'i-lucide-hand-coins', iconClass: 'text-emerald-600', description: 'Process and manage monthly wages' },
  { label: 'Edit Wages', to: '/wages/edit', icon: 'i-lucide-file-edit', iconClass: 'text-amber-500', description: 'Modify existing wage records' },
  { label: 'Employee Advances', to: '/wages/employee-advances', icon: 'i-lucide-wallet', iconClass: 'text-teal-500', description: 'Manage advances and recoveries' },
  { label: 'Reports', to: '/wages/report', icon: 'i-lucide-file-text', iconClass: 'text-rose-500', description: 'Generate wage and payment reports' }
]

// Event listeners for tool modals
const handleKeyDown = (event) => {
  // Ctrl + . (Control + Dot) to open Global Settings
  if (event.ctrlKey && event.key === '.') {
    event.preventDefault()
    showSettingsModal.value = !showSettingsModal.value
  }
}

const openCalculator = () => { showCalculatorModal.value = true }
const openTranslator = () => { showTranslatorModal.value = true }
const openWeather = () => { showWeatherModal.value = true }
const openPdfTools = () => { showPdfToolsModal.value = true }
const openTaskManager = () => { showTaskManagerModal.value = true }
const openTodoList = () => { showTodoListModal.value = true }
const openTextToImage = () => { showTextToImageModal.value = true }
const openNews = () => { showNewsModal.value = true }
const openNotes = (event) => {
  currentNote.value = event.detail?.note
  showNotesModal.value = true
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('open-calculator', openCalculator)
  window.addEventListener('open-translator', openTranslator)
  window.addEventListener('open-weather', openWeather)
  window.addEventListener('open-pdf-tools', openPdfTools)
  window.addEventListener('open-task-manager', openTaskManager)
  window.addEventListener('open-todo-list', openTodoList)
  window.addEventListener('open-text-to-image', openTextToImage)
  window.addEventListener('open-news', openNews)
  window.addEventListener('open-notes', openNotes)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('open-calculator', openCalculator)
  window.removeEventListener('open-translator', openTranslator)
  window.removeEventListener('open-weather', openWeather)
  window.removeEventListener('open-pdf-tools', openPdfTools)
  window.removeEventListener('open-task-manager', openTaskManager)
  window.removeEventListener('open-todo-list', openTodoList)
  window.removeEventListener('open-text-to-image', openTextToImage)
  window.removeEventListener('open-news', openNews)
  window.removeEventListener('open-notes', openNotes)
})
</script>

<template>
  <UApp class="min-h-screen flex flex-col relative">
    <!-- HEADER -->
    <UHeader 
      class="h-16 sticky top-0 z-50 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur"
    >
      <template #left>
        <UButton
          icon="i-heroicons-bars-3"
          color="neutral"
          variant="ghost"
          class="mr-2 md:hidden"
          @click="isMobileMenuOpen = true"
        />

        <NuxtLink to="/" class="flex items-center gap-2">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>

        <div class="hidden md:flex items-center gap-4 ml-6">
          <TemplateMenu />
          <nav class="flex items-center space-x-4">
            <NuxtLink 
              v-for="item in navigation" 
              :key="item.to"
              :to="item.to" 
              class="text-sm font-medium hover:text-primary transition-colors"
            >
              {{ item.label }}
            </NuxtLink>
            <UDropdownMenu
              v-if="isLoggedIn"
              v-slot="{ open }"
              :modal="false"
              :items="wagesMenuItems.map(item => ({
                label: item.label,
                to: item.to,
                icon: item.icon,
                description: item.description
              }))"
              :content="{ align: 'start' }"
              :ui="{ content: 'min-w-fit' }"
              size="xs"
            >
              <UButton
                label="Wages"
                variant="subtle"
                trailing-icon="i-lucide-chevron-down"
                size="xs"
                class="-mb-[6px] font-semibold rounded-full truncate"
                :class="[open && 'bg-primary/15']"
                :ui="{
                  trailingIcon: ['transition-transform duration-200', open ? 'rotate-180' : undefined].filter(Boolean).join(' ')
                }"
              />
            </UDropdownMenu>
            <NuxtLink 
              v-if="isLoggedIn"
              to="/documents" 
              class="text-sm font-medium hover:text-primary transition-colors"
            >
              Documents
            </NuxtLink>
          </nav>
        </div>
      </template>

      <template #right>
        <UColorModeButton />
        
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          size="sm"
          title="Settings"
          @click="showSettingsModal = true"
        />
        
        <template v-if="isLoggedIn && user">
          <UDropdownMenu
            :items="[
              [
                { label: user.fullname, slot: 'account', disabled: true },
                { label: 'Profile', to: '/profile', icon: 'i-lucide-user' }
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

        <UButton
          to="https://github.com/nuxt-ui-templates/starter"
          target="_blank"
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UHeader>

    <!-- MAIN BODY -->
    <div class="flex flex-1 relative">
      <!-- DESKTOP SIDEBAR -->
      <aside
        :class="[
          'hidden md:flex flex-col fixed top-16 left-0 h-[calc(100vh-4rem-3rem)] border-r bg-white/50 dark:bg-gray-900/50 backdrop-blur transition-all duration-300 z-40',
          isSidebarCollapsed ? 'w-16' : 'w-64'
        ]"
      >
        <div class="flex-1 overflow-y-auto p-3">
          <nav class="flex flex-col space-y-1">
            <UTooltip 
              v-for="item in navigation" 
              :key="item.to"
              :text="item.label"
              :side="isSidebarCollapsed ? 'right' : undefined"
            >
              <NuxtLink 
                :to="item.to" 
                class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                active-class="bg-gray-100 dark:bg-gray-800 text-primary"
              >
                <UIcon :name="item.icon" :class="['text-xl shrink-0', item.iconClass]" />
                <span v-if="!isSidebarCollapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              </NuxtLink>
            </UTooltip>
            
            <!-- Wages Dropdown Section -->
            <template v-if="isLoggedIn">
              <UTooltip 
                text="Wages"
                :side="isSidebarCollapsed ? 'right' : undefined"
              >
                <button
                  @click="isWagesDropdownOpen = !isWagesDropdownOpen"
                  class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left group"
                  :class="[isWagesDropdownOpen && 'bg-gray-100 dark:bg-gray-800']"
                >
                  <UIcon name="i-lucide-banknote" class="text-xl shrink-0 text-emerald-500" />
                  <span v-if="!isSidebarCollapsed" class="text-sm font-medium truncate flex-1">Wages</span>
                  <UIcon 
                    v-if="!isSidebarCollapsed"
                    name="i-lucide-chevron-down" 
                    class="text-sm shrink-0 transition-transform"
                    :class="[isWagesDropdownOpen && 'rotate-180']"
                  />
                </button>
              </UTooltip>
              
              <!-- Wages Items -->
              <template v-if="isWagesDropdownOpen">
                <UTooltip 
                  v-for="item in wagesMenuItems" 
                  :key="item.to"
                  :text="item.label"
                  :side="isSidebarCollapsed ? 'right' : undefined"
                >
                  <NuxtLink 
                    :to="item.to" 
                    class="flex items-center gap-3 px-6 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group text-sm"
                    active-class="bg-gray-100 dark:bg-gray-800 text-primary font-medium"
                  >
                    <UIcon :name="item.icon" :class="['text-lg shrink-0', item.iconClass]" />
                    <span v-if="!isSidebarCollapsed" class="font-medium truncate">{{ item.label }}</span>
                  </NuxtLink>
                </UTooltip>
              </template>
            </template>

            <!-- Documents Link -->
            <template v-if="isLoggedIn">
              <UTooltip 
                text="Documents"
                :side="isSidebarCollapsed ? 'right' : undefined"
              >
                <NuxtLink 
                  to="/documents" 
                  class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  active-class="bg-gray-100 dark:bg-gray-800 text-primary"
                >
                  <UIcon name="i-lucide-file-text" class="text-xl shrink-0 text-orange-500" />
                  <span v-if="!isSidebarCollapsed" class="text-sm font-medium truncate">Documents</span>
                </NuxtLink>
              </UTooltip>
            </template>
          </nav>
        </div>

        <!-- SETTINGS & TOOLS -->
        <div class="px-3 pb-2">
          <UTooltip 
            text="Settings & Tools"
            :side="isSidebarCollapsed ? 'right' : undefined"
          >
            <button
              @click="showSettingsModal = true"
              class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left group"
            >
              <UIcon name="i-lucide-settings" class="text-xl shrink-0 text-indigo-500 group-hover:rotate-90 transition-transform duration-500" />
              <span v-if="!isSidebarCollapsed" class="text-sm font-medium truncate">Settings & Tools</span>
            </button>
          </UTooltip>
        </div>

        <!-- COLLAPSE TOGGLE -->
        <div class="p-3 border-t">
          <UButton
            :icon="isSidebarCollapsed ? 'i-heroicons-chevron-double-right' : 'i-heroicons-chevron-double-left'"
            color="neutral"
            variant="ghost"
            block
            @click="isSidebarCollapsed = !isSidebarCollapsed"
          />
        </div>
      </aside>

      <!-- CONTENT AREA -->
      <main
        :class="[
          'flex-1 transition-all duration-300 min-w-0 pb-12',
          isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        ]"
      >
        <UMain class="p-4 md:p-8">
          <slot />
        </UMain>
      </main>
    </div>

    <!-- MOBILE SIDEBAR / MENU -->
    <USlideover v-model:open="isMobileMenuOpen" title="Menu" side="left">
      <template #body>
        <div class="flex flex-col space-y-4 p-4">
          <div class="flex items-center gap-2 pb-4 border-b">
            <AppLogo class="w-auto h-6" />
            <span class="font-bold">Starter</span>
          </div>
          
          <nav class="flex flex-col space-y-2">
            <NuxtLink 
              v-for="item in navigation" 
              :key="item.to"
              :to="item.to" 
              class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              active-class="bg-gray-100 dark:bg-gray-800 text-primary font-semibold"
              @click="isMobileMenuOpen = false"
            >
              <UIcon :name="item.icon" :class="['text-xl', item.iconClass]" />
              <span>{{ item.label }}</span>
            </NuxtLink>
            
            <!-- Wages Section -->
            <template v-if="isLoggedIn">
              <div class="pt-2 mt-2 border-t">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-2 uppercase">Wages</p>
              </div>
              <NuxtLink 
                v-for="item in wagesMenuItems" 
                :key="item.to"
                :to="item.to" 
                class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                active-class="bg-gray-100 dark:bg-gray-800 text-primary font-semibold"
                @click="isMobileMenuOpen = false"
              >
                <UIcon :name="item.icon" :class="['text-xl', item.iconClass]" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </template>

            <!-- Documents Link -->
            <template v-if="isLoggedIn">
              <div class="pt-2 mt-2 border-t">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-2 uppercase">Other</p>
              </div>
              <NuxtLink 
                to="/documents" 
                class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                active-class="bg-gray-100 dark:bg-gray-800 text-primary font-semibold"
                @click="isMobileMenuOpen = false"
              >
                <UIcon name="i-lucide-file-text" class="text-xl text-orange-500" />
                <span>Documents</span>
              </NuxtLink>
            </template>

            <!-- Settings & Tools -->
            <div class="pt-2 mt-2 border-t">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-2 uppercase">System</p>
            </div>
            <button 
              class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left"
              @click="showSettingsModal = true; isMobileMenuOpen = false"
            >
              <UIcon name="i-lucide-settings" class="text-xl text-indigo-500" />
              <span>Settings & Tools</span>
            </button>
          </nav>

          <div class="pt-4 border-t">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Templates</p>
            <TemplateMenu />
          </div>
        </div>
      </template>
    </USlideover>

    <!-- FIXED FOOTER -->
    <footer 
      class="fixed bottom-0 left-0 right-0 h-12 border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur z-50 flex items-center px-4 md:px-6"
    >
      <div class="flex flex-1 items-center justify-between">
        <div class="flex items-center gap-4">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            © {{ new Date().getFullYear() }} Nuxt Starter
          </p>
          <USeparator orientation="vertical" class="h-4" />
          <div class="hidden sm:flex items-center gap-3">
            <NuxtLink to="/" class="text-xs hover:text-primary">Privacy</NuxtLink>
            <NuxtLink to="/" class="text-xs hover:text-primary">Terms</NuxtLink>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            to="https://github.com/nuxt-ui-templates/starter"
            target="_blank"
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </div>
      </div>
    </footer>

    <!-- Global Settings Modal -->
    <GlobalSettingsPopup 
      v-model:isOpen="showSettingsModal"
    />

    <!-- Tool Modals -->
    <CalculatorModal 
      :isOpen="showCalculatorModal"
      @close="showCalculatorModal = false"
    />

    <TranslatorModal 
      :isOpen="showTranslatorModal"
      @close="showTranslatorModal = false"
    />

    <WeatherModal 
      :isOpen="showWeatherModal"
      @close="showWeatherModal = false"
    />

    <PdfToolsModal 
      :isOpen="showPdfToolsModal"
      @close="showPdfToolsModal = false"
    />

    <TaskManagerModal 
      :isOpen="showTaskManagerModal"
      @close="showTaskManagerModal = false"
    />

    <TodoListModal 
      :isOpen="showTodoListModal"
      @close="showTodoListModal = false"
    />

    <TextToImageModal 
      :isOpen="showTextToImageModal"
      @close="showTextToImageModal = false"
    />

    <NewsModal 
      :isOpen="showNewsModal"
      @close="showNewsModal = false"
    />

    <NotesModal 
      :isOpen="showNotesModal"
      :note="currentNote"
      :isEditing="!!currentNote"
      @close="showNotesModal = false"
      @submit="handleNotesSubmit"
    />
  </UApp>
</template>
