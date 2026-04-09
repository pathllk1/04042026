import { getSupabaseClient } from './supabase.js'

export class LaborService {
  constructor() {
    this.supabase = null
  }

  async initialize() {
    try {
      this.supabase = getSupabaseClient()
      return true
    } catch (error) {
      console.error('Labor service initialization failed:', error)
      return false
    }
  }

  // Labor Groups Methods
  async getGroups(firmId) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_groups')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data
  }

  async createGroup(groupData) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_groups')
      .insert([{
        ...groupData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateGroup(id, groupData) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_groups')
      .update({
        ...groupData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteGroup(id) {
    if (!this.supabase) await this.initialize()
    
    // Soft delete by setting is_active to false
    const { data, error } = await this.supabase
      .from('labor_groups')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Labor Profiles Methods
  async getProfiles(firmId, filters = {}) {
    if (!this.supabase) await this.initialize()
    
    let query = this.supabase
      .from('labor_profiles')
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .eq('firm_id', firmId)
      .eq('is_active', true)

    // Apply filters
    if (filters.groupId) {
      query = query.eq('group_id', filters.groupId)
    }
    
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`)
    }

    const { data, error } = await query.order('name')

    if (error) throw error
    return data
  }

  async getProfileById(id) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_profiles')
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async validateProfileName(name, firmId, excludeId = null) {
    if (!this.supabase) await this.initialize()
    
    let query = this.supabase
      .from('labor_profiles')
      .select('id')
      .eq('name', name)
      .eq('firm_id', firmId)
      .eq('is_active', true)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query

    if (error) throw error
    return data.length === 0 // Return true if name is available
  }

  async createProfile(profileData) {
    if (!this.supabase) await this.initialize()
    
    // Validate name uniqueness
    const isNameAvailable = await this.validateProfileName(
      profileData.name, 
      profileData.firm_id
    )
    
    if (!isNameAvailable) {
      throw new Error('A labor profile with this name already exists')
    }

    const { data, error } = await this.supabase
      .from('labor_profiles')
      .insert([{
        ...profileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .single()

    if (error) throw error
    return data
  }

  async updateProfile(id, profileData) {
    if (!this.supabase) await this.initialize()
    
    // Validate name uniqueness if name is being changed
    if (profileData.name) {
      const isNameAvailable = await this.validateProfileName(
        profileData.name, 
        profileData.firm_id,
        id
      )
      
      if (!isNameAvailable) {
        throw new Error('A labor profile with this name already exists')
      }
    }

    const { data, error } = await this.supabase
      .from('labor_profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .single()

    if (error) throw error
    return data
  }

  async deleteProfile(id) {
    if (!this.supabase) await this.initialize()
    
    // Soft delete by setting is_active to false
    const { data, error } = await this.supabase
      .from('labor_profiles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async moveProfileToGroup(profileId, newGroupId) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_profiles')
      .update({
        group_id: newGroupId,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .single()

    if (error) throw error
    return data
  }

  // Statistics Methods
  async getStats(firmId) {
    if (!this.supabase) await this.initialize()
    
    try {
      // Get total labor count
      const { count: totalLabor } = await this.supabase
        .from('labor_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('is_active', true)

      // Get total groups count
      const { count: totalGroups } = await this.supabase
        .from('labor_groups')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('is_active', true)

      // Get today's attendance (if attendance records exist)
      const today = new Date().toISOString().split('T')[0]
      const { count: todayAttendance } = await this.supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('attendance_date', today)
        .gt('days_worked', 0)

      // Get this month's payments (if payment records exist)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { data: payments } = await this.supabase
        .from('payment_records')
        .select('amount')
        .eq('firm_id', firmId)
        .gte('payment_date', startOfMonth.toISOString().split('T')[0])

      const totalPayments = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0

      return {
        totalLabor: totalLabor || 0,
        totalGroups: totalGroups || 0,
        todayAttendance: todayAttendance || 0,
        totalPayments: totalPayments
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      return {
        totalLabor: 0,
        totalGroups: 0,
        todayAttendance: 0,
        totalPayments: 0
      }
    }
  }

  // Bulk Operations
  async bulkUpdateProfiles(updates) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_profiles')
      .upsert(updates.map(update => ({
        ...update,
        updated_at: new Date().toISOString()
      })))
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)

    if (error) throw error
    return data
  }

  async getProfilesByGroup(firmId) {
    if (!this.supabase) await this.initialize()
    
    const { data, error } = await this.supabase
      .from('labor_profiles')
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    // Group profiles by their group
    const groupedProfiles = {}
    data.forEach(profile => {
      const groupName = profile.labor_groups?.name || 'Unassigned'
      if (!groupedProfiles[groupName]) {
        groupedProfiles[groupName] = {
          group: profile.labor_groups,
          profiles: []
        }
      }
      groupedProfiles[groupName].profiles.push(profile)
    })

    return groupedProfiles
  }
}

// Export singleton instance
export const laborService = new LaborService()