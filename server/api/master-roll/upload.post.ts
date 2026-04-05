import { MasterRoll } from '../../models/MasterRoll';
import { createError } from 'h3';
import ExcelJS from 'exceljs';
import { readMultipartFormData } from 'h3';

// Convert Excel date number to JavaScript Date
function excelDateToJSDate(excelDate: number) {
  return new Date(Math.round((excelDate - 25569) * 86400 * 1000))
}

// Parse date string in various formats to JavaScript Date
function parseDate(dateStr: string | number | Date) {
  if (!dateStr) return undefined;

  // If it's already a Date object, return it
  if (dateStr instanceof Date) return dateStr;

  // If it's a number, treat as Excel date
  if (typeof dateStr === 'number') return excelDateToJSDate(dateStr);

  // If it's a string, try various formats
  if (typeof dateStr === 'string') {
    // Try DD-MM-YYYY format (common in India)
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('-').map(Number);
      // Month is 0-indexed in JavaScript Date
      return new Date(year, month - 1, day);
    }

    // Try MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    }

    // Try YYYY-MM-DD format (ISO)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      return new Date(dateStr);
    }

    // Last resort: try standard JavaScript Date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // If all parsing attempts fail, return undefined
  console.warn(`Failed to parse date: ${dateStr}`);
  return undefined;
}

export default defineEventHandler(async (event) => {

  try {
    // Get userId and firmId from the event context (set by auth middleware)
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;

    // Read the uploaded file from multipart form data
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file uploaded'
      })
    }

    const fileField = formData.find(field => field.name === 'file');
    if (!fileField || !fileField.data) {
      throw createError({
        statusCode: 400,
        message: 'No file found in the request'
      })
    }

 // Convert fileField.data to a proper Node.js Buffer
 let fileBuffer: Buffer;
 if (Buffer.isBuffer(fileField.data)) {
   // If it's already a Buffer, use it directly.
   fileBuffer = fileField.data;
 } else {
   // Otherwise, convert it. This handles cases where
   // fileField.data is typed as Buffer<ArrayBuffer> or similar.
   fileBuffer = Buffer.from(new Uint8Array(fileField.data as any));
 }


    // Process the Excel file using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw createError({
        statusCode: 400,
        message: 'No worksheet found in the Excel file'
      })
    }

    // Convert worksheet to JSON
    const jsonData: any[] = [];
    const headers: string[] = [];

    // Extract headers from the first row
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
    });

    // Extract data from rows
    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;

      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        let value = cell.value;

        // Handle date values
        if (cell.type === ExcelJS.ValueType.Date && value instanceof Date) {
          value = value;
        }

        rowData[header] = value;
      });

      // Only add non-empty rows
      if (Object.keys(rowData).length > 0) {
        jsonData.push(rowData);
      }
    });

    if (jsonData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No employees data found in the Excel file'
      })
    }

    // Debug log for first row data with special attention to date fields
    const firstRow = jsonData[0];
    console.log('First row data:', firstRow);
    if (firstRow) {
      console.log('Important fields in first row:');
      console.log('DOB:', firstRow['DOB'], 'Type:', typeof firstRow['DOB']);
      console.log('D.O.J:', firstRow['D.O.J'], 'Type:', typeof firstRow['D.O.J']);
      console.log('D.O.E:', firstRow['D.O.E'], 'Type:', typeof firstRow['D.O.E']);
      console.log('BRANCH:', firstRow['BRANCH'], 'Type:', typeof firstRow['BRANCH']);

      // Test date parsing for first row
      console.log('Parsed DOB:', parseDate(firstRow['DOB']));
      console.log('Parsed D.O.J:', parseDate(firstRow['D.O.J']));
      console.log('Parsed D.O.E:', parseDate(firstRow['D.O.E']));
    }

    const employees = jsonData.map((emp: any, index: number) => {
      // Convert date fields using our robust parseDate function
      const dateOfBirth = parseDate(emp['DOB'])
      const dateOfJoining = parseDate(emp['D.O.J'])
      const dateOfExit = parseDate(emp['D.O.E'])

      const employee = {
        employeeName: emp['EMPLOYEE_NAME*'] || emp['EMPLOYEE_NAME'],
        fatherHusbandName: emp["FATHER'S/HUSBAND NAME*"] || emp["FATHER'S/HUSBAND NAME"] || emp['FATHER_HUSBAND_NAME'],
        dateOfBirth,
        aadhar: (emp['AADHAR*'] || emp['AADHAR'])?.toString(),
        pan: emp['PAN'],
        phoneNo: (emp['PHONE NO*'] || emp['PHONE NO'] || emp['PHONE_NO'])?.toString(),
        address: emp['ADDRESS*'] || emp['ADDRESS'],
        bank: emp['BANK*'] || emp['BANK'],
        branch: emp['BRANCH'], // Add branch field
        accountNo: (emp['A/C NO*'] || emp['A/C NO'] || emp['AC_NO'])?.toString(),
        ifsc: emp['IFSC*'] || emp['IFSC'],
        uan: emp['UAN'],
        esicNo: emp['ESIC NO'],
        sKalyanNo: emp['s_kalyan_no'],
        category: emp['category'] || 'UNSKILLED',
        pDayWage: emp['P_DAY_WAGE'],
        project: emp['project'],
        site: emp['site'],
        dateOfJoining,
        dateOfExit,
        doeRem: emp['doe_rem'],
        userId, // Add userId to each employee record
        firmId, // Add firmId to each employee record
        status: emp['status'] || 'active' // Add status field with default value
      }

      // Validate date fields specifically
      if (emp['DOB'] && !dateOfBirth) {
        throw createError({
          statusCode: 400,
          message: `Row ${index + 1} has an invalid Date of Birth format: "${emp['DOB']}". Please use DD-MM-YYYY format (e.g., 10-02-1978).`
        })
      }

      if (emp['D.O.J'] && !dateOfJoining) {
        throw createError({
          statusCode: 400,
          message: `Row ${index + 1} has an invalid Date of Joining format: "${emp['D.O.J']}". Please use DD-MM-YYYY format (e.g., 10-02-1978).`
        })
      }

      if (emp['D.O.E'] && !dateOfExit) {
        throw createError({
          statusCode: 400,
          message: `Row ${index + 1} has an invalid Date of Exit format: "${emp['D.O.E']}". Please use DD-MM-YYYY format (e.g., 10-02-1978).`
        })
      }

      // Check required fields for each employee
      const requiredFields = {
        'Employee Name': employee.employeeName,
        'Father\'s/Husband Name': employee.fatherHusbandName,
        'Date of Birth': employee.dateOfBirth,
        'Aadhar': employee.aadhar,
        'Phone No': employee.phoneNo,
        'Address': employee.address,
        'Bank': employee.bank,
        'Account No': employee.accountNo,
        'IFSC': employee.ifsc,
        'Date of Joining': employee.dateOfJoining
      }

      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([field]) => field)

      if (missingFields.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Row ${index + 1} is missing required fields: ${missingFields.join(', ')}`
        })
      }

      return employee
    })

    try {
      await MasterRoll.insertMany(employees)

      return {
        message: `Successfully uploaded ${employees.length} employees`
      }
    } catch (dbError: any) {
      // Handle specific MongoDB validation errors
      if (dbError.name === 'ValidationError') {
        // Extract the specific validation error message
        const errorField = Object.keys(dbError.errors)[0];
        const errorMessage = dbError.errors[errorField].message;

        throw createError({
          statusCode: 400,
          message: `Validation error: ${errorMessage}. Please check your data format, especially date fields which should be in DD-MM-YYYY format.`
        });
      }

      // Handle duplicate key errors (e.g., duplicate Aadhar)
      if (dbError.code === 11000) {
        const field = Object.keys(dbError.keyPattern)[0];
        throw createError({
          statusCode: 400,
          message: `Duplicate ${field} found. Each employee must have a unique ${field}.`
        });
      }

      // Re-throw other errors
      throw dbError;
    }
  } catch (error: any) {
    console.error('Upload error details:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error uploading employees'
    })
  }
})
