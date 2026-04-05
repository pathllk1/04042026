<script setup lang="ts">
import { useAppToast } from '~/composables/useAppToast'

const { toasts } = useAppToast()
</script>

<template>
  <div class="fixed top-5 right-5 flex flex-col gap-2 z-[9999]">
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['px-4 py-2 rounded shadow-lg text-white min-w-[200px] pointer-events-auto', 
                 toast.type === 'success' ? 'bg-green-600' :
                 toast.type === 'error' ? 'bg-red-600' :
                 'bg-blue-600']"
      >
        {{ toast.text }}
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>