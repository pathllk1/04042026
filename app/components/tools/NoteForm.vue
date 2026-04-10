<template>
  <div class="bg-white rounded-lg w-full md:w-11/12 lg:w-4/5 mx-auto shadow-xl overflow-hidden border border-gray-200 flex flex-col modal-container">
    <!-- Colorful Header with X close icon -->
    <div class="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-3 sm:p-4 flex justify-between items-center">
      <h2 class="text-xl sm:text-2xl font-bold text-white">{{ isEditing ? 'Edit Note' : 'New Note' }}</h2>
      <button
        @click="handleCancel"
        class="text-white hover:text-gray-200 transition-colors duration-300 focus:outline-none"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <form @submit.prevent="handleSubmit" class="flex flex-col flex-grow overflow-hidden">
      <div class="p-4 sm:p-6 flex-grow overflow-hidden flex flex-col">
        <div class="mb-4 flex-shrink-0">
          <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            id="title"
            v-model="formData.title"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter note title"
          />
        </div>
        <div class="flex-grow flex flex-col min-h-0 mb-2">
          <label for="content" class="block text-sm font-medium text-gray-700 mb-1 flex-shrink-0">Content</label>
          <div class="flex flex-col gap-2 flex-grow">
            <!-- Custom Text Editor with Formatting Toolbar -->
            <div class="editor-container flex-grow overflow-hidden">
              <CustomTextEditor
                id="custom-editor"
                ref="customEditorRef"
                v-model="formData.content"
                :height="editorHeight"
                placeholder="Enter your note content here..."
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Colorful Footer -->
      <div class="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-3 text-white text-sm flex-shrink-0">
        <!-- Character Count -->
        <div class="flex justify-between items-center mb-3">
          <div class="text-white text-sm">
            <span class="font-medium">Characters:</span> {{ characterCount }}
          </div>
          <div class="text-white text-sm">
            <span class="font-medium">Words:</span> {{ wordCount }}
          </div>
        </div>

        <!-- Form Footer with Buttons -->
        <div class="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              @click="handleCancel"
              class="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition duration-300 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md hover:from-blue-600 hover:to-purple-700 transition duration-300 shadow-sm"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Note } from '~/server/models/Note';

const props = defineProps<{
  note?: Note;
  isEditing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', data: { title: string; content: string }): void;
  (e: 'cancel'): void;
}>();

const isSubmitting = ref(false);
const formData = ref({
  title: props.note?.title || '',
  content: props.note?.content || ''
});

// Character and word count computations
const characterCount = computed(() => {
  // Get the raw content
  const content = formData.value.content || '';

  // Check if we're in the browser environment
  if (typeof document === 'undefined') {
    return content.length; // Fallback for SSR
  }

  // For HTML content, we need to strip HTML tags to get accurate character count
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const textContent = tempDiv.textContent || '';

  return textContent.length;
});

const wordCount = computed(() => {
  // Get the raw content
  const content = formData.value.content || '';

  // Check if we're in the browser environment
  if (typeof document === 'undefined') {
    // Simple fallback for SSR
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // For HTML content, we need to strip HTML tags to get accurate word count
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const textContent = tempDiv.textContent || '';

  // Split by whitespace and filter out empty strings
  const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
});

// Dynamic editor height calculation
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0);
const editorHeight = computed(() => {
  const isMobile = windowHeight.value < 640; // sm breakpoint

  // On mobile, use a fixed smaller height
  if (isMobile) {
    return '200px';
  }

  // On larger screens, use a fixed height that's a percentage of viewport height
  // This ensures there's enough space for the scrollbar to be visible
  return `${Math.min(500, windowHeight.value * 0.5)}px`;
});

// Resize handler
const handleResize = () => {
  windowHeight.value = window.innerHeight;
};

// Add resize listener
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
});

// Remove resize listener on cleanup
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
  }
});

const handleCancel = () => {
  // Emit cancel event
  emit('cancel');
};

const handleSubmit = async () => {
  try {
    isSubmitting.value = true;

    // Make sure we have title and content
    if (!formData.value.title || !formData.value.title.trim()) {
      alert('Please enter a title for your note');
      isSubmitting.value = false;
      return;
    }

    if (!formData.value.content || !formData.value.content.trim()) {
      alert('Please enter some content for your note');
      isSubmitting.value = false;
      return;
    }

    // Submit the data without client-side sanitization
    // The server will handle sanitization
    emit('submit', {
      title: formData.value.title,
      content: formData.value.content
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* Modal container */
.modal-container {
  max-height: 90vh;
  height: calc(100vh - 2rem);
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .modal-container {
    max-height: 95vh;
    height: calc(100vh - 1rem);
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
}

/* Editor container needs to have a defined height */
.editor-container {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-grow: 1;
  overflow: hidden; /* Prevent overflow from the editor */
}

/* Flex form needs proper height handling */
form {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Ensure the editor takes available space but allows scrolling */
.editor-container :deep(.editor-content) {
  overflow-y: scroll !important;
  max-height: 100% !important;
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}
</style>