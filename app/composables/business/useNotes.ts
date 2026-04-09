import { ref } from 'vue';
import type { Note, CreateNoteDto, UpdateNoteDto } from '~/server/models/Note';
import useToast from '../ui/useToast';
import useApiWithAuth from '../auth/useApiWithAuth';

export const useNotes = () => {
  const notes = ref<Note[]>([]);
  const isLoading = ref(false);
  const toast = useToast();
  const api = useApiWithAuth();

  // Fetch all notes
  const fetchNotes = async () => {
    try {
      isLoading.value = true;
      const response = await api.get('/api/notes');
      notes.value = response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch notes');
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // Create a new note
  const createNote = async (noteData: CreateNoteDto) => {
    try {
      if (!noteData.title || !noteData.content) {
        toast.error('Note title and content are required');
        return null;
      }

      const data = {
        title: noteData.title,
        content: noteData.content
      };

      // Make the API call
      const response = await api.post('/api/notes', data);

      if (response && response.id) {
        // Add the new note to the array
        notes.value.push(response);
        toast.success('Note created successfully');
        return response;
      } else {
        toast.error('Failed to create note: Server returned invalid data');
        return null;
      }
    } catch (error: any) {
      // User-friendly error message
      let errorMessage = 'Failed to create note';
      if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      return null;
    }
  };

  // Update a note
  const updateNote = async (id: string, noteData: UpdateNoteDto) => {
    try {
      await api.put(`/api/notes/${id}`, noteData);
      const index = notes.value.findIndex(note => note.id === id);
      if (index !== -1) {
        notes.value[index] = { ...notes.value[index], ...noteData };
      }
      toast.success('Note updated successfully');
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to update note');
      throw error;
    }
  };

  // Delete a note
  const deleteNote = async (id: string) => {
    try {
      await api.delete(`/api/notes/${id}`);
      notes.value = notes.value.filter(note => note.id !== id);
      toast.success('Note deleted successfully');
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to delete note');
      throw error;
    }
  };

  // Get a single note
  const getNote = async (id: string) => {
    try {
      const response = await api.get(`/api/notes/${id}`);
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch note');
      throw error;
    }
  };

  return {
    notes,
    isLoading,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    getNote
  };
};