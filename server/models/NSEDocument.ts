import mongoose, { Schema, Document } from 'mongoose';

export interface INSEDocument extends Document {
    type: string;
    description: string;
    file: string;
    fileId: string;
    userId: mongoose.Types.ObjectId;
    cnNoteId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const NSEDocumentSchema: Schema = new Schema({
    type: { type: String, required: true },
    description: { type: String, required: true },
    file: { type: String, required: true },
    fileId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cnNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CNNote' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Check if the model already exists to prevent model overwrite error
const NSEDocument = mongoose.models.NSEDocument || mongoose.model<INSEDocument>('NSEDocument', NSEDocumentSchema);

export default NSEDocument;
