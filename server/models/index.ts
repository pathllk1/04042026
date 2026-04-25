/**
 * server/models/index.ts
 *
 * Central model registry for the Nuxt server directory.
 * All Mongoose models are defined here so they are registered exactly once,
 * regardless of how many server routes import them.
 *
 * If a model was already compiled (hot-reload / tests), mongoose.model() falls
 * back to the cached version — no "Cannot overwrite model" errors.
 */

import mongoose, { Schema, type Document, type Model } from 'mongoose'

/* ─── Helper ─────────────────────────────────────────────────────────────── */

function model<T extends Document>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema)
}

/* ════════════════════════════════════════════════════════════════════════════
   BILL
════════════════════════════════════════════════════════════════════════════ */

const billSchema = new Schema(
  {
    firm_id:           { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    voucher_id:        { type: String },
    bno:               { type: String, required: true },
    bdate:             { type: String, required: true },
    supply:            { type: String },
    addr:              { type: String },
    gstin:             { type: String },
    state:             { type: String },
    pin:               { type: String },
    state_code:        { type: String },
    firm_gstin:        { type: String, default: null },
    firm_state:        { type: String, default: null },
    firm_state_code:   { type: String, default: null },
    gtot:              { type: Number, required: true, default: 0 },
    ntot:              { type: Number, required: true, default: 0 },
    rof:               { type: Number, default: 0 },
    btype:             { type: String, default: 'SALES' },
    bill_subtype:      { type: String },
    usern:             { type: String },
    firm:              { type: String },
    party_id:          { type: Schema.Types.ObjectId, ref: 'Party', default: null },
    oth_chg_json:      { type: String },
    other_charges:     [{ type: Schema.Types.Mixed }],
    supplier_bill_no:  { type: String },
    order_no:          { type: String },
    vehicle_no:        { type: String },
    dispatch_through:  { type: String },
    narration:         { type: String },
    reverse_charge:    { type: Boolean, default: false },
    cgst:              { type: Number, default: 0 },
    sgst:              { type: Number, default: 0 },
    igst:              { type: Number, default: 0 },
    ref_bill_id:       { type: Schema.Types.ObjectId, ref: 'Bill', default: null },
    status:            { type: String, default: 'ACTIVE' },
    cancellation_reason: { type: String },
    cancelled_at:      { type: Date, default: null },
    cancelled_by:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
    consignee_name:    { type: String },
    consignee_gstin:   { type: String },
    consignee_address: { type: String },
    consignee_state:   { type: String },
    consignee_pin:     { type: String },
    consignee_state_code: { type: String },
    file_url:          { type: String, default: null },
    file_path:         { type: String, default: null },
    file_uploaded_by:  { type: String, default: null },
  },
  { timestamps: true },
)

billSchema.index({ firm_id: 1, bno: 1 },                         { unique: true })
billSchema.index({ firm_id: 1, btype: 1, createdAt: -1 })
billSchema.index({ firm_id: 1, party_id: 1 })
billSchema.index({ firm_id: 1, status: 1 })
billSchema.index({ firm_id: 1, party_id: 1, supplier_bill_no: 1, status: 1 })
billSchema.index({ firm_id: 1, firm_gstin: 1, bdate: 1 })
billSchema.index({ ref_bill_id: 1 })

export const Bill = model<Document>('Bill', billSchema)

/* ════════════════════════════════════════════════════════════════════════════
   BILL SEQUENCE
════════════════════════════════════════════════════════════════════════════ */

const billSequenceSchema = new Schema(
  {
    firm_id:        { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    financial_year: { type: String, required: true },
    last_sequence:  { type: Number, default: 0 },
    voucher_type:   { type: String, default: null },
  },
  { timestamps: true },
)

billSequenceSchema.index(
  { firm_id: 1, financial_year: 1, voucher_type: 1 },
  { unique: true },
)

export const BillSequence = model<Document>('BillSequence', billSequenceSchema)

/* ════════════════════════════════════════════════════════════════════════════
   VOUCHER SEQUENCE
════════════════════════════════════════════════════════════════════════════ */

const voucherSequenceSchema = new Schema(
  {
    firm_id:        { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    financial_year: { type: String, required: true },
    last_sequence:  { type: Number, default: 0 },
  },
  { timestamps: true },
)

voucherSequenceSchema.index({ firm_id: 1, financial_year: 1 }, { unique: true })

export const VoucherSequence = model<Document>('VoucherSequence', voucherSequenceSchema)

/* ════════════════════════════════════════════════════════════════════════════
   FIRM
════════════════════════════════════════════════════════════════════════════ */

const firmSchema = new Schema(
  {
    name:                { type: String, required: true, unique: true },
    code:                { type: String },
    description:         { type: String },
    legal_name:          { type: String },
    address:             { type: String },
    city:                { type: String },
    state:               { type: String },
    country:             { type: String },
    pincode:             { type: String },
    gst_number:          { type: String },
    locations: [
      {
        gst_number:        { type: String },
        state_code:        { type: String },
        state:             { type: String },
        registration_type: { type: String, enum: ['PPOB', 'APOB'], default: 'PPOB' },
        address:           { type: String },
        city:              { type: String },
        pincode:           { type: String },
        is_default:        { type: Boolean, default: false },
      },
    ],
    phone_number:        { type: String },
    secondary_phone:     { type: String },
    email:               { type: String },
    website:             { type: String },
    business_type:       { type: String },
    industry_type:       { type: String },
    establishment_year:  { type: Number },
    employee_count:      { type: Number },
    registration_number: { type: String },
    registration_date:   { type: String },
    cin_number:          { type: String },
    pan_number:          { type: String },
    tax_id:              { type: String },
    vat_number:          { type: String },
    bank_account_number: { type: String },
    bank_name:           { type: String },
    bank_branch:         { type: String },
    ifsc_code:           { type: String },
    payment_terms:       { type: String },
    status:              { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    license_numbers:     { type: String },
    insurance_details:   { type: String },
    currency:            { type: String, default: 'INR' },
    timezone:            { type: String, default: 'Asia/Kolkata' },
    fiscal_year_start:   { type: String },
    invoice_prefix:      { type: String },
    quote_prefix:        { type: String },
    po_prefix:           { type: String },
    logo_url:            { type: String },
    invoice_template:    { type: String },
    enable_e_invoice:    { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const Firm = model<Document>('Firm', firmSchema)

/* ════════════════════════════════════════════════════════════════════════════
   FIRM SETTINGS
════════════════════════════════════════════════════════════════════════════ */

const firmSettingsSchema = new Schema(
  {
    firm_id:       { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    setting_key:   { type: String, required: true },
    setting_value: { type: String },
    description:   { type: String },
  },
  { timestamps: true },
)

firmSettingsSchema.index({ firm_id: 1, setting_key: 1 }, { unique: true })

export const FirmSettings = model<Document>('FirmSettings', firmSettingsSchema)

/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS (global)
════════════════════════════════════════════════════════════════════════════ */

const settingsSchema = new Schema(
  {
    setting_key:   { type: String, required: true, unique: true },
    setting_value: { type: String },
    description:   { type: String },
  },
  { timestamps: true },
)

export const Settings = model<Document>('Settings', settingsSchema)

/* ════════════════════════════════════════════════════════════════════════════
   LEDGER
════════════════════════════════════════════════════════════════════════════ */

const ledgerSchema = new Schema(
  {
    firm_id:          { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    voucher_id:       { type: Number },
    voucher_type:     { type: String },
    voucher_no:       { type: String },
    account_head:     { type: String, required: true },
    account_type: {
      type: String,
      enum: [
        'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
        'ASSET', 'LIABILITY', 'CASH', 'BANK',
        'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
        'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
        'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN',
      ],
    },
    debit_amount:     { type: Number, default: 0 },
    credit_amount:    { type: Number, default: 0 },
    narration:        { type: String },
    payment_mode:     { type: String, default: null },
    bill_id:          { type: Schema.Types.ObjectId, ref: 'Bill',        default: null },
    party_id:         { type: Schema.Types.ObjectId, ref: 'Party',       default: null },
    bank_account_id:  { type: Schema.Types.ObjectId, ref: 'BankAccount', default: null },
    stock_id:         { type: Schema.Types.ObjectId, ref: 'Stock',       default: null },
    stock_reg_id:     { type: Schema.Types.ObjectId, ref: 'StockReg',    default: null },
    ref_type: {
      type: String,
      enum: ['BILL', 'JOURNAL', 'VOUCHER', 'OPENING_BALANCE', 'MANUAL'],
      default: null,
    },
    ref_id:           { type: Schema.Types.ObjectId, default: null },
    tax_type:         { type: String },
    tax_rate:         { type: Number },
    transaction_date: { type: String },
    created_by:       { type: String },
    is_locked:        { type: Boolean, default: false },
  },
  { timestamps: true },
)

ledgerSchema.index({ firm_id: 1, voucher_type: 1, transaction_date: -1 })
ledgerSchema.index({ firm_id: 1, voucher_id: 1 })
ledgerSchema.index({ firm_id: 1, account_head: 1 })
ledgerSchema.index({ firm_id: 1, party_id: 1 })
ledgerSchema.index({ firm_id: 1, bank_account_id: 1 })
ledgerSchema.index({ firm_id: 1, stock_id: 1 })
ledgerSchema.index({ firm_id: 1, ref_type: 1, transaction_date: -1 })
ledgerSchema.index({ firm_id: 1, is_locked: 1 })

export const Ledger = model<Document>('Ledger', ledgerSchema)

/* ════════════════════════════════════════════════════════════════════════════
   PARTY
════════════════════════════════════════════════════════════════════════════ */

const partySchema = new Schema(
  {
    firm_id:    { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    firm:       { type: String, required: true },
    gstin:      { type: String, default: 'UNREGISTERED' },
    contact:    { type: String },
    state:      { type: String },
    state_code: { type: String },
    addr:       { type: String },
    pin:        { type: String },
    pan:        { type: String },
    gstLocations: [
      {
        gstin:      { type: String },
        state_code: { type: String },
        state:      { type: String },
        address:    { type: String },
        city:       { type: String },
        pincode:    { type: String },
        contact:    { type: String },
        is_primary: { type: Boolean, default: false },
      },
    ],
    primary_gstin_index: { type: Number, default: 0 },
    usern:  { type: String },
    supply: { type: String },
  },
  { timestamps: true },
)

partySchema.index({ firm_id: 1, firm: 1 },                { unique: true })
partySchema.index({ firm_id: 1, 'gstLocations.gstin': 1 })

export const Party = model<Document>('Party', partySchema)

/* ════════════════════════════════════════════════════════════════════════════
   STOCK
════════════════════════════════════════════════════════════════════════════ */

const batchSchema = new Schema(
  {
    batch:  { type: String },
    qty:    { type: Number, required: true },
    uom:    { type: String, required: true, default: 'PCS' },
    rate:   { type: Number, required: true },
    grate:  { type: Number, required: true, default: 18 },
    expiry: { type: Date },
    mrp:    { type: Number },
  },
  { _id: true },
)

const stockSchema = new Schema(
  {
    firm_id: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    item:    { type: String, required: true },
    pno:     { type: String },
    oem:     { type: String },
    hsn:     { type: String, required: true },
    qty:     { type: Number, required: true, default: 0 },
    uom:     { type: String, required: true, default: 'pcs' },
    rate:    { type: Number, required: true, default: 0 },
    grate:   { type: Number, required: true, default: 0 },
    total:   { type: Number, required: true, default: 0 },
    mrp:     { type: Number },
    batches: [batchSchema],
    user:    { type: String },
  },
  { timestamps: true },
)

stockSchema.index({ firm_id: 1, item: 1 }, { unique: true })

export const Stock = model<Document>('Stock', stockSchema)

/* ════════════════════════════════════════════════════════════════════════════
   STOCK REGISTER (StockReg)
════════════════════════════════════════════════════════════════════════════ */

const stockRegSchema = new Schema(
  {
    firm_id:        { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    type:           { type: String, required: true },
    bno:            { type: String },
    bdate:          { type: String },
    supply:         { type: String },
    item_type:      { type: String, default: 'GOODS' },
    show_qty:       { type: Boolean, default: true },
    item:           { type: String, required: true },
    item_narration: { type: String },
    batch:          { type: String },
    hsn:            { type: String },
    qty:            { type: Number, required: true },
    uom:            { type: String },
    rate:           { type: Number, default: 0 },
    grate:          { type: Number, default: 0 },
    disc:           { type: Number, default: 0 },
    total:          { type: Number, default: 0 },
    cost_rate:      { type: Number, default: null },
    stock_id:       { type: Schema.Types.ObjectId, ref: 'Stock',  default: null },
    bill_id:        { type: Schema.Types.ObjectId, ref: 'Bill',   default: null },
    user:           { type: String },
    firm:           { type: String },
    qtyh:           { type: Number, default: 0 },
  },
  { timestamps: true },
)

stockRegSchema.index({ firm_id: 1, bill_id: 1 })
stockRegSchema.index({ firm_id: 1, stock_id: 1, type: 1 })
stockRegSchema.index({ firm_id: 1, type: 1 })

export const StockReg = model<Document>('StockReg', stockRegSchema)