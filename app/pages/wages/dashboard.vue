<template>
  <div class="min-h-screen p-4 sm:p-6 md:p-8">
    <!-- Page Header -->
    <div class="mb-8 animate-fade-in">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Employee & Wages Management</h1>
      <p class="text-gray-600">Monitor employee statistics, wages, and advances in one place</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Total Employees Card -->
      <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border border-blue-200 transform transition-all duration-300 hover:shadow-lg hover:scale-105">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-600 text-sm font-medium mb-1">Total Employees</p>
            <h3 class="text-2xl font-bold text-gray-800">{{ stats.totalEmployees }}</h3>
            <p class="text-blue-600 text-xs mt-2">{{ stats.activeEmployees }} active</p>
          </div>
          <div class="bg-blue-100 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Monthly Wages Card -->
      <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md p-6 border border-green-200 transform transition-all duration-300 hover:shadow-lg hover:scale-105">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-600 text-sm font-medium mb-1">Monthly Wages</p>
            <h3 class="text-2xl font-bold text-gray-800">₹{{ formatCurrency(stats.monthlyWages) }}</h3>
            <p class="text-green-600 text-xs mt-2">{{ currentMonth }}</p>
          </div>
          <div class="bg-green-100 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Outstanding Advances Card -->
      <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-md p-6 border border-yellow-200 transform transition-all duration-300 hover:shadow-lg hover:scale-105">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-yellow-600 text-sm font-medium mb-1">Outstanding Advances</p>
            <h3 class="text-2xl font-bold text-gray-800">₹{{ formatCurrency(stats.outstandingAdvances) }}</h3>
            <p class="text-yellow-600 text-xs mt-2">{{ stats.advanceCount }} active advances</p>
          </div>
          <div class="bg-yellow-100 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Recovered Advances Card -->
      <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md p-6 border border-purple-200 transform transition-all duration-300 hover:shadow-lg hover:scale-105">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-purple-600 text-sm font-medium mb-1">Recovered Advances</p>
            <h3 class="text-2xl font-bold text-gray-800">₹{{ formatCurrency(stats.recoveredAdvances) }}</h3>
            <p class="text-purple-600 text-xs mt-2">{{ currentMonth }}</p>
          </div>
          <div class="bg-purple-100 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Charts Header with Refresh Buttons -->
      <div class="lg:col-span-2 flex justify-between items-center mb-2">
        <h2 class="text-xl font-semibold text-gray-800">Charts & Analytics</h2>
        <div class="flex space-x-2">
          <button @click="async () => { await fetchDashboardData(); await refreshCharts(); }" class="flex items-center px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Refresh Data
          </button>
          <button @click="refreshCharts" class="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Charts
          </button>
        </div>
      </div>

      <!-- Monthly Wages Chart -->
      <div class="bg-white rounded-xl shadow-md p-6 transform transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-800">Monthly Wages Trend</h2>
          <span v-if="wagesData.value && wagesData.value.length > 0" class="text-xs text-gray-500">
            {{ wagesData.value.length }} month{{ wagesData.value.length > 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Chart content wrapper - relative positioning container -->
        <div class="relative h-64 w-full">
          <!-- Chart container - positioned absolutely with highest z-index when visible -->
          <div id="wagesChartContainer" class="absolute inset-0 w-full h-full border border-gray-200 rounded-lg overflow-hidden z-30"
               v-show="showWagesChart">
            <!-- Canvas will be created dynamically -->
            <!-- Chart loading message -->
            <div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-20"
                 v-if="showWagesChart && !wagesChartInstance">
              <div class="bg-white bg-opacity-80 px-3 py-2 rounded-md shadow-sm">
                Chart loading...
              </div>
            </div>
          </div>

          <!-- Loading indicator - medium z-index -->
          <div v-if="loading" class="absolute inset-0 flex justify-center items-center z-20">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>

          <!-- No data message - lowest z-index -->
          <div v-if="!loading && !showWagesChart" class="absolute inset-0 flex flex-col justify-center items-center z-10 bg-white rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No wage data available for chart</p>
            <p class="text-sm mt-1">Process wages for multiple months to see the trend</p>
            <p v-if="stats.monthlyWages > 0" class="text-xs mt-2 text-blue-500">
              (Current month wages: ₹{{ formatCurrency(stats.monthlyWages) }})
            </p>
          </div>
        </div>
      </div>

      <!-- Advances Distribution Chart -->
      <div class="bg-white rounded-xl shadow-md p-6 transform transition-all duration-300 hover:shadow-lg">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-800">Advances Status</h2>
          <span v-if="advancesData.value && advancesData.value.labels && advancesData.value.labels.length > 0" class="text-xs text-gray-500">
            {{ advancesData.value.labels.length }} status{{ advancesData.value.labels.length > 1 ? 'es' : '' }} - Recovered & Remaining
          </span>
        </div>

        <!-- Chart content wrapper - relative positioning container -->
        <div class="relative h-64 w-full">
          <!-- Chart container - positioned absolutely with highest z-index when visible -->
          <div id="advancesChartContainer" class="absolute inset-0 w-full h-full border border-gray-200 rounded-lg overflow-hidden z-30"
               v-show="showAdvancesChart">
            <!-- Title for the chart -->
            <div class="absolute top-0 left-0 right-0 bg-white bg-opacity-80 p-1 text-center text-xs text-gray-600 z-40" v-if="advancesData.value && advancesData.value.data && advancesData.value.data.some(val => val > 0)">
              Outstanding (₹{{ formatCurrency(stats.outstandingAdvances) }}) vs Recovered (₹{{ formatCurrency(stats.recoveredAdvances) }}) Advances
            </div>
            <!-- Canvas will be created dynamically -->
            <!-- Chart loading message -->
            <div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-20"
                 v-if="showAdvancesChart && !advancesChartInstance">
              <div class="bg-white bg-opacity-80 px-3 py-2 rounded-md shadow-sm">
                Chart loading...
              </div>
            </div>
          </div>

          <!-- Loading indicator - medium z-index -->
          <div v-if="loading" class="absolute inset-0 flex justify-center items-center z-20">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
          </div>

          <!-- No data message - lowest z-index -->
          <div v-if="!loading && !showAdvancesChart" class="absolute inset-0 flex flex-col justify-center items-center z-10 bg-white rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No advances data available for chart</p>
            <p class="text-sm mt-1">Create advances with different statuses to see distribution</p>
            <p v-if="stats.outstandingAdvances > 0" class="text-xs mt-2 text-yellow-500">
              (Outstanding advances: ₹{{ formatCurrency(stats.outstandingAdvances) }})
            </p>
            <p v-if="stats.recoveredAdvances > 0" class="text-xs mt-1 text-purple-500">
              (Recovered advances: ₹{{ formatCurrency(stats.recoveredAdvances) }})
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions and Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <div class="bg-white rounded-xl shadow-md p-6 lg:col-span-1 transform transition-all duration-300 hover:shadow-lg">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div class="space-y-3">
          <button @click="navigateTo('/wages/master_roll')" class="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <span class="font-medium text-blue-700">Manage Employees</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button @click="navigateTo('/wages')" class="w-full flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <span class="font-medium text-green-700">Create Wages</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button @click="navigateTo('/wages/edit')" class="w-full flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
            <span class="font-medium text-yellow-700">Edit Wages</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button @click="navigateTo('/wages/employee-advances')" class="w-full flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <span class="font-medium text-purple-700">Manage Advances</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button @click="navigateTo('/wages/report')" class="w-full flex items-center justify-between p-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
            <span class="font-medium text-indigo-700">View Reports</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white rounded-xl shadow-md p-6 lg:col-span-2 transform transition-all duration-300 hover:shadow-lg">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <div v-if="loading" class="flex justify-center items-center h-48">
          <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
        <div v-else-if="recentActivity.length === 0" class="flex justify-center items-center h-48 text-gray-500">
          No recent activity found
        </div>
        <div v-else class="overflow-hidden">
          <ul class="divide-y divide-gray-200">
            <li v-for="(activity, index) in recentActivity" :key="index" class="py-3 flex items-start">
              <div :class="`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${getActivityIconBg(activity.type)}`">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="activity.type === 'wage'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path v-else-if="activity.type === 'advance'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path v-else-if="activity.type === 'recovery'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="ml-3 flex-1">
                <p class="text-sm font-medium text-gray-900">{{ activity.description }}</p>
                <p class="text-xs text-gray-500">{{ formatDate(activity.date) }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePageTitle } from '~/composables/ui/usePageTitle';
import useApiWithAuth from '~/composables/auth/useApiWithAuth';
// Import Chart.js with all controllers and elements
import Chart from 'chart.js/auto';
// Make sure Chart.js is properly initialized
if (typeof window !== 'undefined') {
  window.Chart = Chart;
}

// Set page title
usePageTitle('Employee & Wages Dashboard', 'Monitor employee statistics, wages, and advances');

// Define page meta
definePageMeta({
  requiresAuth: true
});

// Router for navigation
const router = useRouter();

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';

// Chart instances
let wagesChartInstance = null;
let advancesChartInstance = null;

// State variables
const loading = ref(true);
const stats = ref({
  totalEmployees: 0,
  activeEmployees: 0,
  monthlyWages: 0,
  outstandingAdvances: 0,
  advanceCount: 0,
  recoveredAdvances: 0
});
const wagesData = ref([]);
const advancesData = ref([]);
const recentActivity = ref([]);

// Computed properties
const currentMonth = computed(() => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

// Computed property to determine if wages chart should be shown
const showWagesChart = computed(() => {
  return (wagesData.value &&
          wagesData.value.length > 0 &&
          !loading.value) ||
          wagesChartInstance !== null;
});

// Computed property to determine if advances chart should be shown
const showAdvancesChart = computed(() => {
  return (!loading.value &&
          advancesData.value &&
          advancesData.value.labels &&
          advancesData.value.data &&
          advancesData.value.data.length > 0) ||
          advancesChartInstance !== null;
});

// Format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN').format(value);
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get activity icon background color
const getActivityIconBg = (type) => {
  switch (type) {
    case 'wage':
      return 'bg-green-500';
    case 'advance':
      return 'bg-yellow-500';
    case 'recovery':
      return 'bg-purple-500';
    default:
      return 'bg-blue-500';
  }
};

// Navigation helper
const navigateTo = (path) => {
  router.push(path);
};

// Force refresh charts
const refreshCharts = async () => {
  // Only proceed if we're in the browser
  if (!isBrowser) {
    return false;
  }

  // Destroy existing chart instances
  if (wagesChartInstance) {
    wagesChartInstance.destroy();
    wagesChartInstance = null;
  }

  if (advancesChartInstance) {
    advancesChartInstance.destroy();
    advancesChartInstance = null;
  }

  // Small delay to ensure DOM is updated
  await new Promise(resolve => setTimeout(resolve, 200));

  // Render charts again
  return await renderCharts();
};

// Fetch dashboard data
const fetchDashboardData = async () => {
  loading.value = true;

  try {
    const api = useApiWithAuth();
    const response = await api.get('/api/wages/dashboard');

    if (response.success) {
      stats.value = response.stats;
      wagesData.value = response.wagesData;
      advancesData.value = response.advancesData;
      recentActivity.value = response.recentActivity;
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  } finally {
    loading.value = false;
  }
};

// Chart instances will be declared later

// Helper function to check if canvas is ready
const isCanvasReady = (canvas) => {
  if (!canvas) {
    return false;
  }

  try {
    // Try to get context as a test
    const ctx = canvas.getContext('2d');
    return !!ctx;
  } catch (error) {
    console.error('Error checking canvas readiness:', error);
    return false;
  }
};

// Initialize wages chart
const renderWagesChart = () => {
  return new Promise((resolve) => {
    // Only proceed if we're in the browser
    if (!isBrowser) {
      return resolve(false);
    }

    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        // Get the container element
        const container = document.getElementById('wagesChartContainer');
        if (!container) {
          return resolve(false);
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create a new canvas element with explicit styles
        const canvas = document.createElement('canvas');
        canvas.id = 'wagesChartCanvas';
        canvas.width = container.clientWidth || 400;
        canvas.height = container.clientHeight || 200;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';

        // Append canvas to container
        container.appendChild(canvas);

        // Check if canvas is ready
        if (!isCanvasReady(canvas)) {
          return resolve(false);
        }

        const ctx = canvas.getContext('2d');

        // Check if we have data from the API
        if (!wagesData.value || wagesData.value.length === 0) {
          return resolve(false);
        }

        // Extract months and totals from the API data
        // Remove the fullDate property which is only used for sorting
        const months = wagesData.value.map(item => item.month);
        const data = wagesData.value.map(item => item.total);

        // Destroy existing chart if it exists
        if (wagesChartInstance) {
          wagesChartInstance.destroy();
          wagesChartInstance = null;
        }

        // Create the chart with proper configuration
        try {
          wagesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: months,
              datasets: [{
                label: 'Monthly Wages',
                data: data,
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return 'Total: ₹' + context.raw.toLocaleString('en-IN');
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return '₹' + value.toLocaleString('en-IN');
                    }
                  }
                }
              },
              animation: {
                duration: 2000,
                easing: 'easeOutQuart'
              }
            }
          });

          resolve(true);
        } catch (chartError) {
          console.error('Error creating chart instance:', chartError);
          wagesChartInstance = null;
          resolve(false);
        }
      } catch (error) {
        console.error('Error creating wages chart:', error);
        resolve(false);
      }
    });
  });
};

// Initialize advances chart
const renderAdvancesChart = () => {
  return new Promise((resolve) => {
    // Only proceed if we're in the browser
    if (!isBrowser) {
      return resolve(false);
    }

    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        // Get the container element
        const container = document.getElementById('advancesChartContainer');
        if (!container) {
          return resolve(false);
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create a new canvas element with explicit styles
        const canvas = document.createElement('canvas');
        canvas.id = 'advancesChartCanvas';
        canvas.width = container.clientWidth || 400;
        canvas.height = container.clientHeight || 200;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';

        // Append canvas to container
        container.appendChild(canvas);

        // Check if canvas is ready
        if (!isCanvasReady(canvas)) {
          return resolve(false);
        }

        const ctx = canvas.getContext('2d');

        // Check if we have data from the API
        if (!advancesData.value || !advancesData.value.labels ||
            !advancesData.value.data || advancesData.value.data.length === 0) {
          return resolve(false);
        }

        // Format the status labels to be more readable
        const formattedLabels = advancesData.value.labels.map(label => {
          // Convert status values like 'partially_recovered' to 'Partially Recovered'
          return label
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        });

        // Define completely different colors for each status
        const colorMap = {
          // Primary colors for statuses
          'pending': ['rgba(234, 179, 8, 0.8)', 'rgba(234, 179, 8, 1)'],             // Yellow
          'approved': ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 1)'],          // Blue
          'paid': ['rgba(236, 72, 153, 0.8)', 'rgba(236, 72, 153, 1)'],              // Pink
          'partially_recovered': ['rgba(168, 85, 247, 0.8)', 'rgba(168, 85, 247, 1)'], // Purple
          'fully_recovered': ['rgba(34, 197, 94, 0.8)', 'rgba(34, 197, 94, 1)'],     // Green

          // Completely different colors for the "Remaining" versions
          'pending_remaining': ['rgba(255, 87, 51, 0.8)', 'rgba(255, 87, 51, 1)'],           // Orange-Red
          'approved_remaining': ['rgba(0, 204, 153, 0.8)', 'rgba(0, 204, 153, 1)'],          // Teal
          'paid_remaining': ['rgba(102, 51, 153, 0.8)', 'rgba(102, 51, 153, 1)'],            // Deep Purple
          'partially_recovered_remaining': ['rgba(255, 159, 64, 0.8)', 'rgba(255, 159, 64, 1)'], // Orange
          'fully_recovered_remaining': ['rgba(54, 162, 235, 0.8)', 'rgba(54, 162, 235, 1)']     // Sky Blue
        };

        // Generate background and border colors based on status
        const backgroundColors = [];
        const borderColors = [];

        advancesData.value.labels.forEach(label => {
          if (colorMap[label]) {
            backgroundColors.push(colorMap[label][0]);
            borderColors.push(colorMap[label][1]);
          } else {
            // Default colors if status is not in the map
            backgroundColors.push('rgba(107, 114, 128, 0.8)'); // Gray
            borderColors.push('rgba(107, 114, 128, 1)');
          }
        });

        // Create combined data for each status
        // We'll create a single dataset that combines both recovered and remaining
        const combinedData = [];
        const combinedColors = [];
        const combinedBorders = [];

        // For each status, create two entries - one for recovered and one for remaining
        advancesData.value.labels.forEach((label, index) => {
          const recoveredAmount = advancesData.value.data[index] || 0;
          const remainingAmount = advancesData.value.remainingData[index] || 0;

          // Only add non-zero values
          if (recoveredAmount > 0) {
            combinedData.push(recoveredAmount);
            combinedColors.push(colorMap[label] ? colorMap[label][0] : 'rgba(107, 114, 128, 0.8)');
            combinedBorders.push(colorMap[label] ? colorMap[label][1] : 'rgba(107, 114, 128, 1)');
          }

          if (remainingAmount > 0) {
            combinedData.push(remainingAmount);
            // Use completely different color for remaining balance
            const remainingKey = `${label}_remaining`;
            combinedColors.push(colorMap[remainingKey] ? colorMap[remainingKey][0] : 'rgba(107, 114, 128, 0.4)');
            combinedBorders.push(colorMap[remainingKey] ? colorMap[remainingKey][1] : 'rgba(107, 114, 128, 1)');
          }
        });

        // Create combined labels that include the status and whether it's recovered or remaining
        const combinedLabels = [];
        advancesData.value.labels.forEach(label => {
          const recoveredAmount = advancesData.value.data[advancesData.value.labels.indexOf(label)] || 0;
          const remainingAmount = advancesData.value.remainingData[advancesData.value.labels.indexOf(label)] || 0;

          if (recoveredAmount > 0) {
            combinedLabels.push(`${label} ✓ (Recovered)`);
          }

          if (remainingAmount > 0) {
            combinedLabels.push(`${label} ⚠ (Outstanding)`);
          }
        });

        // Create the data object for the chart
        const data = {
          labels: combinedLabels,
          datasets: [{
            data: combinedData,
            backgroundColor: combinedColors,
            borderColor: combinedBorders,
            borderWidth: 1
          }]
        };

        // For debugging
        console.log('Combined chart data:', {
          labels: combinedLabels,
          data: combinedData
        });

        // Destroy existing chart if it exists
        if (advancesChartInstance) {
          advancesChartInstance.destroy();
          advancesChartInstance = null;
        }

        // Create the chart with proper configuration
        try {
          // Always use doughnut chart for the combined data
          const chartType = 'doughnut';

          advancesChartInstance = new Chart(ctx, {
            type: chartType,
            data: data,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '40%', // Make the doughnut hole smaller
              plugins: {
                legend: {
                  position: 'right',
                  align: 'start',
                  labels: {
                    boxWidth: 12,
                    padding: 15,
                    font: {
                      size: 9
                    }
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.raw || 0;
                      const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

                      // The label already includes the status and whether it's recovered or remaining
                      return `${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                    }
                  }
                }
              },
              animation: {
                duration: 2000,
                easing: 'easeOutQuart'
              }
            }
          });

          resolve(true);
        } catch (chartError) {
          console.error('Error creating chart instance:', chartError);
          advancesChartInstance = null;
          resolve(false);
        }
      } catch (error) {
        console.error('Error creating advances chart:', error);
        resolve(false);
      }
    });
  });
};

// Main render function that coordinates both charts
const renderCharts = async () => {
  if (!isBrowser) {
    return false;
  }

  // Use a small delay to ensure DOM is fully ready
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check if containers are available
  const wagesContainer = document.getElementById('wagesChartContainer');
  const advancesContainer = document.getElementById('advancesChartContainer');

  if (!wagesContainer || !advancesContainer) {
    return false;
  }

  // Render charts in sequence with multiple attempts if needed
  let wagesSuccess = false;
  let advancesSuccess = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts && (!wagesSuccess || !advancesSuccess)) {
    if (!wagesSuccess && wagesData.value && wagesData.value.length > 0) {
      wagesSuccess = await renderWagesChart();
    }

    if (!advancesSuccess && advancesData.value && advancesData.value.labels && advancesData.value.labels.length > 0) {
      advancesSuccess = await renderAdvancesChart();
    }

    if (wagesSuccess && advancesSuccess) {
      break;
    }

    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return wagesSuccess || advancesSuccess;
};

// Handle window resize
const handleResize = async () => {
  if (!isBrowser) {
    return;
  }

  // Destroy existing chart instances
  if (wagesChartInstance) {
    wagesChartInstance.destroy();
    wagesChartInstance = null;
  }

  if (advancesChartInstance) {
    advancesChartInstance.destroy();
    advancesChartInstance = null;
  }

  // Small delay to ensure DOM is updated
  await new Promise(resolve => setTimeout(resolve, 200));

  // Render charts again
  await renderCharts();
};

// isBrowser is already defined at the top of the script

// Lifecycle hooks
onMounted(async () => {
  try {
    // Add window resize listener (only in browser)
    if (isBrowser) {
      window.addEventListener('resize', handleResize);
    }

    // Fetch data
    await fetchDashboardData();

    // Initialize charts with a delay to ensure DOM is fully ready (only in browser)
    if (isBrowser) {
      // First attempt after a short delay
      setTimeout(async () => {
        // Destroy existing chart instances if they exist
        if (wagesChartInstance) {
          wagesChartInstance.destroy();
          wagesChartInstance = null;
        }

        if (advancesChartInstance) {
          advancesChartInstance.destroy();
          advancesChartInstance = null;
        }

        // Render charts
        try {
          const success = await renderCharts();

          // If first attempt failed, try again with a longer delay
          if (!success) {
            setTimeout(async () => {
              try {
                await renderCharts();
              } catch (error) {
                console.error('Error in retry rendering charts:', error);
              }
            }, 2000);
          }
        } catch (error) {
          console.error('Error rendering charts:', error);
        }
      }, 1000); // Initial timeout
    }
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    loading.value = false;
  }
});

// Clean up on component unmount
onUnmounted(() => {
  // Remove event listener (only in browser)
  if (isBrowser) {
    window.removeEventListener('resize', handleResize);
  }

  // Destroy chart instances
  if (wagesChartInstance) {
    wagesChartInstance.destroy();
    wagesChartInstance = null;
  }

  if (advancesChartInstance) {
    advancesChartInstance.destroy();
    advancesChartInstance = null;
  }
});
</script>

<style scoped>
/* Add any component-specific styles here */
.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Chart container styles */
#wagesChartContainer, #advancesChartContainer {
  position: absolute;
  height: 100%;
  width: 100%;
  z-index: 30;
}

/* Canvas styles */
#wagesChartCanvas, #advancesChartCanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
  z-index: 40;
}

/* Ensure proper stacking of chart elements */
.relative {
  position: relative;
}

/* Ensure no data message is properly positioned */
.absolute {
  position: absolute;
}
</style>
