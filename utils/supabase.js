import { createClient } from '@supabase/supabase-js'

let supabaseClient = null

export const initializeSupabase = (supabaseUrl, supabaseAnonKey) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required')
  }
  
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false // We'll handle auth through existing JWT system
    }
  })
  
  return supabaseClient
}

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeSupabase first.')
  }
  return supabaseClient
}

export const testSupabaseConnection = async (supabaseUrl, supabaseAnonKey) => {
  try {
    const testClient = createClient(supabaseUrl, supabaseAnonKey)
    
    // Test connection by trying to execute a simple query
    const { data, error } = await testClient
      .rpc('version')
    
    if (error) {
      // If version RPC doesn't exist, try a simple select
      const { data: testData, error: testError } = await testClient
        .from('pg_tables')
        .select('tablename')
        .limit(1)
      
      if (testError) {
        throw testError
      }
    }
    
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Connection failed'
    }
  }
}

// Database schema creation functions
export const createLaborTables = async (supabaseClient) => {
  try {
    // Check if tables already exist by trying to select from them
    const { data: existingGroups, error: groupsError } = await supabaseClient
      .from('labor_groups')
      .select('id')
      .limit(1)
    
    if (!groupsError) {
      // Tables already exist
      return { success: true, message: 'Database tables already exist' }
    }
    
    // If we get here, tables don't exist, but we can't create them with the anon key
    // This is expected - table creation should be done manually in Supabase dashboard
    return {
      success: true,
      message: 'Please create the database tables manually in your Supabase dashboard. Check the documentation for the complete schema.'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Connection test passed, but table creation requires manual setup in Supabase dashboard'
    }
  }
}

// Row Level Security policies
export const setupRLS = async (supabaseClient) => {
  try {
    // RLS setup requires service role key and should be done manually
    // For now, we'll just return success
    return {
      success: true,
      message: 'RLS policies should be configured manually in Supabase dashboard for security'
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}