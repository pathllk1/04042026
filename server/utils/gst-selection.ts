// server/utils/gst-selection.ts
import { IFirmGST } from '../models/Firm';
import { IPartyGST } from '../models/inventory/Party';

export interface GSTSelectionContext {
  firmGSTs: (IFirmGST & { isPrimary?: boolean })[];
  partyGSTs?: (IPartyGST & { isPrimary?: boolean })[];
  deliveryState?: string;
  billingState?: string;
  transactionAmount?: number;
  userPreferences?: {
    preferSameState?: boolean;
    defaultFirmGSTIndex?: number;
    defaultPartyGSTIndex?: number;
  };
}

export interface GSTSelectionResult {
  firmGST: {
    gstNumber: string;
    state: string;
    stateCode: number;
    locationName: string;
    index: number;
  };
  partyGST?: {
    gstNumber: string;
    state: string;
    stateCode: number;
    locationName: string;
    index: number;
  };
  transactionType: 'intra-state' | 'inter-state';
  gstApplicability: 'cgst-sgst' | 'igst' | 'exempt';
  selectionMethod: 'automatic' | 'manual' | 'default';
  confidence: number;
  reason: string;
}

/**
 * Intelligent GST selection based on various factors
 */
export function selectOptimalGST(context: GSTSelectionContext): GSTSelectionResult {
  const { firmGSTs, partyGSTs, deliveryState, userPreferences } = context;



  // Default to first firm GST (primary)
  let selectedFirmGSTIndex = 0;
  let selectedPartyGSTIndex = 0;
  let selectionMethod: 'automatic' | 'manual' | 'default' = 'default';
  let confidence = 50;
  let reason = 'Using default GST selection';

  // SIMPLE: Just use what user selected
  if (userPreferences?.selectedFirmGSTIndex !== undefined) {
    selectedFirmGSTIndex = userPreferences.selectedFirmGSTIndex;
    selectionMethod = 'manual';
    reason = 'User selection';
  }

  if (userPreferences?.selectedPartyGSTIndex !== undefined && partyGSTs) {
    selectedPartyGSTIndex = userPreferences.selectedPartyGSTIndex;
  }

  // Basic validation - use default if invalid
  if (selectedFirmGSTIndex >= firmGSTs.length) selectedFirmGSTIndex = 0;
  if (partyGSTs && selectedPartyGSTIndex >= partyGSTs.length) selectedPartyGSTIndex = 0;

  const selectedFirmGST = firmGSTs[selectedFirmGSTIndex];
  const selectedPartyGST = partyGSTs?.[selectedPartyGSTIndex];

  // Determine transaction type
  const transactionType: 'intra-state' | 'inter-state' =
    selectedPartyGST && selectedFirmGST.state && selectedPartyGST.state &&
    selectedFirmGST.state.toLowerCase() === selectedPartyGST.state.toLowerCase()
      ? 'intra-state'
      : 'inter-state';

  const gstApplicability: 'cgst-sgst' | 'igst' | 'exempt' = 
    transactionType === 'intra-state' ? 'cgst-sgst' : 'igst';



  return {
    firmGST: {
      gstNumber: selectedFirmGST.gstNumber,
      state: selectedFirmGST.state,
      stateCode: selectedFirmGST.stateCode,
      locationName: selectedFirmGST.locationName,
      address: selectedFirmGST.address,           // ← Add address
      city: selectedFirmGST.city,                 // ← Add city
      pincode: selectedFirmGST.pincode,           // ← Add pincode
      isActive: selectedFirmGST.isActive,         // ← Add isActive
      isDefault: selectedFirmGST.isDefault,       // ← Add isDefault
      registrationType: selectedFirmGST.registrationType, // ← Add registrationType
      index: selectedFirmGSTIndex
    },
    partyGST: selectedPartyGST ? {
      gstNumber: selectedPartyGST.gstNumber,
      state: selectedPartyGST.state,
      stateCode: selectedPartyGST.stateCode,
      locationName: selectedPartyGST.locationName,
      address: selectedPartyGST.address,          // ← Add address
      city: selectedPartyGST.city,                // ← Add city
      pincode: selectedPartyGST.pincode,          // ← Add pincode
      isActive: selectedPartyGST.isActive,        // ← Add isActive
      isDefault: selectedPartyGST.isDefault,      // ← Add isDefault
      index: selectedPartyGSTIndex
    } : undefined,
    transactionType,
    gstApplicability,
    selectionMethod,
    confidence,
    reason
  };
}

/**
 * Validate GST selection for compliance
 */
export function validateGSTSelection(selection: GSTSelectionResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate GST number formats
  if (!isValidGSTFormat(selection.firmGST.gstNumber)) {
    errors.push('Invalid firm GST number format');
  }

  if (selection.partyGST && !isValidGSTFormat(selection.partyGST.gstNumber)) {
    errors.push('Invalid party GST number format');
  }

  // Validate state consistency
  if (selection.partyGST && selection.firmGST.state && selection.partyGST.state) {
    const expectedTransactionType =
      selection.firmGST.state.toLowerCase() === selection.partyGST.state.toLowerCase()
        ? 'intra-state'
        : 'inter-state';

    if (selection.transactionType !== expectedTransactionType) {
      errors.push(`Transaction type mismatch: expected ${expectedTransactionType}`);
    }
  }

  // Validate GST applicability
  const expectedGSTType = selection.transactionType === 'intra-state' ? 'cgst-sgst' : 'igst';
  if (selection.gstApplicability !== expectedGSTType) {
    warnings.push(`GST applicability may be incorrect: expected ${expectedGSTType}`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Helper function to validate GST number format
 */
function isValidGSTFormat(gstNumber: string): boolean {
  if (gstNumber === 'UNREGISTERED') return true;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstNumber);
}
