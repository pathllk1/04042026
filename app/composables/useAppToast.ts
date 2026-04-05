import { ref } from 'vue'

export interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

const toasts = ref<ToastMessage[]>([])

export const useAppToast = () => {
  const addToast = (
    text: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 3000
  ) => {
    const id = Date.now()
    toasts.value.push({ id, text, type })
    setTimeout(() => removeToast(id), duration)
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    addToast,
    removeToast
  }
}
