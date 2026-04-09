/**
 * Comprehensive user data management composable
 * Handles export/import of ALL user settings and data from localStorage
 */

import useLocalStorage from '~/composables/utils/useLocalStorage'

export const useUserDataManager = () => {
  const localStorage = useLocalStorage()

  /**
   * Get all localStorage keys that contain user data
   */
  const getAllUserDataKeys = (): string[] => {
    if (!process.client || typeof window === 'undefined') return []

    try {
      const keys = []
      // Use localStorage.length and localStorage.key() for better compatibility
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          keys.push(key)
        }
      }
      return keys
    } catch (error) {
      console.error('Error getting localStorage keys:', error)
      return []
    }
  }

  /**
   * Get all user data from localStorage
   */
  const getAllUserData = (): Record<string, any> => {
    const userData: Record<string, any> = {}

    if (!process.client || typeof window === 'undefined') return userData

    try {
      // Get all keys directly from localStorage
      const keys = Object.keys(window.localStorage)

      keys.forEach(key => {
        try {
          // Get raw value from localStorage
          const rawValue = window.localStorage.getItem(key)
          if (rawValue !== null) {
            // Try to parse as JSON, if it fails, store as string
            try {
              userData[key] = JSON.parse(rawValue)
            } catch (parseError) {
              // If JSON parsing fails, store the raw string value
              userData[key] = rawValue
            }
          }
        } catch (error) {
          console.error(`Error reading key ${key}:`, error)
        }
      })
    } catch (error) {
      console.error('Error accessing localStorage:', error)
    }

    return userData
  }

  /**
   * Export all user data to a structured JSON format
   */
  const exportAllUserData = (options: {
    includeAuthTokens?: boolean
    includeSensitiveData?: boolean
    includeTemporaryData?: boolean
    debug?: boolean
  } = {}) => {
    const {
      includeAuthTokens = false,
      includeSensitiveData = false,
      includeTemporaryData = false,
      debug = false
    } = options

    try {
      const allData = getAllUserData()

      if (debug) {
        console.log('🔍 Debug: All localStorage data found:', allData)
        console.log('🔍 Debug: Total keys found:', Object.keys(allData).length)
        console.log('🔍 Debug: Keys:', Object.keys(allData))
      }

      const exportData: any = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        data: {}
      }

      // Categorize data
      const categories = {
        authentication: [] as string[],
        aiSettings: [] as string[],
        appSettings: [] as string[],
        apiKeys: [] as string[],
        userData: [] as string[],
        temporaryData: [] as string[],
        other: [] as string[]
      }

      // Categorize keys
      Object.keys(allData).forEach(key => {
        const lowerKey = key.toLowerCase()
        
        if (lowerKey.includes('token') || lowerKey.includes('auth') || key === 'user') {
          categories.authentication.push(key)
        } else if (lowerKey.includes('ai_') || lowerKey.includes('ai-')) {
          categories.aiSettings.push(key)
        } else if (lowerKey.includes('app_settings') || lowerKey.includes('settings')) {
          categories.appSettings.push(key)
        } else if (lowerKey.includes('api_key') || lowerKey.includes('apikey') || lowerKey.includes('credentials')) {
          categories.apiKeys.push(key)
        } else if (lowerKey.includes('temp_') || lowerKey.includes('cache_') || lowerKey.includes('auto_save')) {
          categories.temporaryData.push(key)
        } else if (lowerKey.includes('weather') || lowerKey.includes('notes') || lowerKey.includes('inventory') || lowerKey.includes('timer')) {
          categories.userData.push(key)
        } else {
          categories.other.push(key)
        }
      })

      if (debug) {
        console.log('🔍 Debug: Categorized keys:', categories)
      }

      // Add data based on options
      Object.entries(categories).forEach(([category, keys]) => {
        if (category === 'authentication' && !includeAuthTokens) {
          if (debug) console.log(`⏭️ Skipping ${category} (${keys.length} keys) - includeAuthTokens is false`)
          return
        }
        if ((category === 'apiKeys') && !includeSensitiveData) {
          if (debug) console.log(`⏭️ Skipping ${category} (${keys.length} keys) - includeSensitiveData is false`)
          return
        }
        if (category === 'temporaryData' && !includeTemporaryData) {
          if (debug) console.log(`⏭️ Skipping ${category} (${keys.length} keys) - includeTemporaryData is false`)
          return
        }

        if (keys.length > 0) {
          exportData.data[category] = {}
          keys.forEach(key => {
            exportData.data[category][key] = allData[key]
          })
          if (debug) console.log(`✅ Included ${category} (${keys.length} keys):`, keys)
        }
      })

      // Add metadata
      exportData.metadata = {
        totalKeys: Object.keys(allData).length,
        exportedKeys: Object.keys(exportData.data).reduce((total, category) => {
          return total + Object.keys(exportData.data[category] || {}).length
        }, 0),
        categories: Object.keys(categories).filter(cat => exportData.data[cat]),
        options: options
      }

      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error('Error exporting user data:', error)
      throw new Error('Failed to export user data')
    }
  }

  /**
   * Import user data from JSON
   */
  const importUserData = (jsonData: string, options: {
    mergeWithExisting?: boolean
    importAuthTokens?: boolean
    importSensitiveData?: boolean
    importTemporaryData?: boolean
    categories?: string[]
  } = {}) => {
    const {
      mergeWithExisting = true,
      importAuthTokens = false,
      importSensitiveData = false,
      importTemporaryData = false,
      categories = []
    } = options

    try {
      const importData = JSON.parse(jsonData)
      
      if (!importData.data || typeof importData.data !== 'object') {
        throw new Error('Invalid data format')
      }

      let importedCount = 0
      let skippedCount = 0

      // Process each category
      Object.entries(importData.data).forEach(([category, categoryData]: [string, any]) => {
        // Check if we should import this category
        if (category === 'authentication' && !importAuthTokens) {
          skippedCount += Object.keys(categoryData).length
          return
        }
        if (category === 'apiKeys' && !importSensitiveData) {
          skippedCount += Object.keys(categoryData).length
          return
        }
        if (category === 'temporaryData' && !importTemporaryData) {
          skippedCount += Object.keys(categoryData).length
          return
        }
        if (categories.length > 0 && !categories.includes(category)) {
          skippedCount += Object.keys(categoryData).length
          return
        }

        // Import data from this category
        Object.entries(categoryData).forEach(([key, value]) => {
          try {
            // Check if we should skip this key (merge mode)
            const existingValue = process.client ? window.localStorage.getItem(key) : null
            if (!mergeWithExisting || existingValue === null) {
              // Convert value to string for localStorage
              const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
              if (process.client) {
                window.localStorage.setItem(key, stringValue)
              }
              importedCount++
            } else {
              skippedCount++
            }
          } catch (error) {
            console.error(`Error importing key ${key}:`, error)
            skippedCount++
          }
        })
      })

      return {
        success: true,
        message: `Successfully imported ${importedCount} items${skippedCount > 0 ? `, skipped ${skippedCount} items` : ''}`,
        imported: importedCount,
        skipped: skippedCount,
        metadata: importData.metadata
      }
    } catch (error) {
      console.error('Error importing user data:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import user data',
        imported: 0,
        skipped: 0
      }
    }
  }

  /**
   * Export to file
   */
  const exportToFile = (options: Parameters<typeof exportAllUserData>[0] = {}) => {
    try {
      const data = exportAllUserData(options)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `user-settings-${timestamp}.json`
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      return { success: true, message: `Settings exported to ${filename}` }
    } catch (error) {
      console.error('Error exporting to file:', error)
      return { success: false, message: 'Failed to export settings' }
    }
  }

  /**
   * Import from file
   */
  const importFromFile = (file: File, options: Parameters<typeof importUserData>[1] = {}) => {
    return new Promise<ReturnType<typeof importUserData>>((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const result = importUserData(content, options)
          resolve(result)
        } catch (error) {
          resolve({ 
            success: false, 
            message: error instanceof Error ? error.message : 'Failed to read file',
            imported: 0,
            skipped: 0
          })
        }
      }
      
      reader.onerror = () => {
        resolve({ 
          success: false, 
          message: 'Failed to read file',
          imported: 0,
          skipped: 0
        })
      }
      
      reader.readAsText(file)
    })
  }

  /**
   * Get data summary for preview
   */
  const getDataSummary = () => {
    try {
      const allData = getAllUserData()
      const keys = Object.keys(allData)

      console.log('📊 Data summary - Total keys found:', keys.length)
      console.log('📊 Data summary - Keys:', keys)

      const summary = {
        totalItems: keys.length,
        categories: {
          authentication: keys.filter(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('auth') || k === 'user').length,
          aiSettings: keys.filter(k => k.toLowerCase().includes('ai_') || k.toLowerCase().includes('ai-')).length,
          appSettings: keys.filter(k => k.toLowerCase().includes('app_settings') || k.toLowerCase().includes('settings')).length,
          apiKeys: keys.filter(k => k.toLowerCase().includes('api_key') || k.toLowerCase().includes('apikey') || k.toLowerCase().includes('credentials')).length,
          userData: keys.filter(k => k.toLowerCase().includes('weather') || k.toLowerCase().includes('notes') || k.toLowerCase().includes('inventory') || k.toLowerCase().includes('timer')).length,
          temporaryData: keys.filter(k => k.toLowerCase().includes('temp_') || k.toLowerCase().includes('cache_') || k.toLowerCase().includes('auto_save')).length,
          other: 0
        }
      }

      summary.categories.other = summary.totalItems - Object.values(summary.categories).reduce((sum, count) => sum + count, 0) + summary.categories.other

      console.log('📊 Data summary - Categories:', summary.categories)

      return summary
    } catch (error) {
      console.error('Error getting data summary:', error)
      return {
        totalItems: 0,
        categories: {
          authentication: 0,
          aiSettings: 0,
          appSettings: 0,
          apiKeys: 0,
          userData: 0,
          temporaryData: 0,
          other: 0
        }
      }
    }
  }

  return {
    exportAllUserData,
    importUserData,
    exportToFile,
    importFromFile,
    getAllUserData,
    getAllUserDataKeys,
    getDataSummary
  }
}
