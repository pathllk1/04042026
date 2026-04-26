/**
 * server/api/settings/gst-config.get.ts
 * GET /api/settings/gst-config
 *
 * Fetches the global GST enabled/disabled setting from the database.
 * Falls back to default (true) if not set.
 *
 * Auth: No auth required (public setting)
 */

import { Settings } from '../../models/index'

export default defineEventHandler(async (event) => {
  try {
    const gstSetting = await Settings.findOne({ setting_key: 'gst_enabled' })

    if (!gstSetting) {
      // Default to GST enabled if not set
      return {
        success: true,
        data: {
          gst_enabled: true,
          setting_key: 'gst_enabled',
        },
      }
    }

    const settingValue = (gstSetting as any).setting_value
    // Convert string "true"/"false" to boolean
    const gstEnabled = settingValue === 'true'
    
    return {
      success: true,
      data: {
        gst_enabled: gstEnabled,
        setting_key: (gstSetting as any).setting_key,
        updatedAt: (gstSetting as any).updatedAt,
      },
    }
  } catch (err) {
    console.error('Error fetching GST config:', err)
    return {
      success: false,
      error: 'Failed to fetch GST configuration',
      data: { gst_enabled: true }, // Safe default
    }
  }
})
