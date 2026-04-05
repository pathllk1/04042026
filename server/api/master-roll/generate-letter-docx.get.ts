import { defineEventHandler } from 'h3';
import { MasterRoll } from '../../models/MasterRoll';
import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer, PageNumber, PageNumberFormat, ImageRun, ExternalHyperlink, Tab, TabStopPosition, TabStopType, LevelFormat, convertInchesToTwip, UnderlineType, Packer } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

export default defineEventHandler(async (event) => {
  try {
    // Get the employee ID from the query parameters
    const query = getQuery(event);
    const employeeId = query.employeeId as string;

    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    // Find the employee by ID using the MasterRoll model
    const employee = await MasterRoll.findById(employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Convert Mongoose document to plain object with type safety
    const employeeData = employee.toObject() as {
      _id: { toString: () => string };
      employeeName: string;
      fatherHusbandName: string;
      dateOfJoining: Date;
      address: string;
      category?: string;
      pDayWage?: number;
    };

    // Define month format for dates
    const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Format the joining date
    const joiningDate = employeeData.dateOfJoining ? new Date(employeeData.dateOfJoining) : new Date();
    const formattedJoiningDate = `${joiningDate.getDate()} ${longMonths[joiningDate.getMonth()]} ${joiningDate.getFullYear()}`;

    // Get the employee's category (designation) or default to 'UNSKILLED'
    const designation = employeeData.category || 'UNSKILLED';

    // Calculate monthly salary based on per day wage
    const perDayWage = employeeData.pDayWage || 0;
    const workingDays = 26; // Standard working days per month
    const monthlySalary = perDayWage * workingDays;
    const formattedSalary = monthlySalary.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');

    // Create a new document
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              size: 22, // 11pt
              font: "Calibri",
            },
            paragraph: {
              spacing: {
                line: 240, // 1.0 line spacing
              },
            },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              size: 28, // 14pt
              bold: true,
              color: "0066CC", // Blue color
              font: "Calibri",
            },
            paragraph: {
              spacing: {
                before: 240, // 12pt before
                after: 120, // 6pt after
              },
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 8.27 * 1440, // A4 width in points (8.27 inches)
                height: 11.69 * 1440, // A4 height in points (11.69 inches)
              },
              margin: {
                top: 1080, // 0.75 inch
                right: 720, // 0.5 inch
                bottom: 1080, // 0.75 inch
                left: 720, // 0.5 inch
              },
            },
          },
          children: [
            // Reference number
            new Paragraph({
              text: `Ref: HR/APPT/${new Date().getFullYear()}/${employeeData._id.toString().slice(-5)}`,
              spacing: {
                after: 240, // 12pt spacing after
              },
            }),

            // Title - centered with blue color
            new Paragraph({
              text: "APPOINTMENT LETTER",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: {
                before: 240, // 12pt spacing before
                after: 240, // 12pt spacing after
              },
              border: {
                bottom: {
                  color: "auto",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
            }),

            // Addressee
            new Paragraph({
              text: "To,",
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),
            new Paragraph({
              text: employeeData.employeeName,
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),
            new Paragraph({
              text: `S/o ${employeeData.fatherHusbandName}`,
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),
            new Paragraph({
              text: employeeData.address,
              spacing: {
                after: 240, // 12pt spacing after
              },
            }),

            // Salutation
            new Paragraph({
              text: `Dear ${employeeData.employeeName},`,
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),

            // Introduction
            new Paragraph({
              text: `With reference to your application and subsequent interview, we are pleased to offer you the position of "${designation.toUpperCase()}" in our organization effective from ${formattedJoiningDate}.`,
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),

            // Terms and conditions
            new Paragraph({
              text: "Your employment will be subject to the following terms and conditions:",
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),

            // Bullet points for terms
            new Paragraph({
              text: `Designation: You will be designated as "${designation.toUpperCase()}".`,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: `Salary: Your gross salary will be Rs. ${formattedSalary} per month. Statutory deductions will be made as per government regulations.`,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Probation: You will be on probation for a period of three months from the date of joining.",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Working Hours: Standard working hours are 8 hours per day, 6 days a week.",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Leave: You will be entitled to leaves as per company policy.",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Notice Period: During probation, employment can be terminated by either party with 7 days' notice. Post probation, notice period will be 30 days.",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Code of Conduct: You will be governed by the company's policies, rules, and regulations in force.",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Required Documents:",
              bullet: {
                level: 0,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Bank account details for salary transfer",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Previous UAN & ESIC number (if any)",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "PAN card/Aadhaar card",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Two passport-sized photographs",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Copies of educational certificates",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "ID and address proof",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Previous employment relieving letter (if applicable)",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 0, // 0pt spacing after
              },
            }),
            new Paragraph({
              text: "Police verification certificate (not older than 6 months)",
              bullet: {
                level: 1,
              },
              spacing: {
                after: 400, // 20pt spacing after
              },
            }),

            // Conclusion
            new Paragraph({
              text: "Please sign and return the duplicate copy of this letter as a token of your acceptance of the above terms and conditions.",
              spacing: {
                after: 120, // 6pt spacing after
              },
            }),
            new Paragraph({
              text: "We welcome you to our organization and look forward to a long and mutually beneficial association.",
              spacing: {
                after: 240, // 12pt spacing after
              },
            }),

            // No acceptance paragraph here - moved to employee signature cell

            // Create a table for signatures with two columns
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows: [
                new TableRow({
                  children: [
                    // Left column - Employer signature
                    new TableCell({
                      width: {
                        size: 50,
                        type: WidthType.PERCENTAGE,
                      },
                      children: [
                        new Paragraph({
                          text: "For PRAKASH ENTERPRISE",
                          spacing: {
                            after: 120, // 6pt spacing after
                          },
                        }),
                        new Paragraph({
                          text: "Authorized Signatory",
                          spacing: {
                            after: 0,
                          },
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                    }),
                    // Right column - Employee signature
                    new TableCell({
                      width: {
                        size: 50,
                        type: WidthType.PERCENTAGE,
                      },
                      children: [
                        new Paragraph({
                          text: "I have read and understood the terms and conditions of my employment and hereby accept the same.",
                          spacing: {
                            after: 120, // 6pt spacing after
                          },
                        }),
                        new Paragraph({
                          text: "Date: ________________",
                          spacing: {
                            after: 120, // 6pt spacing after
                          },
                        }),
                        new Paragraph({
                          text: "Signature: ________________",
                          spacing: {
                            after: 120, // 6pt spacing after
                          },
                        }),
                        new Paragraph({
                          text: `(${employeeData.employeeName})`,
                          spacing: {
                            after: 0,
                          },
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    // Generate the document as a buffer using Packer
    const buffer = await Packer.toBuffer(doc);

    // Set the response headers
    setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="Appointment_Letter_${employeeData.employeeName.replace(/\\s+/g, '_')}.docx"`
    );

    // Return the buffer
    return buffer;
  } catch (error: any) {
    console.error('Error generating appointment letter:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to generate appointment letter: ${error.message}`,
    });
  }
});

// Helper functions for h3
function getQuery(event: any) {
  return event.node.req.url ? Object.fromEntries(new URL(event.node.req.url, 'http://localhost').searchParams) : {};
}

function setResponseHeader(event: any, name: string, value: string) {
  event.node.res.setHeader(name, value);
}

function createError(options: { statusCode: number; statusMessage: string }) {
  const error = new Error(options.statusMessage);
  (error as any).statusCode = options.statusCode;
  return error;
}
