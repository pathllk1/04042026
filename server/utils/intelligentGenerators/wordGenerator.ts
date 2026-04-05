import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

export class IntelligentWordGenerator {
  static async generate(aiOptimizedStructure: any): Promise<Buffer> {
    try {
      console.log('=== WORD GENERATOR DEBUG START ===');
      console.log('Generating Word document with AI-optimized structure');
      console.log('Full AI Structure:', JSON.stringify(aiOptimizedStructure, null, 2));
      console.log('Structure type:', typeof aiOptimizedStructure);
      console.log('Has sections?', !!aiOptimizedStructure.sections);
      console.log('Sections type:', typeof aiOptimizedStructure.sections);
      console.log('Sections length:', aiOptimizedStructure.sections?.length);

      const sections = [];

      // Handle the actual AI structure format
      const documentSections = aiOptimizedStructure.sections || [];

      // Process each section as determined by AI
      for (let i = 0; i < documentSections.length; i++) {
        const sectionConfig = documentSections[i];
        console.log(`=== PROCESSING SECTION ${i + 1}/${documentSections.length} ===`);
        console.log('Section Config:', JSON.stringify(sectionConfig, null, 2));
        console.log(`Section name: ${sectionConfig.name}, type: ${sectionConfig.type}`);
        console.log('Section content type:', typeof sectionConfig.content);
        console.log('Section content:', sectionConfig.content);

        const sectionChildren = [];

        // Handle different content formats from AI
        if (sectionConfig.content) {
          console.log('Processing content for section:', sectionConfig.name);
          if (Array.isArray(sectionConfig.content)) {
            console.log('Content is array with', sectionConfig.content.length, 'items');
            // If content is an array of content items
            for (let j = 0; j < sectionConfig.content.length; j++) {
              const contentItem = sectionConfig.content[j];
              console.log(`Processing content item ${j + 1}:`, contentItem);
              try {
                const processedItem = this.processContentItem(contentItem);
                sectionChildren.push(processedItem);
                console.log('Successfully processed content item', j + 1);
              } catch (error) {
                console.error(`Error processing content item ${j + 1}:`, error);
                // REAL DATA ONLY - No fallback content allowed
                throw new Error(`Failed to process content item ${j + 1}: ${error.message} - No fallback content allowed`);
              }
            }
          } else if (typeof sectionConfig.content === 'string') {
            console.log('Content is string:', sectionConfig.content);
            // If content is a simple string
            sectionChildren.push(this.createParagraphFromText(sectionConfig.content, sectionConfig.type));
          } else if (typeof sectionConfig.content === 'object') {
            console.log('Content is object:', sectionConfig.content);
            // If content is an object (like table data)
            sectionChildren.push(this.processContentObject(sectionConfig.content, sectionConfig.type));
          }
        } else {
          console.error('🚨 [WORD GEN] No content found for section:', sectionConfig.name);
          // REAL DATA ONLY - No fallback content allowed
          throw new Error(`Section "${sectionConfig.name}" has no content and no fallback content is allowed`);
        }

        // Create section with AI-determined properties
        const section = {
          properties: {
            page: {
              margin: {
                top: sectionConfig.properties?.margins?.top || 1440, // 1 inch in twips
                right: sectionConfig.properties?.margins?.right || 1440,
                bottom: sectionConfig.properties?.margins?.bottom || 1440,
                left: sectionConfig.properties?.margins?.left || 1440,
              },
            },
          },
          headers: sectionConfig.properties?.headers ? {
            default: new Paragraph({
              children: [new TextRun(sectionConfig.properties.headers)],
              alignment: AlignmentType.CENTER,
            }),
          } : undefined,
          footers: sectionConfig.properties?.footers ? {
            default: new Paragraph({
              children: [new TextRun(sectionConfig.properties.footers)],
              alignment: AlignmentType.CENTER,
            }),
          } : undefined,
          children: sectionChildren,
        };

        sections.push(section);
      }

      // REAL DATA ONLY - No default/fallback content allowed
      if (sections.length === 0) {
        console.error('🚨 [WORD GEN] No sections defined by AI and no fallback content allowed (real data only requirement)');
        throw new Error('Word document generation failed: No sections defined by AI and no fallback content is allowed');
      }

      // Create document with AI-determined properties
      const doc = new Document({
        sections: sections,
        title: aiOptimizedStructure.documentProperties?.title || 'AI Generated Document',
        creator: aiOptimizedStructure.documentProperties?.author || 'AI Document Generator',
        description: 'Document generated by AI Document Intelligence System',
        styles: {
          paragraphStyles: [
            {
              id: 'Heading1',
              name: 'Heading 1',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: {
                size: 32, // 16pt
                bold: true,
                color: '2E74B5',
              },
              paragraph: {
                spacing: {
                  after: 240, // 12pt
                  before: 240,
                },
              },
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: {
                size: 26, // 13pt
                bold: true,
                color: '2E74B5',
              },
              paragraph: {
                spacing: {
                  after: 120, // 6pt
                  before: 240,
                },
              },
            },
          ],
        },
      });

      console.log('Word generation completed successfully');
      return await Packer.toBuffer(doc);

    } catch (error) {
      console.error('Word generation failed:', error);
      throw new Error(`Word generation failed: ${error.message}`);
    }
  }

  private static processContentItem(contentItem: any): Paragraph | Table {
    try {
      switch (contentItem.type) {
        case 'heading':
          return this.createHeading(contentItem);
        case 'paragraph':
          return this.createParagraph(contentItem);
        case 'table':
          return this.createTable(contentItem);
        case 'list':
          const listItems = this.createList(contentItem);
          return listItems.length > 0 ? listItems[0] : this.createParagraphFromText('List');
        default:
          // REAL DATA ONLY - No fallback content allowed
          throw new Error(`Unknown content item type: ${contentItem.type} - No fallback processing allowed`);
      }
    } catch (error) {
      console.error('Error processing content item:', error, contentItem);
      // REAL DATA ONLY - No fallback content allowed
      throw new Error(`Failed to process content item: ${error.message} - No fallback content allowed`);
    }
  }

  private static createParagraphFromText(text: string, sectionType?: string): Paragraph {
    const isHeader = sectionType === 'header' || sectionType === 'heading';
    const isSignature = sectionType === 'signature';

    return new Paragraph({
      children: [new TextRun({
        text: text || '',
        bold: isHeader,
        size: isHeader ? 28 : 22, // 14pt for headers, 11pt for normal
      })],
      alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: {
        after: isSignature ? 240 : 120, // More space after signature
        before: isHeader ? 120 : 0,
      },
    });
  }

  private static processContentObject(content: any, sectionType?: string): Paragraph | Table {
    if (sectionType === 'table' || content.columns || content.rows) {
      // Handle table content
      return this.createTableFromObject(content);
    } else {
      // Convert object to text
      const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
      return this.createParagraphFromText(text, sectionType);
    }
  }

  private static createTableFromObject(content: any): Table {
    const rows = [];

    // Handle columns and rows structure
    if (content.columns && content.rows) {
      // Create header row
      const headerCells = content.columns.map((col: string) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: col, bold: true })],
          })],
        })
      );
      rows.push(new TableRow({ children: headerCells }));

      // Create data rows
      for (const rowData of content.rows) {
        const cells = rowData.map((cellData: any) =>
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun(String(cellData || ''))],
            })],
          })
        );
        rows.push(new TableRow({ children: cells }));
      }
    }

    // If no rows created, create a simple table
    if (rows.length === 0) {
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun('Data')] })],
          }),
        ],
      }));
    }

    return new Table({
      rows: rows,
      width: {
        size: 100,
        type: 'pct',
      },
    });
  }

  private static createHeading(contentItem: any): Paragraph {
    const level = contentItem.level || 1;
    const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;

    return new Paragraph({
      text: contentItem.text || '',
      heading: headingLevel,
      alignment: this.getAlignment(contentItem.style?.alignment),
    });
  }

  private static createParagraph(contentItem: any): Paragraph {
    const textRuns = [];

    if (typeof contentItem.text === 'string') {
      textRuns.push(new TextRun({
        text: contentItem.text,
        bold: contentItem.style?.emphasis === 'bold',
        italics: contentItem.style?.emphasis === 'italic',
        size: contentItem.style?.size ? parseInt(contentItem.style.size) * 2 : 22, // Convert to half-points
      }));
    } else if (Array.isArray(contentItem.text)) {
      // Handle array of text runs with different formatting
      for (const textItem of contentItem.text) {
        textRuns.push(new TextRun({
          text: textItem.text || '',
          bold: textItem.bold || false,
          italics: textItem.italic || false,
          size: textItem.size ? parseInt(textItem.size) * 2 : 22,
        }));
      }
    } else if (typeof contentItem === 'string') {
      // Handle case where contentItem itself is a string
      textRuns.push(new TextRun({
        text: contentItem,
        size: 22,
      }));
    } else {
      // REAL DATA ONLY - No fallback content allowed
      throw new Error(`Invalid content item format - expected string or object with text property, got: ${typeof contentItem}`);
    }

    // Ensure we always have at least one text run
    if (textRuns.length === 0) {
      textRuns.push(new TextRun({
        text: 'Content',
        size: 22,
      }));
    }

    return new Paragraph({
      children: textRuns,
      alignment: this.getAlignment(contentItem.style?.alignment),
      spacing: {
        after: 120, // 6pt after paragraph
      },
    });
  }

  private static createTable(contentItem: any): Table {
    const rows = [];

    // Create table rows from AI data
    if (contentItem.data && Array.isArray(contentItem.data)) {
      for (const rowData of contentItem.data) {
        const cells = [];
        
        if (Array.isArray(rowData)) {
          for (const cellData of rowData) {
            cells.push(new TableCell({
              children: [new Paragraph({
                children: [new TextRun(String(cellData || ''))],
              })],
            }));
          }
        } else if (typeof rowData === 'object') {
          // Handle object rows
          Object.values(rowData).forEach(cellValue => {
            cells.push(new TableCell({
              children: [new Paragraph({
                children: [new TextRun(String(cellValue || ''))],
              })],
            }));
          });
        }

        if (cells.length > 0) {
          rows.push(new TableRow({ children: cells }));
        }
      }
    }

    // If no data provided, create a simple table
    if (rows.length === 0) {
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun('Data')] })],
          }),
        ],
      }));
    }

    return new Table({
      rows: rows,
      width: {
        size: 100,
        type: 'pct', // 100% width
      },
    });
  }

  private static createList(contentItem: any): Paragraph[] {
    const paragraphs = [];

    if (contentItem.items && Array.isArray(contentItem.items)) {
      for (let i = 0; i < contentItem.items.length; i++) {
        const item = contentItem.items[i];
        paragraphs.push(new Paragraph({
          children: [new TextRun(`${i + 1}. ${item}`)],
          spacing: { after: 60 }, // 3pt after each item
        }));
      }
    }

    // If no items, return a single paragraph
    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({
        children: [new TextRun('List item')],
        spacing: { after: 60 },
      }));
    }

    return paragraphs;
  }

  private static getAlignment(alignment: string): AlignmentType {
    switch (alignment?.toLowerCase()) {
      case 'center':
        return AlignmentType.CENTER;
      case 'right':
        return AlignmentType.RIGHT;
      case 'justify':
        return AlignmentType.JUSTIFIED;
      default:
        return AlignmentType.LEFT;
    }
  }
}
