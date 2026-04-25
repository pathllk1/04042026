import { H3Event } from 'h3';
import Bills from '../../../models/inventory/Bills';
import StockReg from '../../../models/inventory/StockReg';
import Stocks from '../../../models/inventory/Stocks';
import Party from '../../../models/inventory/Party';
import Firm from '../../../models/Firm';
import mongoose from 'mongoose';
import { createSalesBillLedgerTransactionMongo } from '../../../utils/inventoryLedgerMongo';
import { createStockFilter, createStockUpdateSet } from '../../../utils/stockFilterUtils';
import { selectOptimalGST, validateGSTSelection } from '../../../utils/gst-selection';

export default defineEventHandler(async (event: H3Event) => {
    let session = null;

    try {
        // Start MongoDB session for transaction
        session = await mongoose.startSession();
        session.startTransaction();
        const user = event.context.user;
        if (!user || !user.firmId) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
            });
        }

        const body = await readBody(event);
        let partyId: mongoose.Types.ObjectId | null = null;
        let partyName = body.partyName;

        // Create new party if newParty data is available
        if (body.newParty) {
            // Remove temporary ID if present
            const { _id, ...partyData } = body.newParty;
            const party = new Party({
                supply: partyData.supply,
                addr: partyData.addr,
                gstin: partyData.gstin || 'UNREGISTERED',
                state: partyData.state,
                state_code: partyData.state_code,
                pin: partyData.pin,
                pan: partyData.pan,
                contact: partyData.contact,
                usern: user._id,
                firm: user.firmId
            });
            const savedParty = await party.save({ session });
            partyId = savedParty._id as mongoose.Types.ObjectId;
            partyName = savedParty.supply;
        } else if (body.party) {
            partyId = body.party;
            
            // If partyName is missing, fetch it from the database
            if (!partyName) {
                const party = await Party.findById(partyId).session(session);
                if (party) {
                    partyName = party.supply;
                }
            }
        }

        // Process stock items and create/update Stocks and StockReg
        const stockRegs = [];
        const stockItems = body.stockItems || body.cart || [];
        const billType = body.type || 'SALES';

        // Process each stock item sequentially to avoid transaction conflicts
        for (const item of stockItems) {
            // Update or create Stocks using the utility function
            const stockFilter = createStockFilter(item, user.firmId);

            // Prepare the stock update object using the utility function
            const stockUpdateSet = createStockUpdateSet(item, user._id, user.firmId);

            // Add total calculation
            stockUpdateSet.total = item.qty * item.rate;

            const stockUpdate = {
                $inc: { qty: billType === 'PURCHASE' ? item.qty : -item.qty },
                $set: stockUpdateSet
            };

            // Use findOneAndUpdate with explicit session
            const stock = await Stocks.findOneAndUpdate(
                stockFilter,
                stockUpdate,
                { upsert: true, new: true, session }
            );
            const nqnty = stock.qty;
            // Create StockReg entry with proper handling of optional fields
            const stockRegData: any = {
                type: billType,
                bno: body.bno,
                bdate: body.bdate,
                supply: partyName,
                item: item.item,
                hsn: item.hsn,
                qty: item.qty,
                qtyh: nqnty, // Historical quantity
                uom: item.uom,
                rate: item.rate,
                total: item.total,
                user: user._id,
                firm: user.firmId,
                stockId: stock._id
            };

            // Add optional fields only if they have valid values
            if (item.item_narration) stockRegData.item_narration = item.item_narration;
            if (item.pno && item.pno.trim() !== '') stockRegData.pno = item.pno;
            if (item.batch && item.batch.trim() !== '') stockRegData.batch = item.batch;
            if (item.oem) stockRegData.oem = item.oem;
            if (item.grate) stockRegData.grate = item.grate;
            if (item.cgst) stockRegData.cgst = item.cgst;
            if (item.sgst) stockRegData.sgst = item.sgst;
            if (item.igst) stockRegData.igst = item.igst;
            if (item.disc) {
                stockRegData.disc = item.disc;
                stockRegData.discamt = (item.qty * item.rate) * item.disc / 100;
            }
            if (item.project) stockRegData.project = item.project;
            // Add new optional fields
            if (item.mrp) stockRegData.mrp = item.mrp;
            if (item.expiryDate) stockRegData.expiryDate = item.expiryDate;

            // Create the StockReg instance
            const stockReg = new StockReg(stockRegData);

            // Save the StockReg with the session
            const savedStockReg = await stockReg.save({ session });
            stockRegs.push(savedStockReg);
        }

        // Get firm data for GST selection
        const firm = await Firm.findById(user.firmId).session(session);
        if (!firm) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Firm not found'
            });
        }

        // Prepare firm GST options
        const firmGSTs = [
            {
                gstNumber: firm.gstNo,
                state: firm.state,
                stateCode: parseInt(firm.gstNo.substring(0, 2)) || 0,
                locationName: 'Head Office',
                address: firm.address,
                city: firm.city,
                pincode: firm.pincode,
                isPrimary: true
            },
            ...(firm.additionalGSTs || []).map(gst => {
                // Extract data from Mongoose document
                const gstData = gst._doc || gst;
                return {
                    gstNumber: gstData.gstNumber,
                    state: gstData.state,
                    stateCode: gstData.stateCode || parseInt(gstData.gstNumber?.substring(0, 2)) || 0,
                    locationName: gstData.locationName,
                    address: gstData.address,           // ← Add address
                    city: gstData.city,                 // ← Add city
                    pincode: gstData.pincode,           // ← Add pincode
                    isActive: gstData.isActive,         // ← Add isActive
                    isDefault: gstData.isDefault,       // ← Add isDefault
                    registrationType: gstData.registrationType, // ← Add registrationType
                    isPrimary: false
                };
            })
        ];



        // Prepare party GST options if party exists
        let partyGSTs: any[] = [];
        if (partyId) {
            const party = await Party.findById(partyId).session(session);
            if (party) {
                partyGSTs = [
                    {
                        gstNumber: party.gstin,
                        state: party.state,
                        stateCode: party.state_code || parseInt(party.gstin.substring(0, 2)) || 0,
                        locationName: 'Primary Location',
                        isPrimary: true
                    },
                    ...(party.additionalGSTs || []).map(gst => ({ ...gst, isPrimary: false }))
                ];
            }
        }

        // Perform GST selection
        const gstSelection = selectOptimalGST({
            firmGSTs,
            partyGSTs: partyGSTs.length > 0 ? partyGSTs : undefined,
            deliveryState: body.consigneeState || body.partyState,
            userPreferences: body.gstPreferences
        });

        // Simple validation - just check if we have a firm GST
        if (!gstSelection.firmGST?.gstNumber) {
            throw createError({
                statusCode: 400,
                statusMessage: 'No valid firm GST found'
            });
        }

        // Create the bill
        const bill = new Bills({
            bno: body.bno,
            bdate: body.bdate,
            supply: partyName,
            addr: body.partyAddress,
            gstin: body.partyGstin,
            state: body.partyState,
            pin: body.partyPin,
            gtot: body.gtot,
            disc: body.disc,
            cgst: body.cgst,
            usern: user._id,
            sgst: body.sgst,
            firm: user.firmId,
            igst: body.igst,
            rof: body.rof,
            ntot: body.ntot,
            btype: body.type,
            // Order and dispatch details
            orderNo: body.orderNo,
            orderDate: body.orderDate,
            dispatchThrough: body.dispatchThrough,
            docketNo: body.docketNo,
            vehicleNo: body.vehicleNo,
            // Consignee details
            consigneeName: body.consigneeName,
            consigneeGstin: body.consigneeGstin,
            consigneeAddress: body.consigneeAddress,
            consigneeState: body.consigneeState,
            consigneePin: body.consigneePin,
            narration: body.narration,
            oth_chg: body.oth_chg,
            stockRegIds: stockRegs.map(reg => reg._id),
            partyId: partyId,

            // GST selection tracking
            gstSelection: {
                firmGST: gstSelection.firmGST,
                partyGST: gstSelection.partyGST,
                transactionType: gstSelection.transactionType,
                gstApplicability: gstSelection.gstApplicability,
                selectionMethod: gstSelection.selectionMethod,
                selectionDate: new Date(),
                selectedBy: user._id
            }
        });

        await bill.save({ session });

        // Update each StockReg with the billId
        // Use a more reliable approach with explicit session handling
        for (const stockReg of stockRegs) {
            await StockReg.findByIdAndUpdate(
                stockReg._id,
                { billId: bill._id },
                { session, new: true }
            );
        }

        // Commit the transaction
        await session.commitTransaction();

        // Create ledger transaction for sales bill
        let ledgerResult = null;
        if (body.type === 'SALES') {
            try {
                ledgerResult = await createSalesBillLedgerTransactionMongo(
                    bill,
                    user._id.toString(),
                    user.firmId.toString()
                );
                console.log('Ledger transaction created:', ledgerResult);
            } catch (ledgerError) {
                console.error('Error creating ledger transaction:', ledgerError);
                // We don't throw here as the bill was already created successfully
                // Just log the error and continue
            }
        }

        return {
            success: true,
            message: 'Bill created successfully',
            id: bill._id,
            billNo: bill.bno,
            bill,
            ledgerTransaction: ledgerResult
        };
    } catch (error: any) {
        console.error('Error in bills.post.ts:', error);

        // Abort the transaction if it's active
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error('Error aborting transaction:', abortError);
            }
        }

        throw createError({
            statusCode: 400,
            message: error.message
        });
    } finally {
        // End the session in the finally block to ensure it's always closed
        if (session) {
            try {
                await session.endSession();
            } catch (endError) {
                console.error('Error ending session:', endError);
            }
        }
    }
});