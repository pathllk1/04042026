// nuxt.config.ts
import dotenv from 'dotenv'
dotenv.config()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    weatherApiKey: process.env.WEATHER_API_KEY || '',
    rapidApiKey:  process.env.RAPID_API_KEY  || '',
  rapidApiHost: process.env.RAPID_API_HOST || 'gst-verification.p.rapidapi.com',
    // public runtime config if needed
    public: {}
  }
})