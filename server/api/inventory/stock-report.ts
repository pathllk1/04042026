// server/api/inventory/stock-report.ts
import { defineEventHandler, createError, getQuery } from 'h3';
import Stocks from '../../models/inventory/Stocks';
import StockReg from '../../models/inventory/StockReg';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Get query parameters
    const query = getQuery(event);
    const searchTerm = query.search ? String(query.search) : '';
    const limit = query.limit ? parseInt(String(query.limit)) : 100;
    const page = query.page ? parseInt(String(query.page)) : 1;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {
      firm: user.firmId
    };

    // Add search filter if provided
    if (searchTerm) {
      filter.$or = [
        { item: { $regex: searchTerm, $options: 'i' } },
        { pno: { $regex: searchTerm, $options: 'i' } },
        { batch: { $regex: searchTerm, $options: 'i' } },
        { hsn: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Get stocks with pagination
    const stocks = await Stocks.find(filter)
      .sort({ item: 1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await Stocks.countDocuments(filter);

    // Get stock registration data for each stock
    const stockIds = stocks.map(stock => stock._id);
    const stockRegs = await StockReg.find({
      stockId: { $in: stockIds },
      firm: user.firmId
    })
      .sort({ bdate: -1 })
      .limit(1000); // Limit to recent transactions

    // Group stock registrations by stockId
    const stockRegsByStockId = stockRegs.reduce((acc, reg) => {
      const stockId = reg.stockId.toString();
      if (!acc[stockId]) {
        acc[stockId] = [];
      }
      acc[stockId].push(reg);
      return acc;
    }, {});

    // Combine stocks with their registration data
    const stocksWithHistory = stocks.map(stock => {
      const stockId = stock._id.toString();
      const history = stockRegsByStockId[stockId] || [];
      
      // Sort history by date (newest first)
      history.sort((a, b) => new Date(b.bdate).getTime() - new Date(a.bdate).getTime());
      
      return {
        ...stock.toObject(),
        history
      };
    });

    return {
      stocks: stocksWithHistory,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error: any) {
    console.error('Error fetching stock report:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal Server Error'
    });
  }
});
