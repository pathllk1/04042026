import mongoose, { Schema, Document } from 'mongoose';

interface IDocument extends Document {
    name: string;
    description: string;
    ref_no: string;
    value: number;
    startDate?: Date; // Optional
    closedDate?: Date; // Optional
    oExpiryDate: Date; // Required
    expiryDate: Date; // Required
    userId: string; // New field
    status: string
    file?: string
    fileId?: string // Google Drive file ID
}

const DocumentSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        description: { type: String, required: true },
        ref_no: { type: String, required: true },
        value: { type: Number, required: true },
        startDate: { type: Date }, // Optional
        closedDate: { type: Date }, // Optional
        oExpiryDate: { type: Date, required: true }, // Required
        expiryDate: { type: Date, required: true }, // Required
        userId: { type: String, required: true }, // Added field, marked as required
        firmId: {
            type: Schema.Types.ObjectId,
            ref: 'Firm',
            required: true
          },
        status: {type: String},
        file: { type: String, required: false },
        fileId: { type: String, required: false }, // Google Drive file ID
    },
    { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

export default mongoose.model<IDocument>('Document', DocumentSchema);
