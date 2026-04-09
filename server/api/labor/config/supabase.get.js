import SupabaseConfig from '../../../models/SupabaseConfig.js'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      })
    }

    // Get active configuration for the firm
    const config = await SupabaseConfig.findOne({
      firmId,
      isActive: true
    }).select('-supabaseServiceKey') // Don't return service key in GET requests

    if (!config) {
      return {
        success: true,
        data: null,
        message: 'No active Supabase configuration found'
      }
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
      }
    }
  } catch (error) {
    console.error('Error fetching Supabase config:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch Supabase configuration'
    })
  }
})