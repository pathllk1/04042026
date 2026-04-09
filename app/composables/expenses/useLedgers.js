import { ref, computed } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

/**
 * Composable for managing ledgers
 *
 * Provides functions and state for working with ledgers
 */
export function useLedgers() {
  const api = useApiWithAuth();
  const basePath = '/api/mongo/ledgers';

  // State
  const ledgers = ref([]);
  const currentLedger = ref(null);
  const ledgerTransactions = ref([]);
  const isLoading = ref(false);
  const error = ref(null);

  // Computed properties
  const cashLedgers = computed(() => {
    return ledgers.value.filter(ledger => ledger.type === 'cash');
  });

  const bankLedgers = computed(() => {
    return ledgers.value.filter(ledger => ledger.type === 'bank');
  });

  const totalCashBalance = computed(() => {
    return cashLedgers.value.reduce((sum, ledger) => sum + ledger.currentBalance, 0);
  });

  const totalBankBalance = computed(() => {
    return bankLedgers.value.reduce((sum, ledger) => sum + ledger.currentBalance, 0);
  });

  const totalBalance = computed(() => {
    return totalCashBalance.value + totalBankBalance.value;
  });

  // Methods
  const fetchLedgers = async (type) => {
    try {
      isLoading.value = true;
      error.value = null;

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (type) queryParams.append('type', type);

      // Make API request
      const url = `${basePath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);

      ledgers.value = response;
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to fetch ledgers';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Ensures that a default cash book exists
   * If no cash ledger exists, creates one with default values
   */
  const ensureDefaultCashBook = async () => {
    try {

      // First, fetch all ledgers
      await fetchLedgers();

      // Check if a cash ledger already exists
      const existingCashLedger = cashLedgers.value[0];

      if (existingCashLedger) {

        return existingCashLedger;
      }

      // No cash ledger exists, create one

      const defaultCashBook = {
        name: 'Cash Book',
        type: 'cash',
        openingBalance: 0,
        description: 'Default cash book for all cash transactions'
      };

      const newLedger = await createLedger(defaultCashBook);

      return newLedger;
    } catch (err) {

      error.value = err.message || 'Failed to ensure default cash book';
      throw err;
    }
  };

  const fetchLedgerById = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;

      try {
        const response = await api.get(`${basePath}/${id}`);
        currentLedger.value = response;
        // Extract transactions if available
        if (response.transactions) {
          ledgerTransactions.value = response.transactions;
        } else {
          ledgerTransactions.value = [];
        }
        return response;
      } catch (apiError) {
        error.value = apiError.message || 'Failed to fetch ledger';
        throw apiError;
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch ledger';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const createLedger = async (ledgerData) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await api.post(basePath, ledgerData);
      // Refresh ledgers list
      await fetchLedgers();
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to create ledger';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateLedger = async (id, ledgerData) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await api.put(`${basePath}/${id}`, ledgerData);
      // Refresh ledgers list
      await fetchLedgers();
      // Update current ledger if it's the one being edited
      if (currentLedger.value && currentLedger.value.id === id) {
        currentLedger.value = response;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to update ledger';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteLedger = async (id) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await api.delete(`${basePath}/${id}`);
      // Refresh ledgers list
      await fetchLedgers();
      // Clear current ledger if it's the one being deleted
      if (currentLedger.value && currentLedger.value.id === id) {
        currentLedger.value = null;
      }
      return response;
    } catch (err) {
      error.value = err.message || 'Failed to delete ledger';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    ledgers,
    currentLedger,
    ledgerTransactions,
    isLoading,
    error,

    // Computed
    cashLedgers,
    bankLedgers,
    totalCashBalance,
    totalBankBalance,
    totalBalance,

    // Methods
    fetchLedgers,
    fetchLedgerById,
    createLedger,
    updateLedger,
    deleteLedger,
    ensureDefaultCashBook
  };
}
