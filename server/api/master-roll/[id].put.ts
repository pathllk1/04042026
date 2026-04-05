import { MasterRoll } from '../../models/MasterRoll';
import { createError } from 'h3';

export default defineEventHandler(async (event) => {
  
  try {
    const id = event.context.params?.id
    const body = await readBody(event)
    const userId = event.context.userId
    
    const employee = await MasterRoll.findOne({ _id: id, userId })
    if (!employee) {
      throw createError({
        statusCode: 404,
        message: 'Employee not found'
      })
    }
    
    const updatedEmployee = await MasterRoll.findByIdAndUpdate(
      id,
      {
        ...body,
        dateOfBirth: new Date(body.dateOfBirth),
        dateOfJoining: new Date(body.dateOfJoining),
        dateOfExit: body.dateOfExit ? new Date(body.dateOfExit) : undefined
      },
      { new: true }
    )
    
    return { employee: updatedEmployee }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message
    })
  }
})