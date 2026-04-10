<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[300] transition-opacity duration-300 ease-in-out">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex justify-between items-center">
        <h2 class="text-xl font-bold text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          Weather Forecast
        </h2>
        <button @click="close" class="text-white hover:text-red-200 focus:outline-none transition-transform duration-300 hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-grow overflow-auto p-6">
        <!-- Search Form -->
        <div class="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow-sm border border-blue-100 weather-form-container">
          <form @submit.prevent="searchWeather" class="flex items-end gap-3">
            <div class="flex-grow">
              <label for="cityInput" class="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                id="cityInput"
                v-model="searchCity"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter city name"
                ref="cityInputRef"
              />
            </div>
            <div class="w-32">
              <label for="unitsSelect" class="block text-sm font-medium text-gray-700 mb-1">Units</label>
              <select
                id="unitsSelect"
                v-model="units"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="metric">Celsius</option>
                <option value="imperial">Fahrenheit</option>
              </select>
            </div>
            <button
              type="submit"
              class="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform duration-300 hover:scale-105 shadow"
              :disabled="weather.isLoading"
            >
              <span class="flex items-center">
                <svg v-if="weather.isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {{ weather.isLoading ? 'Searching...' : 'Search' }}
              </span>
            </button>
          </form>
        </div>

        <!-- Saved Cities -->
        <div v-if="savedCities.length > 0" class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Saved Cities</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="city in savedCities"
              :key="city"
              @click="loadSavedCity(city)"
              class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors duration-300 flex items-center"
            >
              {{ city }}
              <svg @click.stop="removeCity(city)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1 text-blue-600 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="weather.isLoading" class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>

        <!-- Error State -->
        <div v-else-if="weather.error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ weather.error }}
          </p>
          <p class="text-sm mt-1">Please check the city name and try again.</p>
        </div>

        <!-- Weather Data -->
        <div v-else-if="weather.current" class="weather-data-container">
          <!-- Current Weather -->
          <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white p-6 mb-6 shadow-lg current-weather-card">
            <div class="flex flex-col md:flex-row items-center justify-between">
              <div class="text-center md:text-left mb-4 md:mb-0">
                <h3 class="text-2xl font-bold">{{ weather.current.city }}, {{ weather.current.country }}</h3>
                <p class="text-blue-100">{{ formatDate(weather.current.timestamp) }}</p>
                <div class="mt-4">
                  <p class="text-5xl font-bold">{{ formatTemperature(weather.current.temperature) }}</p>
                  <p class="text-lg">Feels like {{ formatTemperature(weather.current.feelsLike) }}</p>
                  <p class="capitalize mt-1">{{ weather.current.description }}</p>
                </div>
              </div>
              <div class="flex flex-col items-center">
                <img :src="weather.current.icon" :alt="weather.current.description" class="w-24 h-24 weather-icon" />
                <div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
                  <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span>Humidity: {{ weather.current.humidity }}%</span>
                  </div>
                  <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span>Pressure: {{ weather.current.pressure }} hPa</span>
                  </div>
                  <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Wind: {{ weather.current.windSpeed }} {{ units === 'metric' ? 'km/h' : 'mph' }}</span>
                  </div>
                  <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Sunrise: {{ formatTime(weather.current.sunrise) }}</span>
                  </div>
                  <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span>Sunset: {{ formatTime(weather.current.sunset) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Air Quality Index -->
            <div v-if="weather.current.aqi" class="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
              <h4 class="text-sm font-semibold mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Air Quality Index
              </h4>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center">
                  <div class="w-2 h-2 rounded-full mr-1" :class="getAqiColor(weather.current.aqi.usEpaIndex)"></div>
                  <span>US EPA Index: {{ weather.current.aqi.usEpaIndex }} - {{ getAqiLabel(weather.current.aqi.usEpaIndex) }}</span>
                </div>
                <div>PM2.5: {{ Math.round(weather.current.aqi.pm2_5 * 10) / 10 }} μg/m³</div>
                <div>PM10: {{ Math.round(weather.current.aqi.pm10 * 10) / 10 }} μg/m³</div>
                <div>O₃: {{ Math.round(weather.current.aqi.o3 * 10) / 10 }} μg/m³</div>
                <div>NO₂: {{ Math.round(weather.current.aqi.no2 * 10) / 10 }} μg/m³</div>
                <div>SO₂: {{ Math.round(weather.current.aqi.so2 * 10) / 10 }} μg/m³</div>
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <button
                v-if="!isCitySaved"
                @click="saveCity(weather.current.city)"
                class="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-full flex items-center transition-colors duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save City
              </button>
            </div>
          </div>

          <!-- Weather Alerts -->
          <div v-if="weather.alerts && weather.alerts.length > 0" class="mb-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Weather Alerts
            </h3>
            <div class="space-y-3 weather-alerts-container">
              <div
                v-for="(alert, index) in weather.alerts"
                :key="index"
                class="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div class="flex justify-between items-start">
                  <h4 class="font-medium text-red-700">{{ alert.event }}</h4>
                  <span class="text-xs px-2 py-1 rounded-full" :class="getAlertSeverityClass(alert.severity)">
                    {{ alert.severity }}
                  </span>
                </div>
                <p class="text-sm text-gray-700 mt-2">{{ alert.headline }}</p>
                <div class="mt-2 text-xs text-gray-500 flex justify-between">
                  <span>Areas: {{ alert.areas }}</span>
                  <span>Expires: {{ formatDate(alert.expires, { dateStyle: 'short', timeStyle: 'short' }) }}</span>
                </div>
                <div class="mt-3">
                  <button
                    @click="toggleAlertDetails(index)"
                    class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    {{ expandedAlerts[index] ? 'Hide Details' : 'Show Details' }}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-1 transition-transform duration-300" :class="{ 'rotate-180': expandedAlerts[index] }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div v-if="expandedAlerts[index]" class="mt-3 text-sm text-gray-700 p-3 bg-red-50 rounded border border-red-100 animate-fade-in">
                  <p class="mb-2"><strong>Description:</strong> {{ alert.desc }}</p>
                  <p v-if="alert.instruction"><strong>Instructions:</strong> {{ alert.instruction }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 3-Day Forecast -->
          <h3 class="text-lg font-semibold text-gray-800 mb-3">3-Day Forecast</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div
              v-for="(day, index) in weather.dailyForecast"
              :key="index"
              class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-300 forecast-card"
            >
              <div class="text-center">
                <p class="font-medium text-gray-800">{{ formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' }) }}</p>
                <img :src="day.icon" :alt="day.description" class="w-16 h-16 mx-auto my-2" />
                <p class="capitalize text-sm text-gray-600">{{ day.description }}</p>
                <div class="flex justify-center items-center space-x-2 mt-2">
                  <span class="text-blue-600 font-medium">{{ formatTemperature(day.minTemp) }}</span>
                  <span class="text-gray-400">|</span>
                  <span class="text-red-600 font-medium">{{ formatTemperature(day.maxTemp) }}</span>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                  <div class="flex justify-center items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M12 3v18" />
                    </svg>
                    Rain: {{ day.chanceOfRain }}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Hourly Forecast -->
          <h3 class="text-lg font-semibold text-gray-800 mb-3">Hourly Forecast</h3>
          <div class="overflow-x-auto">
            <div class="inline-flex space-x-4 pb-4 hourly-forecast-container">
              <div
                v-for="(hour, index) in weather.forecast.slice(0, 8)"
                :key="index"
                class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm min-w-[120px] text-center hourly-card"
              >
                <p class="font-medium text-gray-800">{{ formatTime(hour.timestamp) }}</p>
                <img :src="hour.icon" :alt="hour.description" class="w-12 h-12 mx-auto my-1" />
                <p class="text-lg font-medium">{{ formatTemperature(hour.temperature) }}</p>
                <p class="text-xs text-gray-500 capitalize">{{ hour.description }}</p>
                <p class="text-xs text-blue-500 mt-1">
                  <span class="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {{ hour.precipitation }}%
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- No Data State -->
        <div v-else class="text-center py-8">
          <div class="text-gray-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p class="text-lg font-medium">No weather data</p>
            <p class="text-sm mt-1">Search for a city to see the weather forecast</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useWeather } from '~/composables/utils/useWeather';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

// Refs
const cityInputRef = ref(null);
const searchCity = ref('');
const units = ref('metric');
const expandedAlerts = ref({});

// Weather composable
const {
  weather,
  savedCities,
  fetchWeather,
  saveCity: saveCityToStorage,
  removeCity: removeCityFromStorage,
  formatTemperature,
  formatDate,
  formatTime
} = useWeather();

// Computed properties
const isCitySaved = computed(() => {
  return weather.current && savedCities.value.includes(weather.current.city);
});

// No need for dailyForecast computed property as we get it directly from the API

// Methods
const close = () => {
  emit('close');
};

const searchWeather = async () => {
  if (!searchCity.value.trim()) return;

  try {
    await fetchWeather(searchCity.value, units.value);
  } catch (error) {
    console.error('Error searching weather:', error);
    // Error is already handled in the fetchWeather function
    // and displayed in the UI via weather.error
  }
};

const loadSavedCity = async (city) => {
  searchCity.value = city;
  await fetchWeather(city, units.value);
};

const saveCity = (city) => {
  saveCityToStorage(city);
};

const removeCity = (city) => {
  removeCityFromStorage(city);
};

// AQI helper methods
const getAqiColor = (index) => {
  const colors = {
    1: 'bg-green-500', // Good
    2: 'bg-yellow-400', // Moderate
    3: 'bg-orange-500', // Unhealthy for Sensitive Groups
    4: 'bg-red-500', // Unhealthy
    5: 'bg-purple-600', // Very Unhealthy
    6: 'bg-red-900' // Hazardous
  };
  return colors[index] || 'bg-gray-500';
};

const getAqiLabel = (index) => {
  const labels = {
    1: 'Good',
    2: 'Moderate',
    3: 'Unhealthy for Sensitive Groups',
    4: 'Unhealthy',
    5: 'Very Unhealthy',
    6: 'Hazardous'
  };
  return labels[index] || 'Unknown';
};

// Alert helper methods
const getAlertSeverityClass = (severity) => {
  const classes = {
    'Extreme': 'bg-red-600 text-white',
    'Severe': 'bg-red-500 text-white',
    'Moderate': 'bg-orange-500 text-white',
    'Minor': 'bg-yellow-500 text-black',
    'Unknown': 'bg-gray-500 text-white'
  };
  return classes[severity] || classes['Unknown'];
};

const toggleAlertDetails = (index) => {
  expandedAlerts.value[index] = !expandedAlerts.value[index];
};

// Lifecycle hooks
onMounted(() => {
  if (props.isOpen) {
    nextTick(() => {
      if (cityInputRef.value) {
        cityInputRef.value.focus();
      }
    });

    // Load default city if no weather data
    if (!weather.current) {
      if (savedCities.value.length > 0) {
        loadSavedCity(savedCities.value[0]);
      } else {
        // Default to a major city if no saved cities
        searchCity.value = 'London';
        searchWeather();
      }
    }
  }
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (cityInputRef.value) {
        cityInputRef.value.focus();
      }
    });

    // Load default city if no weather data
    if (!weather.current) {
      if (savedCities.value.length > 0) {
        loadSavedCity(savedCities.value[0]);
      } else {
        // Default to a major city if no saved cities
        searchCity.value = 'London';
        searchWeather();
      }
    }
  }
});
</script>

<style scoped>
.weather-form-container {
  animation: slideDown 0.4s ease-out;
}

.current-weather-card {
  animation: fadeIn 0.6s ease-out;
}

.forecast-card {
  animation: fadeIn 0.8s ease-out;
}

.hourly-card {
  animation: fadeIn 1s ease-out;
}

.weather-icon {
  animation: pulse 2s infinite;
}

.weather-data-container {
  animation: fadeIn 0.5s ease-out;
}

.hourly-forecast-container {
  animation: slideRight 0.5s ease-out;
}

.weather-alerts-container {
  animation: fadeIn 0.8s ease-out;
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
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

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes slideRight {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
