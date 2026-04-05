import { MasterRoll } from '../../models/MasterRoll';
import { createError } from 'h3';

export default defineEventHandler(async (event) => {
  
  try {
    const id = event.context.params?.id
    const userId = event.context.userId
    
    const employee = await MasterRoll.findOne({ _id: id, userId })
    if (!employee) {
      throw createError({
        statusCode: 404,
        message: 'Employee not found'
      })
    }
    
    await MasterRoll.findByIdAndDelete(id)
    
    return {
      message: 'Employee deleted successfully'
    }
  } catch (error: any) {
    console.log(error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message
    })
  }
})