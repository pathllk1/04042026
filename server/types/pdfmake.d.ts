/**
 * Type declarations for pdfmake internal modules
 * Suppresses TypeScript errors for modules without type definitions
 */

declare module 'pdfmake/js/Printer.js' {
  export default class PdfPrinter {
    constructor(fonts: any)
    createPdfKitDocument(docDefinition: any, options?: any): any
  }
}
