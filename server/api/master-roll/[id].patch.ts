import { MasterRoll } from '../../models/MasterRoll'
import { createError } from 'h3'


export default defineEventHandler(async (event) => {

  // Get user ID from context (set by auth middleware)
  const userId = event.context.userId
  
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    // Get employee ID from URL
    const id = event.context.params?.id
    
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Employee ID is required'
      })
    }

    // Get request body (only pDayWage is expected)
    const { pDayWage } = await readBody(event)
    
    if (pDayWage === undefined) {
      throw createError({
        statusCode: 400,
        message: 'pDayWage is required'
      })
    }

    // Update only the pDayWage field
    const updatedEmployee = await MasterRoll.findByIdAndUpdate(
      id,
      { pDayWage },
      { new: true }
    )

    if (!updatedEmployee) {
      throw createError({
        statusCode: 404,
        message: 'Employee not found'
      })
    }

    return {
      success: true,
      message: 'Employee wage updated successfully',
      employee: updatedEmployee
    }
  } catch (error: any) {
    console.error('Error updating employee wage:', error)
    
    throw createError({
      statusCode: 500,
      message: `Error updating employee wage: ${error.message}`
    })
  }
})