import { Firm } from '../../models/index'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const body = await readBody(event)

    if (!body.name || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Firm name is required'
      })
    }

    const existingFirm = await Firm.findOne({ name: body.name.trim() })
    if (existingFirm) {
      throw createError({
        statusCode: 409,
        message: 'Firm with this name already exists'
      })
    }

    const validLocations = (body.locations || []).filter((l: any) => l.gst_number?.trim() || l.address?.trim())
    if (validLocations.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'At least one location is required'
      })
    }

    if (!validLocations.some((l: any) => l.is_default)) {
      validLocations[0].is_default = true
    }

    const firmData = {
      name: body.name.trim(),
      legal_name: body.legal_name?.trim(),
      code: body.code?.trim(),
      description: body.description?.trim(),
      business_type: body.business_type?.trim(),
      industry_type: body.industry_type?.trim(),
      establishment_year: body.establishment_year,
      employee_count: body.employee_count,
      status: body.status || 'approved',
      phone_number: body.phone_number?.trim(),
      secondary_phone: body.secondary_phone?.trim(),
      email: body.email?.trim(),
      website: body.website?.trim(),
      pan_number: body.pan_number?.trim(),
      cin_number: body.cin_number?.trim(),
      registration_number: body.registration_number?.trim(),
      registration_date: body.registration_date?.trim(),
      tax_id: body.tax_id?.trim(),
      vat_number: body.vat_number?.trim(),
      license_numbers: body.license_numbers?.trim(),
      insurance_details: body.insurance_details?.trim(),
      bank_account_number: body.bank_account_number?.trim(),
      bank_name: body.bank_name?.trim(),
      bank_branch: body.bank_branch?.trim(),
      ifsc_code: body.ifsc_code?.trim(),
      payment_terms: body.payment_terms?.trim(),
      currency: body.currency || 'INR',
      timezone: body.timezone || 'Asia/Kolkata',
      fiscal_year_start: body.fiscal_year_start?.trim(),
      invoice_prefix: body.invoice_prefix?.trim(),
      quote_prefix: body.quote_prefix?.trim(),
      po_prefix: body.po_prefix?.trim(),
      logo_url: body.logo_url?.trim(),
      enable_e_invoice: body.enable_e_invoice || false,
      locations: validLocations.map((l: any) => ({
        gst_number: l.gst_number?.trim(),
        state_code: l.state_code?.trim(),
        state: l.state?.trim(),
        registration_type: l.registration_type || 'PPOB',
        address: l.address?.trim(),
        city: l.city?.trim(),
        pincode: l.pincode?.trim(),
        is_default: l.is_default
      }))
    }

    const firm = await Firm.create(firmData)

    return {
      success: true,
      message: 'Firm created successfully',
      data: firm
    }
  } catch (err: any) {
    console.error('Error creating firm:', err)
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      message: 'Failed to create firm'
    })
  }
})
