import mongoose, { Schema, Document } from 'mongoose';

export interface IFolio extends Document {
    cn_no: string;
    symbol: string;
    price: number;
    qnty: number;
    amt: number;
    brokerage: number;
    broker: string;
    pdate: Date;
    namt: number;
    folio: string;
    type: string;
    rid: string;
    sector: string;
    user: string;
    cprice: number;
    cval: number;
    age: number;
    pl: number;
    prevDayPrice: number;
    dayPL: number;
    dayPLPercentage: number;
}

const folioSchema: Schema = new Schema({
    cn_no: { type: String, required: true },
    symbol: { type: String, required: true },
    price: { type: Number, required: true },
    qnty: { type: Number, required: true },
    amt: { type: Number, required: true },
    brokerage: { type: Number, required: true },
    broker: { type: String, required: true },
    pdate: { type: Date, required: true },
    namt: { type: Number, required: true },
    folio: { type: String, required: true },
    type: { type: String, required: true },
    rid: { type: String, required: true },
    sector: { type: String, required: true },
    user: { type: String, required: true },
    cprice: { type: Number },
    cval: { type: Number },
    age: { type: Number },
    pl: { type: Number },
    prevDayPrice: { type: Number },
    dayPL: { type: Number },
    dayPLPercentage: { type: Number },
    cnNoteId: { type: Schema.Types.ObjectId, ref: 'CNNote' }
}, { timestamps: true });

// Check if the model already exists to prevent model overwrite error
const FolioModel = mongoose.models.Folio || mongoose.model<IFolio>('Folio', folioSchema);

export { FolioModel as Folio };
export default FolioModel;