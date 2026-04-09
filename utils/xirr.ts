/**
 * XIRR (Extended Internal Rate of Return) calculation utility
 * Uses Newton-Raphson method to find the rate that makes NPV = 0
 */

export interface CashFlow {
  date: Date;
  amount: number; // Negative for investments, positive for returns
}

/**
 * Calculate XIRR for a series of cash flows
 * @param cashFlows Array of cash flows with dates and amounts
 * @param guess Initial guess for the rate (default: 0.1 = 10%)
 * @param maxIterations Maximum number of iterations (default: 100)
 * @param tolerance Tolerance for convergence (default: 1e-6)
 * @returns XIRR as a decimal (e.g., 0.15 = 15%)
 */
export function calculateXIRR(
  cashFlows: CashFlow[],
  guess: number = 0.1,
  maxIterations: number = 100,
  tolerance: number = 1e-6
): number | null {
  try {
    // Validate input
    if (!cashFlows || cashFlows.length < 2) {
      return null;
    }

    // Sort cash flows by date
    const sortedCashFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Check if we have both positive and negative cash flows
    const hasPositive = sortedCashFlows.some(cf => cf.amount > 0);
    const hasNegative = sortedCashFlows.some(cf => cf.amount < 0);

    if (!hasPositive || !hasNegative) {
      return null; // Need both investments and returns
    }

    // Try multiple initial guesses to improve convergence
    const initialGuesses = [guess, 0.05, 0.15, 0.2, -0.1, 0.01, 0.3];

    for (const initialGuess of initialGuesses) {
      const result = calculateXIRRWithGuess(sortedCashFlows, initialGuess, maxIterations, tolerance);
      if (result !== null) {
        return result;
      }
    }

    return null; // Failed to converge with any initial guess
  } catch (error) {
    console.error('Error calculating XIRR:', error);
    return null;
  }
}

function calculateXIRRWithGuess(
  sortedCashFlows: CashFlow[],
  initialRate: number,
  maxIterations: number,
  tolerance: number
): number | null {
  const firstDate = sortedCashFlows[0].date;

  // Convert dates to years from first date
  const cashFlowsWithYears = sortedCashFlows.map(cf => ({
    years: (cf.date.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    amount: cf.amount
  }));

  let rate = initialRate;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0; // Derivative of NPV

    // Calculate NPV and its derivative
    for (const cf of cashFlowsWithYears) {
      // Avoid division by zero and extreme values
      if (rate <= -1) {
        return null;
      }

      const factor = Math.pow(1 + rate, -cf.years);
      npv += cf.amount * factor;
      dnpv -= cf.amount * cf.years * factor / (1 + rate);
    }

    // Check for convergence
    if (Math.abs(npv) < tolerance) {
      // Check if the result is reasonable (between -99% and 1000% annually)
      if (rate >= -0.99 && rate <= 10) {
        return rate;
      }
      return null;
    }

    // Newton-Raphson iteration
    if (Math.abs(dnpv) < tolerance) {
      return null; // Derivative too small, can't continue
    }

    const newRate = rate - npv / dnpv;

    // Prevent extreme values that would cause overflow
    if (newRate < -0.99 || newRate > 10) {
      return null;
    }

    // Check for convergence in rate
    if (Math.abs(newRate - rate) < tolerance) {
      if (newRate >= -0.99 && newRate <= 10) {
        return newRate;
      }
      return null;
    }

    rate = newRate;
  }

  return null; // Failed to converge
}

/**
 * Calculate XIRR for mutual fund investments
 * @param investments Array of investment entries with purchase dates and amounts
 * @param currentValue Current total value of all investments
 * @param currentDate Current date (default: today)
 * @returns XIRR as a percentage (e.g., 15.5 for 15.5%)
 */
export function calculateMutualFundXIRR(
  investments: Array<{
    purchaseDate: Date;
    investmentAmount: number;
  }>,
  currentValue: number,
  currentDate: Date = new Date()
): number | null {
  try {
    if (!investments || investments.length === 0 || currentValue <= 0) {
      return null;
    }

    // Create cash flows array
    const cashFlows: CashFlow[] = [];

    // Add investment cash flows (negative amounts)
    investments.forEach(inv => {
      cashFlows.push({
        date: new Date(inv.purchaseDate),
        amount: -Math.abs(inv.investmentAmount) // Negative for investments
      });
    });

    // Add current value as final cash flow (positive amount)
    cashFlows.push({
      date: currentDate,
      amount: currentValue
    });

    const xirr = calculateXIRR(cashFlows);

    // Convert to percentage
    return xirr !== null ? xirr * 100 : null;
  } catch (error) {
    console.error('Error calculating mutual fund XIRR:', error);
    return null;
  }
}

/**
 * Calculate XIRR for a single mutual fund scheme with multiple entries
 * @param entries Array of mutual fund entries for the same scheme
 * @returns XIRR as a percentage
 */
export function calculateSchemeXIRR(entries: Array<{
  purchaseDate: Date;
  investmentAmount: number;
  currentNAV: number;
  units: number;
}>): number | null {
  try {
    if (!entries || entries.length === 0) {
      return null;
    }

    // Create cash flows array
    const cashFlows: CashFlow[] = [];

    // Add each transaction as a cash flow
    entries.forEach(entry => {
      const amount = Number(entry.investmentAmount);
      const units = Number(entry.units);
      const date = new Date(entry.purchaseDate);

      // For XIRR calculation:
      // - Purchases (positive units): negative cash flow (money going out)
      // - Redemptions (negative units): positive cash flow (money coming in)
      let cashFlowAmount;

      if (units < 0) {
        // Redemption: positive cash flow (money received)
        cashFlowAmount = Math.abs(amount);
      } else {
        // Purchase: negative cash flow (money invested)
        cashFlowAmount = -Math.abs(amount);
      }

      cashFlows.push({
        date: date,
        amount: cashFlowAmount
      });
    });

    // Calculate total current value (only for entries with positive units)
    const totalCurrentValue = entries.reduce((sum, entry) => {
      const units = Number(entry.units);
      const currentNAV = Number(entry.currentNAV);

      // Only add current value for holdings (positive units)
      if (units > 0) {
        return sum + (currentNAV * units);
      }
      return sum;
    }, 0);

    // Add current value as final cash flow (positive amount) only if we have holdings
    if (totalCurrentValue > 0) {
      cashFlows.push({
        date: new Date(), // Today's date
        amount: totalCurrentValue
      });
    }

    // Calculate XIRR
    const xirr = calculateXIRR(cashFlows);

    // Convert to percentage
    const xirrPercentage = xirr !== null ? xirr * 100 : null;

    return xirrPercentage;
  } catch (error) {
    console.error('Error calculating scheme XIRR:', error);
    return null;
  }
}

/**
 * Format XIRR for display
 * @param xirr XIRR value as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string with % symbol
 */
export function formatXIRR(xirr: number | null, decimals: number = 2): string {
  if (xirr === null || xirr === undefined || isNaN(xirr)) {
    return 'N/A';
  }

  return `${xirr.toFixed(decimals)}%`;
}
