// Function to format date for charts
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Function to calculate moving average
export function calculateMovingAverage(data: number[], period: number): number[] {
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    
    result.push(parseFloat((sum / period).toFixed(2)));
  }
  
  return result;
}

// Function to prepare data for Chart.js
export function prepareChartData(historyData: any[], symbol: string): any {
  if (!historyData || historyData.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }
  
  // Sort data by date
  const sortedData = [...historyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Extract dates and closing prices
  const labels = sortedData.map(item => formatDate(item.date));
  const closingPrices = sortedData.map(item => item.close);
  
  // Calculate 20-day moving average
  const movingAverage = calculateMovingAverage(closingPrices, 20);
  
  return {
    labels,
    datasets: [
      {
        label: symbol,
        data: closingPrices,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false
      },
      {
        label: '20-day MA',
        data: movingAverage,
        borderColor: 'rgb(255, 99, 132)',
        borderDash: [5, 5],
        tension: 0.1,
        fill: false
      }
    ]
  };
}

// Function to calculate portfolio metrics
export function calculatePortfolioMetrics(folioRecords: any[]): any {
  if (!folioRecords || folioRecords.length === 0) {
    return {
      totalInvestment: 0,
      currentValue: 0,
      profitLoss: 0,
      profitLossPercentage: 0
    };
  }
  
  const totalInvestment = folioRecords.reduce((sum, record) => sum + (record.price * record.qnty), 0);
  const currentValue = folioRecords.reduce((sum, record) => sum + (record.cprice * record.qnty), 0);
  const profitLoss = currentValue - totalInvestment;
  const profitLossPercentage = (profitLoss / totalInvestment) * 100;
  
  return {
    totalInvestment: parseFloat(totalInvestment.toFixed(2)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    profitLoss: parseFloat(profitLoss.toFixed(2)),
    profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
  };
}
