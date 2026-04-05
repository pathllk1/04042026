import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, HeadingLevel, Packer } from 'docx'
import { defineEventHandler, readBody, createError } from 'h3'
import { Wage } from '../../models/Wage'
import { MasterRoll } from '../../models/MasterRoll'
import Firm from '../../models/Firm'
import JSZip from 'jszip'

export default defineEventHandler(async (event) => {
  try {
    // Get user ID and firm ID from context (set by auth middleware)
    const userId = event.context.userId
    const firmId = event.context.user.firmId

    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }

    // Get request body
    const { month, employeeIds } = await readBody(event)

    if (!month) {
      throw createError({
        statusCode: 400,
        message: 'Month is required'
      })
    }

    // Get firm details
    const firm = await Firm.findById(firmId)
    if (!firm) {
      throw createError({
        statusCode: 404,
        message: 'Firm not found'
      })
    }

    // Parse month to create date range
    const [year, monthNum] = month.split('-')
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0) // Last day of month

    // Build query
    let query = {
      firmId,
      salary_month: {
        $gte: startDate,
        $lte: endDate
      }
    }

    // If specific employee IDs are provided, filter by them
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      query['masterRollId'] = { $in: employeeIds }
    }

    // Get wage records
    const wages = await Wage.find(query).lean()

    if (wages.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No wage records found for the specified month'
      })
    }

    // Get all employee IDs from wages
    const masterRollIds = wages.map(wage => wage.masterRollId)

    // Get employee details
    const employees = await MasterRoll.find({
      _id: { $in: masterRollIds }
    }).lean()

    // Create a map of employee IDs to employee details
    const employeeMap = {}
    employees.forEach(emp => {
      employeeMap[emp._id.toString()] = emp
    })

    // Create a ZIP file to hold all the salary slips
    const zip = new JSZip()

    // Generate salary slips for each wage record
    for (const wage of wages) {
      const employee = employeeMap[wage.masterRollId.toString()]
      if (!employee) continue // Skip if employee not found

      // Generate salary slip
      const doc = await generateSalarySlip(wage, employee, firm)

      // Convert to buffer
      const buffer = await Packer.toBuffer(doc)

      // Add to ZIP file
      const fileName = `salary-slip-${wage.employeeName.replace(/\s+/g, '_')}.docx`
      zip.file(fileName, buffer)
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Set response headers
    event.node.res.setHeader('Content-Type', 'application/zip')
    event.node.res.setHeader('Content-Disposition', `attachment; filename=salary-slips-${month}.zip`)

    return zipBuffer
  } catch (error) {
    console.error('Error generating salary slips:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating salary slips'
    })
  }
})

// Function to generate a salary slip document
async function generateSalarySlip(wage, employee, firm) {
  // Format date
  const salaryMonth = new Date(wage.salary_month)
  const monthName = salaryMonth.toLocaleString('default', { month: 'long' })
  const year = salaryMonth.getFullYear()

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header with company name
          new Paragraph({
            text: firm.name.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),

          // Salary slip title
          new Paragraph({
            text: `SALARY SLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${year}`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 200,
            },
          }),

          // Employee details table
          new Table({
            width: {
              size: 100,
              type: 'pct',
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: [
              // Employee details row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Employee Name")],
                    width: { size: 25, type: 'pct' },
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.employeeName)],
                    width: { size: 25, type: 'pct' },
                  }),
                  new TableCell({
                    children: [new Paragraph("Bank")],
                    width: { size: 25, type: 'pct' },
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.bank)],
                    width: { size: 25, type: 'pct' },
                  }),
                ],
              }),
              // Account details row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Account No.")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.accountNo)],
                  }),
                  new TableCell({
                    children: [new Paragraph("IFSC")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.ifsc)],
                  }),
                ],
              }),
              // Project details row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Project")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.project || "N/A")],
                  }),
                  new TableCell({
                    children: [new Paragraph("Site")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.site || "N/A")],
                  }),
                ],
              }),
            ],
          }),

          // Spacing
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),

          // Salary details table
          new Table({
            width: {
              size: 100,
              type: 'pct',
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: [
              // Header row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      text: "Earnings",
                      alignment: AlignmentType.CENTER,
                      heading: HeadingLevel.HEADING_4,
                    })],
                    columnSpan: 2,
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      text: "Deductions",
                      alignment: AlignmentType.CENTER,
                      heading: HeadingLevel.HEADING_4,
                    })],
                    columnSpan: 2,
                  }),
                ],
              }),
              // Salary details row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Per Day Wage")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${wage.pDayWage.toFixed(2)}`)],
                  }),
                  new TableCell({
                    children: [new Paragraph("EPF Deduction")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${wage.epf_deduction.toFixed(2)}`)],
                  }),
                ],
              }),
              // Days and ESIC row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Working Days")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`${wage.wage_Days}`)],
                  }),
                  new TableCell({
                    children: [new Paragraph("ESIC Deduction")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${wage.esic_deduction.toFixed(2)}`)],
                  }),
                ],
              }),
              // Gross salary and other deduction row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Gross Salary")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${wage.gross_salary.toFixed(2)}`)],
                  }),
                  new TableCell({
                    children: [new Paragraph("Other Deduction")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${(wage.other_deduction || 0).toFixed(2)}`)],
                  }),
                ],
              }),
              // Other benefit and advance recovery row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Other Benefit")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${(wage.other_benefit || 0).toFixed(2)}`)],
                  }),
                  new TableCell({
                    children: [new Paragraph("Advance Recovery")],
                  }),
                  new TableCell({
                    children: [new Paragraph(`₹${(wage.advance_recovery || 0).toFixed(2)}`)],
                  }),
                ],
              }),
              // Total row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      text: "Total Earnings",
                      heading: HeadingLevel.HEADING_4,
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      text: `₹${(wage.gross_salary + (wage.other_benefit || 0)).toFixed(2)}`,
                      style: "strong",
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      text: "Total Deductions",
                      heading: HeadingLevel.HEADING_4,
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      text: `₹${(wage.epf_deduction + wage.esic_deduction + (wage.other_deduction || 0) + (wage.advance_recovery || 0)).toFixed(2)}`,
                      style: "strong",
                    })],
                  }),
                ],
              }),
            ],
          }),

          // Spacing
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),

          // Net salary
          new Table({
            width: {
              size: 100,
              type: 'pct',
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      text: "Net Salary",
                      heading: HeadingLevel.HEADING_3,
                    })],
                    width: { size: 50, type: 'pct' },
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      text: `₹${wage.net_salary.toFixed(2)}`,
                      style: "strong",
                    })],
                    width: { size: 50, type: 'pct' },
                  }),
                ],
              }),
            ],
          }),

          // Spacing
          new Paragraph({
            text: "",
            spacing: {
              after: 400,
            },
          }),

          // Payment details
          new Paragraph({
            text: "Payment Details",
            heading: HeadingLevel.HEADING_3,
          }),

          new Table({
            width: {
              size: 100,
              type: 'pct',
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Payment Date")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.paid_date ? new Date(wage.paid_date).toLocaleDateString() : "Not paid yet")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Cheque No.")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.cheque_no || "N/A")],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Paid From Bank A/c")],
                  }),
                  new TableCell({
                    children: [new Paragraph(wage.paid_from_bank_ac || "N/A")],
                  }),
                ],
              }),
            ],
          }),

          // Spacing
          new Paragraph({
            text: "",
            spacing: {
              after: 400,
            },
          }),

          // Signature
          new Paragraph({
            text: "Authorized Signatory",
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  return doc;
}
