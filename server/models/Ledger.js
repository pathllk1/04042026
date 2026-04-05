/**
 * Ledger model definition
 * 
 * This model represents a ledger for cash or bank accounts
 */

// Define the Ledger model schema
export const LedgerSchema = {
  id: String,                  // Unique identifier
  name: String,                // Name of the ledger (e.g., "Cash", "HDFC Bank", "SBI Bank")
  type: String,                // Type of ledger ('cash' or 'bank')
  openingBalance: Number,      // Opening balance
  currentBalance: Number,      // Current balance
  bankDetails: {
    accountNumber: String,     // Bank account number
    ifscCode: String,          // IFSC code
    branch: String,            // Branch name
    bankName: String           // Bank name
  },
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  isActive: Boolean,           // Whether the ledger is active
  createdAt: Date,             // Creation timestamp
  updatedAt: Date              // Last update timestamp
};

// Define the LedgerTransaction model schema
export const LedgerTransactionSchema = {
  id: String,                  // Unique identifier
  ledgerId: String,            // Reference to the ledger
  expenseId: String,           // Reference to the expense
  date: Date,                  // Transaction date
  description: String,         // Transaction description
  amount: Number,              // Transaction amount
  type: String,                // 'debit' or 'credit'
  balance: Number,             // Balance after this transaction
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  createdAt: Date              // Creation timestamp
};
