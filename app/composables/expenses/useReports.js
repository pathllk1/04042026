import { ref, computed } from 'vue';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';

/**
 * Composable for generating expense reports
 *
 * Provides functions and state for working with expense reports
 */
export function useReports() {
  const api = useApiWithAuth();

  // State
  const reportData = ref(null);
  const reportType = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  // Computed properties
  const chartData = computed(() => {
    if (!reportData.value) return null;

    const data = reportData.value.data;

    // Generate chart data based on report type
    switch (reportType.value) {
      case 'daily':
        return {
          labels: data.map(item => item.date),
          datasets: [
            {
              label: 'Expenses',
              data: data.map(item => item.totalExpenses),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Receipts',
              data: data.map(item => item.totalReceipts),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        };

      case 'weekly':
        return {
          labels: data.map(item => item.week),
          datasets: [
            {
              label: 'Expenses',
              data: data.map(item => item.totalExpenses),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Receipts',
              data: data.map(item => item.totalReceipts),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        };

      case 'monthly':
        return {
          labels: data.map(item => item.month),
          datasets: [
            {
              label: 'Expenses',
              data: data.map(item => item.totalExpenses),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Receipts',
              data: data.map(item => item.totalReceipts),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        };

      case 'yearly':
        return {
          labels: data.map(item => item.year),
          datasets: [
            {
              label: 'Expenses',
              data: data.map(item => item.totalExpenses),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Receipts',
              data: data.map(item => item.totalReceipts),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        };

      case 'financial-year':
        return {
          labels: data.map(item => item.financialYear),
          datasets: [
            {
              label: 'Expenses',
              data: data.map(item => item.totalExpenses),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Receipts',
              data: data.map(item => item.totalReceipts),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        };

      case 'paidTo':
        return {
          labels: data.map(item => item.paidTo),
          datasets: [
            {
              label: 'Amount',
              data: data.map(item => item.totalExpenses),
              backgroundColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`),
              borderColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`),
              borderWidth: 1
            }
          ]
        };

      case 'category':
        return {
          labels: data.map(item => item.category),
          datasets: [
            {
              label: 'Amount',
              data: data.map(item => item.totalExpenses),
              backgroundColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`),
              borderColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`),
              borderWidth: 1
            }
          ]
        };

      case 'project':
        return {
          labels: data.map(item => item.project),
          datasets: [
            {
              label: 'Amount',
              data: data.map(item => item.totalExpenses),
              backgroundColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`),
              borderColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`),
              borderWidth: 1
            }
          ]
        };

      case 'subs':
        return {
          labels: data.map(item => item.paidTo),
          datasets: [
            {
              label: 'Amount',
              data: data.map(item => item.totalExpenses),
              backgroundColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`),
              borderColor: data.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`),
              borderWidth: 1
            }
          ]
        };

      default:
        return null;
    }
  });

  // Methods
  const generateReport = async (type, filters = {}) => {
    try {
      isLoading.value = true;
      error.value = null;
      reportType.value = type;


      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('type', type);

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

      if (filters.timePeriod) {
        queryParams.append('timePeriod', filters.timePeriod);
      }

      if (filters.isTransfer !== undefined) {
        queryParams.append('isTransfer', filters.isTransfer);
      }

      // Make API request
      const url = `/api/mongo/expenses/reports?${queryParams.toString()}`;
      const response = await api.get(url);

      reportData.value = response;

      return response;
    } catch (err) {

      error.value = err.message || 'Failed to generate report';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    reportData,
    reportType,
    isLoading,
    error,

    // Computed
    chartData,

    // Methods
    generateReport
  };
}
