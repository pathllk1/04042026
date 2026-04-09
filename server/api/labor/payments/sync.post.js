import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { getFirestore } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { paymentId } = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!paymentId || !firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

    const config = await SupabaseConfig.findOne({
      firmId,
      isActive: true
    })

    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No active Supabase configuration found'
      })
    }

    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    const { data: payment, error } = await supabase
      .from('payment_records')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }

    if (!payment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Payment not found'
      })
    }

    const db = getFirestore()
    const ledgerRef = db.collection('ledgers').doc()
    await ledgerRef.set({
      paymentId: payment.id,
      groupId: payment.group_id,
      paymentDate: payment.payment_date,
      amount: payment.amount,
      project: payment.project,
      paymentMethod: payment.payment_method,
      firmId: payment.firm_id,
      createdAt: new Date()
    })

    await supabase
      .from('payment_records')
      .update({
        firestore_sync_status: 'synced',
        firestore_doc_id: ledgerRef.id
      })
      .eq('id', payment.id)

    return {
      success: true,
      message: 'Payment synced to Firestore successfully'
    }
  } catch (error) {
    console.error('Error syncing payment to Firestore:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to sync payment to Firestore'
    })
  }
})