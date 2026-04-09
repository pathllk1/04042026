import { testSupabaseConnection } from '~~/utils/supabase.js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { supabaseUrl, supabaseAnonKey } = body

    // Validate required fields
    if (!supabaseUrl || !supabaseAnonKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Supabase URL and Anon Key are required for testing'
      })
    }

    // Validate Supabase URL format
    if (!supabaseUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Supabase URL format'
      })
    }

    // Test the connection
    const connectionTest = await testSupabaseConnection(supabaseUrl, supabaseAnonKey)
    
    if (connectionTest.success) {
      return {
        success: true,
        message: 'Connection test successful',
        data: {
          status: 'connected',
          timestamp: new Date().toISOString()
        }
      }
    } else {
      return {
        success: false,
        message: connectionTest.message || 'Connection failed',
        data: {
          status: 'failed',
          timestamp: new Date().toISOString()
        }
      }
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error)
    
    return {
      success: false,
      message: error.message || 'Connection test failed',
      data: {
        status: 'error',
        timestamp: new Date().toISOString()
      }
    }
  }
})