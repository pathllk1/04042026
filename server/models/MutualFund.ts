import mongoose, { Schema, Document } from 'mongoose';

export interface IMutualFund extends Document {
    schemeName: string;
    schemeCode: string;
    fundHouse: string;
    category: string;
    purchaseNAV: number;
    units: number;
    investmentAmount: number;
    purchaseDate: Date;
    folioNumber: string;
    currentNAV: number;
    currentValue: number;
    profitLoss: number;
    profitLossPercentage: number;
    xirr: number;
    sipFlag: boolean;
    sipAmount: number;
    sipFrequency: string;
    sipDay: number;
    lastNAVUpdate: Date;
    user: string;
    broker: string;
    expense: number;
    dividendOption: string;
    prevDayNAV: number;
    dayPL: number;
    dayPLPercentage: number;
}

const mutualFundSchema: Schema = new Schema({
    schemeName: { type: String, required: true },
    schemeCode: { type: String, required: true },
    fundHouse: { type: String, required: true },
    category: { type: String, required: true },
    purchaseNAV: { type: Number, required: true },
    units: { type: Number, required: true },
    investmentAmount: { type: Number, required: true },
    purchaseDate: { type: Date, required: true },
    folioNumber: { type: String, required: true },
    currentNAV: { type: Number },
    currentValue: { type: Number },
    profitLoss: { type: Number },
    profitLossPercentage: { type: Number },
    xirr: { type: Number },
    sipFlag: { type: Boolean, default: false },
    sipAmount: { type: Number },
    sipFrequency: { type: String },
    sipDay: { type: Number },
    lastNAVUpdate: { type: Date },
    user: { type: String, required: true },
    broker: { type: String, required: true },
    expense: { type: Number, default: 0 },
    dividendOption: { type: String, default: 'Growth' },
    prevDayNAV: { type: Number },
    dayPL: { type: Number },
    dayPLPercentage: { type: Number }
}, { timestamps: true });

// Check if the model already exists to prevent model overwrite error
const MutualFundModel = mongoose.models.MutualFund || mongoose.model<IMutualFund>('MutualFund', mutualFundSchema);

export { MutualFundModel as MutualFund };
export default MutualFundModel;
