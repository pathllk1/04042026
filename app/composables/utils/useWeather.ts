import { ref, reactive } from 'vue';
import useToast from '../ui/useToast';

interface WeatherState {
  current: any;
  forecast: any[];
  dailyForecast: any[];
  city: string;
  units: string;
  isLoading: boolean;
  error: string | null;
}

export const useWeather = () => {
  const weather = reactive<WeatherState>({
    current: null,
    forecast: [],
    dailyForecast: [],
    city: '',
    units: 'metric',
    isLoading: false,
    error: null
  });

  const savedCities = ref<string[]>([]);
  const toast = useToast();

  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';

  // Load saved cities from localStorage
  const loadSavedCities = () => {
    if (!isBrowser) return;

    const saved = localStorage.getItem('weather_saved_cities');
    if (saved) {
      try {
        savedCities.value = JSON.parse(saved);
      } catch (error) {
        console.error('Error parsing saved cities:', error);
        savedCities.value = [];
      }
    }
  };

  // Save city to localStorage
  const saveCity = (city: string) => {
    if (!isBrowser) return;

    if (!savedCities.value.includes(city)) {
      savedCities.value.push(city);
      localStorage.setItem('weather_saved_cities', JSON.stringify(savedCities.value));
      toast.success(`${city} added to saved cities`);
    }
  };

  // Remove city from localStorage
  const removeCity = (city: string) => {
    if (!isBrowser) return;

    savedCities.value = savedCities.value.filter(c => c !== city);
    localStorage.setItem('weather_saved_cities', JSON.stringify(savedCities.value));
    toast.success(`${city} removed from saved cities`);
  };

  // Fetch weather data for a city
  const fetchWeather = async (city: string = weather.city, units: string = weather.units) => {
    // Don't attempt to fetch if we're not in a browser environment
    if (!isBrowser) {
      return null;
    }

    try {
      weather.isLoading = true;
      weather.error = null;

      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}&units=${units}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch weather data' }));
        throw new Error(errorData.message || 'Failed to fetch weather data');
      }

      const data = await response.json();

      weather.current = data.current;
      weather.forecast = data.forecast;
      weather.dailyForecast = data.dailyForecast;
      weather.city = city;
      weather.units = units;

      return data;
    } catch (error: any) {
      console.error('Error fetching weather:', error);
      const errorMessage = error.message || 'Failed to fetch weather data';
      weather.error = errorMessage;
      if (isBrowser) {
        toast.error(errorMessage);
      }
      throw error;
    } finally {
      weather.isLoading = false;
    }
  };

  // Format temperature based on units
  const formatTemperature = (temp: number, units: string = weather.units) => {
    const value = Math.round(temp);
    return `${value}°${units === 'metric' ? 'C' : 'F'}`;
  };

  // Format date from timestamp
  const formatDate = (timestamp: number, options: Intl.DateTimeFormatOptions = {}) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      ...options
    }).format(date);
  };

  // Format time from timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  // Initialize
  loadSavedCities();

  return {
    weather,
    savedCities,
    fetchWeather,
    saveCity,
    removeCity,
    formatTemperature,
    formatDate,
    formatTime
  };
};
