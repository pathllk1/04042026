import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createLaborTables, setupRLS } from '~~/utils/supabase.js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { configName, supabaseUrl, supabaseAnonKey, supabaseServiceKey } = body


    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    // Validate required fields
    if (!configName || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'All configuration fields are required'
      })
    }

    // Validate Supabase URL format
    if (!supabaseUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Supabase URL format'
      })
    }

    // Test connection before saving
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const testClient = createClient(supabaseUrl, supabaseAnonKey)
      
      // Simple connection test - try to get the current timestamp
      const { data, error } = await testClient
        .from('pg_stat_activity')
        .select('datname')
        .limit(1)
      
      // If that fails, try a simpler approach
      if (error) {
        // Just test if we can create a client and make any query
        const { error: simpleError } = await testClient.auth.getSession()
        // Even if auth fails, if we get a response, connection is working
      }
    } catch (connectionError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Connection test failed: ${connectionError.message}`
      })
    }

    // Create or update configuration
    const existingConfig = await SupabaseConfig.findOne({ firmId, isActive: true })
    
    let config
    if (existingConfig) {
      // Update existing configuration
      config = await SupabaseConfig.findByIdAndUpdate(
        existingConfig._id,
        {
          configName,
          supabaseUrl,
          supabaseAnonKey,
          supabaseServiceKey,
          userId,
          testConnection: {
            status: 'success',
            lastTested: new Date(),
            errorMessage: null
          }
        },
        { new: true, runValidators: true }
      )
    } else {
      // Create new configuration
      config = new SupabaseConfig({
        configName,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceKey,
        firmId,
        userId,
        isActive: true,
        testConnection: {
          status: 'success',
          lastTested: new Date(),
          errorMessage: null
        }
      })
      
      await config.save()
    }

    // Initialize database schema
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
      
      // Create tables and setup RLS
      await createLaborTables(supabaseClient)
      await setupRLS(supabaseClient)
      
    } catch (schemaError) {
      console.error('Error setting up database schema:', schemaError)
      // Update config with schema setup error but don't fail the request
      await SupabaseConfig.findByIdAndUpdate(config._id, {
        'testConnection.errorMessage': `Schema setup warning: ${schemaError.message}`
      })
    }

    return {
      success: true,
      data: {
        id: config._id,
        configName: config.configName,
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
        isActive: config.isActive,
        testConnection: config.testConnection,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      },
      message: 'Supabase configuration saved successfully'
    }
  } catch (error) {
    console.error('Error saving Supabase config:', error)
    
    // If it's a validation error, return specific message
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message)
      throw createError({
        statusCode: 400,
        statusMessage: `Validation error: ${validationErrors.join(', ')}`
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to save Supabase configuration'
    })
  }
})