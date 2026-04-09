import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing subs transactions
 *
 * Handles POST (create) operations
 */
export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const db = getFirestore();
  const method = event.node.req.method;

  // POST - Create a new subs transaction
  if (method === 'POST') {
    const debugId = `API_createTransaction_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      console.log(`🌟 [${debugId}] ===== API TRANSACTION CREATION STARTED =====`);
      console.log(`🌟 [${debugId}] Request headers:`, event.node.req.headers);
      console.log(`🌟 [${debugId}] Request method:`, method);
      console.log(`🌟 [${debugId}] Request URL:`, event.node.req.url);

      const body = await readBody(event);

      console.log(`🌟 [${debugId}] === TRANSACTION CREATION DEBUG ===`);
      console.log(`🌟 [${debugId}] Request body:`, JSON.stringify(body, null, 2));
      console.log(`🌟 [${debugId}] User firmId:`, firmId);
      console.log(`🌟 [${debugId}] User ID:`, userId);
      console.log(`🌟 [${debugId}] Request timestamp:`, new Date().toISOString());

      // Validate required fields
      if (!body.date || !body.amount || !body.paidTo || !body.subsModelId) {
        console.log(`❌ [${debugId}] Missing required fields:`, {
          date: !!body.date,
          amount: !!body.amount,
          paidTo: !!body.paidTo,
          subsModelId: !!body.subsModelId
        });
        throw createError({
          statusCode: 400,
          message: 'Missing required fields: date, amount, paidTo, subsModelId'
        });
      }

      console.log(`✅ [${debugId}] All required fields present`);

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();
      console.log('Firm ID string:', firmIdStr);
      console.log('Looking for subsModelId:', body.subsModelId);

      // Find the specific subs model by ID
      const subsRef = db.collection('subsModels').doc(body.subsModelId);
      console.log('Firestore path:', `subsModels/${body.subsModelId}`);

      const subsDoc = await subsRef.get();
      console.log('Subs doc exists:', subsDoc.exists);

      if (!subsDoc.exists) {
        // Let's see what subs models actually exist
        console.log('Subs model not found. Checking what exists...');
        const allSubsSnapshot = await db.collection('subsModels').where('firmId', '==', firmIdStr).get();
        console.log('Total subs models in firm:', allSubsSnapshot.size);
        allSubsSnapshot.forEach(doc => {
          console.log('Existing subs model:', {
            id: doc.id,
            name: doc.data().name,
            firmId: doc.data().firmId
          });
        });

        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const subsData = subsDoc.data();

      // Verify the subs model belongs to the correct firm
      if (subsData.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Prepare transaction data
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`🆔 [${debugId}] Generated transaction ID:`, transactionId);

      const transactionData = {
        id: transactionId,
        date: Timestamp.fromDate(new Date(body.date)),
        amount: Number(body.amount),
        paidTo: body.paidTo,
        category: body.category || 'PAYMENT',
        project: body.project || '',
        description: body.description || '',
        createdAt: Timestamp.now(),
        createdBy: userId.toString()
      };

      console.log(`💾 [${debugId}] Transaction data prepared:`, {
        id: transactionData.id,
        amount: transactionData.amount,
        paidTo: transactionData.paidTo,
        category: transactionData.category,
        date: transactionData.date.toDate().toISOString()
      });

      // Calculate new balance
      const newBalance = subsData.balance + Number(body.amount);
      console.log(`💰 [${debugId}] Balance calculation:`, {
        currentBalance: subsData.balance,
        transactionAmount: Number(body.amount),
        newBalance: newBalance
      });

      // Create transaction in the subs collection (where transactions are actually stored)
      const subsCollection = db.collection('subs');

      // Check for existing transaction with same details to prevent duplicates
      console.log(`🔍 [${debugId}] Checking for duplicate transactions...`);
      const existingTransactionQuery = await subsCollection
        .where('firmId', '==', firmIdStr)
        .where('amount', '==', Number(body.amount))
        .where('paidTo', '==', body.paidTo)
        .where('date', '==', Timestamp.fromDate(new Date(body.date)))
        .get();

      console.log(`🔍 [${debugId}] Duplicate check query size:`, existingTransactionQuery.size);

      if (!existingTransactionQuery.empty) {
        console.log(`⚠️ [${debugId}] Potential duplicate transaction detected:`);
        existingTransactionQuery.forEach(doc => {
          const existing = doc.data();
          console.log(`⚠️ [${debugId}]   Existing: ID=${existing.id}, Amount=₹${existing.amount}, Date=${existing.date.toDate().toLocaleDateString()}, PaidTo=${existing.paidTo}`);
        });

        throw createError({
          statusCode: 409,
          statusMessage: 'A transaction with the same amount, date, and recipient already exists. Please check for duplicates.'
        });
      }

      console.log(`✅ [${debugId}] No duplicate transactions found`);

      const subsTransactionData = {
        ...transactionData,
        firmId: firmIdStr,
        subId: subsDoc.id,
        subName: subsData.name,
        // Add balance tracking
        balanceBefore: subsData.balance,
        balanceAfter: newBalance
      };

      // Add transaction to subs collection
      console.log(`💾 [${debugId}] About to add transaction to subs collection...`);
      console.log(`💾 [${debugId}] Full transaction data:`, JSON.stringify(subsTransactionData, null, 2));

      const newTransactionDoc = await subsCollection.add(subsTransactionData);

      console.log(`✅ [${debugId}] Transaction created in subs collection with doc ID: ${newTransactionDoc.id}`);
      console.log(`✅ [${debugId}]   Transaction data:`, {
        id: subsTransactionData.id,
        amount: subsTransactionData.amount,
        date: subsTransactionData.date.toDate().toLocaleDateString(),
        paidTo: subsTransactionData.paidTo,
        subName: subsTransactionData.subName,
        docId: newTransactionDoc.id
      });

      // Update subs model balance only (no longer storing transactions array)
      console.log(`🔄 [${debugId}] About to update subs model balance...`);
      await subsDoc.ref.update({
        balance: newBalance,
        updatedAt: Timestamp.now(),
        updatedBy: userId.toString()
      });
      console.log(`✅ [${debugId}] SubsModel balance updated to: ₹${newBalance}`);

      const responseData = {
        ...transactionData,
        date: transactionData.date.toDate().toISOString(),
        createdAt: transactionData.createdAt.toDate().toISOString()
      };

      console.log(`🎉 [${debugId}] ===== API TRANSACTION CREATION COMPLETED SUCCESSFULLY =====`);
      console.log(`🎉 [${debugId}] Response data:`, responseData);

      return responseData;
    } catch (error) {
      console.error(`❌ [${debugId}] ===== API TRANSACTION CREATION ERROR =====`);
      console.error(`❌ [${debugId}] Error creating subs transaction:`, error);
      console.error(`❌ [${debugId}] Error message:`, error.message);
      console.error(`❌ [${debugId}] Error stack:`, error.stack);

      throw createError({
        statusCode: 500,
        message: 'Failed to create subs transaction',
        cause: error
      });
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
