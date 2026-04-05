import { defineEventHandler } from 'h3';
import PDFDocument from 'pdfkit';
import { MasterRoll } from '../../models/MasterRoll';

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

    // Define month format for dates
    const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Appointment Letter - ${employee.employeeName}`,
        Author: 'HR Department',
        Subject: 'Appointment Letter',
        Keywords: 'appointment, letter, employment',
      },
    });

    // Set the response headers
    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(
      event,
      'Content-Disposition',
      `inline; filename="Appointment_Letter_${employee.employeeName.replace(/\s+/g, '_')}.pdf"`
    );

    // Pipe the PDF to the response
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Set font and default font size
    doc.font('Helvetica');
    doc.fontSize(10);

    // Define page dimensions and margins
    const pageWidth = 595.28; // A4 width in points
    const leftMargin = 72;
    const rightMargin = 72;
    const topMargin = 80;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    // Reference number only (no date)
    doc.text(`Ref: HR/APPT/${new Date().getFullYear()}/${employee._id.toString().slice(-5)}`, leftMargin, topMargin);

    // Title - centered with blue color
    doc.moveDown(2);
    doc.fontSize(16);
    doc.font('Helvetica-Bold');
    doc.fillColor('#0066cc'); // Blue color for title

    // Add the title text centered with absolute positioning
    const titleY = doc.y;

    // Draw a background rectangle for the title (optional)
    // doc.rect(leftMargin, titleY - 5, contentWidth, 30).fill('#f0f4ff');

    // Add the title with explicit positioning
    doc.fontSize(18); // Increase font size for better visibility
    doc.text('APPOINTMENT LETTER', leftMargin, titleY, {
      align: 'center',
      width: contentWidth,
      characterSpacing: 1,
      underline: true // Add underline for emphasis
    });

    // Reset to black for remaining text
    doc.fillColor('black');
    doc.font('Helvetica');
    doc.fontSize(10);

    // Addressee
    doc.moveDown(1.5);
    doc.text('To,', leftMargin);
    doc.moveDown(0.5);
    doc.text(employee.employeeName, leftMargin);
    doc.text(`S/o ${employee.fatherHusbandName}`, leftMargin);

    // Format address with proper line breaks
    const addressParts = employee.address.split(',').map((part: string) => part.trim());
    doc.text(addressParts.join(', '), leftMargin, doc.y, {
      width: contentWidth,
      align: 'left'
    });

    // Salutation
    doc.moveDown(1);
    doc.text(`Dear ${employee.employeeName},`, leftMargin);

    // Introduction
    doc.moveDown(0.5);

    // Format the joining date
    const joiningDate = employee.dateOfJoining ? new Date(employee.dateOfJoining) : new Date();
    const formattedJoiningDate = `${joiningDate.getDate()} ${longMonths[joiningDate.getMonth()]} ${joiningDate.getFullYear()}`;

    // Get the employee's category (designation) or default to 'UNSKILLED'
    const designation = employee.category || 'UNSKILLED';

    doc.text(
      `With reference to your application and subsequent interview, we are pleased to offer you the position of "${designation.toUpperCase()}" in our organization effective from ${formattedJoiningDate}.`,
      leftMargin,
      doc.y,
      { width: contentWidth }
    );

    // Terms and conditions
    doc.moveDown(0.5);
    doc.text('Your employment will be subject to the following terms and conditions:', leftMargin, doc.y, {
      width: contentWidth,
    });

    // Calculate monthly salary based on per day wage
    const perDayWage = employee.pDayWage || 0;
    const workingDays = 26; // Standard working days per month
    const monthlySalary = perDayWage * workingDays;
    const formattedSalary = monthlySalary.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Bullet points for terms
    const bulletPoints = [
      `Designation: You will be designated as "${designation.toUpperCase()}".`,
      `Salary: Your gross salary will be Rs. ${formattedSalary} per month. Statutory deductions will be made as per government regulations.`,
      'Probation: You will be on probation for a period of three months from the date of joining.',
      'Working Hours: Standard working hours are 8 hours per day, 6 days a week.',
      'Leave: You will be entitled to leaves as per company policy.',
      'Notice Period: During probation, employment can be terminated by either party with 7 days\' notice. Post probation, notice period will be 30 days.',
      'Code of Conduct: You will be governed by the company\'s policies, rules, and regulations in force.',
      'Required Documents:',
      '1. Bank account details for salary transfer',
      '2. Previous UAN & ESIC number (if any)',
      '3. PAN card/Aadhaar card',
      '4. Two passport-sized photographs',
      '5. Copies of educational certificates',
      '6. ID and address proof',
      '7. Previous employment relieving letter (if applicable)',
    ];

    // Add bullet points
    doc.moveDown(0.5);
    bulletPoints.forEach((point) => {
      if (point.match(/^\d+\./)) {
        // Numbered list items (for Required Documents)
        doc.text(point, leftMargin + 15, doc.y, { width: contentWidth - 15 });
      } else {
        // Main points
        doc.text(`- ${point}`, leftMargin, doc.y, { width: contentWidth });
      }
      doc.moveDown(0.5);
    });

    // Closing
    doc.moveDown(0.5);
    doc.text(
      'Please sign and return the duplicate copy of this letter as a token of your acceptance of the above terms and conditions. We welcome you to our organization and look forward to a long and mutually beneficial association.',
      leftMargin,
      doc.y,
      { width: contentWidth }
    );

    // Company name and signature
    doc.moveDown(2);
    doc.text('For PRAKASH ENTERPRISE', leftMargin);

    // Signature line
    doc.moveDown(1);
    doc.text('Authorized Signatory', leftMargin);

    // Acceptance line - positioned on the right side
    const acceptanceX = pageWidth - 200;
    doc.text('I accept the terms and conditions', acceptanceX, doc.y, { width: 200, align: 'center' });

    // Employee signature line
    doc.moveDown(2);
    doc.text(`(${employee.employeeName})`, acceptanceX, doc.y, { width: 200, align: 'center' });

    // Finalize the PDF
    doc.end();

    // Return the response
    return new Promise((resolve) => {
      doc.on('end', () => {
        // @ts-ignore - Buffer.concat works with Buffer[] in this context
        resolve(Buffer.concat(chunks));
      });
    });
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
