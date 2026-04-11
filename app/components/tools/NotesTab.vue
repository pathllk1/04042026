<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 sm:gap-0">
      <h3 class="text-lg font-medium text-gray-900">My Notes</h3>
      <button @click="openNewNoteModal"
              class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow transition duration-300 w-full sm:w-auto">
        <span class="flex items-center justify-center">
          <Icon name="heroicons:plus" class="w-5 h-5 mr-2" />
          New Note
        </span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>

    <!-- Notes Grid -->
    <div v-else-if="notes.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
      <div v-for="note in notes" :key="note.id"
           class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200">
        <div class="p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-semibold text-gray-800 break-words">{{ note.title }}</h3>
            <div class="flex space-x-2 ml-2 flex-shrink-0">
              <button @click="editNote(note)"
                      class="text-blue-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50">
                <Icon name="heroicons:pencil-square" class="w-5 h-5" />
              </button>
              <button @click="confirmDelete(note)"
                      class="text-red-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50">
                <Icon name="heroicons:trash" class="w-5 h-5" />
              </button>
            </div>
          </div>
          <NoteContent :content="note.content" class="text-gray-600 whitespace-pre-wrap line-clamp-3 break-words" />
          <div class="mt-4 flex justify-between items-center flex-wrap gap-2">
            <div class="text-sm text-gray-500">
              Last updated: {{ formatDate(note.updatedAt || note.createdAt) }}
            </div>
            <button v-if="isContentTruncated(note.content)"
                    @click="editNote(note)"
                    class="text-sm text-blue-500 hover:text-blue-600">
              Read more
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <div class="text-gray-500 mb-4">No notes yet</div>
      <button @click="openNewNoteModal"
              class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow transition duration-300">
        Create your first note
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNotes } from '~/composables/business/useNotes';
import type { Note } from '~/server/models/Note';
import NoteContent from './NoteContent.vue';

// State
const { notes, isLoading, fetchNotes, createNote, updateNote, deleteNote } = useNotes();

// Fetch notes on component mount
onMounted(async () => {
  try {
    await fetchNotes();
  } catch (error) {
    console.error('Failed to initial fetch notes:', error);
  }
  
  // Listen for notes update event from layout
  window.addEventListener('notes-updated', async () => {
    try {
      await fetchNotes();
    } catch (error) {
      console.error('Failed to fetch notes on update:', error);
    }
  });
});

// Actions
const editNote = (note: Note) => {
  window.dispatchEvent(new CustomEvent('open-notes', { detail: { note } }));
};

const openNewNoteModal = () => {
  window.dispatchEvent(new CustomEvent('open-notes', { detail: { note: undefined } }));
};

const handleSubmit = async (data: { title: string; content: string }) => {
  try {
    // This will be called from the layout's NotesModal
    // The modal will handle the submission
  } catch (error) {
    console.error('Error in notes submission:', error);
  }
};

const confirmDelete = async (note: Note) => {
  if (!confirm('Are you sure you want to delete this note?')) return;

  try {
    await deleteNote(note.id!);
  } catch (error) {
    console.error('Error deleting note:', error);
  }
};

// Utilities
const isContentTruncated = (content: string) => {
  return content.split('\n').length > 3 || content.length > 200;
};

const formatDate = (ts) => {
  if (!ts) return 'Unknown date';

  try {
    const date = new Date(ts);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date error';
  }
};
</script>

<style scoped>
.modal-wrapper {
  z-index: 300; /* Higher than the settings modal */
}
</style>
