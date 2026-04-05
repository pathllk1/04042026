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

    // Check if employees exist and belong to the firm
    const employees = await MasterRoll.find({
      _id: { $in: employeeIds },
      firmId: firmId
    }).select('_id employeeName')

    const foundEmployeeIds = employees.map(emp => emp._id.toString())
    const missingEmployeeIds = employeeIds.filter(id => !foundEmployeeIds.includes(id))

    if (missingEmployeeIds.length > 0) {
      throw createError({
        statusCode: 404,
        message: `Employees not found: ${missingEmployeeIds.length} out of ${employeeIds.length} employees`
      })
    }

    // Detailed field validation
    const validationErrors = []
    const warnings = []

    // Validate each field
    Object.keys(fieldsToUpdate).forEach(field => {
      const value = fieldsToUpdate[field]
      
      switch (field) {
        case 'dateOfBirth':
        case 'dateOfExit':
          if (value) {
            // Date format validation
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            if (!dateRegex.test(value)) {
              validationErrors.push(`${field} must be in YYYY-MM-DD format`)
            } else {
              const date = new Date(value)
              if (isNaN(date.getTime())) {
                validationErrors.push(`${field} is not a valid date`)
              } else {
                // Additional date logic validation
                const today = new Date()
                if (field === 'dateOfBirth') {
                  const age = (today - date) / (365.25 * 24 * 60 * 60 * 1000)
                  if (age < 18 || age > 100) {
                    warnings.push(`Date of birth indicates age ${Math.floor(age)} years, which may be unusual`)
                  }
                } else if (field === 'dateOfExit') {
                  if (date > today) {
                    warnings.push('Date of exit is in the future')
                  }
                }
              }
            }
          }
          break

        case 'status':
          if (value) {
            const validStatuses = ['Active', 'Inactive', 'On Leave', 'Terminated']
            if (!validStatuses.includes(value)) {
              validationErrors.push(`Status must be one of: ${validStatuses.join(', ')}`)
            }
          }
          break

        case 'phoneNo':
          if (value) {
            const phoneRegex = /^\d{10}$/
            if (!phoneRegex.test(value)) {
              validationErrors.push('Phone number must be exactly 10 digits')
            } else if (value === '0000000000') {
              warnings.push('Phone number appears to be a placeholder (all zeros)')
            }
          }
          break



        case 'pDayWage':
          if (value) {
            const wage = parseFloat(value)
            if (isNaN(wage)) {
              validationErrors.push('Daily wage must be a valid number')
            } else if (wage < 0) {
              validationErrors.push('Daily wage cannot be negative')
            } else if (wage > 10000) {
              warnings.push('Daily wage seems unusually high (over ₹10,000)')
            } else if (wage < 100) {
              warnings.push('Daily wage seems unusually low (under ₹100)')
            }
          }
          break

        case 'category':
          if (value) {
            const commonCategories = ['UNSKILLED', 'SKILLED', 'SEMI-SKILLED', 'TECHNICIAN', 'SUPERVISOR']
            if (!commonCategories.includes(value.toUpperCase())) {
              warnings.push(`Category '${value}' is not in common categories: ${commonCategories.join(', ')}`)
            }
          }
          break
      }
    })

    // Business logic validations
    if (fieldsToUpdate.status === 'Terminated' && !fieldsToUpdate.dateOfExit) {
      warnings.push('Setting status to Terminated without Date of Exit')
    }

    if (fieldsToUpdate.dateOfExit && fieldsToUpdate.status === 'Active') {
      warnings.push('Setting Date of Exit while status remains Active')
    }

    // Check for potential conflicts
    const conflicts = []

    // Performance considerations
    const performanceNotes = []
    if (employeeIds.length > 50) {
      performanceNotes.push(`Large batch size (${employeeIds.length} records) will be processed in chunks of 50`)
    }
    if (employeeIds.length > 500) {
      performanceNotes.push('Very large batch - consider breaking into smaller operations')
    }

    const isValid = validationErrors.length === 0
    const hasWarnings = warnings.length > 0 || conflicts.length > 0

    return {
      success: true,
      isValid,
      hasWarnings,
      validationErrors,
      warnings,
      conflicts,
      performanceNotes,
      summary: {
        employeeCount: employeeIds.length,
        fieldsToUpdate: Object.keys(fieldsToUpdate).length,
        processingMethod: employeeIds.length > 50 ? 'chunked' : 'single-batch',
        estimatedDuration: Math.ceil(employeeIds.length / 50) * 2 // Rough estimate in seconds
      }
    }

  } catch (error) {
    console.error('Validation error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error validating bulk edit request'
    })
  }
})
