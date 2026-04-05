import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Creates or updates a ledger transaction for a credit note
 * If the ledger for the party doesn't exist, it will be created
 * For credit notes, we create a credit entry (we owe money to the party)
 *
 * @param {Object} billData - The bill data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createCreditNoteLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, check if a transaction already exists for this bill
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('billId', '==', billIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);
      let isUpdate = !existingTransactionSnapshot.empty;
      let oldTransactionData = null;
      let oldLedgerId = null;

      if (isUpdate) {
        oldTransactionData = existingTransactionSnapshot.docs[0].data();
        oldLedgerId = oldTransactionData.ledgerId;
      }

      // Check if a ledger exists for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);
      let ledgerRef;
      let ledgerData;
      let newBalance;
      let ledgerCreated = false;

      // If ledger doesn't exist, create it
      if (ledgerSnapshot.empty) {
        // Create a new ledger for this party
        ledgerRef = ledgersCollection.doc();
        ledgerCreated = true;

        const newLedger = {
          name: billData.supply,
          type: 'party',
          openingBalance: 0,
          currentBalance: -billAmount, // Negative for credit note (we owe money)
          address: billData.addr || '',
          state: billData.state || '',
          gstin: billData.gstin || 'UNREGISTERED',
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        transaction.set(ledgerRef, newLedger);
        newBalance = -billAmount;
      } else {
        // Use existing ledger
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();

        if (isUpdate && oldLedgerId === ledgerRef.id) {
          // This is an update to the same ledger, adjust the balance by the difference
          const oldAmount = oldTransactionData.amount;
          const amountDifference = billAmount - oldAmount;

          // Calculate new balance based on the difference (subtract for credit note)
          newBalance = ledgerData.currentBalance - amountDifference;
        } else if (isUpdate) {
          // This is an update but the ledger has changed
          // We need to adjust the old ledger and set the new one

          // First, get the old ledger
          const oldLedgerRef = ledgersCollection.doc(oldLedgerId);
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (oldLedgerDoc.exists) {
            const oldLedgerData = oldLedgerDoc.data();
            // Add the old amount back to the old ledger (reverse the credit)
            transaction.update(oldLedgerRef, {
              currentBalance: oldLedgerData.currentBalance + oldTransactionData.amount,
              updatedAt: now
            });
          }

          // Now subtract the new amount from the new ledger
          newBalance = ledgerData.currentBalance - billAmount;
        } else {
          // This is a new transaction for an existing ledger
          newBalance = ledgerData.currentBalance - billAmount;
        }

        // Update ledger balance
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: now
        });
      }

      // Extract GST information from bill data
      const firmGSTNo = billData.gstSelection?.firmGST?.gstNumber || '';
      const partyGSTNo = billData.gstSelection?.partyGST?.gstNumber || billData.gstin || 'UNREGISTERED';

      // Determine if this is an inter-state transaction
      const firmStateCode = firmGSTNo.substring(0, 2);
      const partyStateCode = partyGSTNo.substring(0, 2);
      const isInterState = firmStateCode !== partyStateCode && partyGSTNo !== 'UNREGISTERED';

      // Prepare transaction data
      const transactionData = {
        ledgerId: ledgerRef.id,
        billId: billIdStr,
        date: billData.bdate instanceof Date ? Timestamp.fromDate(billData.bdate) : now,
        description: `Credit Note #${billData.bno}`,
        amount: billAmount,
        type: 'credit', // Credit for credit note (we owe money to the party)
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,

        // Multi-GST tracking fields
        firmGSTNo: firmGSTNo,
        partyGSTNo: partyGSTNo,
        firmStateCode: firmStateCode,
        partyStateCode: partyStateCode,
        isInterState: isInterState,

        updatedAt: now
      };

      // If this is an update, update the existing transaction
      // Otherwise, create a new one
      if (isUpdate) {
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.update(existingTransactionRef, {
          ...transactionData,
          updatedAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: existingTransactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: true,
          message: `Updated credit entry for ${billData.supply}`
        };
      } else {
        // Create a new transaction entry
        const transactionRef = transactionsCollection.doc();

        transaction.set(transactionRef, {
          ...transactionData,
          createdAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: transactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: false,
          message: ledgerCreated
            ? `Created new ledger for ${billData.supply} and added credit entry`
            : `Added credit entry to existing ledger for ${billData.supply}`
        };
      }
    });
  } catch (error) {
    console.error('Error creating/updating ledger transaction for credit note:', error);
    throw error;
  }
}

/**
 * Creates or updates a ledger transaction for a debit note
 * If the ledger for the party doesn't exist, it will be created
 * For debit notes, we create a debit entry (party owes money)
 *
 * @param {Object} billData - The bill data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createDebitNoteLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, check if a transaction already exists for this bill
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('billId', '==', billIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);
      let isUpdate = !existingTransactionSnapshot.empty;
      let oldTransactionData = null;
      let oldLedgerId = null;

      if (isUpdate) {
        oldTransactionData = existingTransactionSnapshot.docs[0].data();
        oldLedgerId = oldTransactionData.ledgerId;
      }

      // Check if a ledger exists for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);
      let ledgerRef;
      let ledgerData;
      let newBalance;
      let ledgerCreated = false;

      // If ledger doesn't exist, create it
      if (ledgerSnapshot.empty) {
        // Create a new ledger for this party
        ledgerRef = ledgersCollection.doc();
        ledgerCreated = true;

        const newLedger = {
          name: billData.supply,
          type: 'party',
          openingBalance: 0,
          currentBalance: billAmount, // Positive for debit note (party owes money)
          address: billData.addr || '',
          state: billData.state || '',
          gstin: billData.gstin || 'UNREGISTERED',
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        transaction.set(ledgerRef, newLedger);
        newBalance = billAmount;
      } else {
        // Use existing ledger
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();

        if (isUpdate && oldLedgerId === ledgerRef.id) {
          // This is an update to the same ledger, adjust the balance by the difference
          const oldAmount = oldTransactionData.amount;
          const amountDifference = billAmount - oldAmount;

          // Calculate new balance based on the difference
          newBalance = ledgerData.currentBalance + amountDifference;
        } else if (isUpdate) {
          // This is an update but the ledger has changed
          // We need to adjust the old ledger and set the new one

          // First, get the old ledger
          const oldLedgerRef = ledgersCollection.doc(oldLedgerId);
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (oldLedgerDoc.exists) {
            const oldLedgerData = oldLedgerDoc.data();
            // Subtract the old amount from the old ledger (reverse the debit)
            transaction.update(oldLedgerRef, {
              currentBalance: oldLedgerData.currentBalance - oldTransactionData.amount,
              updatedAt: now
            });
          }

          // Now add the new amount to the new ledger
          newBalance = ledgerData.currentBalance + billAmount;
        } else {
          // This is a new transaction for an existing ledger
          newBalance = ledgerData.currentBalance + billAmount;
        }

        // Update ledger balance
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: now
        });
      }

      // Extract GST information from bill data
      const firmGSTNo = billData.gstSelection?.firmGST?.gstNumber || '';
      const partyGSTNo = billData.gstSelection?.partyGST?.gstNumber || billData.gstin || 'UNREGISTERED';

      // Determine if this is an inter-state transaction
      const firmStateCode = firmGSTNo.substring(0, 2);
      const partyStateCode = partyGSTNo.substring(0, 2);
      const isInterState = firmStateCode !== partyStateCode && partyGSTNo !== 'UNREGISTERED';

      // Prepare transaction data
      const transactionData = {
        ledgerId: ledgerRef.id,
        billId: billIdStr,
        date: billData.bdate instanceof Date ? Timestamp.fromDate(billData.bdate) : now,
        description: `Debit Note #${billData.bno}`,
        amount: billAmount,
        type: 'debit', // Debit for debit note (party owes money)
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,

        // Multi-GST tracking fields
        firmGSTNo: firmGSTNo,
        partyGSTNo: partyGSTNo,
        firmStateCode: firmStateCode,
        partyStateCode: partyStateCode,
        isInterState: isInterState,

        updatedAt: now
      };

      // If this is an update, update the existing transaction
      // Otherwise, create a new one
      if (isUpdate) {
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.update(existingTransactionRef, {
          ...transactionData,
          updatedAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: existingTransactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: true,
          message: `Updated debit entry for ${billData.supply}`
        };
      } else {
        // Create a new transaction entry
        const transactionRef = transactionsCollection.doc();

        transaction.set(transactionRef, {
          ...transactionData,
          createdAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: transactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: false,
          message: ledgerCreated
            ? `Created new ledger for ${billData.supply} and added debit entry`
            : `Added debit entry to existing ledger for ${billData.supply}`
        };
      }
    });
  } catch (error) {
    console.error('Error creating/updating ledger transaction for debit note:', error);
    throw error;
  }
}

/**
 * Creates or updates a ledger transaction for a sales bill
 * If the ledger for the party doesn't exist, it will be created
 * For sales bills, we create a debit entry (party owes money)
 *
 * @param {Object} billData - The bill data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createSalesBillLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, check if a transaction already exists for this bill
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('billId', '==', billIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);
      let isUpdate = !existingTransactionSnapshot.empty;
      let oldTransactionData = null;
      let oldLedgerId = null;

      if (isUpdate) {
        oldTransactionData = existingTransactionSnapshot.docs[0].data();
        oldLedgerId = oldTransactionData.ledgerId;
      }

      // Check if a ledger exists for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);
      let ledgerRef;
      let ledgerData;
      let newBalance;
      let ledgerCreated = false;

      // If ledger doesn't exist, create it
      if (ledgerSnapshot.empty) {
        // Create a new ledger for this party
        ledgerRef = ledgersCollection.doc();
        ledgerCreated = true;

        const newLedger = {
          name: billData.supply,
          type: 'party',
          openingBalance: 0,
          currentBalance: billAmount, // Start with the bill amount
          address: billData.addr || '',
          state: billData.state || '',
          gstin: billData.gstin || 'UNREGISTERED',
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        // Set the new ledger in the transaction
        transaction.set(ledgerRef, newLedger);

        // Set ledger data for later use
        ledgerData = newLedger;
        newBalance = billAmount;
      } else {
        // Use existing ledger
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();

        if (isUpdate && oldLedgerId === ledgerRef.id) {
          // This is an update to the same ledger, adjust the balance by the difference
          const oldAmount = oldTransactionData.amount;
          const amountDifference = billAmount - oldAmount;

          // Calculate new balance based on the difference
          newBalance = ledgerData.currentBalance + amountDifference;
        } else if (isUpdate) {
          // This is an update but the ledger has changed
          // We need to adjust the old ledger and set the new one

          // First, get the old ledger
          const oldLedgerRef = ledgersCollection.doc(oldLedgerId);
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (oldLedgerDoc.exists) {
            const oldLedgerData = oldLedgerDoc.data();
            // Subtract the old amount from the old ledger
            transaction.update(oldLedgerRef, {
              currentBalance: oldLedgerData.currentBalance - oldTransactionData.amount,
              updatedAt: now
            });
          }

          // Now add the new amount to the new ledger
          newBalance = ledgerData.currentBalance + billAmount;
        } else {
          // This is a new transaction for an existing ledger
          newBalance = ledgerData.currentBalance + billAmount;
        }

        // Update ledger balance
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: now
        });
      }

      // Extract GST information from bill data
      const firmGSTNo = billData.gstSelection?.firmGST?.gstNumber || '';
      const partyGSTNo = billData.gstSelection?.partyGST?.gstNumber || billData.gstin || 'UNREGISTERED';

      // Determine if this is an inter-state transaction
      const firmStateCode = firmGSTNo.substring(0, 2);
      const partyStateCode = partyGSTNo.substring(0, 2);
      const isInterState = firmStateCode !== partyStateCode && partyGSTNo !== 'UNREGISTERED';

      console.log('📊 GST Tracking for Sales Bill:', {
        firmGSTNo,
        partyGSTNo,
        firmStateCode,
        partyStateCode,
        isInterState,
        billNo: billData.bno
      });

      // Prepare transaction data
      const transactionData = {
        ledgerId: ledgerRef.id,
        billId: billIdStr,
        date: billData.bdate instanceof Date ? Timestamp.fromDate(billData.bdate) : now,
        description: `Sales Bill #${billData.bno}`,
        amount: billAmount,
        type: 'debit', // Debit for sales bill (party owes money)
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,

        // Multi-GST tracking fields
        firmGSTNo: firmGSTNo,
        partyGSTNo: partyGSTNo,
        firmStateCode: firmStateCode,
        partyStateCode: partyStateCode,
        isInterState: isInterState,

        updatedAt: now
      };

      // If this is an update, update the existing transaction
      // Otherwise, create a new one
      if (isUpdate) {
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.update(existingTransactionRef, {
          ...transactionData,
          updatedAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: existingTransactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: true,
          message: `Updated debit entry for ${billData.supply}`
        };
      } else {
        // Create a new transaction entry
        const transactionRef = transactionsCollection.doc();

        transaction.set(transactionRef, {
          ...transactionData,
          createdAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: transactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: false,
          message: ledgerCreated
            ? `Created new ledger for ${billData.supply} and added debit entry`
            : `Added debit entry to existing ledger for ${billData.supply}`
        };
      }
    });
  } catch (error) {
    console.error('Error creating/updating ledger transaction for sales bill:', error);
    throw error;
  }
}

/**
 * Creates or updates a ledger transaction for a purchase bill
 * If the ledger for the party doesn't exist, it will be created
 * For purchase bills, we create a credit entry (we owe money to the party)
 *
 * @param {Object} billData - The bill data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createPurchaseBillLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, check if a transaction already exists for this bill
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('billId', '==', billIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);
      let isUpdate = !existingTransactionSnapshot.empty;
      let oldTransactionData = null;
      let oldLedgerId = null;

      if (isUpdate) {
        oldTransactionData = existingTransactionSnapshot.docs[0].data();
        oldLedgerId = oldTransactionData.ledgerId;
      }

      // Check if a ledger exists for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);
      let ledgerRef;
      let ledgerData;
      let newBalance;
      let ledgerCreated = false;

      // If ledger doesn't exist, create it
      if (ledgerSnapshot.empty) {
        // Create a new ledger for this party
        ledgerRef = ledgersCollection.doc();
        ledgerCreated = true;

        const newLedger = {
          name: billData.supply,
          type: 'party',
          openingBalance: 0,
          currentBalance: -billAmount, // Negative for purchase bill (we owe money)
          address: billData.addr || '',
          state: billData.state || '',
          gstin: billData.gstin || 'UNREGISTERED',
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        // Set the new ledger in the transaction
        transaction.set(ledgerRef, newLedger);

        // Set ledger data for later use
        ledgerData = newLedger;
        newBalance = -billAmount;
      } else {
        // Use existing ledger
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();

        if (isUpdate && oldLedgerId === ledgerRef.id) {
          // This is an update to the same ledger, adjust the balance by the difference
          const oldAmount = oldTransactionData.amount;
          const amountDifference = billAmount - oldAmount;

          // Calculate new balance based on the difference (subtract for purchase)
          newBalance = ledgerData.currentBalance - amountDifference;
        } else if (isUpdate) {
          // This is an update but the ledger has changed
          // We need to adjust the old ledger and set the new one

          // First, get the old ledger
          const oldLedgerRef = ledgersCollection.doc(oldLedgerId);
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (oldLedgerDoc.exists) {
            const oldLedgerData = oldLedgerDoc.data();
            // Add the old amount back to the old ledger (reverse the credit)
            transaction.update(oldLedgerRef, {
              currentBalance: oldLedgerData.currentBalance + oldTransactionData.amount,
              updatedAt: now
            });
          }

          // Now subtract the new amount from the new ledger
          newBalance = ledgerData.currentBalance - billAmount;
        } else {
          // This is a new transaction for an existing ledger
          newBalance = ledgerData.currentBalance - billAmount;
        }

        // Update ledger balance
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: now
        });
      }

      // Extract GST information from bill data
      const firmGSTNo = billData.gstSelection?.firmGST?.gstNumber || '';
      const partyGSTNo = billData.gstSelection?.partyGST?.gstNumber || billData.gstin || 'UNREGISTERED';

      // Determine if this is an inter-state transaction
      const firmStateCode = firmGSTNo.substring(0, 2);
      const partyStateCode = partyGSTNo.substring(0, 2);
      const isInterState = firmStateCode !== partyStateCode && partyGSTNo !== 'UNREGISTERED';

      // Prepare transaction data
      const transactionData = {
        ledgerId: ledgerRef.id,
        billId: billIdStr,
        date: billData.bdate instanceof Date ? Timestamp.fromDate(billData.bdate) : now,
        description: `Purchase Bill #${billData.bno}`,
        amount: billAmount,
        type: 'credit', // Credit for purchase bill (we owe money to the party)
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,

        // Multi-GST tracking fields
        firmGSTNo: firmGSTNo,
        partyGSTNo: partyGSTNo,
        firmStateCode: firmStateCode,
        partyStateCode: partyStateCode,
        isInterState: isInterState,

        updatedAt: now
      };

      // If this is an update, update the existing transaction
      // Otherwise, create a new one
      if (isUpdate) {
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.update(existingTransactionRef, {
          ...transactionData,
          updatedAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: existingTransactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: true,
          message: `Updated credit entry for ${billData.supply}`
        };
      } else {
        // Create a new transaction entry
        const transactionRef = transactionsCollection.doc();

        transaction.set(transactionRef, {
          ...transactionData,
          createdAt: now
        });

        return {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: transactionRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: false,
          message: ledgerCreated
            ? `Created new ledger for ${billData.supply} and added credit entry`
            : `Added credit entry to existing ledger for ${billData.supply}`
        };
      }
    });
  } catch (error) {
    console.error('Error creating/updating ledger transaction for purchase bill:', error);
    throw error;
  }
}

/**
 * Creates a ledger transaction for a cancelled bill
 * This function reverses the original transaction by creating an opposite entry
 *
 * @param {Object} billData - The cancelled bill data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createCancellationLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // Check if a ledger exists for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);

      // If ledger doesn't exist, create a new one
      let ledgerRef;
      let ledgerData;

      if (ledgerSnapshot.empty) {
        console.log(`Ledger not found for party: ${billData.supply}, creating a new one`);

        // Create a new ledger for this party
        ledgerRef = db.collection('ledgers').doc();
        ledgerData = {
          name: billData.supply,
          type: 'party',
          openingBalance: 0,
          currentBalance: 0,
          address: billData.addr || '',
          state: billData.state || '',
          gstin: billData.gstin || 'UNREGISTERED',
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        // Set the new ledger data
        transaction.set(ledgerRef, ledgerData);
      } else {
        // Get the ledger reference and data
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();
      }
      let newBalance;

      // Determine the transaction type based on bill type
      // For cancellation, we do the opposite of the original transaction
      let transactionType;
      let description;

      switch (billData.btype) {
        case 'SALES':
          // Original: Debit (party owes money)
          // Cancellation: Credit (reverse the debit)
          transactionType = 'credit';
          description = `Cancelled Sales Bill #${billData.bno}`;
          newBalance = ledgerData.currentBalance - billAmount; // Subtract from balance
          break;
        case 'PURCHASE':
          // Original: Credit (we owe money)
          // Cancellation: Debit (reverse the credit)
          transactionType = 'debit';
          description = `Cancelled Purchase Bill #${billData.bno}`;
          newBalance = ledgerData.currentBalance + billAmount; // Add to balance
          break;
        case 'CREDIT NOTE':
          // Original: Credit (we owe money)
          // Cancellation: Debit (reverse the credit)
          transactionType = 'debit';
          description = `Cancelled Credit Note #${billData.bno}`;
          newBalance = ledgerData.currentBalance + billAmount; // Add to balance
          break;
        case 'DEBIT NOTE':
          // Original: Debit (party owes money)
          // Cancellation: Credit (reverse the debit)
          transactionType = 'credit';
          description = `Cancelled Debit Note #${billData.bno}`;
          newBalance = ledgerData.currentBalance - billAmount; // Subtract from balance
          break;
        default:
          throw new Error(`Unsupported bill type: ${billData.btype}`);
      }

      // Update ledger balance
      transaction.update(ledgerRef, {
        currentBalance: newBalance,
        updatedAt: now
      });

      // Create a new transaction entry for the cancellation
      const transactionsCollection = db.collection('ledgerTransactions');
      const transactionRef = transactionsCollection.doc();

      const transactionData = {
        ledgerId: ledgerRef.id,
        billId: billIdStr,
        date: now, // Use current time for cancellation
        description,
        amount: billAmount,
        type: transactionType,
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,
        cancellation: true, // Mark this as a cancellation transaction
        cancelledAt: now,
        createdAt: now,
        updatedAt: now
      };

      transaction.set(transactionRef, transactionData);

      return {
        success: true,
        ledgerId: ledgerRef.id,
        transactionId: transactionRef.id,
        message: `Created cancellation entry for ${billData.btype} #${billData.bno}`
      };
    });
  } catch (error) {
    console.error('Error creating ledger transaction for cancelled bill:', error);
    throw error;
  }
}

/**
 * Creates a ledger transaction to reverse the effect of a deleted bill
 * This function handles all bill types: PURCHASE, SALES, DEBIT NOTE, CREDIT NOTE
 *
 * @param {Object} billData - The bill data that was deleted
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createDeletionLedgerTransaction(billData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const billIdStr = billData._id.toString();

    // Convert bill amount to number to ensure proper calculation
    const billAmount = Number(billData.ntot);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, do all reads before any writes (Firestore requirement)
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('billId', '==', billIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);

      // Find the ledger for this party
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', billData.supply)
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);

      // Now do all writes after reads
      if (!existingTransactionSnapshot.empty) {
        // Delete the existing transaction
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.delete(existingTransactionRef);
        console.log('Deleted existing ledger transaction for bill');
      }

      if (ledgerSnapshot.empty) {
        console.log('No ledger found for party, skipping ledger update');
        return { success: true, message: 'No ledger found to update' };
      }

      // Update the existing ledger by reversing the bill amount
      const ledgerRef = ledgerSnapshot.docs[0].ref;
      const ledgerData = ledgerSnapshot.docs[0].data();

      // Calculate the amount to reverse based on bill type
      let amountToReverse = 0;
      switch (billData.btype) {
        case 'PURCHASE':
        case 'DEBIT NOTE':
          // These increased the amount we owe, so subtract when deleting
          amountToReverse = -billAmount;
          break;
        case 'SALES':
        case 'CREDIT NOTE':
          // These increased the amount owed to us, so subtract when deleting
          amountToReverse = -billAmount;
          break;
        default:
          console.warn(`Unknown bill type for ledger reversal: ${billData.btype}`);
          return { success: true, message: 'Unknown bill type, no ledger update needed' };
      }

      const newBalance = ledgerData.currentBalance + amountToReverse;

      // Update the ledger balance
      transaction.update(ledgerRef, {
        currentBalance: newBalance,
        updatedAt: now
      });

      console.log(`Updated ledger for ${billData.supply}: ${ledgerData.currentBalance} -> ${newBalance}`);

      return {
        success: true,
        message: 'Ledger transaction reversed successfully',
        ledgerId: ledgerRef.id,
        oldBalance: ledgerData.currentBalance,
        newBalance: newBalance,
        amountReversed: amountToReverse
      };
    });

  } catch (error) {
    console.error('Error in createDeletionLedgerTransaction:', error);
    throw error;
  }
}

/**
 * Creates or updates a ledger transaction for a labor payment
 * If the ledger for the labor group doesn't exist, it will be created
 * For labor payments, we create a debit entry (we paid money to the group)
 * Also creates an expense entry in the expenses collection
 *
 * @param {Object} paymentData - The payment data from Supabase
 * @param {Object} groupData - The labor group data from Supabase
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createLaborPaymentLedgerTransaction(paymentData: any, groupData: any, userId: string, firmId: string) {
  try {
    console.log('🔥 [LEDGER TRANSACTION DEBUG] Starting createLaborPaymentLedgerTransaction...')
    console.log('🔥 [LEDGER TRANSACTION DEBUG] Input parameters:', {
      paymentId: paymentData.id,
      groupName: groupData.name,
      amount: paymentData.amount,
      userId,
      firmId
    })

    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const paymentIdStr = paymentData.id.toString();

    // Convert payment amount to number to ensure proper calculation
    const paymentAmount = Number(paymentData.amount);

    console.log('🔥 [LEDGER TRANSACTION DEBUG] Firestore connection established, starting transaction...')
    console.log('🔥 [LEDGER TRANSACTION DEBUG] Target Firestore collections:')
    console.log('  📊 expenses - Will store payment as expense record')
    console.log('  💰 ledgers - Will store/update labor group ledger')
    console.log('  📝 ledgerTransactions - Will store transaction record')

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      console.log('🔥 [LEDGER TRANSACTION DEBUG] Starting Firestore transaction...')

      // First, check if a transaction already exists for this payment
      console.log('🔍 [LEDGER TRANSACTION DEBUG] Checking for existing transaction in ledgerTransactions collection...')
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('paymentId', '==', paymentIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);
      let isUpdate = !existingTransactionSnapshot.empty;
      let oldTransactionData = null;
      let oldLedgerId = null;

      console.log('🔍 [LEDGER TRANSACTION DEBUG] Existing transaction check result:', {
        isUpdate,
        existingCount: existingTransactionSnapshot.size
      })

      if (isUpdate) {
        oldTransactionData = existingTransactionSnapshot.docs[0].data();
        oldLedgerId = oldTransactionData.ledgerId;
        console.log('🔄 [LEDGER TRANSACTION DEBUG] Found existing transaction:', {
          oldLedgerId,
          oldAmount: oldTransactionData.amount
        })
      }

      // Check if a ledger exists for this labor group
      console.log('🔍 [LEDGER TRANSACTION DEBUG] Checking for existing ledger in ledgers collection...')
      console.log('🔍 [LEDGER TRANSACTION DEBUG] Ledger query parameters:', {
        firmId: firmIdStr,
        groupName: groupData.name,
        type: 'labor_group'
      })

      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', groupData.name)
        .where('type', '==', 'labor_group')
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);
      let ledgerRef;
      let ledgerData;
      let newBalance;
      let ledgerCreated = false;
      let ledgerNeedsCreate = false;
      let newLedgerDocData: any | null = null;
      let needsOldLedgerReverse = false;
      let oldLedgerRefForReverse: FirebaseFirestore.DocumentReference | undefined;
      let oldLedgerReversedBalance: number | undefined;

      console.log('🔍 [LEDGER TRANSACTION DEBUG] Ledger check result:', {
        ledgerExists: !ledgerSnapshot.empty,
        ledgerCount: ledgerSnapshot.size
      })

      // If ledger doesn't exist, create it
      if (ledgerSnapshot.empty) {
        console.log('🆕 [LEDGER TRANSACTION DEBUG] Creating new ledger for labor group...')

        // Create a new ledger for this labor group
        ledgerRef = ledgersCollection.doc();
        ledgerCreated = true;
        ledgerNeedsCreate = true;

        newLedgerDocData = {
          name: groupData.name,
          type: 'labor_group',
          openingBalance: 0,
          currentBalance: -paymentAmount, // Negative because we paid money to the group
          address: groupData.address || '',
          phone: groupData.phone || '',
          aadhar: groupData.aadhar || '',
          bankDetails: groupData.bank_details || {},
          firmId: firmIdStr,
          userId: userIdStr,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        console.log('🆕 [LEDGER TRANSACTION DEBUG] New ledger data (to be created later in writes phase):', {
          id: ledgerRef.id,
          name: newLedgerDocData.name,
          type: newLedgerDocData.type,
          currentBalance: newLedgerDocData.currentBalance,
          firmId: newLedgerDocData.firmId
        })

        newBalance = -paymentAmount;

        console.log('✅ [LEDGER TRANSACTION DEBUG] New ledger will be created in ledgers collection (writes phase)')
      } else {
        console.log('✅ [LEDGER TRANSACTION DEBUG] Using existing ledger...')

        // Use existing ledger
        ledgerRef = ledgerSnapshot.docs[0].ref;
        ledgerData = ledgerSnapshot.docs[0].data();

        console.log('✅ [LEDGER TRANSACTION DEBUG] Existing ledger data:', {
          id: ledgerRef.id,
          name: ledgerData.name,
          currentBalance: ledgerData.currentBalance,
          type: ledgerData.type
        })

        if (isUpdate && oldLedgerId === ledgerRef.id) {
          // This is an update to the same ledger, adjust the balance by the difference
          const oldAmount = oldTransactionData.amount;
          const amountDifference = paymentAmount - oldAmount;

          // Calculate new balance based on the difference (subtract for payment)
          newBalance = ledgerData.currentBalance - amountDifference;
        } else if (isUpdate) {
          // This is an update but the ledger has changed
          // We need to adjust the old ledger and set the new one

          // First, get the old ledger
          const oldLedgerRef = ledgersCollection.doc(oldLedgerId);
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (oldLedgerDoc.exists) {
            const oldLedgerData = oldLedgerDoc.data();
            // Mark reverse to be applied in writes phase
            needsOldLedgerReverse = true;
            oldLedgerRefForReverse = oldLedgerRef;
            oldLedgerReversedBalance = Number(oldLedgerData.currentBalance || 0) + Number(oldTransactionData.amount || 0);
          }

          // Now subtract the new amount from the new ledger
          newBalance = ledgerData.currentBalance - paymentAmount;
        } else {
          // This is a new transaction for an existing ledger
          newBalance = ledgerData.currentBalance - paymentAmount;
        }
        // Do not write yet; will update in writes phase
      }

      // Prepare expense entry (no writes yet)
      console.log('📊 [LEDGER TRANSACTION DEBUG] Preparing expense entry in expenses collection...')
      const expensesCollection = db.collection('expenses');
      const expenseRef = expensesCollection.doc();

      const expenseData = {
        id: expenseRef.id,
        date: Timestamp.fromDate(new Date(paymentData.payment_date)),
        paidTo: groupData.name,
        amount: -paymentAmount, // Negative for payment (following expenses system convention)
        category: 'PAYMENT',
        project: paymentData.project || null,
        paymentMode: {
          type: paymentData.payment_method === 'cash' ? 'cash' : 'bank',
          instrumentNo: paymentData.bank_details?.instrumentNo || null,
          bankId: paymentData.bank_details?.bankId || null
        },
        description: `Labor payment to ${groupData.name} - ${paymentData.payment_type || 'Payment'}`,
        paidToGroup: 'LABOR',
        hasDeductions: false,
        deductions: [],
        netAmount: -paymentAmount,
        firmId: firmIdStr,
        userId: userIdStr,
        isTransfer: false,
        transferDetails: null,
        laborPaymentId: paymentIdStr, // Link to original payment record
        createdAt: now,
        updatedAt: now
      };

      console.log('📊 [LEDGER TRANSACTION DEBUG] Expense data prepared:', {
        id: expenseData.id,
        paidTo: expenseData.paidTo,
        amount: expenseData.amount,
        category: expenseData.category,
        laborPaymentId: expenseData.laborPaymentId
      })

      // Defer expense write to writes phase below

      // BANK/CASH LEDGER IMPACT (debit money out of bank/cash)
      // ------------------------------------------------------
      // Determine source ledger (cash or bank) and create/update a corresponding
      // ledgerTransactions entry for the bank/cash ledger as well.
      let bankLedgerRef: FirebaseFirestore.DocumentReference | undefined;
      let bankLedgerData: FirebaseFirestore.DocumentData | undefined;
      let existingBankTxnRef: FirebaseFirestore.DocumentReference | undefined;
      let newBankBalance: number | undefined;

      // Identify the expense id that will be used to link the bank/cash transaction
      const targetExpenseId = isUpdate && oldTransactionData?.expenseId
        ? oldTransactionData.expenseId
        : expenseRef.id;

      // Resolve bank/cash ledger
      if (paymentData.payment_method === 'cash') {
        // Find firm cash ledger
        const cashQuery = db.collection('ledgers')
          .where('firmId', '==', firmIdStr)
          .where('type', '==', 'cash')
          .limit(1);
        const cashSnapshot = await transaction.get(cashQuery);
        if (cashSnapshot.empty) {
          throw new Error('Cash ledger not found for firm');
        }
        bankLedgerRef = cashSnapshot.docs[0].ref;
        bankLedgerData = cashSnapshot.docs[0].data();
      } else {
        const bankId = paymentData?.bank_details?.bankId;
        if (!bankId || typeof bankId !== 'string') {
          throw new Error('Bank payment selected but bank ledgerId is missing');
        }
        const ref = db.collection('ledgers').doc(bankId);
        const bankDoc = await transaction.get(ref);
        if (!bankDoc.exists) {
          throw new Error(`Bank ledger not found: ${bankId}`);
        }
        bankLedgerRef = ref;
        bankLedgerData = bankDoc.data();
      }

      // If a previous bank/cash transaction exists for this expense, load it
      if (bankLedgerRef) {
        const existingBankTxnQuery = db.collection('ledgerTransactions')
          .where('firmId', '==', firmIdStr)
          .where('expenseId', '==', targetExpenseId)
          .where('ledgerId', '==', bankLedgerRef.id)
          .limit(1);
        const existingBankTxnSnapshot = await transaction.get(existingBankTxnQuery);

        if (!existingBankTxnSnapshot.empty) {
          existingBankTxnRef = existingBankTxnSnapshot.docs[0].ref;
          const oldBankTxnData = existingBankTxnSnapshot.docs[0].data();

          // Same bank/cash ledger: adjust by difference
          const amountDifference = paymentAmount - Number(oldBankTxnData.amount || 0);
          newBankBalance = Number(bankLedgerData!.currentBalance || 0) - amountDifference;

          // Update bank/cash ledger balance
          transaction.update(bankLedgerRef, {
            currentBalance: newBankBalance,
            updatedAt: now
          });

          // Update existing bank/cash ledger transaction
          transaction.update(existingBankTxnRef, {
            amount: paymentAmount,
            balance: newBankBalance,
            date: Timestamp.fromDate(new Date(paymentData.payment_date)),
            description: `Payment to Labor Group ${groupData.name} - ${paymentData.payment_type || 'Payment'}`,
            paymentId: paymentIdStr, // link to payment
            updatedAt: now
          });
        } else {
          // It may be an update where ledger changed, or a fresh create. Check for any bank txn for this expense on other ledger
          const anyBankTxnQuery = db.collection('ledgerTransactions')
            .where('firmId', '==', firmIdStr)
            .where('expenseId', '==', targetExpenseId)
            .limit(1);
          const anyBankTxnSnapshot = await transaction.get(anyBankTxnQuery);
          if (!anyBankTxnSnapshot.empty) {
            // Reverse old ledger balance (move from old to new)
            const oldRef = anyBankTxnSnapshot.docs[0].ref;
            const oldData = anyBankTxnSnapshot.docs[0].data();
            const oldLedgerId = oldData.ledgerId as string | undefined;
            const oldAmount = Number(oldData.amount || 0);
            if (oldLedgerId && oldLedgerId !== bankLedgerRef.id) {
              const oldLedgerRef = db.collection('ledgers').doc(oldLedgerId);
              const oldLedgerDoc = await transaction.get(oldLedgerRef);
              if (oldLedgerDoc.exists) {
                const oldLedgerData = oldLedgerDoc.data()!;
                const reversedBalance = Number(oldLedgerData.currentBalance || 0) + oldAmount;
                transaction.update(oldLedgerRef, {
                  currentBalance: reversedBalance,
                  updatedAt: now
                });
              }
              // Remove old bank txn entry
              transaction.delete(oldRef);
            }
          }

      // Create new bank/cash ledger transaction and update ledger balance
          newBankBalance = Number(bankLedgerData!.currentBalance || 0) - paymentAmount;
          // Defer writes; will execute after expense and labor ledger writes
        }
      }

      // ------------------ WRITES PHASE (no more reads beyond this point) ------------------

      // 1) Expense write
      if (isUpdate && oldTransactionData?.expenseId) {
        const existingExpenseRef = expensesCollection.doc(oldTransactionData.expenseId);
        transaction.update(existingExpenseRef, {
          ...expenseData,
          id: oldTransactionData.expenseId,
          updatedAt: now
        });
      } else {
        transaction.set(expenseRef, expenseData);
      }

      // 2) Old ledger reverse (if ledger changed)
      if (needsOldLedgerReverse && oldLedgerRefForReverse && oldLedgerReversedBalance !== undefined) {
        transaction.update(oldLedgerRefForReverse, {
          currentBalance: oldLedgerReversedBalance,
          updatedAt: now
        });
      }

      // 3) Labor group ledger write
      if (ledgerNeedsCreate && newLedgerDocData) {
        transaction.set(ledgerRef, newLedgerDocData);
      } else {
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: now
        });
      }

      // 4) Bank/cash ledger writes
      if (bankLedgerRef) {
        if (existingBankTxnRef) {
          // Update bank ledger balance
          transaction.update(bankLedgerRef, {
            currentBalance: newBankBalance,
            updatedAt: now
          });
          // Update existing bank transaction
          transaction.update(existingBankTxnRef, {
            amount: paymentAmount,
            balance: newBankBalance,
            date: Timestamp.fromDate(new Date(paymentData.payment_date)),
            description: `Payment to Labor Group ${groupData.name} - ${paymentData.payment_type || 'Payment'}`,
            paymentId: paymentIdStr,
            updatedAt: now
          });
        } else {
          // Create new bank transaction and update ledger balance
          transaction.update(bankLedgerRef, {
            currentBalance: newBankBalance,
            updatedAt: now
          });
          const bankTxnRef = db.collection('ledgerTransactions').doc();
          transaction.set(bankTxnRef, {
            ledgerId: bankLedgerRef.id,
            expenseId: targetExpenseId,
            paymentId: paymentIdStr,
            date: Timestamp.fromDate(new Date(paymentData.payment_date)),
            description: `Payment to Labor Group ${groupData.name} - ${paymentData.payment_type || 'Payment'}`,
            amount: paymentAmount,
            type: 'debit',
            balance: newBankBalance,
            firmId: firmIdStr,
            userId: userIdStr,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // Prepare transaction data
      const transactionData = {
        ledgerId: ledgerRef.id,
        paymentId: paymentIdStr,
        expenseId: isUpdate && oldTransactionData.expenseId ? oldTransactionData.expenseId : expenseRef.id,
        date: Timestamp.fromDate(new Date(paymentData.payment_date)),
        description: `Labor Payment to ${groupData.name} - ${paymentData.payment_type || 'Payment'}`,
        amount: paymentAmount,
        type: 'credit', // Credit for labor payment (we paid money to the group)
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,
        updatedAt: now
      };

      // If this is an update, update the existing transaction
      // Otherwise, create a new one
      if (isUpdate) {
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.update(existingTransactionRef, {
          ...transactionData,
          updatedAt: now
        });

        const updateResult = {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: existingTransactionRef.id,
          expenseId: transactionData.expenseId,
          ledgerCreated: ledgerCreated,
          isUpdate: true,
          message: `Updated payment entry for ${groupData.name}`
        };

        console.log('✅ [LEDGER TRANSACTION DEBUG] Transaction update completed:', updateResult)
        return updateResult;
      } else {
        // Create a new transaction entry
        console.log('📝 [LEDGER TRANSACTION DEBUG] Creating new transaction in ledgerTransactions collection...')
        const transactionRef = transactionsCollection.doc();

        transaction.set(transactionRef, {
          ...transactionData,
          createdAt: now
        });

        const createResult = {
          success: true,
          ledgerId: ledgerRef.id,
          transactionId: transactionRef.id,
          expenseId: expenseRef.id,
          ledgerCreated: ledgerCreated,
          isUpdate: false,
          message: ledgerCreated
            ? `Created new ledger for ${groupData.name} and added payment entry`
            : `Added payment entry to existing ledger for ${groupData.name}`
        };

        console.log('✅ [LEDGER TRANSACTION DEBUG] Transaction creation completed:', createResult)
        console.log('🎉 [LEDGER TRANSACTION DEBUG] All Firestore collections updated successfully:')
        console.log('  📊 expenses collection - Document created/updated')
        console.log('  💰 ledgers collection - Document created/updated')
        console.log('  📝 ledgerTransactions collection - Document created')

        return createResult;
      }
    });
  } catch (error) {
    console.error('❌ [LEDGER TRANSACTION DEBUG] Error creating/updating ledger transaction for labor payment:', error);
    console.error('❌ [LEDGER TRANSACTION DEBUG] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Creates a ledger transaction to reverse the effect of a deleted labor payment
 * This function removes the expense entry and adjusts the ledger balance
 *
 * @param {Object} paymentData - The payment data that was deleted
 * @param {Object} groupData - The labor group data
 * @param {string} userId - The user ID
 * @param {string} firmId - The firm ID
 * @returns {Promise<Object>} - The result of the transaction
 */
export async function createLaborPaymentDeletionTransaction(paymentData: any, groupData: any, userId: string, firmId: string) {
  try {
    const db = getFirestore();
    const firmIdStr = firmId.toString();
    const userIdStr = userId.toString();
    const now = Timestamp.now();
    const paymentIdStr = paymentData.id.toString();

    // Convert payment amount to number to ensure proper calculation
    const paymentAmount = Number(paymentData.amount);

    // Use a transaction to ensure data consistency
    return await db.runTransaction(async (transaction) => {
      // First, do all reads before any writes (Firestore requirement)
      const transactionsCollection = db.collection('ledgerTransactions');
      const existingTransactionQuery = transactionsCollection
        .where('paymentId', '==', paymentIdStr)
        .where('firmId', '==', firmIdStr)
        .limit(1);

      const existingTransactionSnapshot = await transaction.get(existingTransactionQuery);

      // Find the ledger for this labor group
      const ledgersCollection = db.collection('ledgers');
      const ledgerQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', groupData.name)
        .where('type', '==', 'labor_group')
        .limit(1);

      const ledgerSnapshot = await transaction.get(ledgerQuery);

      // Now do all writes after reads
      if (!existingTransactionSnapshot.empty) {
        // Get the transaction data before deleting
        const existingTransactionData = existingTransactionSnapshot.docs[0].data();

        // Delete the existing transaction
        const existingTransactionRef = existingTransactionSnapshot.docs[0].ref;
        transaction.delete(existingTransactionRef);

        // Delete the associated expense if it exists
        if (existingTransactionData.expenseId) {
          const expenseRef = db.collection('expenses').doc(existingTransactionData.expenseId);
          transaction.delete(expenseRef);
        }

        console.log('Deleted existing ledger transaction and expense for labor payment');
      }

      if (ledgerSnapshot.empty) {
        console.log('No ledger found for labor group, skipping ledger update');
        return { success: true, message: 'No ledger found to update' };
      }

      // Update the existing ledger by reversing the payment amount (labor group ledger)
      const ledgerRef = ledgerSnapshot.docs[0].ref;
      const ledgerData = ledgerSnapshot.docs[0].data();

      // For labor payments, we subtract from balance (negative), so when deleting we add back
      const newBalance = ledgerData.currentBalance + paymentAmount;

      // Update the ledger balance
      transaction.update(ledgerRef, {
        currentBalance: newBalance,
        updatedAt: now
      });

      console.log(`Updated ledger for ${groupData.name}: ${ledgerData.currentBalance} -> ${newBalance}`);

      // Additionally, reverse bank/cash ledger impact and remove corresponding bank txn
      try {
        const firmIdStr = firmId.toString();
        const paymentIdStr = paymentData.id.toString();

        let bankLedgerRef: FirebaseFirestore.DocumentReference | undefined;
        let bankLedgerData: FirebaseFirestore.DocumentData | undefined;

        if (paymentData.payment_method === 'cash') {
          const cashQuery = db.collection('ledgers')
            .where('firmId', '==', firmIdStr)
            .where('type', '==', 'cash')
            .limit(1);
          const cashSnapshot = await transaction.get(cashQuery);
          if (!cashSnapshot.empty) {
            bankLedgerRef = cashSnapshot.docs[0].ref;
            bankLedgerData = cashSnapshot.docs[0].data();
          }
        } else if (paymentData?.bank_details?.bankId) {
          const ref = db.collection('ledgers').doc(paymentData.bank_details.bankId);
          const bankDoc = await transaction.get(ref);
          if (bankDoc.exists) {
            bankLedgerRef = ref;
            bankLedgerData = bankDoc.data();
          }
        }

        if (bankLedgerRef && bankLedgerData) {
          // Find bank-side ledger transaction (linked by paymentId or expenseId)
          let bankTxnQuery = db.collection('ledgerTransactions')
            .where('firmId', '==', firmIdStr)
            .where('paymentId', '==', paymentIdStr)
            .where('ledgerId', '==', bankLedgerRef.id)
            .limit(1);
          let bankTxnSnapshot = await transaction.get(bankTxnQuery);

          if (bankTxnSnapshot.empty && !existingTransactionSnapshot.empty) {
            const existingTransactionData = existingTransactionSnapshot.docs[0].data();
            if (existingTransactionData?.expenseId) {
              bankTxnQuery = db.collection('ledgerTransactions')
                .where('firmId', '==', firmIdStr)
                .where('expenseId', '==', existingTransactionData.expenseId)
                .where('ledgerId', '==', bankLedgerRef.id)
                .limit(1);
              bankTxnSnapshot = await transaction.get(bankTxnQuery);
            }
          }

          if (!bankTxnSnapshot.empty) {
            // Delete bank-side txn
            const ref = bankTxnSnapshot.docs[0].ref;
            const oldBankAmount = Number(bankTxnSnapshot.docs[0].data().amount || 0);
            // Defer writes until after all reads (we are already in writes phase here)
            transaction.delete(ref);
            const newBankBalance = Number(bankLedgerData.currentBalance || 0) + oldBankAmount;
            transaction.update(bankLedgerRef, { currentBalance: newBankBalance, updatedAt: now });
          } else {
            // If transaction not found, still attempt to reverse balance by amount
            const newBankBalance = Number(bankLedgerData.currentBalance || 0) + Number(paymentData.amount || 0);
            transaction.update(bankLedgerRef, {
              currentBalance: newBankBalance,
              updatedAt: now
            });
          }
        }
      } catch (bankReverseError) {
        console.error('Failed to reverse bank/cash ledger for labor payment deletion:', bankReverseError);
        // Do not fail the whole deletion due to bank reversal issues
      }

      return {
        success: true,
        message: 'Labor payment transaction reversed successfully',
        ledgerId: ledgerRef.id,
        oldBalance: ledgerData.currentBalance,
        newBalance: newBalance,
        amountReversed: paymentAmount
      };
    });

  } catch (error) {
    console.error('Error in createLaborPaymentDeletionTransaction:', error);
    throw error;
  }
}
