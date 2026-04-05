import { MasterRoll } from '../../models/MasterRoll'


export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;

    const body = await readBody(event)
    
    // Create new master roll entry
    const masterRoll = new MasterRoll({
      ...body,
      userId: userId,
      firmId: firmId
    })

    await masterRoll.save()
    
    return {
      success: true,
      data: masterRoll
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message
    }
  }
}) 