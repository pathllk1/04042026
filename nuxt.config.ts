// nuxt.config.ts
import dotenv from 'dotenv'
dotenv.config()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // public runtime config if needed
    public: {}
  }
})