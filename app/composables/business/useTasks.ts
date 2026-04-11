import { ref } from 'vue';
import useToast from '../ui/useToast';
import useApiWithAuth from '../auth/useApiWithAuth';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
}

export const useTasks = () => {
  const tasks = ref<Task[]>([]);
  const isLoading = ref(false);
  const toast = useToast();
  const api = useApiWithAuth();

  // Fetch all tasks
  const fetchTasks = async () => {
    try {
      isLoading.value = true;
      const response = await api.get('/api/tasks');
      tasks.value = response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch tasks');
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // Create a new task
  const createTask = async (taskData: CreateTaskDto) => {
    try {
      if (!taskData.title) {
        toast.error('Task title is required');
        return null;
      }

      const data = {
        title: taskData.title,
        description: taskData.description || '',
        dueDate: taskData.dueDate || null,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending'
      };

      // Make the API call
      const response = await api.post('/api/tasks', data);

      if (response && response.id) {
        // Add the new task to the array
        tasks.value.push(response);
        toast.success('Task created successfully');
        return response;
      } else {
        toast.error('Failed to create task: Server returned invalid data');
        return null;
      }
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to create task');
      throw error;
    }
  };

  // Update a task
  const updateTaskById = async (id: string, taskData: UpdateTaskDto) => {
    try {
      const response = await api.put(`/api/tasks/${id}`, taskData);
      
      // Update the task in the array
      const index = tasks.value.findIndex(task => task.id === id);
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], ...response };
      }
      
      toast.success('Task updated successfully');
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to update task');
      throw error;
    }
  };

  // Delete a task
  const deleteTaskById = async (id: string) => {
    try {
      await api.delete(`/api/tasks/${id}`);
      tasks.value = tasks.value.filter(task => task.id !== id);
      toast.success('Task deleted successfully');
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to delete task');
      throw error;
    }
  };

  // Toggle task status
  const toggleTaskStatusById = async (id: string, newStatus: 'pending' | 'completed') => {
    try {
      const response = await api.put(`/api/tasks/${id}`, { status: newStatus });
      
      // Update the task in the array
      const index = tasks.value.findIndex(task => task.id === id);
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], ...response };
      }
      
      toast.success(`Task marked as ${newStatus}`);
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to update task status');
      throw error;
    }
  };

  // Get a single task
  const getTaskById = async (id: string) => {
    try {
      const response = await api.get(`/api/tasks/${id}`);
      return response;
    } catch (error: any) {
      toast.error(error.data?.message || 'Failed to fetch task');
      throw error;
    }
  };

  return {
    tasks,
    isLoading,
    fetchTasks,
    createTask,
    updateTaskById,
    deleteTaskById,
    toggleTaskStatusById,
    getTaskById
  };
};
