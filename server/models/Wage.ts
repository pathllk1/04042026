import { Schema, model } from 'mongoose'

const wageSchema = new Schema({
  employeeName: {
    type: String,
    required: true
  },
  bank: {
    type: String,
    required: true
  },
  branch: {
    type: String,
    required: false
  },
  accountNo: {
    type: String,
    required: true
  },
  ifsc: {
    type: String,
    required: true
  },
  pDayWage: Number,
  wage_Days: {
    type: Number,
    default: 26
  },
  project: String,
  site: String,
  gross_salary: Number,
  epf_deduction: Number,
  esic_deduction: Number,
  other_deduction: Number,
  advance_recovery: {
    type: Number,
    default: 0
  },
  advance_recovery_id: {
    type: Schema.Types.ObjectId,
    ref: 'AdvanceRecovery',
    required: false
  },
  other_benefit: Number,
  net_salary: Number,
  salary_month: {
    type: Date,
    required: true
  },
  paid_date: Date,
  cheque_no: String,
  paid_from_bank_ac: String,
  masterRollId: {
    type: Schema.Types.ObjectId,
    ref: 'MasterRoll',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  firmId: {
    type: Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  }
}, {
  timestamps: true
})

export const Wage = model('Wage', wageSchema)