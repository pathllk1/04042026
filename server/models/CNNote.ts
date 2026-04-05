import mongoose, { Schema, Document } from 'mongoose';

export interface ICNNote extends Document {
    cn_no: string;
    cn_date: Date;
    broker: string;
    type: string;
    folio: string;
    oth_chg: number;
    famt: number;
    user: string;
    firmId?: string; // Optional firmId field
    createdAt: Date;
    updatedAt: Date;
    Folio_rec: mongoose.Types.ObjectId[];
    documents: mongoose.Types.ObjectId[];
}

// Define the schema
const CNNoteSchema = new Schema({
    cn_no: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function(v: string): boolean {
                return v !== undefined && v !== null && v.trim().length > 0;
            },
            message: 'CN Number cannot be empty'
        }
    },
    cn_date: { type: Date, required: true },
    broker: { type: String, required: true },
    type: { type: String, required: true },
    folio: { type: String, required: true },
    oth_chg: { type: Number },
    famt: { type: Number, required: true },
    user: { type: String, required: true },
    firmId: { type: String },
    Folio_rec: [{ type: Schema.Types.ObjectId, ref: 'Folio' }],
    documents: [{ type: Schema.Types.ObjectId, ref: 'NSEDocument' }]
}, {
    timestamps: true
});

// Add a compound index to ensure uniqueness of cn_no per user
CNNoteSchema.index({ cn_no: 1, user: 1 }, { unique: true });

// Add a compound index for firmId and cn_no, but make it sparse to allow nulls
CNNoteSchema.index({ firmId: 1, cn_no: 1 }, { unique: true, sparse: true });

// Remove any existing problematic indexes if they exist
try {
    CNNoteSchema.indexes().forEach(index => {
        // Check for cnNumber index
        if (index[0] && index[0].cnNumber) {
            CNNoteSchema.index({ cnNumber: 1 }, { unique: false, background: true, sparse: true });
        }

        // Check for firmId_cnNumber compound index
        if (index[0] && index[0].firmId && index[0].cnNumber) {
            CNNoteSchema.index({ firmId: 1, cnNumber: 1 }, { unique: false, background: true, sparse: true });
        }
    });
} catch (error) {
    console.error('Error checking for problematic indexes:', error);
}

// Check if the model already exists to prevent model overwrite error
const CNNoteModel = mongoose.models.CNNote || mongoose.model<ICNNote>('CNNote', CNNoteSchema);

export { CNNoteModel as CNNote };
export default CNNoteModel;