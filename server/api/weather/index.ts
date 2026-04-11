import { defineEventHandler, getQuery, createError } from 'h3';
import { $fetch } from 'ofetch';
import { useRuntimeConfig } from '#imports';

// WeatherAPI.com Configuration
const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const WEATHER_API_KEY = config.weatherApiKey;

  if (!WEATHER_API_KEY) {
    throw createError({
      statusCode: 500,
      message: 'Weather API key not configured'
    });
  }

  try {
    // Get query parameters
    const query = getQuery(event);
    const city = (query.city as string) || 'London';
    const units = (query.units as string) || 'metric';

    // Fetch current weather and forecast data with AQI and alerts
    const data = await $fetch(`${WEATHER_API_BASE_URL}/forecast.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: city,
        days: 3,
        aqi: 'yes',
        alerts: 'yes'
      }
    });

    // Process and return the data
    const current = {
      city: data.location.name,
      country: data.location.country,
      temperature: units === 'metric' ? data.current.temp_c : data.current.temp_f,
      feelsLike: units === 'metric' ? data.current.feelslike_c : data.current.feelslike_f,
      humidity: data.current.humidity,
      pressure: data.current.pressure_mb,
      windSpeed: units === 'metric' ? data.current.wind_kph : data.current.wind_mph,
      windDirection: data.current.wind_degree,
      description: data.current.condition.text,
      icon: data.current.condition.icon,
      timestamp: new Date(data.location.localtime).getTime(),
      sunrise: new Date(`${data.forecast.forecastday[0].date} ${data.forecast.forecastday[0].astro.sunrise}`).getTime(),
      sunset: new Date(`${data.forecast.forecastday[0].date} ${data.forecast.forecastday[0].astro.sunset}`).getTime(),
      aqi: data.current.air_quality ? {
        co: data.current.air_quality.co,
        no2: data.current.air_quality.no2,
        o3: data.current.air_quality.o3,
        so2: data.current.air_quality.so2,
        pm2_5: data.current.air_quality.pm2_5,
        pm10: data.current.air_quality.pm10,
        usEpaIndex: data.current.air_quality['us-epa-index'],
        gbDefraIndex: data.current.air_quality['gb-defra-index']
      } : null
    };

    const forecast = [];
    const now = new Date();
    const currentTimestamp = now.getTime();

    data.forecast.forecastday[0].hour.forEach((hour: any) => {
      const hourTime = new Date(hour.time).getTime();
      if (hourTime > currentTimestamp) {
        forecast.push({
          timestamp: hourTime,
          temperature: units === 'metric' ? hour.temp_c : hour.temp_f,
          feelsLike: units === 'metric' ? hour.feelslike_c : hour.feelslike_f,
          humidity: hour.humidity,
          pressure: hour.pressure_mb,
          windSpeed: units === 'metric' ? hour.wind_kph : hour.wind_mph,
          windDirection: hour.wind_degree,
          description: hour.condition.text,
          icon: hour.condition.icon,
          precipitation: hour.chance_of_rain
        });
      }
    });

    for (let i = 1; i < Math.min(3, data.forecast.forecastday.length); i++) {
      const day = data.forecast.forecastday[i];
      for (let j = 0; j < 8; j++) {
        const hour = day.hour[j * 3];
        forecast.push({
          timestamp: new Date(hour.time).getTime(),
          temperature: units === 'metric' ? hour.temp_c : hour.temp_f,
          feelsLike: units === 'metric' ? hour.feelslike_c : hour.feelslike_f,
          humidity: hour.humidity,
          pressure: hour.pressure_mb,
          windSpeed: units === 'metric' ? hour.wind_kph : hour.wind_mph,
          windDirection: hour.wind_degree,
          description: hour.condition.text,
          icon: hour.condition.icon,
          precipitation: hour.chance_of_rain
        });
      }
    }

    const dailyForecast = data.forecast.forecastday.map((day: any) => ({
      date: new Date(day.date).getTime(),
      minTemp: units === 'metric' ? day.day.mintemp_c : day.day.mintemp_f,
      maxTemp: units === 'metric' ? day.day.maxtemp_c : day.day.maxtemp_f,
      avgTemp: units === 'metric' ? day.day.avgtemp_c : day.day.avgtemp_f,
      description: day.day.condition.text,
      icon: day.day.condition.icon,
      sunrise: new Date(`${day.date} ${day.astro.sunrise}`).getTime(),
      sunset: new Date(`${day.date} ${day.astro.sunset}`).getTime(),
      chanceOfRain: day.day.daily_chance_of_rain,
      humidity: day.day.avghumidity
    }));

    const alerts = data.alerts && data.alerts.alert ?
      data.alerts.alert.map((alert: any) => ({
        headline: alert.headline,
        severity: alert.severity,
        urgency: alert.urgency,
        areas: alert.areas,
        category: alert.category,
        event: alert.event,
        effective: new Date(alert.effective).getTime(),
        expires: new Date(alert.expires).getTime(),
        desc: alert.desc,
        instruction: alert.instruction
      })) : [];

    return {
      current,
      forecast,
      dailyForecast,
      alerts
    };
  } catch (error: any) {
    console.error('Weather API error:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch weather data'
    });
  }
});
