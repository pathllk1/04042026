/**
 * server/api/users/assign-firm.put.ts
 * PUT /api/users/assign-firm
 *
 * Assigns a firm to the authenticated user.
 * Updates user.firmId to the specified firm ID.
 *
 * Used after creating a new firm to make it the user's active firm.
 */

import User from '../../models/User'
import { Firm } from '../../models/index'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const body = await readBody(event)
    const { firmId } = body

    if (!firmId || !mongoose.Types.ObjectId.isValid(String(firmId))) {
      throw createError({
        statusCode: 400,
        message: 'Invalid firm ID'
      })
    }

    // Verify firm exists
    const firm = await Firm.findById(firmId)
    if (!firm) {
      throw createError({
        statusCode: 404,
        message: 'Firm not found'
      })
    }

    // Update user's firmId
    const updatedUser = await User.findByIdAndUpdate(
      user._id || user.id,
      { firmId: new mongoose.Types.ObjectId(firmId) },
      { new: true }
    ).select('username email fullname firmId')

    if (!updatedUser) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      })
    }

    return {
      success: true,
      message: 'Firm assigned successfully',
      data: {
        userId: updatedUser._id.toString(),
        firmId: updatedUser.firmId.toString(),
        firmName: firm.name
      }
    }
  } catch (err: any) {
    console.error('Error assigning firm:', err)
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      message: 'Failed to assign firm'
    })
  }
})
