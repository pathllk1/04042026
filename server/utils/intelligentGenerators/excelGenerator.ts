import ExcelJS from 'exceljs';

export class IntelligentExcelGenerator {
  static async generate(aiOptimizedStructure: any): Promise<Buffer> {
    try {
      console.log('Generating Excel document with AI-optimized structure');
      
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook properties from AI recommendations
      if (aiOptimizedStructure.workbookProperties) {
        workbook.creator = aiOptimizedStructure.workbookProperties.author || undefined;
        workbook.title = aiOptimizedStructure.workbookProperties.title || undefined;
        workbook.created = new Date(aiOptimizedStructure.workbookProperties.created || Date.now());
        workbook.modified = new Date();
      }

      // Process each sheet as determined by AI
      for (const sheetConfig of aiOptimizedStructure.sheets || []) {
        console.log(`Creating Excel sheet: ${sheetConfig.name}`);
        
        const worksheet = workbook.addWorksheet(sheetConfig.name);

        // Set column widths as suggested by AI
        if (sheetConfig.columnWidths) {
          Object.entries(sheetConfig.columnWidths).forEach(([col, width]) => {
            worksheet.getColumn(col).width = width as number;
          });
        }

        // Set row heights as suggested by AI
        if (sheetConfig.rowHeights) {
          Object.entries(sheetConfig.rowHeights).forEach(([row, height]) => {
            worksheet.getRow(parseInt(row)).height = height as number;
          });
        }

        // Process cells with AI-determined content and formatting
        for (const cellConfig of sheetConfig.cells || []) {
          const cell = worksheet.getCell(cellConfig.address);
          
          // Set cell value or formula as determined by AI
          if (cellConfig.formula) {
            cell.value = { formula: cellConfig.formula };
          } else {
            cell.value = cellConfig.value;
          }

          // Apply AI-suggested formatting
          if (cellConfig.formatting) {
            const formatting = cellConfig.formatting;
            
            // Font formatting
            if (formatting.font) {
              cell.font = {
                name: formatting.font.name || 'Calibri',
                size: formatting.font.size || 11,
                bold: formatting.font.bold || false,
                italic: formatting.font.italic || false,
                color: formatting.font.color ? { argb: formatting.font.color } : undefined
              };
            }

            // Alignment
            if (formatting.alignment) {
              cell.alignment = {
                horizontal: formatting.alignment.horizontal || 'left',
                vertical: formatting.alignment.vertical || 'middle',
                wrapText: formatting.alignment.wrapText || false
              };
            }

            // Border
            if (formatting.border) {
              cell.border = {
                top: { style: formatting.border.style || 'thin' },
                left: { style: formatting.border.style || 'thin' },
                bottom: { style: formatting.border.style || 'thin' },
                right: { style: formatting.border.style || 'thin' }
              };
            }

            // Fill/Background color
            if (formatting.fill) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: formatting.fill }
              };
            }

            // Number format
            if (formatting.numberFormat) {
              cell.numFmt = formatting.numberFormat;
            }
          }
        }

        // Add AI-suggested charts
        if (sheetConfig.charts) {
          for (const chartConfig of sheetConfig.charts) {
            try {
              console.log(`Adding chart: ${chartConfig.title}`);
              
              // Note: ExcelJS chart support is limited, but we can add basic charts
              // For more complex charts, we would need additional libraries
              
              // Add chart data preparation here
              // This is a simplified implementation
              if (chartConfig.type && chartConfig.data) {
                // Add chart implementation based on AI recommendations
                // For now, we'll add a comment indicating where the chart should be
                const chartCell = worksheet.getCell(chartConfig.position || 'A1');
                chartCell.note = `Chart: ${chartConfig.title} (${chartConfig.type})`;
              }
            } catch (chartError) {
              console.warn('Chart creation failed:', chartError);
            }
          }
        }

        // Auto-fit columns if not specifically set by AI
        if (!sheetConfig.columnWidths) {
          worksheet.columns.forEach(column => {
            if (column.eachCell) {
              let maxLength = 0;
              column.eachCell({ includeEmpty: false }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                  maxLength = columnLength;
                }
              });
              column.width = Math.min(maxLength + 2, 50); // Cap at 50 characters
            }
          });
        }
      }

      // REAL DATA ONLY - No default/fallback content allowed
      if (workbook.worksheets.length === 0) {
        console.error('🚨 [EXCEL GEN] No sheets defined by AI and no fallback content allowed (real data only requirement)');
        throw new Error('Excel generation failed: No sheets defined by AI and no fallback content is allowed');
      }

      console.log('Excel generation completed successfully');
      return await workbook.xlsx.writeBuffer() as Buffer;
      
    } catch (error) {
      console.error('Excel generation failed:', error);
      throw new Error(`Excel generation failed: ${error.message}`);
    }
  }

  // Helper method to convert AI color format to Excel format
  private static convertColor(color: string): string {
    if (!color) throw new Error('Color value required - no default colors allowed (real data only requirement)');
    
    // Remove # if present and ensure 8 characters (ARGB format)
    color = color.replace('#', '');
    if (color.length === 6) {
      color = 'FF' + color; // Add alpha channel
    }
    return color.toUpperCase();
  }

  // Helper method to determine Excel column letter from number
  private static getColumnLetter(columnNumber: number): string {
    let columnLetter = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return columnLetter;
  }
}
