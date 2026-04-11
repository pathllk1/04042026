<template>
  <UModal
    :open="isOpen"
    @update:open="$emit('close')"
    :ui="{
      content: 'max-w-4xl max-h-[90vh] overflow-hidden',
      overlay: { base: 'z-[99999]' },
      wrapper: { base: 'z-[99999]' }
    }"
  >
    <template #content>
      <div class="bg-white rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col relative">
        <!-- Close Button -->
        <button @click="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors duration-200 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Header -->
        <div class="p-6 pb-0">
          <h2 class="text-2xl font-bold text-gray-900 mb-6">{{ isEditing ? 'Edit Note' : 'New Note' }}</h2>
        </div>

        <!-- Content -->
        <div class="flex-grow overflow-auto p-6 pt-0">
          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Title -->
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                id="title"
                v-model="formData.title"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter note title"
              />
            </div>

            <!-- Content -->
            <div>
              <label for="content" class="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <CustomTextEditor
                id="custom-editor"
                v-model="formData.content"
                height="300px"
                placeholder="Enter your note content here..."
              />
            </div>

            <!-- Footer-like actions inside form -->
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                @click="closeModal"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {{ isSubmitting ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNotes } from '~/composables/business/useNotes';
import CustomTextEditor from './CustomTextEditor.vue';

interface Note {
  id?: string;
  title: string;
  content: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const props = defineProps<{
  isOpen: boolean;
  note?: Note;
  isEditing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: { title: string; content: string }): void;
}>();

const { createNote, updateNote } = useNotes();
const isSubmitting = ref(false);
const formData = ref({
  title: '',
  content: ''
});

// Watch for note changes and update form data
watch(() => props.note, (newNote) => {
  if (newNote) {
    formData.value = {
      title: newNote.title || '',
      content: newNote.content || ''
    };
  } else {
    formData.value = {
      title: '',
      content: ''
    };
  }
}, { immediate: true });

const closeModal = () => {
  formData.value = { title: '', content: '' };
  emit('close');
};

const handleSubmit = async () => {
  try {
    isSubmitting.value = true;

    if (!formData.value.title || !formData.value.title.trim()) {
      alert('Please enter a title for your note');
      return;
    }

    if (!formData.value.content || !formData.value.content.trim()) {
      alert('Please enter some content for your note');
      return;
    }

    if (props.isEditing && props.note) {
      await updateNote(props.note.id!, {
        title: formData.value.title,
        content: formData.value.content
      });
    } else {
      await createNote({
        title: formData.value.title,
        content: formData.value.content
      });
    }

    emit('submit', {
      title: formData.value.title,
      content: formData.value.content
    });
    closeModal();
  } catch (error) {
    console.error('Error submitting note:', error);
    alert('Error saving note. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
