/**
 * PaidToGroup model definition
 * 
 * This model represents categories for paid to/from entities
 */

// Define the PaidToGroup model schema
export const PaidToGroupSchema = {
  id: String,                  // Unique identifier
  name: String,                // Group name (e.g., "Debtor", "Creditor", "Labour", "Staff", "Subs")
  description: String,         // Group description
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  isActive: Boolean,           // Whether the group is active
  createdAt: Date,             // Creation timestamp
  updatedAt: Date              // Last update timestamp
};

// Define the SubsModel schema for managing subs records
export const SubsModelSchema = {
  id: String,                  // Unique identifier
  name: String,                // Name of the sub
  contactInfo: {
    phone: String,             // Phone number
    email: String,             // Email address
    address: String            // Physical address
  },
  balance: Number,             // Current balance
  firmId: String,              // Firm identifier
  userId: String,              // User identifier
  isActive: Boolean,           // Whether the sub is active
  createdAt: Date,             // Creation timestamp
  updatedAt: Date              // Last update timestamp
};
