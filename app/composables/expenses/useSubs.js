import { ref, computed } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

/**
 * Composable for managing subs
 *
 * Provides functions and state for working with subs
 */
export function useSubs() {
  const api = useApiWithAuth();
  const basePath = '/api/mongo/subs';
  const txnPath = '/api/mongo/subs/transactions';

  // State
  const subs = ref([]);
  const subsModels = ref([]);
  const currentSub = ref(null);
  const currentSubsModel = ref(null);
  const subsTransactions = ref([]); // transactions for the currently selected subs model
  const isLoading = ref(false);
  const error = ref(null);

  // Computed properties
  const activeSubs = computed(() => {
    return subsModels.value.filter(sub => sub.isActive);
  });

  const inactiveSubs = computed(() => {
    return subsModels.value.filter(sub => !sub.isActive);
  });

  const totalSubsBalance = computed(() => {
    return subsModels.value.reduce((sum, sub) => sum + sub.balance, 0);
  });

  const getUniqueSubNames = computed(() => {
    return subsModels.value.map(sub => sub.name).sort();
  });

  // Get unique paidTo values combining sub names with currently loaded subs transactions
  const getUniquePaidToValues = computed(() => {
    const paidToValues = new Set();

    // Include all sub names
    subsModels.value.forEach(sub => {
      if (sub?.name) paidToValues.add(String(sub.name).trim());
    });

    // Include paidTo from the currently fetched transactions for the active subs model
    subsTransactions.value.forEach(tx => {
      if (tx?.paidTo) paidToValues.add(String(tx.paidTo).trim());
    });

    return Array.from(paidToValues).filter(Boolean).sort();
  });

  // Get unique project values from the currently loaded subs transactions
  const getUniqueSubProjects = computed(() => {
    const projectSet = new Set();
    subsTransactions.value.forEach(tx => {
      if (tx?.project) projectSet.add(String(tx.project).trim());
    });
    return Array.from(projectSet).filter(Boolean).sort();
  });

  // Methods
  const fetchSubs = async (filters = {}) => {
    try {
      isLoading.value = true;
      error.value = null;
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', new Date(filters.startDate).toISOString());
      if (filters.endDate) queryParams.append('endDate', new Date(filters.endDate).toISOString());
      if (filters.paidTo) queryParams.append('paidTo', filters.paidTo);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.project) queryParams.append('project', filters.project);
      const url = `${basePath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      subs.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch subs';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchSubById = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.get(`${basePath}/${id}`);
      currentSub.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch sub';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Fetch transactions for a specific subs model
  const fetchSubsTransactionsByModelId = async (subsModelId) => {
    try {
      isLoading.value = true;
      error.value = null;
      const queryParams = new URLSearchParams();
      queryParams.append('subsModelId', String(subsModelId));
      const url = `${txnPath}?${queryParams.toString()}`;
      const response = await api.get(url);
      subsTransactions.value = Array.isArray(response) ? response : [];
      return subsTransactions.value;
    } catch (err) {
      error.value = err.message || 'Failed to fetch subs transactions';
      subsTransactions.value = [];
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createSub = async (subData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.post(basePath, subData);
      await fetchSubs();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to create sub';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateSub = async (id, subData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.put(`${basePath}/${id}`, subData);
      await fetchSubs();
      if (currentSub.value && currentSub.value.id === id) {
        currentSub.value = response;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to update sub';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteSub = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.delete(`${basePath}/${id}`);
      await fetchSubs();
      if (currentSub.value && currentSub.value.id === id) {
        currentSub.value = null;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to delete sub';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Subs Models methods
  const fetchSubsModels = async (filters = {}) => {
    try {
      isLoading.value = true;
      error.value = null;
      const queryParams = new URLSearchParams();
      if (typeof filters === 'boolean') queryParams.append('isActive', filters);
      else {
        if (filters.isActive !== undefined) queryParams.append('isActive', filters.isActive);
        if (filters.firmId) queryParams.append('firmId', filters.firmId);
      }
      const url = `${basePath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      subsModels.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch subs models';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchSubsModelById = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.get(`${basePath}/${id}`);
      if (response && !response.transactions) response.transactions = [];
      currentSubsModel.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch subs model';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createSubsModel = async (subsModelData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.post(basePath, subsModelData);
      await fetchSubsModels();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to create subs model';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateSubsModel = async (id, subsModelData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.put(`${basePath}/${id}`, subsModelData);
      await fetchSubsModels();
      if (currentSubsModel.value && currentSubsModel.value.id === id) {
        currentSubsModel.value = response;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to update subs model';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteSubsModel = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.delete(`${basePath}/${id}`);
      await fetchSubsModels();
      if (currentSubsModel.value && currentSubsModel.value.id === id) {
        currentSubsModel.value = null;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to delete subs model';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Transaction methods
  const createSubsTransaction = async (transactionData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.post(txnPath, transactionData);
      await fetchSubsModels();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to create subs transaction';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateSubsTransaction = async (transactionId, transactionData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.put(`${txnPath}/${transactionId}`, transactionData);
      await fetchSubsModels();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to update subs transaction';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteSubsTransaction = async (transactionId) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.delete(`${txnPath}/${transactionId}`);
      await fetchSubsModels();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to delete subs transaction';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    subs,
    subsModels,
    currentSub,
    currentSubsModel,
    subsTransactions,
    isLoading,
    error,

    // Computed
    activeSubs,
    inactiveSubs,
    totalSubsBalance,
    getUniqueSubNames,
    getUniquePaidToValues,
    getUniqueSubProjects,

    // Subs methods
    fetchSubs,
    fetchSubById,
    fetchSubsTransactionsByModelId,
    createSub,
    updateSub,
    deleteSub,

    // Subs Models methods
    fetchSubsModels,
    fetchSubsModelById,
    createSubsModel,
    updateSubsModel,
    deleteSubsModel,

    // Transaction methods
    createSubsTransaction,
    updateSubsTransaction,
    deleteSubsTransaction
  };
}
