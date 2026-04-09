import { getFirestore } from 'firebase-admin/firestore';

/**
 * API endpoint for generating expense reports
 *
 * Handles GET operations with different report types
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

  const db = getFirestore();
  const method = event.node.req.method;

  // GET - Generate report
  if (method === 'GET') {
    try {
      const queryParams = getQuery(event);
      const reportType = queryParams.type || 'monthly';

      // Validate report type
      const validReportTypes = [
        'daily', 'weekly', 'monthly', 'yearly', 'financial-year',
        'date-range', 'paidTo', 'category', 'project', 'subs'
      ];

      if (!validReportTypes.includes(reportType)) {
        throw createError({
          statusCode: 400,
          message: `Invalid report type. Valid types are: ${validReportTypes.join(', ')}`
        });
      }

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
            // Convert any Timestamp fields in subExpenses to Date objects
            subExpenses: data.subExpenses ? data.subExpenses.map(sub => ({
              ...sub,
              date: sub.date.toDate()
            })) : []
          });
        });

        return expenses;
      }

      try {
        // First approach: Try with composite query (requires index)
        const expensesRef = db.collection(`firms/${firmIdStr}/expenses`);
        let expensesQuery = expensesRef;

        // Apply date range filter
        if (queryParams.startDate) {
          const startDate = new Date(queryParams.startDate);
          expensesQuery = expensesQuery.where('date', '>=', startDate);
        }

        if (queryParams.endDate) {
          const endDate = new Date(queryParams.endDate);
          // Set time to end of day
          endDate.setHours(23, 59, 59, 999);
          expensesQuery = expensesQuery.where('date', '<=', endDate);
        }

        // Apply other filters
        if (queryParams.category) {
          expensesQuery = expensesQuery.where('category', '==', queryParams.category);
        }

        if (queryParams.paidTo) {
          expensesQuery = expensesQuery.where('paidTo', '==', queryParams.paidTo);
        }

        if (queryParams.project) {
          expensesQuery = expensesQuery.where('project', '==', queryParams.project);
        }

        if (queryParams.paymentMode) {
          expensesQuery = expensesQuery.where('paymentMode.type', '==', queryParams.paymentMode);
        }

        if (queryParams.paidToGroup) {
          expensesQuery = expensesQuery.where('paidToGroup', '==', queryParams.paidToGroup);
        }

        if (queryParams.isTransfer !== undefined) {
          const isTransfer = queryParams.isTransfer === 'true';
          expensesQuery = expensesQuery.where('isTransfer', '==', isTransfer);
        }

        // Execute query
        const snapshot = await expensesQuery.orderBy('date', 'desc').get();
        const expenses = processSnapshot(snapshot);

        // Generate report based on type
        const report = generateReport(reportType, expenses, queryParams);
        return report;
      } catch (indexError) {
        console.warn('Index error, falling back to client-side filtering:', indexError.message);

        // Fallback approach: Get all expenses for the firm and filter in memory
        const expensesRef = db.collection(`firms/${firmIdStr}/expenses`);
        const snapshot = await expensesRef.get();

        // Process the snapshot
        let expenses = processSnapshot(snapshot);

        // Apply filters in memory
        if (queryParams.startDate) {
          const startDate = new Date(queryParams.startDate).getTime();
          expenses = expenses.filter(expense => expense.date.getTime() >= startDate);
        }

        if (queryParams.endDate) {
          const endDate = new Date(queryParams.endDate);
          endDate.setHours(23, 59, 59, 999);
          const endDateMs = endDate.getTime();
          expenses = expenses.filter(expense => expense.date.getTime() <= endDateMs);
        }

        if (queryParams.category) {
          expenses = expenses.filter(expense => expense.category === queryParams.category);
        }

        if (queryParams.paidTo) {
          expenses = expenses.filter(expense => expense.paidTo === queryParams.paidTo);
        }

        if (queryParams.project) {
          expenses = expenses.filter(expense => expense.project === queryParams.project);
        }

        if (queryParams.paymentMode) {
          expenses = expenses.filter(expense => expense.paymentMode?.type === queryParams.paymentMode);
        }

        if (queryParams.paidToGroup) {
          expenses = expenses.filter(expense => expense.paidToGroup === queryParams.paidToGroup);
        }

        if (queryParams.isTransfer !== undefined) {
          const isTransfer = queryParams.isTransfer === 'true';
          expenses = expenses.filter(expense => expense.isTransfer === isTransfer);
        }

        // Sort by date descending
        expenses.sort((a, b) => b.date.getTime() - a.date.getTime());

        // Generate report based on type
        const report = generateReport(reportType, expenses, queryParams);
        return report;

      }
    } catch (error) {
      console.error('Error generating report:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to generate report',
        cause: error
      });
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});

/**
 * Generate report based on type
 *
 * @param {string} reportType - The type of report to generate
 * @param {Array} expenses - The expenses data
 * @param {Object} queryParams - The query parameters
 * @returns {Object} The generated report
 */
function generateReport(reportType, expenses, queryParams) {
  // Initialize report
  const report = {
    reportType,
    summary: {
      totalExpenses: 0,
      totalReceipts: 0,
      netAmount: 0,
      count: expenses.length
    },
    data: []
  };

  // Calculate summary
  expenses.forEach(expense => {
    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      report.summary.totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      report.summary.totalReceipts += expense.amount;
    }
    report.summary.netAmount += expense.amount;
  });

  // Generate report data based on type
  switch (reportType) {
    case 'daily':
      report.data = generateDailyReport(expenses);
      break;
    case 'weekly':
      report.data = generateWeeklyReport(expenses);
      break;
    case 'monthly':
      report.data = generateMonthlyReport(expenses);
      break;
    case 'yearly':
      report.data = generateYearlyReport(expenses);
      break;
    case 'financial-year':
      report.data = generateFinancialYearReport(expenses);
      break;
    case 'date-range':
      report.data = expenses.map(formatExpenseForReport);
      break;
    case 'paidTo':
      report.data = generateGroupedReport(expenses, 'paidTo');
      break;
    case 'category':
      report.data = generateGroupedReport(expenses, 'category');
      break;
    case 'project':
      report.data = generateGroupedReport(expenses, 'project');
      break;
    case 'subs':
      // Filter expenses for subs only
      const subsExpenses = expenses.filter(expense => expense.paidToGroup === 'subs');
      report.data = generateGroupedReport(subsExpenses, 'paidTo');
      break;
    default:
      report.data = expenses.map(formatExpenseForReport);
  }

  return report;
}

/**
 * Format expense for report
 *
 * @param {Object} expense - The expense data
 * @returns {Object} The formatted expense
 */
function formatExpenseForReport(expense) {
  return {
    id: expense.id,
    date: expense.date.toISOString(),
    paidTo: expense.paidTo,
    amount: expense.amount,
    category: expense.category || 'PAYMENT',
    project: expense.project || '',
    paymentMode: expense.paymentMode,
    description: expense.description || '',
    paidToGroup: expense.paidToGroup || ''
  };
}

/**
 * Generate daily report
 *
 * @param {Array} expenses - The expenses data
 * @returns {Array} The daily report data
 */
function generateDailyReport(expenses) {
  const dailyData = {};

  expenses.forEach(expense => {
    const dateStr = expense.date.toISOString().split('T')[0];

    if (!dailyData[dateStr]) {
      dailyData[dateStr] = {
        date: dateStr,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    dailyData[dateStr].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      dailyData[dateStr].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      dailyData[dateStr].totalReceipts += expense.amount;
    }

    dailyData[dateStr].netAmount += expense.amount;
  });

  return Object.values(dailyData).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Generate weekly report
 *
 * @param {Array} expenses - The expenses data
 * @returns {Array} The weekly report data
 */
function generateWeeklyReport(expenses) {
  const weeklyData = {};

  expenses.forEach(expense => {
    const date = expense.date;
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        week: weekKey,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    weeklyData[weekKey].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      weeklyData[weekKey].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      weeklyData[weekKey].totalReceipts += expense.amount;
    }

    weeklyData[weekKey].netAmount += expense.amount;
  });

  return Object.values(weeklyData).sort((a, b) => b.week.localeCompare(a.week));
}

/**
 * Generate monthly report
 *
 * @param {Array} expenses - The expenses data
 * @returns {Array} The monthly report data
 */
function generateMonthlyReport(expenses) {
  const monthlyData = {};

  expenses.forEach(expense => {
    const date = expense.date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    monthlyData[monthKey].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      monthlyData[monthKey].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      monthlyData[monthKey].totalReceipts += expense.amount;
    }

    monthlyData[monthKey].netAmount += expense.amount;
  });

  return Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Generate yearly report
 *
 * @param {Array} expenses - The expenses data
 * @returns {Array} The yearly report data
 */
function generateYearlyReport(expenses) {
  const yearlyData = {};

  expenses.forEach(expense => {
    const year = expense.date.getFullYear();

    if (!yearlyData[year]) {
      yearlyData[year] = {
        year,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    yearlyData[year].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      yearlyData[year].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      yearlyData[year].totalReceipts += expense.amount;
    }

    yearlyData[year].netAmount += expense.amount;
  });

  return Object.values(yearlyData).sort((a, b) => b.year - a.year);
}

/**
 * Generate financial year report
 *
 * @param {Array} expenses - The expenses data
 * @returns {Array} The financial year report data
 */
function generateFinancialYearReport(expenses) {
  const financialYearData = {};

  expenses.forEach(expense => {
    const date = expense.date;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Financial year is April to March
    // If month is January to March, it's part of the previous year's financial year
    const financialYear = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    if (!financialYearData[financialYear]) {
      financialYearData[financialYear] = {
        financialYear,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    financialYearData[financialYear].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      financialYearData[financialYear].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      financialYearData[financialYear].totalReceipts += expense.amount;
    }

    financialYearData[financialYear].netAmount += expense.amount;
  });

  return Object.values(financialYearData).sort((a, b) => b.financialYear.localeCompare(a.financialYear));
}

/**
 * Generate grouped report
 *
 * @param {Array} expenses - The expenses data
 * @param {string} groupBy - The field to group by
 * @returns {Array} The grouped report data
 */
function generateGroupedReport(expenses, groupBy) {
  const groupedData = {};

  expenses.forEach(expense => {
    const groupValue = expense[groupBy] || 'Uncategorized';

    if (!groupedData[groupValue]) {
      groupedData[groupValue] = {
        [groupBy]: groupValue,
        count: 0,
        totalExpenses: 0,
        totalReceipts: 0,
        netAmount: 0
      };
    }

    groupedData[groupValue].count++;

    // Check if it's a receipt (positive amount) or payment (negative amount)
    if (expense.amount < 0) {
      // Payments (expenses) are negative
      groupedData[groupValue].totalExpenses += Math.abs(expense.amount);
    } else {
      // Receipts (income) are positive
      groupedData[groupValue].totalReceipts += expense.amount;
    }

    groupedData[groupValue].netAmount += expense.amount;
  });

  return Object.values(groupedData).sort((a, b) => b.totalExpenses - a.totalExpenses);
}

/**
 * Get week number of the year
 *
 * @param {Date} date - The date
 * @returns {number} The week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
