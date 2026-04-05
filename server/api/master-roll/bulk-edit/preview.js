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
        message: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
      })
    }

    // Fetch employees to be updated
    const employees = await MasterRoll.find({
      _id: { $in: employeeIds },
      firmId: firmId
    }).select('employeeName fatherHusbandName status category project site dateOfBirth dateOfExit phoneNo bank branch accountNo ifsc pDayWage')

    if (employees.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No employees found with the provided IDs'
      })
    }

    // Create preview data showing before and after values
    const previewData = employees.map(employee => {
      const beforeValues = {}
      const afterValues = {}
      const changes = {}

      Object.keys(fieldsToUpdate).forEach(field => {
        const currentValue = employee[field]
        const newValue = fieldsToUpdate[field]

        beforeValues[field] = currentValue
        afterValues[field] = newValue

        // Determine if this is actually a change
        const isChange = String(currentValue || '') !== String(newValue || '')
        changes[field] = {
          hasChange: isChange,
          from: currentValue,
          to: newValue
        }
      })

      return {
        employeeId: employee._id,
        employeeName: employee.employeeName,
        fatherHusbandName: employee.fatherHusbandName,
        beforeValues,
        afterValues,
        changes,
        hasAnyChanges: Object.values(changes).some(change => change.hasChange)
      }
    })

    // Calculate summary statistics
    const summary = {
      totalEmployees: employees.length,
      employeesWithChanges: previewData.filter(emp => emp.hasAnyChanges).length,
      employeesWithoutChanges: previewData.filter(emp => !emp.hasAnyChanges).length,
      fieldsToUpdate: Object.keys(fieldsToUpdate),
      processingMethod: employees.length > 50 ? 'chunked' : 'single-batch',
      estimatedChunks: employees.length > 50 ? Math.ceil(employees.length / 50) : 1
    }

    // Validate data types and formats
    const validationErrors = []
    
    Object.keys(fieldsToUpdate).forEach(field => {
      const value = fieldsToUpdate[field]
      
      // Date validation
      if ((field === 'dateOfBirth' || field === 'dateOfExit') && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(value)) {
          validationErrors.push(`${field} must be in YYYY-MM-DD format`)
        } else {
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            validationErrors.push(`${field} is not a valid date`)
          }
        }
      }
      
      // Phone number validation
      if (field === 'phoneNo' && value) {
        const phoneRegex = /^\d{10}$/
        if (!phoneRegex.test(value)) {
          validationErrors.push('Phone number must be exactly 10 digits')
        }
      }
      
      // IFSC validation
      if (field === 'ifsc' && value) {
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
        if (!ifscRegex.test(value)) {
          validationErrors.push('IFSC code format is invalid')
        }
      }
      
      // Daily wage validation
      if (field === 'pDayWage' && value) {
        const wage = parseFloat(value)
        if (isNaN(wage) || wage < 0) {
          validationErrors.push('Daily wage must be a positive number')
        }
      }
    })

    return {
      success: true,
      preview: previewData,
      summary,
      validationErrors,
      canProceed: validationErrors.length === 0
    }

  } catch (error) {
    console.error('Preview error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error generating preview'
    })
  }
})
