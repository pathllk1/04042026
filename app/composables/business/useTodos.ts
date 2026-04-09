import { ref } from 'vue';
import type { Todo, CreateTodoDto, UpdateTodoDto } from '~/server/models/Todo';
import useToast from '../ui/useToast';
import useApiWithAuth from '../auth/useApiWithAuth';

export const useTodos = () => {
  const todos = ref<Todo[]>([]);
  const isLoading = ref(false);
  const toast = useToast();
  const api = useApiWithAuth();

  // Fetch all todos
  const fetchTodos = async () => {
    try {
      isLoading.value = true;
      const response = await api.get('/api/todos');
      todos.value = response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch todos');
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // Create a new todo
  const createTodo = async (todoData: CreateTodoDto) => {
    try {
      if (!todoData.content) {
        toast.error('Todo content is required');
        return null;
      }

      const data = {
        content: todoData.content,
        category: todoData.category || '',
        completed: todoData.completed || false
      };

      // Make the API call
      const response = await api.post('/api/todos', data);

      if (response && response.id) {
        // Add the new todo to the array
        todos.value.push(response);
        toast.success('Todo created successfully');
        return response;
      } else {
        toast.error('Failed to create todo: Server returned invalid data');
        return null;
      }
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to create todo');
      throw error;
    }
  };

  // Update a todo
  const updateTodoById = async (id: string, todoData: UpdateTodoDto) => {
    try {
      const response = await api.put(`/api/todos/${id}`, todoData);
      
      // Update the todo in the array
      const index = todos.value.findIndex(todo => todo.id === id);
      if (index !== -1) {
        todos.value[index] = { ...todos.value[index], ...response };
      }
      
      toast.success('Todo updated successfully');
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to update todo');
      throw error;
    }
  };

  // Delete a todo
  const deleteTodoById = async (id: string) => {
    try {
      await api.delete(`/api/todos/${id}`);
      todos.value = todos.value.filter(todo => todo.id !== id);
      toast.success('Todo deleted successfully');
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to delete todo');
      throw error;
    }
  };

  // Toggle todo completion
  const toggleTodoCompletionById = async (id: string, completed: boolean) => {
    try {
      const response = await api.put(`/api/todos/${id}`, { completed });
      
      // Update the todo in the array
      const index = todos.value.findIndex(todo => todo.id === id);
      if (index !== -1) {
        todos.value[index] = { ...todos.value[index], ...response };
      }
      
      toast.success(`Todo marked as ${completed ? 'completed' : 'incomplete'}`);
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to update todo status');
      throw error;
    }
  };

  // Get a single todo
  const getTodoById = async (id: string) => {
    try {
      const response = await api.get(`/api/todos/${id}`);
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch todo');
      throw error;
    }
  };

  return {
    todos,
    isLoading,
    fetchTodos,
    createTodo,
    updateTodoById,
    deleteTodoById,
    toggleTodoCompletionById,
    getTodoById
  };
};
