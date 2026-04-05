import PDFDocument from 'pdfkit';

export class IntelligentPDFGenerator {
  static async generate(aiOptimizedStructure: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Generating PDF document with AI-optimized structure');

        const doc = new PDFDocument({
          size: aiOptimizedStructure.documentSettings?.pageSize || 'A4',
          margins: aiOptimizedStructure.documentSettings?.margins || {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          },
          info: {
            Title: aiOptimizedStructure.metadata?.title || undefined,
            Author: aiOptimizedStructure.metadata?.author || undefined,
            Creator: 'AI Document Intelligence System',
            CreationDate: new Date(aiOptimizedStructure.metadata?.created || Date.now())
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('PDF generation completed successfully');
          resolve(pdfBuffer);
        });

        doc.on('error', (error) => {
          console.error('PDF generation error:', error);
          reject(error);
        });

        // Process pages as determined by AI
        let isFirstPage = true;
        
        for (const pageConfig of aiOptimizedStructure.pages || []) {
          console.log(`Processing PDF page ${pageConfig.pageNumber || 'unknown'}`);

          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Add page header if specified by AI
          if (pageConfig.header) {
            doc.fontSize(10)
               .fillColor('#666666')
               .text(pageConfig.header, 50, 30, { align: 'center' });
          }

          // Process elements as determined by AI
          for (const element of pageConfig.elements || []) {
            this.addElement(doc, element);
          }

          // Add page footer if specified by AI
          if (pageConfig.footer) {
            const pageHeight = doc.page.height;
            doc.fontSize(10)
               .fillColor('#666666')
               .text(pageConfig.footer, 50, pageHeight - 30, { align: 'center' });
          }

          // Add page numbers
          const pageHeight = doc.page.height;
          const pageWidth = doc.page.width;
          doc.fontSize(10)
             .fillColor('#666666')
             .text(`Page ${pageConfig.pageNumber || doc.bufferedPageRange().count}`, 
                    pageWidth - 100, pageHeight - 30, { align: 'right' });
        }

        // REAL DATA ONLY - No default/fallback content allowed
        if (!aiOptimizedStructure.pages || aiOptimizedStructure.pages.length === 0) {
          console.error('🚨 [PDF GEN] No pages defined by AI and no fallback content allowed (real data only requirement)');
          throw new Error('PDF generation failed: No pages defined by AI and no fallback content is allowed');
        }

        doc.end();

      } catch (error) {
        console.error('PDF generation failed:', error);
        reject(new Error(`PDF generation failed: ${error.message}`));
      }
    });
  }

  private static addElement(doc: PDFKit.PDFDocument, element: any): void {
    try {
      const x = element.position?.x || 50;
      const y = element.position?.y || 100;
      const width = element.size?.width || 500;
      const height = element.size?.height || 20;

      // Apply styling from AI recommendations
      if (element.style) {
        if (element.style.fontSize) {
          doc.fontSize(element.style.fontSize);
        }
        if (element.style.color) {
          doc.fillColor(element.style.color);
        }
        if (element.style.font) {
          // PDFKit supports limited fonts, use closest match
          const fontFamily = this.mapFontFamily(element.style.font);
          if (fontFamily) {
            doc.font(fontFamily);
          }
        }
      }

      switch (element.type) {
        case 'text':
          this.addText(doc, element, x, y, width);
          break;
        case 'table':
          this.addTable(doc, element, x, y, width);
          break;
        case 'list':
          this.addList(doc, element, x, y, width);
          break;
        case 'line':
          this.addLine(doc, element, x, y, width);
          break;
        case 'rectangle':
          this.addRectangle(doc, element, x, y, width, height);
          break;
        case 'image':
          // Image handling would require additional setup
          console.log('Image element detected but not implemented');
          break;
        default:
          // REAL DATA ONLY - No fallback content allowed
          throw new Error(`Unknown PDF element type: ${element.type} - No fallback processing allowed`);
      }
    } catch (elementError) {
      console.error('Failed to add PDF element:', elementError);
      // REAL DATA ONLY - No fallback content allowed
      throw new Error(`Failed to process PDF element: ${elementError.message} - No fallback content allowed`);
    }
  }

  private static addText(doc: PDFKit.PDFDocument, element: any, x: number, y: number, width: number): void {
    const options: any = {
      width: width,
      align: element.style?.alignment || 'left'
    };

    if (element.style?.bold) {
      doc.font('Helvetica-Bold');
    } else if (element.style?.italic) {
      doc.font('Helvetica-Oblique');
    } else {
      doc.font('Helvetica');
    }

    doc.text(element.content || '', x, y, options);
  }

  private static addTable(doc: PDFKit.PDFDocument, element: any, x: number, y: number, width: number): void {
    if (!element.data || !Array.isArray(element.data)) {
      return;
    }

    const tableData = element.data;
    const rowHeight = 25;
    const colWidth = width / (tableData[0]?.length || 1);

    let currentY = y;

    // Draw table rows
    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      let currentX = x;

      // Draw row background for header
      if (rowIndex === 0) {
        doc.fillColor('#f0f0f0')
           .rect(x, currentY, width, rowHeight)
           .fill();
        doc.fillColor('#000000');
      }

      // Draw cells
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cellValue = String(row[colIndex] || '');
        
        // Draw cell border
        doc.rect(currentX, currentY, colWidth, rowHeight).stroke();
        
        // Draw cell text
        doc.fontSize(10)
           .text(cellValue, currentX + 5, currentY + 5, {
             width: colWidth - 10,
             height: rowHeight - 10,
             align: 'left'
           });

        currentX += colWidth;
      }

      currentY += rowHeight;
    }
  }

  private static addLine(doc: PDFKit.PDFDocument, element: any, x: number, y: number, width: number): void {
    const endX = x + width;
    const lineWidth = element.style?.lineWidth || 1;
    const color = element.style?.color || '#000000';

    doc.strokeColor(color)
       .lineWidth(lineWidth)
       .moveTo(x, y)
       .lineTo(endX, y)
       .stroke();
  }

  private static addRectangle(doc: PDFKit.PDFDocument, element: any, x: number, y: number, width: number, height: number): void {
    const fillColor = element.style?.fillColor;
    const strokeColor = element.style?.strokeColor || '#000000';
    const lineWidth = element.style?.lineWidth || 1;

    doc.lineWidth(lineWidth)
       .strokeColor(strokeColor);

    if (fillColor) {
      doc.fillColor(fillColor)
         .rect(x, y, width, height)
         .fillAndStroke();
    } else {
      doc.rect(x, y, width, height)
         .stroke();
    }
  }

  private static addList(doc: PDFKit.PDFDocument, element: any, x: number, y: number, width: number): void {
    const fontSize = element.style?.fontSize || 12;
    const color = element.style?.color || '#000000';
    const lineHeight = fontSize * 1.2;

    // Set font properties
    doc.fontSize(fontSize).fillColor(color);

    let currentY = y;

    // Handle list items
    if (element.items && Array.isArray(element.items)) {
      element.items.forEach((item: any, index: number) => {
        const bulletPoint = element.listType === 'ordered' ? `${index + 1}.` : '•';
        const itemText = typeof item === 'string' ? item : item.text || item.content || '';

        // Add bullet point
        doc.text(bulletPoint, x, currentY, { width: 20, align: 'left' });

        // Add item text
        doc.text(itemText, x + 25, currentY, { width: width - 25, align: 'left' });

        currentY += lineHeight;
      });
    } else if (element.content) {
      // Handle content as a single list item
      const itemText = typeof element.content === 'string' ? element.content : String(element.content);
      doc.text('• ' + itemText, x, currentY, { width: width, align: 'left' });
    }
  }

  private static mapFontFamily(fontFamily: string): string | null {
    const fontMap: { [key: string]: string } = {
      'arial': 'Helvetica',
      'helvetica': 'Helvetica',
      'times': 'Times-Roman',
      'times new roman': 'Times-Roman',
      'courier': 'Courier',
      'courier new': 'Courier'
    };

    const normalizedFont = fontFamily.toLowerCase();
    return fontMap[normalizedFont] || 'Helvetica';
  }
}
