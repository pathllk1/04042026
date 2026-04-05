import { MasterRoll } from '../../models/MasterRoll';
import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {

  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;

    const data = await MasterRoll.find({ userId }).lean();

    // Initialize a new Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('MasterRoll Data');

    // Add columns (Adjust headers and keys based on your model fields)
    worksheet.columns = [
      { header: 'Employee Name', key: 'employeeName', width: 20 },
      { header: 'Father/Husband Name', key: 'fatherHusbandName', width: 20 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
      { header: 'Aadhar', key: 'aadhar', width: 15 },
      { header: 'PAN', key: 'pan', width: 15 },
      { header: 'Phone No', key: 'phoneNo', width: 15 },
      { header: 'Address', key: 'address', width: 25 },
      { header: 'Bank', key: 'bank', width: 15 },
      { header: 'Branch', key: 'branch', width: 15 },
      { header: 'Account No', key: 'accountNo', width: 20 },
      { header: 'IFSC', key: 'ifsc', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Project', key: 'project', width: 20 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Date of Joining', key: 'dateOfJoining', width: 15 },
      { header: 'Date of Exit', key: 'dateOfExit', width: 15 },
    ];

    // Apply header styles
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }; // White font
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0070C0' }, // Blue background
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Add rows to the worksheet
    data.forEach((item) => {
      worksheet.addRow({
        employeeName: item.employeeName,
        fatherHusbandName: item.fatherHusbandName,
        dateOfBirth: item.dateOfBirth,
        aadhar: item.aadhar,
        pan: item.pan,
        phoneNo: item.phoneNo,
        address: item.address,
        bank: item.bank,
        branch: item.branch,
        accountNo: item.accountNo,
        ifsc: item.ifsc,
        category: item.category || 'UNSKILLED',
        project: item.project,
        site: item.site,
        dateOfJoining: item.dateOfJoining,
        dateOfExit: item.dateOfExit,
      });
    });

    // Apply border styles to all rows
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Adjust column widths to fit content dynamically
    worksheet.columns.forEach((column) => {
      let maxLength = 10; // Minimum width
      if (column && column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length + 2); // Add padding
        });
        column.width = maxLength;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers to download the file
    setHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="master_roll.xlsx"',
    });

    return buffer;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error fetching master roll data'
    })
  }
})