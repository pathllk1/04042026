<template>
  <UModal
    :open="isOpen"
    @update:open="$emit('close')"
    :ui="{
      content: 'max-w-4xl max-h-[90vh] overflow-hidden',
      overlay: { base: 'z-[99999]' },
      wrapper: 'z-[99999]'
    }"
  >
    <template #content>
      <div class="bg-white rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col relative">
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 flex justify-between items-center">
          <h2 class="text-xl font-bold text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Todo List
          </h2>
          <button @click="close" class="text-white hover:text-red-200 focus:outline-none transition-transform duration-300 hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-grow overflow-auto p-6">
          <!-- Todo Form -->
          <div class="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg shadow-sm border border-purple-100 todo-form-container">
            <form @submit.prevent="addTodo" class="flex items-end gap-3">
              <div class="flex-grow">
                <label for="todoContent" class="block text-sm font-medium text-gray-700 mb-1">New Todo</label>
                <input
                  id="todoContent"
                  v-model="newTodo.content"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="What needs to be done?"
                  ref="todoContentInput"
                />
              </div>
              <div class="w-32">
                <label for="todoCategory" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  id="todoCategory"
                  v-model="newTodo.category"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">None</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="shopping">Shopping</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="submit"
                class="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform duration-300 hover:scale-105 shadow"
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
                  {{ isSubmitting ? 'Adding...' : 'Add' }}
                </span>
              </button>
            </form>
          </div>

          <!-- Todo Filters -->
          <div class="mb-6 flex flex-wrap gap-4 items-center">
            <div class="flex-grow">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="Search todos..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <select
                v-model="filterStatus"
                class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <select
                v-model="filterCategory"
                class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Categories</option>
                <option value="">No Category</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="shopping">Shopping</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <!-- Todos List -->
          <div v-if="isLoading" class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>

          <div v-else-if="filteredTodos.length > 0" class="space-y-3">
            <div
              v-for="todo in filteredTodos"
              :key="todo.id"
              class="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden todo-item"
              :class="{
                'border-purple-200': todo.completed,
                'border-gray-200': !todo.completed
              }"
            >
              <div class="p-3 flex items-center justify-between">
                <div class="flex items-center flex-grow">
                  <button
                    @click="toggleTodoCompletion(todo)"
                    class="w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-300 mr-3"
                    :class="{
                      'bg-purple-500 border-purple-500': todo.completed,
                      'border-gray-300 hover:border-purple-500': !todo.completed
                    }"
                  >
                    <svg v-if="todo.completed" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div class="flex-grow">
                    <p class="text-gray-800 transition-all duration-300" :class="{ 'line-through text-gray-500': todo.completed }">
                      {{ todo.content }}
                    </p>
                    <div v-if="todo.category" class="mt-1">
                      <span
                        class="px-2 py-0.5 text-xs rounded-full"
                        :class="{
                          'bg-blue-100 text-blue-800': todo.category === 'work',
                          'bg-green-100 text-green-800': todo.category === 'personal',
                          'bg-yellow-100 text-yellow-800': todo.category === 'shopping',
                          'bg-gray-100 text-gray-800': todo.category === 'other'
                        }"
                      >
                        {{ capitalizeFirstLetter(todo.category) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex space-x-2 ml-4">
                  <button
                    @click="editTodo(todo)"
                    class="text-blue-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors duration-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="confirmDeleteTodo(todo)"
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

          <div v-else class="text-center py-8">
            <div class="text-gray-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p class="text-lg font-medium">No todos found</p>
              <p class="text-sm mt-1">
                {{ searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Add your first todo to get started' }}
              </p>
            </div>
          </div>

          <!-- Summary -->
          <div v-if="todos.length > 0" class="mt-6 text-sm text-gray-500 flex justify-between items-center">
            <div>
              {{ activeCount }} items left
            </div>
            <div class="flex space-x-2">
              <button
                @click="clearCompleted"
                class="text-purple-500 hover:text-purple-700 transition-colors duration-300"
                :disabled="completedCount === 0"
                :class="{ 'opacity-50 cursor-not-allowed': completedCount === 0 }"
              >
                Clear completed
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Todo Modal -->
        <div v-if="showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5100] p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Edit Todo</h3>
            <form @submit.prevent="updateTodo" class="space-y-4">
              <div>
                <label for="editTodoContent" class="block text-sm font-medium text-gray-700 mb-1">Todo Content</label>
                <input
                  id="editTodoContent"
                  v-model="editingTodo.content"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="What needs to be done?"
                  ref="editTodoContentInput"
                />
              </div>
              <div>
                <label for="editTodoCategory" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  id="editTodoCategory"
                  v-model="editingTodo.category"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">None</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="shopping">Shopping</option>
                  <option value="other">Other</option>
                </select>
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
                  class="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-300"
                  :disabled="isSubmitting"
                >
                  {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5100] p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Todo</h3>
            <p class="text-gray-600 mb-6">Are you sure you want to delete this todo? This action cannot be undone.</p>
            <div class="flex justify-end space-x-3">
              <button
                @click="closeDeleteModal"
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-300"
              >
                Cancel
              </button>
              <button
                @click="deleteTodo"
                class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-300"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useTodos } from '~/composables/business/useTodos';
import { useAuth } from '~/composables/useAuth';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

// Check if user is authenticated
const { isLoggedIn } = useAuth();
const isAuthenticated = computed(() => isLoggedIn.value);

// Todo state
const {
  todos,
  isLoading,
  fetchTodos,
  createTodo,
  updateTodoById,
  deleteTodoById,
  toggleTodoCompletionById
} = useTodos();

// Form state
const newTodo = ref({
  content: '',
  category: '',
  completed: false
});

const isSubmitting = ref(false);
const todoContentInput = ref(null);
const editTodoContentInput = ref(null);

// Filter state
const searchQuery = ref('');
const filterStatus = ref('all');
const filterCategory = ref('all');

// Modal state
const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingTodo = ref(null);
const todoToDelete = ref(null);

// Computed properties
const filteredTodos = computed(() => {
  return todos.value.filter(todo => {
    // Filter by search query
    const matchesSearch = searchQuery.value
      ? todo.content.toLowerCase().includes(searchQuery.value.toLowerCase())
      : true;

    // Filter by status
    const matchesStatus = filterStatus.value === 'all'
      ? true
      : (filterStatus.value === 'completed' ? todo.completed : !todo.completed);

    // Filter by category
    const matchesCategory = filterCategory.value === 'all'
      ? true
      : todo.category === filterCategory.value;

    return matchesSearch && matchesStatus && matchesCategory;
  });
});

const activeCount = computed(() => {
  return todos.value.filter(todo => !todo.completed).length;
});

const completedCount = computed(() => {
  return todos.value.filter(todo => todo.completed).length;
});

// Fetch todos on component mount
onMounted(async () => {
  if (props.isOpen) {
    await fetchTodos();
    nextTick(() => {
      if (todoContentInput.value) {
        todoContentInput.value.focus();
      }
    });
  }
});

// Watch for isOpen changes
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    await fetchTodos();
    nextTick(() => {
      if (todoContentInput.value) {
        todoContentInput.value.focus();
      }
    });
  }
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
    alert('Please log in to access the Todo List');
  }
});

const addTodo = async () => {
  if (!newTodo.value.content.trim()) return;

  try {
    isSubmitting.value = true;
    await createTodo(newTodo.value);

    // Reset form
    newTodo.value = {
      content: '',
      category: '',
      completed: false
    };

    // Focus on content input
    nextTick(() => {
      if (todoContentInput.value) {
        todoContentInput.value.focus();
      }
    });
  } catch (error) {
    console.error('Error adding todo:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const toggleTodoCompletion = async (todo) => {
  try {
    await toggleTodoCompletionById(todo.id, !todo.completed);
  } catch (error) {
    console.error('Error toggling todo completion:', error);
  }
};

const editTodo = (todo) => {
  editingTodo.value = { ...todo };
  showEditModal.value = true;

  // Focus on content input in edit modal
  nextTick(() => {
    if (editTodoContentInput.value) {
      editTodoContentInput.value.focus();
    }
  });
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingTodo.value = null;
};

const updateTodo = async () => {
  if (!editingTodo.value || !editingTodo.value.content.trim()) return;

  try {
    isSubmitting.value = true;
    await updateTodoById(editingTodo.value.id, editingTodo.value);
    closeEditModal();
  } catch (error) {
    console.error('Error updating todo:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDeleteTodo = (todo) => {
  todoToDelete.value = todo;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  todoToDelete.value = null;
};

const deleteTodo = async () => {
  if (!todoToDelete.value) return;

  try {
    isSubmitting.value = true;
    await deleteTodoById(todoToDelete.value.id);
    closeDeleteModal();
  } catch (error) {
    console.error('Error deleting todo:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const clearCompleted = async () => {
  try {
    isSubmitting.value = true;

    // Get all completed todos
    const completedTodos = todos.value.filter(todo => todo.completed);

    // Delete each completed todo
    for (const todo of completedTodos) {
      await deleteTodoById(todo.id);
    }
  } catch (error) {
    console.error('Error clearing completed todos:', error);
  } finally {
    isSubmitting.value = false;
  }
};

// Helper functions
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};
</script>

<style scoped>
.todo-form-container {
  animation: slideDown 0.4s ease-out;
}

.todo-item {
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
