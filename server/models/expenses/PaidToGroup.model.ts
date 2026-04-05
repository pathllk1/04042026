import mongoose from 'mongoose';

const PaidToGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const PaidToGroupModel = () =>
  mongoose.models.PaidToGroupMongo ||
  mongoose.model('PaidToGroupMongo', PaidToGroupSchema, 'paidToGroups');

export default PaidToGroupModel;


