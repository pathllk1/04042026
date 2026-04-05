/**
 * Expense model definition
 * 
 * This model represents an expense or receipt transaction in the system
 */

// Define the Expense model schema
export const ExpenseSchema = {
  id: String,                  // Unique identifier
  date: Date,                  // Payment or receipt date
  paidTo: String,              // Paid to or received from
  amount: Number,              // Gross amount (before deductions)
  category: String,            // Payment category (PAYMENT, RECEIPT, TRANSFER)
  project: String,             // Project (optional)
  paymentMode: {
    type: String,              // 'cash' or 'bank'
    instrumentNo: String,      // Required if type is 'bank'
    bankId: String             // Reference to the bank ledger if type is 'bank'
  },
  description: String,         // Remarks or description (optional)
  paidToGroup: String,         // Like debtor, creditor, labour, staff, subs etc.
  // Dynamic deduction fields
  hasDeductions: Boolean,      // Flag to enable/disable deductions
  deductions: [{
    id: String,                // Unique identifier for each deduction
    name: String,              // Deduction name (e.g., "TDS", "Service Charge")
    amount: Number,            // Deduction amount (always positive)
    description: String        // Optional description for the deduction
  }],
  netAmount: Number,           // Calculated net amount (gross amount - total deductions)
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  isTransfer: Boolean,         // Flag to identify transfers between payment modes
  transferDetails: {
    fromMode: String,          // 'cash' or 'bank'
    fromBankId: String,        // Bank ledger ID if fromMode is 'bank'
    toMode: String,            // 'cash' or 'bank'
    toBankId: String           // Bank ledger ID if toMode is 'bank'
  },
  createdAt: Date,             // Creation timestamp
  updatedAt: Date              // Last update timestamp
};

// Define the SubExpense model schema for subs
export const SubExpenseSchema = {
  id: String,                  // Unique identifier
  date: Date,                  // Payment or receipt date
  paidTo: String,              // Paid to or received from
  amount: Number,              // Amount
  category: String,            // Payment category (optional)
  project: String,             // Project (optional)
  description: String,         // Remarks or description (optional)
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  parentExpenseId: String,     // Reference to the parent expense
  createdAt: Date,             // Creation timestamp
  updatedAt: Date              // Last update timestamp
};

// Define the expense filter schema for reports
export const ExpenseFilterSchema = {
  startDate: Date,             // Start date for filtering
  endDate: Date,               // End date for filtering
  paidTo: String,              // Filter by paid to/from
  category: String,            // Filter by category
  project: String,             // Filter by project
  paymentMode: String,         // Filter by payment mode
  paidToGroup: String,         // Filter by paid to group
  isTransfer: Boolean          // Filter transfers
};
