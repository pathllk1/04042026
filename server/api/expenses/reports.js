import { getFirestore } from 'firebase-admin/firestore';

/**
 * API endpoint for generating expense reports
 *
 * Handles GET operations for various report types
 */
export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  // Get query parameters
  const query = getQuery(event);
  const reportType = query.type;
  const timePeriod = query.timePeriod;

  if (!reportType) {
    throw createError({
      statusCode: 400,
      message: 'Report type is required'
    });
  }



  const db = getFirestore();
  const expensesCollection = db.collection('expenses');

  try {
    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();


    // Helper function to process Firestore snapshot
    function processSnapshot(snapshot) {
      if (snapshot.empty) {
        return [];
      }

      // Transform data
      const expenses = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        expenses.push({
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null
        });
      });

      return expenses;
    }

    try {
      // First approach: Try with composite query (requires index)
      // Base query - filter by firmId
      let expensesQuery = expensesCollection.where('firmId', '==', firmIdStr);

    // Apply date filters if provided
    if (query.startDate && query.endDate) {
      expensesQuery = expensesQuery
        .where('date', '>=', new Date(query.startDate))
        .where('date', '<=', new Date(query.endDate));
    } else if (query.startDate) {
      expensesQuery = expensesQuery.where('date', '>=', new Date(query.startDate));
    } else if (query.endDate) {
      expensesQuery = expensesQuery.where('date', '<=', new Date(query.endDate));
    }

      // Execute the query
      const snapshot = await expensesQuery.orderBy('date', 'desc').get();
      let expenses = processSnapshot(snapshot);

      // Generate report based on report type
      return generateReport(reportType, expenses, query);
    } catch (indexError) {


      // Fallback approach: Get all expenses for the firm and filter in memory
      const snapshot = await expensesCollection.where('firmId', '==', firmIdStr).get();

      // Process the snapshot
      let expenses = processSnapshot(snapshot);

      // Apply filters in memory
      if (query.startDate) {
        const startDate = new Date(query.startDate).getTime();
        expenses = expenses.filter(expense => expense.date.getTime() >= startDate);
      }

      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        const endDateMs = endDate.getTime();
        expenses = expenses.filter(expense => expense.date.getTime() <= endDateMs);
      }

      // Sort by date descending
      expenses.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Generate report based on report type
      return generateReport(reportType, expenses, query);
    }

  } catch (error) {

    throw createError({
      statusCode: 500,
      message: 'Failed to generate report'
    });
  }
});

/**
 * Helper function to generate report based on type
 */
function generateReport(reportType, expenses, query) {
  // Apply additional filters based on query parameters
  if (query.paidTo) {
    expenses = expenses.filter(expense => expense.paidTo === query.paidTo);
  }

  // Apply time period filter if provided
  if (query.timePeriod) {
    expenses = filterByTimePeriod(expenses, reportType, query.timePeriod);
  }

  if (query.category) {
    expenses = expenses.filter(expense => expense.category === query.category);
  }

  if (query.project) {
    expenses = expenses.filter(expense => expense.project === query.project);
  }

  if (query.paymentMode) {
    expenses = expenses.filter(expense => expense.paymentMode?.type === query.paymentMode);
  }

  if (query.paidToGroup) {
    expenses = expenses.filter(expense => expense.paidToGroup === query.paidToGroup);
  }

  if (query.isTransfer !== undefined) {
    const isTransfer = query.isTransfer === 'true';
    expenses = expenses.filter(expense => expense.isTransfer === isTransfer);
  }

  // If no expenses found after filtering, return empty report
  if (expenses.length === 0) {
    return {
      reportType,
      data: [],
      summary: {
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      }
    };
  }

  // Generate report based on report type
  switch (reportType) {
    case 'daily':
      return generateDailyReport(expenses);

    case 'weekly':
      return generateWeeklyReport(expenses);

    case 'monthly':
      return generateMonthlyReport(expenses);

    case 'yearly':
      return generateYearlyReport(expenses);

    case 'financial-year':
      return generateFinancialYearReport(expenses);

    case 'date-range':
      return generateDateRangeReport(expenses);

    case 'paidTo':
      return generatePaidToReport(expenses);

    case 'category':
      return generateCategoryReport(expenses);

    case 'project':
      return generateProjectReport(expenses);

    case 'subs':
      return generateSubsReport(expenses);

    default:
      throw createError({
        statusCode: 400,
        message: 'Invalid report type'
      });
  }
}

/**
 * Helper function to generate daily report
 */
function generateDailyReport(expenses) {
  // Group expenses by date
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const dateStr = expense.date.toISOString().split('T')[0];

    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }

    acc[dateStr].push(expense);
    return acc;
  }, {});

  // Calculate summary for each date
  const data = Object.entries(groupedExpenses).map(([date, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    return {
      date,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by date (newest first)
  data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    reportType: 'daily',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate weekly report
 */
function generateWeeklyReport(expenses) {
  // Group expenses by week
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    const weekKey = `${year}-W${weekNumber}`;

    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }

    acc[weekKey].push(expense);
    return acc;
  }, {});

  // Calculate summary for each week
  const data = Object.entries(groupedExpenses).map(([weekKey, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      week: weekKey,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by week (newest first)
  data.sort((a, b) => b.week.localeCompare(a.week));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    reportType: 'weekly',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate monthly report
 */
function generateMonthlyReport(expenses) {
  // Group expenses by month
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }

    acc[monthKey].push(expense);
    return acc;
  }, {});

  // Calculate summary for each month
  const data = Object.entries(groupedExpenses).map(([monthKey, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      month: monthKey,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by month (newest first)
  data.sort((a, b) => b.month.localeCompare(a.month));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    reportType: 'monthly',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate yearly report
 */
function generateYearlyReport(expenses) {
  // Group expenses by year
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const year = new Date(expense.date).getFullYear();

    if (!acc[year]) {
      acc[year] = [];
    }

    acc[year].push(expense);
    return acc;
  }, {});

  // Calculate summary for each year
  const data = Object.entries(groupedExpenses).map(([year, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      year,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by year (newest first)
  data.sort((a, b) => Number(b.year) - Number(a.year));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    reportType: 'yearly',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate financial year report (April to March)
 */
function generateFinancialYearReport(expenses) {
  // Group expenses by financial year
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Financial year is from April to March
    // If month is January to March, it belongs to previous year's financial year
    const financialYear = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    if (!acc[financialYear]) {
      acc[financialYear] = [];
    }

    acc[financialYear].push(expense);
    return acc;
  }, {});

  // Calculate summary for each financial year
  const data = Object.entries(groupedExpenses).map(([financialYear, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      financialYear,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by financial year (newest first)
  data.sort((a, b) => b.financialYear.localeCompare(a.financialYear));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    reportType: 'financial-year',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate date range report
 */
function generateDateRangeReport(expenses) {
  // Calculate total expenses and receipts
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  return {
    reportType: 'date-range',
    data: expenses,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    }
  };
}

/**
 * Helper function to generate paid-to report
 */
function generatePaidToReport(expenses) {
  // Group expenses by paid to
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const paidTo = expense.paidTo;

    if (!acc[paidTo]) {
      acc[paidTo] = [];
    }

    acc[paidTo].push(expense);
    return acc;
  }, {});

  // Calculate summary for each paid to
  const data = Object.entries(groupedExpenses).map(([paidTo, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    return {
      paidTo,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by total amount (highest first)
  data.sort((a, b) => (b.totalExpenses + b.totalReceipts) - (a.totalExpenses + a.totalReceipts));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  return {
    reportType: 'paidTo',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate category report
 */
function generateCategoryReport(expenses) {
  // Group expenses by category
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const category = expense.category || 'Uncategorized';

    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push(expense);
    return acc;
  }, {});

  // Calculate summary for each category
  const data = Object.entries(groupedExpenses).map(([category, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      category,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by total amount (highest first)
  data.sort((a, b) => (b.totalExpenses + b.totalReceipts) - (a.totalExpenses + a.totalReceipts));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  return {
    reportType: 'category',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate project report
 */
function generateProjectReport(expenses) {
  // Group expenses by project
  const groupedExpenses = expenses.reduce((acc, expense) => {
    const project = expense.project || 'No Project';

    if (!acc[project]) {
      acc[project] = [];
    }

    acc[project].push(expense);
    return acc;
  }, {});

  // Calculate summary for each project
  const data = Object.entries(groupedExpenses).map(([project, expenses]) => {
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.amount > 0)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.amount < 0)
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    return {
      project,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by total amount (highest first)
  data.sort((a, b) => (b.totalExpenses + b.totalReceipts) - (a.totalExpenses + a.totalReceipts));

  // Calculate overall summary
  const totalExpenses = expenses
    .filter(e => !e.isTransfer && e.amount > 0)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const totalReceipts = expenses
    .filter(e => !e.isTransfer && e.amount < 0)
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  return {
    reportType: 'project',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    }
  };
}

/**
 * Helper function to generate subs report
 */
function generateSubsReport(expenses) {
  // Filter only subs expenses
  const subsExpenses = expenses.filter(expense => expense.paidToGroup === 'subs');

  // Group expenses by paid to (sub name)
  const groupedExpenses = subsExpenses.reduce((acc, expense) => {
    const paidTo = expense.paidTo || 'Unknown';

    if (!acc[paidTo]) {
      acc[paidTo] = [];
    }

    acc[paidTo].push(expense);
    return acc;
  }, {});

  // Calculate summary for each sub
  const data = Object.entries(groupedExpenses).map(([paidTo, expenses]) => {
    // For subs, we need to check the category to determine if it's a payment or receipt
    // PAYMENT category should be in the Payments column
    // RECEIPT category should be in the Receipts column
    const totalExpenses = expenses
      .filter(e => !e.isTransfer && e.category === 'PAYMENT')
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    const totalReceipts = expenses
      .filter(e => !e.isTransfer && e.category === 'RECEIPT')
      .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

    return {
      paidTo,
      expenses,
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses,
      count: expenses.length
    };
  });

  // Sort by total amount (highest first)
  data.sort((a, b) => (b.totalExpenses + b.totalReceipts) - (a.totalExpenses + a.totalReceipts));

  // Calculate overall summary
  // For subs, we need to check the category to determine if it's a payment or receipt
  const totalExpenses = subsExpenses
    .filter(e => !e.isTransfer && e.category === 'PAYMENT')
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  const totalReceipts = subsExpenses
    .filter(e => !e.isTransfer && e.category === 'RECEIPT')
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

  // Prepare transactions for display
  // We need to normalize the transactions so they display correctly in the report
  const normalizedTransactions = subsExpenses.map(transaction => {
    // Create a copy of the transaction to avoid modifying the original
    const normalizedTransaction = { ...transaction };

    // For PAYMENT: ensure amount is negative
    // For RECEIPT: ensure amount is positive
    if (normalizedTransaction.category === 'PAYMENT') {
      normalizedTransaction.amount = -Math.abs(normalizedTransaction.amount);
    } else if (normalizedTransaction.category === 'RECEIPT') {
      normalizedTransaction.amount = Math.abs(normalizedTransaction.amount);
    }

    return normalizedTransaction;
  });

  return {
    reportType: 'subs',
    data,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    },
    transactions: normalizedTransactions // Include normalized transactions for detailed report
  };
}

/**
 * Helper function to get week number
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Helper function to filter expenses by time period
 */
function filterByTimePeriod(expenses, reportType, timePeriod) {

  switch (reportType) {
    case 'weekly': {
      // timePeriod format: 'YYYY-MM-DD|YYYY-MM-DD' (start|end)
      const [startDateStr, endDateStr] = timePeriod.split('|');
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);

      return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    case 'monthly': {
      // timePeriod format: 'YYYY-MM'
      const [year, month] = timePeriod.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

      return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    case 'yearly': {
      // timePeriod format: 'YYYY'
      const year = parseInt(timePeriod);
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    case 'financial-year': {
      // timePeriod format: 'YYYY-YYYY'
      const [startYear, endYear] = timePeriod.split('-').map(Number);
      // Financial year: April 1st to March 31st
      const startDate = new Date(startYear, 3, 1); // April 1st
      const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999); // March 31st

      return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    default:
      return expenses;
  }
}
