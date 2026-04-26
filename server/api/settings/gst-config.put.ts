/**
 * server/api/settings/gst-config.put.ts
 * PUT /api/settings/gst-config
 *
 * Updates the global GST enabled/disabled setting in the database.
 * Accessible to authenticated users.
 *
 * Body: { gst_enabled: boolean }
 *
 * Auth: Authenticated users
 */

import { Settings } from '../../models/index'

export default defineEventHandler(async (event) => {
  // Check authentication
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized - authentication required',
    })
  }

  try {
    const body = await readBody(event)
    const { gst_enabled } = body

    if (typeof gst_enabled !== 'boolean') {
      throw createError({
        statusCode: 400,
        message: 'Invalid request - gst_enabled must be a boolean',
      })
    }

    // Update or create the setting
    const updated = await Settings.findOneAndUpdate(
      { setting_key: 'gst_enabled' },
      {
        setting_key: 'gst_enabled',
        setting_value: String(gst_enabled),
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    )

    return {
      success: true,
      message: `GST has been ${gst_enabled ? 'enabled' : 'disabled'}`,
      data: {
        gst_enabled,
        setting_key: (updated as any).setting_key,
        updatedAt: (updated as any).updatedAt,
      },
    }
  } catch (err) {
    console.error('Error updating GST config:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to update GST configuration',
    })
  }
})
