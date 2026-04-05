// Technical Indicators Calculation Utilities
// Built for the existing Yahoo Finance integration

export interface TechnicalIndicators {
  sma20: number
  sma50: number
  sma200: number
  ema12: number
  ema26: number
  rsi: number
  macd: {
    line: number
    signal: number
    histogram: number
  }
  bollingerBands: {
    upper: number
    middle: number
    lower: number
  }
  atr: number
  obv: number
  supportResistance: {
    support: number[]
    resistance: number[]
  }
}

// Calculate SMA for a full series of data points for charting
export function calculateSMASeries(prices: number[], period: number): (number | null)[] {
  const smaValues: (number | null)[] = [];
  if (prices.length < period) {
    return new Array(prices.length).fill(null);
  }

  // Use a sliding window approach for efficiency
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }

  // Fill initial nulls for periods where SMA is not available
  for (let i = 0; i < period - 1; i++) {
    smaValues.push(null);
  }
  smaValues.push(sum / period);

  // Calculate subsequent SMAs using the sliding window
  for (let i = period; i < prices.length; i++) {
    sum = sum - prices[i - period] + prices[i];
    smaValues.push(sum / period);
  }

  return smaValues;
}

// EMA Series Calculation (helper for MACD)
export function calculateEMASeries(prices: number[], period: number): (number | null)[] {
  if (prices.length < period) {
    return new Array(prices.length).fill(null);
  }

  const emaValues: (number | null)[] = new Array(period - 1).fill(null);
  const multiplier = 2 / (period + 1);

  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += prices[i];
  }
  let previousEma = initialSum / period;
  emaValues.push(previousEma);

  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] - previousEma) * multiplier + previousEma;
    emaValues.push(ema);
    previousEma = ema;
  }

  return emaValues;
}

// RSI Series Calculation
export function calculateRSISeries(prices: number[], period: number = 14): (number | null)[] {
  if (prices.length < period + 1) {
    return new Array(prices.length).fill(null);
  }

  const rsiValues: (number | null)[] = new Array(period).fill(null);
  const changes = prices.slice(1).map((price, i) => price - prices[i]);

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gainSum += changes[i];
    } else {
      lossSum += Math.abs(changes[i]);
    }
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(100 - (100 / (1 + firstRs)));

  for (let i = period; i < changes.length; i++) {
    const currentGain = changes[i] > 0 ? changes[i] : 0;
    const currentLoss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  return rsiValues;
}

// MACD Series Calculation
export function calculateMACDSeries(prices: number[]): { macdLines: (number | null)[], signalLines: (number | null)[], histograms: (number | null)[] } {
  const ema12Series = calculateEMASeries(prices, 12);
  const ema26Series = calculateEMASeries(prices, 26);

  const macdLines: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (ema12Series[i] !== null && ema26Series[i] !== null) {
      macdLines.push(ema12Series[i]! - ema26Series[i]!);
    } else {
      macdLines.push(null);
    }
  }

  const validMacdLines = macdLines.filter(v => v !== null) as number[];
  const signalLineSeriesRaw = calculateEMASeries(validMacdLines, 9);
  
  const signalLines: (number | null)[] = new Array(macdLines.length).fill(null);
  let signalIndex = 0;
  for(let i = 0; i < macdLines.length; i++) {
      if(macdLines[i] !== null) {
          if(signalIndex < signalLineSeriesRaw.length) {
              signalLines[i] = signalLineSeriesRaw[signalIndex];
              signalIndex++;
          }
      }
  }

  const histograms: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (macdLines[i] !== null && signalLines[i] !== null) {
      histograms.push(macdLines[i]! - signalLines[i]!);
    } else {
      histograms.push(null);
    }
  }

  return { macdLines, signalLines, histograms };
}

// Simple Moving Average (for a single, latest value)
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0

  // Only calculate SMA if we have enough data for the full period
  // This ensures accurate moving averages and prevents misleading results
  if (prices.length < period) {
    console.log(`SMA calculation: insufficient data for ${period}-day SMA. Need ${period} days, have ${prices.length} days`)
    return 0
  }

  const slice = prices.slice(-period)
  console.log(`SMA calculation: ${period}-day SMA calculated with ${slice.length} data points from ${prices.length} total`)

  return slice.reduce((sum, price) => sum + price, 0) / period
}

// Exponential Moving Average
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0
  if (prices.length === 1) return prices[0]
  
  const multiplier = 2 / (period + 1)
  let ema = prices[0]
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier))
  }
  
  return ema
}

// Relative Strength Index
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50
  
  let gains = 0
  let losses = 0
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) {
      gains += change
    } else {
      losses += Math.abs(change)
    }
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // Calculate RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    
    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period
  }
  
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// MACD (Moving Average Convergence Divergence)
export function calculateMACD(prices: number[]): { line: number, signal: number, histogram: number } {
  if (prices.length < 26) {
    return { line: 0, signal: 0, histogram: 0 }
  }
  
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macdLine = ema12 - ema26
  
  // Calculate signal line (9-period EMA of MACD line)
  // For simplicity, using a basic calculation
  const signalLine = macdLine * 0.2 // Simplified signal calculation
  const histogram = macdLine - signalLine
  
  return {
    line: macdLine,
    signal: signalLine,
    histogram: histogram
  }
}

// Bollinger Bands
export function calculateBollingerBands(prices: number[], period: number = 20): { upper: number, middle: number, lower: number } {
  if (prices.length < period) {
    const lastPrice = prices[prices.length - 1] || 0
    return { upper: lastPrice, middle: lastPrice, lower: lastPrice }
  }
  
  const sma = calculateSMA(prices, period)
  const slice = prices.slice(-period)
  
  // Calculate standard deviation
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period
  const stdDev = Math.sqrt(variance)
  
  return {
    upper: sma + (2 * stdDev),
    middle: sma,
    lower: sma - (2 * stdDev)
  }
}

// Average True Range
export function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period || lows.length < period || closes.length < period) return 0
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < highs.length; i++) {
    const tr1 = highs[i] - lows[i]
    const tr2 = Math.abs(highs[i] - closes[i - 1])
    const tr3 = Math.abs(lows[i] - closes[i - 1])
    trueRanges.push(Math.max(tr1, tr2, tr3))
  }
  
  return calculateSMA(trueRanges, period)
}

// On-Balance Volume
export function calculateOBV(prices: number[], volumes: number[]): number {
  if (prices.length !== volumes.length || prices.length < 2) return 0
  
  let obv = 0
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      obv += volumes[i]
    } else if (prices[i] < prices[i - 1]) {
      obv -= volumes[i]
    }
  }
  
  return obv
}

// Support and Resistance Levels
export function calculateSupportResistance(highs: number[], lows: number[], closes: number[]): { support: number[], resistance: number[] } {
  if (highs.length < 20) {
    return { support: [], resistance: [] }
  }
  
  const support: number[] = []
  const resistance: number[] = []
  
  // Find local minima for support
  for (let i = 2; i < lows.length - 2; i++) {
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && 
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      support.push(lows[i])
    }
  }
  
  // Find local maxima for resistance
  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && 
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      resistance.push(highs[i])
    }
  }
  
  // Return most recent levels
  return {
    support: support.slice(-3), // Last 3 support levels
    resistance: resistance.slice(-3) // Last 3 resistance levels
  }
}

// Main function to calculate all technical indicators
export function calculateAllTechnicalIndicators(historicalData: any[]): TechnicalIndicators {
  if (!historicalData || historicalData.length === 0) {
    console.log('⚠️ No historical data provided for technical analysis')
    return {
      sma20: 0, sma50: 0, sma200: 0,
      ema12: 0, ema26: 0, rsi: 50,
      macd: { line: 0, signal: 0, histogram: 0 },
      bollingerBands: { upper: 0, middle: 0, lower: 0 },
      atr: 0, obv: 0,
      supportResistance: { support: [], resistance: [] }
    }
  }

  // Extract and validate data arrays
  const closes = historicalData.map(d => d.close).filter(c => c !== null && c !== undefined && !isNaN(c))
  const highs = historicalData.map(d => d.high).filter(h => h !== null && h !== undefined && !isNaN(h))
  const lows = historicalData.map(d => d.low).filter(l => l !== null && l !== undefined && !isNaN(l))
  const volumes = historicalData.map(d => d.volume).filter(v => v !== null && v !== undefined && !isNaN(v))

  // Log data quality for debugging
  console.log(`📊 Technical indicators data quality:
    - Raw data points: ${historicalData.length}
    - Valid closes: ${closes.length}
    - Valid highs: ${highs.length}
    - Valid lows: ${lows.length}
    - Valid volumes: ${volumes.length}
    - Date range: ${historicalData[0]?.date} to ${historicalData[historicalData.length-1]?.date}
    - Sample closes: [${closes.slice(-5).map(c => c.toFixed(2)).join(', ')}]`)

  if (closes.length === 0) {
    console.log('⚠️ No valid close prices found in historical data')
    return {
      sma20: 0, sma50: 0, sma200: 0,
      ema12: 0, ema26: 0, rsi: 50,
      macd: { line: 0, signal: 0, histogram: 0 },
      bollingerBands: { upper: 0, middle: 0, lower: 0 },
      atr: 0, obv: 0,
      supportResistance: { support: [], resistance: [] }
    }
  }
  
  // Calculate all indicators
  const sma20 = calculateSMA(closes, 20)
  const sma50 = calculateSMA(closes, 50)
  const sma200 = calculateSMA(closes, 200)
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const rsi = calculateRSI(closes)
  const macd = calculateMACD(closes)
  const bollingerBands = calculateBollingerBands(closes)
  const atr = calculateATR(highs, lows, closes)
  const obv = calculateOBV(closes, volumes)
  const supportResistance = calculateSupportResistance(highs, lows, closes)

  // Log calculated indicators for debugging
  console.log(`✅ Technical indicators calculated:
    - SMA 20: ₹${sma20.toFixed(2)}
    - SMA 50: ₹${sma50.toFixed(2)}
    - SMA 200: ₹${sma200.toFixed(2)}
    - RSI: ${rsi.toFixed(2)}
    - MACD: ${macd.line.toFixed(4)}`)

  return {
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    rsi,
    macd,
    bollingerBands,
    atr,
    obv,
    supportResistance
  }
}
