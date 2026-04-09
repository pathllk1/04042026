import { ref, computed } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

/**
 * Composable for managing expenses
 *
 * Provides functions and state for working with expenses
 */
export function useExpenses() {
  const api = useApiWithAuth();
  const basePath = '/api/mongo/expenses';

  // State
  const expenses = ref([]);
  const currentExpense = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  // Computed properties
  const groupedByCategory = computed(() => {
    return expenses.value.reduce((acc, expense) => {
      const category = expense.category || 'Uncategorized';

      if (!acc[category]) {
        acc[category] = [];
      }

      acc[category].push(expense);
      return acc;
    }, {});
  });

  const groupedByPaidTo = computed(() => {
    return expenses.value.reduce((acc, expense) => {
      const paidTo = expense.paidTo;

      if (!acc[paidTo]) {
        acc[paidTo] = [];
      }

      acc[paidTo].push(expense);
      return acc;
    }, {});
  });

  const groupedByProject = computed(() => {
    return expenses.value.reduce((acc, expense) => {
      const project = expense.project || 'No Project';

      if (!acc[project]) {
        acc[project] = [];
      }

      acc[project].push(expense);
      return acc;
    }, {});
  });

  const groupedByPaidToGroup = computed(() => {
    return expenses.value.reduce((acc, expense) => {
      const paidToGroup = expense.paidToGroup || 'No Group';

      if (!acc[paidToGroup]) {
        acc[paidToGroup] = [];
      }

      acc[paidToGroup].push(expense);
      return acc;
    }, {});
  });

  const getUniquePaidTo = computed(() => {
    const paidToSet = new Set(expenses.value.map(expense => expense.paidTo));
    return Array.from(paidToSet).sort();
  });

  const getUniqueCategories = computed(() => {
    const categorySet = new Set(expenses.value.map(expense => expense.category).filter(Boolean));
    return Array.from(categorySet).sort();
  });

  const getUniqueProjects = computed(() => {
    const projectSet = new Set(expenses.value.map(expense => expense.project).filter(Boolean));
    return Array.from(projectSet).sort();
  });

  const getUniquePaidToGroups = computed(() => {
    const paidToGroupSet = new Set(expenses.value.map(expense => expense.paidToGroup).filter(Boolean));
    return Array.from(paidToGroupSet).sort();
  });

  // Methods
  const fetchExpenses = async (filters = {}) => {
    try {
      isLoading.value = true;
      error.value = null;


      // Build query parameters
      const queryParams = new URLSearchParams();

      if (filters.startDate) {
        queryParams.append('startDate', new Date(filters.startDate).toISOString());
      }

      if (filters.endDate) {
        queryParams.append('endDate', new Date(filters.endDate).toISOString());
      }

      if (filters.paidTo) {
        queryParams.append('paidTo', filters.paidTo);
      }

      if (filters.category) {
        queryParams.append('category', filters.category);
      }

      if (filters.project) {
        queryParams.append('project', filters.project);
      }

      if (filters.paymentMode) {
        queryParams.append('paymentMode', filters.paymentMode);
      }

      if (filters.paidToGroup) {
        queryParams.append('paidToGroup', filters.paidToGroup);
      }

      if (filters.isTransfer !== undefined) {
        queryParams.append('isTransfer', filters.isTransfer);
      }

      // Make API request
      const url = `${basePath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);

      expenses.value = response;

      return response;
    } catch (err) {

      error.value = err.message || 'Failed to fetch expenses';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchExpenseById = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;


      try {
        const response = await api.get(`${basePath}/${id}`);

        currentExpense.value = response;

        return response;
      } catch (apiError) {

        error.value = apiError.message || 'Failed to fetch expense';
        throw apiError;
      }
    } catch (err) {

      error.value = err.message || 'Failed to fetch expense';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createExpense = async (expenseData) => {
    try {
      isLoading.value = true;
      error.value = null;


      const response = await api.post(basePath, expenseData);

      // Refresh expenses list
      await fetchExpenses();

      return response;
    } catch (err) {

      error.value = err.message || 'Failed to create expense';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateExpense = async (id, expenseData) => {
    try {
      isLoading.value = true;
      error.value = null;

      console.log('Updating expense:', { id, expenseData });

      const response = await api.put(`${basePath}/${id}`, expenseData);

      // Add a small delay to ensure backend operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh expenses list to ensure data consistency
      await fetchExpenses();

      // Update current expense if it's the one being edited
      if (currentExpense.value && currentExpense.value.id === id) {
        currentExpense.value = response;
      }

      console.log('Expense updated successfully:', response);
      return response;
    } catch (err) {
      console.error('Error updating expense:', err);
      error.value = err.message || 'Failed to update expense';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteExpense = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;

      console.log('Deleting expense:', id);

      const response = await api.delete(`${basePath}/${id}`);

      // Add a small delay to ensure backend operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh expenses list to ensure data consistency
      await fetchExpenses();

      // Clear current expense if it's the one being deleted
      if (currentExpense.value && currentExpense.value.id === id) {
        currentExpense.value = null;
      }

      console.log('Expense deleted successfully:', response);
      return response;
    } catch (err) {
      console.error('Error deleting expense:', err);
      error.value = err.message || 'Failed to delete expense';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createTransfer = async (transferData) => {
    try {
      isLoading.value = true;
      error.value = null;


      // Prepare transfer data
      const expenseData = {
        date: transferData.date,
        paidTo: 'Internal Transfer',
        amount: transferData.amount,
        category: 'TRANSFER',
        project: transferData.project,
        paymentMode: {
          type: transferData.fromMode,
          instrumentNo: transferData.instrumentNo,
          bankId: transferData.fromBankId
        },
        description: transferData.description || `Transfer from ${transferData.fromMode} to ${transferData.toMode}`,
        isTransfer: true,
        transferDetails: {
          fromMode: transferData.fromMode,
          fromBankId: transferData.fromBankId,
          toMode: transferData.toMode,
          toBankId: transferData.toBankId
        }
      };

      const response = await api.post(basePath, expenseData);

      // Refresh expenses list
      await fetchExpenses();

      return response;
    } catch (err) {

      error.value = err.message || 'Failed to create transfer';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    expenses,
    currentExpense,
    isLoading,
    error,

    // Computed
    groupedByCategory,
    groupedByPaidTo,
    groupedByProject,
    groupedByPaidToGroup,
    getUniquePaidTo,
    getUniqueCategories,
    getUniqueProjects,
    getUniquePaidToGroups,

    // Methods
    fetchExpenses,
    fetchExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    createTransfer
  };
}
