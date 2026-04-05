import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {
  try {
    // Initialize a new Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    // Define the headers with their requirement status
    const headers = [
      { header: 'EMPLOYEE_NAME', key: 'employeeName', required: true },
      { header: "FATHER'S/HUSBAND NAME", key: 'fatherHusbandName', required: true },
      { header: 'DOB', key: 'dateOfBirth', required: true },
      { header: 'AADHAR', key: 'aadhar', required: true },
      { header: 'PAN', key: 'pan', required: false },
      { header: 'PHONE NO', key: 'phoneNo', required: true },
      { header: 'ADDRESS', key: 'address', required: true },
      { header: 'BANK', key: 'bank', required: true },
      { header: 'BRANCH', key: 'branch', required: false },
      { header: 'A/C NO', key: 'accountNo', required: true },
      { header: 'IFSC', key: 'ifsc', required: true },
      { header: 'UAN', key: 'uan', required: false },
      { header: 'ESIC NO', key: 'esicNo', required: false },
      { header: 's_kalyan_no', key: 'sKalyanNo', required: false },
      { header: 'category', key: 'category', required: false },
      { header: 'P_DAY_WAGE', key: 'pDayWage', required: false },
      { header: 'project', key: 'project', required: false },
      { header: 'site', key: 'site', required: false },
      { header: 'D.O.J', key: 'dateOfJoining', required: true },
      { header: 'D.O.E', key: 'dateOfExit', required: false },
      { header: 'doe_rem', key: 'doeRem', required: false }
    ];

    // Add columns to the worksheet
    worksheet.columns = headers.map(header => ({
      header: header.header,
      key: header.key,
      width: 20 // Default width
    }));

    // Apply header styles based on requirement
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];

      // Common styles for all headers
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }; // White font

      // Different background colors based on requirement
      if (header.required) {
        // Red background for required fields
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0000' } // Red
        };
      } else {
        // Orange background for optional fields
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFA500' } // Orange
        };
      }

      // Add borders
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add a sample row with empty values and date format examples
    worksheet.addRow({
      DOB: '10-02-1978', // Example date in DD-MM-YYYY format
      'D.O.J': '01-04-2023', // Example date in DD-MM-YYYY format
    });

    // Add a note about date formats
    const noteRow = worksheet.addRow(['NOTE: All dates must be in DD-MM-YYYY format (e.g., 10-02-1978 for February 10, 1978)']);
    worksheet.mergeCells(`A${noteRow.number}:U${noteRow.number}`);
    noteRow.font = { bold: true, color: { argb: 'FF0000' } }; // Red text
    noteRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' } // Yellow background
    };

    // Apply border styles to all cells
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers to download the file
    setHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=MasterRollTemplate.xlsx'
    });

    return buffer;
  } catch (error) {
    console.error('Error generating template:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate template'
    });
  }
});