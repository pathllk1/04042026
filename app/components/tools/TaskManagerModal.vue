<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[200] transition-opacity duration-300 ease-in-out">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex justify-between items-center">
        <h2 class="text-xl font-bold text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Task Manager
        </h2>
        <button @click="close" class="text-white hover:text-red-200 focus:outline-none transition-transform duration-300 hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-grow overflow-auto p-6">
        <!-- Task Form -->
        <div class="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-lg shadow-sm border border-emerald-100 task-form-container">
          <h3 class="text-lg font-semibold text-emerald-700 mb-4">Add New Task</h3>
          <form @submit.prevent="addTask" class="space-y-4">
            <div>
              <label for="taskTitle" class="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
              <input
                id="taskTitle"
                v-model="newTask.title"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter task title"
                ref="taskTitleInput"
              />
            </div>
            <div>
              <label for="taskDescription" class="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                id="taskDescription"
                v-model="newTask.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter task description"
              ></textarea>
            </div>
            <div class="flex flex-wrap gap-4">
              <div class="w-full sm:w-auto">
                <label for="taskDueDate" class="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                <input
                  id="taskDueDate"
                  v-model="newTask.dueDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div class="w-full sm:w-auto">
                <label for="taskPriority" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  id="taskPriority"
                  v-model="newTask.priority"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end">
              <button
                type="submit"
                class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-md hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-transform duration-300 hover:scale-105 shadow"
                :disabled="isSubmitting"
              >
                <span class="flex items-center">
                  <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {{ isSubmitting ? 'Adding...' : 'Add Task' }}
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Task Filters -->
        <div class="mb-6 flex flex-wrap gap-4 items-center">
          <div class="flex-grow">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search tasks..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <select
              v-model="filterStatus"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <select
              v-model="filterPriority"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <!-- Tasks List -->
        <div v-if="isLoading" class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>

        <div v-else-if="filteredTasks.length > 0" class="space-y-4">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            class="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden task-item"
            :class="{
              'border-emerald-200': task.status === 'completed',
              'border-gray-200': task.status === 'pending'
            }"
          >
            <div class="p-4">
              <div class="flex items-start justify-between">
                <div class="flex items-start flex-grow">
                  <div class="flex-shrink-0 mr-3">
                    <button
                      @click="toggleTaskStatus(task)"
                      class="w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-300"
                      :class="{
                        'bg-emerald-500 border-emerald-500': task.status === 'completed',
                        'border-gray-300 hover:border-emerald-500': task.status === 'pending'
                      }"
                    >
                      <svg v-if="task.status === 'completed'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                  <div class="flex-grow">
                    <h4 class="text-lg font-medium mb-1 transition-all duration-300" :class="{ 'line-through text-gray-500': task.status === 'completed' }">
                      {{ task.title }}
                    </h4>
                    <p v-if="task.description" class="text-gray-600 text-sm mb-2" :class="{ 'text-gray-400': task.status === 'completed' }">
                      {{ task.description }}
                    </p>
                    <div class="flex flex-wrap gap-2 text-xs">
                      <span
                        v-if="task.dueDate"
                        class="px-2 py-1 rounded-full flex items-center"
                        :class="{
                          'bg-red-100 text-red-800': isOverdue(task) && task.status !== 'completed',
                          'bg-gray-100 text-gray-800': !isOverdue(task) || task.status === 'completed'
                        }"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {{ formatDate(task.dueDate) }}
                      </span>
                      <span
                        class="px-2 py-1 rounded-full flex items-center"
                        :class="{
                          'bg-red-100 text-red-800': task.priority === 'high',
                          'bg-yellow-100 text-yellow-800': task.priority === 'medium',
                          'bg-blue-100 text-blue-800': task.priority === 'low'
                        }"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        {{ capitalizeFirstLetter(task.priority) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex space-x-2 ml-4">
                  <button
                    @click="editTask(task)"
                    class="text-blue-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors duration-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="confirmDeleteTask(task)"
                    class="text-red-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors duration-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div class="text-gray-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p class="text-lg font-medium">No tasks found</p>
            <p class="text-sm mt-1">
              {{ searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Add your first task to get started' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Edit Task Modal -->
      <div v-if="showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Edit Task</h3>
          <form @submit.prevent="updateTask" class="space-y-4">
            <div>
              <label for="editTaskTitle" class="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
              <input
                id="editTaskTitle"
                v-model="editingTask.title"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter task title"
                ref="editTaskTitleInput"
              />
            </div>
            <div>
              <label for="editTaskDescription" class="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                id="editTaskDescription"
                v-model="editingTask.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter task description"
              ></textarea>
            </div>
            <div class="flex flex-wrap gap-4">
              <div class="w-full sm:w-auto">
                <label for="editTaskDueDate" class="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                <input
                  id="editTaskDueDate"
                  v-model="editingTask.dueDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div class="w-full sm:w-auto">
                <label for="editTaskPriority" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  id="editTaskPriority"
                  v-model="editingTask.priority"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                @click="closeEditModal"
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-md hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors duration-300"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Task</h3>
          <p class="text-gray-600 mb-6">Are you sure you want to delete this task? This action cannot be undone.</p>
          <div class="flex justify-end space-x-3">
            <button
              @click="closeDeleteModal"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-300"
            >
              Cancel
            </button>
            <button
              @click="deleteTask"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-300"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useTasks } from '~/composables/business/useTasks';
import { useCookie } from '#app';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

// Check if user is authenticated
const token = useCookie('token');
const isAuthenticated = computed(() => !!token.value);

// Task state
const {
  tasks,
  isLoading,
  fetchTasks,
  createTask,
  updateTaskById,
  deleteTaskById,
  toggleTaskStatusById
} = useTasks();

// Form state
const newTask = ref({
  title: '',
  description: '',
  dueDate: '',
  priority: 'medium',
  status: 'pending'
});

const isSubmitting = ref(false);
const taskTitleInput = ref(null);
const editTaskTitleInput = ref(null);

// Filter state
const searchQuery = ref('');
const filterStatus = ref('all');
const filterPriority = ref('all');

// Modal state
const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingTask = ref(null);
const taskToDelete = ref(null);

// Fetch tasks on component mount
onMounted(async () => {
  if (props.isOpen) {
    await fetchTasks();
    nextTick(() => {
      if (taskTitleInput.value) {
        taskTitleInput.value.focus();
      }
    });
  }
});

// Watch for isOpen changes
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    await fetchTasks();
    nextTick(() => {
      if (taskTitleInput.value) {
        taskTitleInput.value.focus();
      }
    });
  }
});

// Computed properties
const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // Filter by search query
    const matchesSearch = searchQuery.value
      ? task.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : true;

    // Filter by status
    const matchesStatus = filterStatus.value === 'all'
      ? true
      : task.status === filterStatus.value;

    // Filter by priority
    const matchesPriority = filterPriority.value === 'all'
      ? true
      : task.priority === filterPriority.value;

    return matchesSearch && matchesStatus && matchesPriority;
  });
});

// Methods
const close = () => {
  emit('close');
};

// Redirect if not authenticated
watch(() => props.isOpen, (newVal) => {
  if (newVal && !isAuthenticated.value) {
    emit('close');
    // Optionally show a message or redirect to login
    alert('Please log in to access the Task Manager');
  }
});

const addTask = async () => {
  if (!newTask.value.title.trim()) return;

  try {
    isSubmitting.value = true;
    await createTask(newTask.value);

    // Reset form
    newTask.value = {
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      status: 'pending'
    };

    // Focus on title input
    nextTick(() => {
      if (taskTitleInput.value) {
        taskTitleInput.value.focus();
      }
    });
  } catch (error) {
    console.error('Error adding task:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const toggleTaskStatus = async (task) => {
  try {
    await toggleTaskStatusById(task.id, task.status === 'completed' ? 'pending' : 'completed');
  } catch (error) {
    console.error('Error toggling task status:', error);
  }
};

const editTask = (task) => {
  editingTask.value = { ...task };
  showEditModal.value = true;

  // Focus on title input in edit modal
  nextTick(() => {
    if (editTaskTitleInput.value) {
      editTaskTitleInput.value.focus();
    }
  });
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingTask.value = null;
};

const updateTask = async () => {
  if (!editingTask.value || !editingTask.value.title.trim()) return;

  try {
    isSubmitting.value = true;
    await updateTaskById(editingTask.value.id, editingTask.value);
    closeEditModal();
  } catch (error) {
    console.error('Error updating task:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDeleteTask = (task) => {
  taskToDelete.value = task;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  taskToDelete.value = null;
};

const deleteTask = async () => {
  if (!taskToDelete.value) return;

  try {
    isSubmitting.value = true;
    await deleteTaskById(taskToDelete.value.id);
    closeDeleteModal();
  } catch (error) {
    console.error('Error deleting task:', error);
  } finally {
    isSubmitting.value = false;
  }
};

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const isOverdue = (task) => {
  if (!task.dueDate || task.status === 'completed') return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
};

const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};
</script>

<style scoped>
.task-form-container {
  animation: slideDown 0.4s ease-out;
}

.task-item {
  animation: fadeIn 0.5s ease-out;
  transform-origin: center;
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
