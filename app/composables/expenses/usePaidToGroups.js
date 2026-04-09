import { ref, computed } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

/**
 * Composable for managing paid-to groups
 *
 * Provides functions and state for working with paid-to groups
 */
export function usePaidToGroups() {
  const api = useApiWithAuth();
  const basePath = '/api/mongo/paidToGroups';

  // State
  const paidToGroups = ref([]);
  const currentPaidToGroup = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  // Computed properties
  const activePaidToGroups = computed(() => {
    return paidToGroups.value.filter(group => group.isActive);
  });

  const inactivePaidToGroups = computed(() => {
    return paidToGroups.value.filter(group => !group.isActive);
  });

  const getUniquePaidToGroupNames = computed(() => {
    return paidToGroups.value.map(group => group.name).sort();
  });

  // Methods
  const fetchPaidToGroups = async (isActive) => {
    try {
      isLoading.value = true;
      error.value = null;
      const queryParams = new URLSearchParams();
      if (isActive !== undefined) queryParams.append('isActive', isActive);
      const url = `${basePath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      let response = await api.get(url);
      paidToGroups.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch paid-to groups';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchPaidToGroupById = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.get(`${basePath}/${id}`);
      currentPaidToGroup.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch paid-to group';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createPaidToGroup = async (paidToGroupData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.post(basePath, paidToGroupData);
      await fetchPaidToGroups();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to create paid-to group';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updatePaidToGroup = async (id, paidToGroupData) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.put(`${basePath}/${id}`, paidToGroupData);
      await fetchPaidToGroups();
      if (currentPaidToGroup.value && currentPaidToGroup.value.id === id) {
        currentPaidToGroup.value = response;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to update paid-to group';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deletePaidToGroup = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;
      const response = await api.delete(`${basePath}/${id}`);
      await fetchPaidToGroups();
      if (currentPaidToGroup.value && currentPaidToGroup.value.id === id) {
        currentPaidToGroup.value = null;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to delete paid-to group';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    paidToGroups,
    currentPaidToGroup,
    isLoading,
    error,

    // Computed
    activePaidToGroups,
    inactivePaidToGroups,
    getUniquePaidToGroupNames,

    // Methods
    fetchPaidToGroups,
    fetchPaidToGroupById,
    createPaidToGroup,
    updatePaidToGroup,
    deletePaidToGroup
  };
}
