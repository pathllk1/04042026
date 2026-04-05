import { MasterRoll } from '../../../models/MasterRoll'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Get userId and firmId from the event context (set by auth middleware)
    const userId = event.context.userId
    const firmId = event.context.user.firmId

    const body = await readBody(event)
    const { employeeIds, fieldsToUpdate } = body

    // Validate input
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Employee IDs are required and must be a non-empty array'
      })
    }

    if (!fieldsToUpdate || Object.keys(fieldsToUpdate).length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Fields to update are required'
      })
    }

    // Validate field names
    const allowedFields = [
      'dateOfBirth',
      'status',
      'category',
      'project',
      'site',
      'dateOfExit',
      'phoneNo',
      'pDayWage'
    ]

    const invalidFields = Object.keys(fieldsToUpdate).filter(field => !allowedFields.includes(field))
    if (invalidFields.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Invalid fields: ${invalidFields.join(', ')}`
      })
    }

    // Prepare update object with proper data types
    const updateObject = {}
    const errors = []
    
    Object.keys(fieldsToUpdate).forEach(field => {
      const value = fieldsToUpdate[field]
      
      try {
        switch (field) {
          case 'dateOfBirth':
          case 'dateOfExit':
            if (value) {
              const date = new Date(value)
              if (isNaN(date.getTime())) {
                errors.push(`Invalid date format for ${field}: ${value}`)
              } else {
                updateObject[field] = date
              }
            } else {
              updateObject[field] = null
            }
            break

          case 'pDayWage':
            if (value !== null && value !== undefined && value !== '') {
              const wage = parseFloat(value)
              if (isNaN(wage)) {
                errors.push(`Invalid wage amount: ${value}`)
              } else {
                updateObject[field] = wage
              }
            } else {
              updateObject[field] = null
            }
            break

          case 'phoneNo':
            if (value) {
              // Validate phone number format
              const phoneRegex = /^\d{10}$/
              if (!phoneRegex.test(value)) {
                errors.push(`Invalid phone number format: ${value}`)
              } else {
                updateObject[field] = value
              }
            } else {
              updateObject[field] = null
            }
            break

          case 'status':
            if (value) {
              const validStatuses = ['Active', 'Inactive', 'On Leave', 'Terminated']
              if (!validStatuses.includes(value)) {
                errors.push(`Invalid status: ${value}`)
              } else {
                updateObject[field] = value
              }
            }
            break

          default:
            // For string fields like category, project, site
            updateObject[field] = value || null
            break
        }
      } catch (fieldError) {
        errors.push(`Error processing field ${field}: ${fieldError.message}`)
      }
    })

    // If there are validation errors, return them
    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Validation errors: ${errors.join(', ')}`
      })
    }

    // Add metadata
    updateObject.updatedAt = new Date()
    updateObject.updatedBy = userId

    // Execute the bulk update
    const startTime = Date.now()
    let successCount = 0
    let failedCount = 0
    const failedEmployees = []

    try {
      // Use MongoDB's updateMany for better performance
      const result = await MasterRoll.updateMany(
        {
          _id: { $in: employeeIds },
          firmId: firmId
        },
        {
          $set: updateObject
        }
      )

      successCount = result.modifiedCount
      
      // Check if all employees were found and updated
      if (result.matchedCount < employeeIds.length) {
        const updatedEmployees = await MasterRoll.find({
          _id: { $in: employeeIds },
          firmId: firmId
        }).select('_id')
        
        const updatedIds = updatedEmployees.map(emp => emp._id.toString())
        const notFoundIds = employeeIds.filter(id => !updatedIds.includes(id))
        
        failedCount = notFoundIds.length
        failedEmployees.push(...notFoundIds.map(id => ({
          employeeId: id,
          error: 'Employee not found or access denied'
        })))
      }

    } catch (dbError) {
      console.error('Database update error:', dbError)
      
      // If bulk update fails, try individual updates to identify specific failures
      for (const employeeId of employeeIds) {
        try {
          await MasterRoll.updateOne(
            {
              _id: employeeId,
              firmId: firmId
            },
            {
              $set: updateObject
            }
          )
          successCount++
        } catch (individualError) {
          failedCount++
          failedEmployees.push({
            employeeId,
            error: individualError.message
          })
        }
      }
    }

    const endTime = Date.now()
    const processingTime = endTime - startTime

    // Log the operation for monitoring
    console.log(`Bulk edit completed: ${successCount} success, ${failedCount} failed, ${processingTime}ms`)

    return {
      success: true,
      successCount,
      failedCount,
      totalProcessed: employeeIds.length,
      processingTimeMs: processingTime,
      fieldsUpdated: Object.keys(fieldsToUpdate),
      errors: failedEmployees,
      summary: {
        operation: 'bulk-edit',
        timestamp: new Date().toISOString(),
        userId,
        firmId,
        recordsRequested: employeeIds.length,
        recordsUpdated: successCount,
        recordsFailed: failedCount
      }
    }

  } catch (error) {
    console.error('Bulk edit execution error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error executing bulk edit operation'
    })
  }
})
