// server/utils/register-models.ts
import mongoose from 'mongoose';

// Import all models to ensure they are registered with Mongoose
import '../models/User';
import '../models/Firm';
import '../models/Role';
import '../models/Document';
import '../models/Note';
import '../models/AIHistory';
import { NSE } from '../models/NSE';
import { Folio } from '../models/Folio';
import { CNNote } from '../models/CNNote';
import NSEDocumentModel from '../models/NSEDocument';

// Import additional MongoDB models
import '../models/AdvanceRecovery';
import { ChatMessage } from '../models/ChatMessage';
import '../models/EmployeeAdvance';
import '../models/ManagerCode';
import '../models/MasterRoll';
import { MutualFund } from '../models/MutualFund';
import '../models/Wage';

// Import inventory models
import '../models/inventory/Bills';
import '../models/inventory/StockReg';
import '../models/inventory/Stocks';
import '../models/inventory/Party';

// Import expenses models (Mongo) and ensure they are registered
import { LedgerModel as RegisterLedgerModel } from '../models/expenses/Ledger.model';
import { LedgerTxnModel as RegisterLedgerTxnModel } from '../models/expenses/LedgerTxn.model';
import { ExpenseModel as RegisterExpenseModel } from '../models/expenses/Expense.model';
import { ExpensePartyModel as RegisterExpensePartyModel } from '../models/expenses/ExpenseParty.model';
import { SubsModel as RegisterSubsModel, SubsTxnModel as RegisterSubsTxnModel } from '../models/expenses/Subs.model';
import { PaidToGroupModel as RegisterPaidToGroupModel } from '../models/expenses/PaidToGroup.model';

/**
 * Register all models with Mongoose
 * This function doesn't need to do anything as the imports above
 * will register the models with Mongoose
 */
export function registerAllModels() {
  console.log('Registering all Mongoose models...');

  // Explicitly invoke model factory functions for expenses subsystem so they appear in mongoose.modelNames()
  try {
    RegisterLedgerModel();
    RegisterLedgerTxnModel();
    RegisterExpenseModel();
    RegisterExpensePartyModel();
    RegisterSubsModel();
    RegisterSubsTxnModel();
    RegisterPaidToGroupModel();
  } catch (e: any) {
    const warningMessage = (e && typeof e === 'object' && 'message' in e) ? (e as Error).message : String(e);
    console.warn('Warning while registering expenses models:', warningMessage);
  }

  // Log all registered models
  const modelNames = Object.keys(mongoose.models);
  console.log(`Registered models: ${modelNames.join(', ')}`);

  return modelNames;
}

// Export default for use as a plugin
export default registerAllModels;
