/**
 * PDF Template System
 * 
 * This module provides different invoice templates for PDF generation
 */

// Only keeping your original professional template - removing all AI-created templates

export interface TemplateConfig {
  selected: string
  customization: {
    colors: {
      primary: string
      secondary: string
      text: string
    }
    fonts: {
      header: string
      body: string
    }
  }
}

export interface BillData {
  _id: string
  bno: string
  bdate: string
  btype: string
  partyName: string
  partyAddress?: string
  partyGstin?: string
  partyState?: string
  consigneeName?: string
  consigneeAddress?: string
  consigneeGstin?: string
  consigneeState?: string
  gtot: number
  cgst: number
  sgst: number
  igst: number
  rof: number
  ntot: number
  narration?: string
  stockItems: any[]
  oth_chg?: any[]
  [key: string]: any
}

export interface FirmData {
  name: string
  address?: string
  gstNo?: string
  state?: string
  [key: string]: any
}

export interface PrintConfig {
  template?: TemplateConfig
  bankDetails?: {
    enabled: boolean
    showOnInvoice: boolean
    bankName: string
    accountNumber: string
    ifscCode: string
    branch: string
  }
  jurisdiction?: {
    enabled: boolean
    state: string
    district: string
    court: string
    customText: string
  }
  declaration?: {
    enabled: boolean
    text: string
    showOnInvoice: boolean
    position: 'top' | 'bottom'
  }
  inventoryFields?: {
    showHSN: boolean
    showBatch: boolean
    showMRP: boolean
    showExpiryDate: boolean
    showDiscount: boolean
    showGSTRate: boolean
    showCGST: boolean
    showSGST: boolean
    showIGST: boolean
    showProject: boolean
    showNarration: boolean
  }
  [key: string]: any
}

// Removed all AI-created templates - using only your original PDF API system
export const templates = {}

// Template system disabled - using your original PDF API system only
export function getTemplate(templateName: string) {
  return null // No templates - use original system
}

export function generatePDF(doc: any, bill: BillData, firm: FirmData, printConfig?: PrintConfig) {
  // Disabled - use your original PDF generation in bills-pdf/[id].ts
  return null
}
