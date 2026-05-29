import type { Trade, Dividend, DailyPortfolioValue } from "./types";

/**
 * Compute daily portfolio history from trades.
 * Returns an array of { date, value, investment } from the first trade date to today.
 * - `value` is the cost basis of all holdings at each date
 * - `investment` is the cumulative total invested (sum of all BUY amounts)
 */
export function computePortfolioHistory(trades: Trade[]): DailyPortfolioValue[] {
  if (trades.length === 0) return [];

  // Sort trades by date ascending
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstDate = new Date(sorted[0].date);
  const today = new Date();

  // Track holdings (qty, cost) and cumulative investment at each trade date
  const holdingsMap = new Map<string, { qty: number; cost: number }>();

  // Build maps of date -> portfolio value and date -> cumulative investment
  const dateValues = new Map<string, { value: number; investment: number }>();

  let totalInvested = 0;

  for (const trade of sorted) {
    const sym = trade.symbol;
    const existing = holdingsMap.get(sym) || { qty: 0, cost: 0 };

    if (trade.type === "BUY") {
      existing.qty += Number(trade.quantity);
      existing.cost += Number(trade.total_value);
      totalInvested += Number(trade.total_value);
    } else {
      const avgCost = existing.qty > 0 ? existing.cost / existing.qty : 0;
      existing.qty -= Number(trade.quantity);
      existing.cost -= avgCost * Number(trade.quantity);
      if (existing.qty <= 0) {
        existing.qty = 0;
        existing.cost = 0;
      }
    }
    holdingsMap.set(sym, existing);

    // Compute total cost basis across all holdings
    let totalValue = 0;
    for (const [_, h] of holdingsMap) {
      totalValue += h.cost;
    }

    const dateStr = trade.date.split("T")[0];
    dateValues.set(dateStr, { value: totalValue, investment: totalInvested });
  }

  // Generate daily values from first trade date to today
  const values: DailyPortfolioValue[] = [];
  const current = new Date(firstDate);

  let currentValue = 0;
  let currentInvestment = 0;

  while (current <= today) {
    const dateStr = current.toISOString().split("T")[0];

    // Update from known trade dates
    if (dateValues.has(dateStr)) {
      const dv = dateValues.get(dateStr)!;
      currentValue = dv.value;
      currentInvestment = dv.investment;
    } else if (values.length === 0) {
      // Before first trade date, portfolio value is 0
      currentValue = 0;
      currentInvestment = 0;
    }

    values.push({
      date: dateStr,
      value: currentValue,
      investment: currentInvestment,
    });
    current.setDate(current.getDate() + 1);
  }

  return values;
}

/**
 * Compute current holdings (net position and cost basis) from a list of trades.
 */
export interface Holding {
  symbol: string;
  totalQuantity: number;
  totalCost: number;
  averagePrice: number;
}

export function computeHoldings(trades: Trade[]): Holding[] {
  const holdingsMap = new Map<string, Holding>();

  for (const trade of trades) {
    const sym = trade.symbol;
    const existing = holdingsMap.get(sym) || {
      symbol: sym,
      totalQuantity: 0,
      totalCost: 0,
      averagePrice: 0,
    };

    if (trade.type === "BUY") {
      existing.totalQuantity += Number(trade.quantity);
      existing.totalCost += Number(trade.total_value);
    } else {
      const avgCost = existing.totalQuantity > 0 ? existing.totalCost / existing.totalQuantity : 0;
      existing.totalQuantity -= Number(trade.quantity);
      existing.totalCost -= avgCost * Number(trade.quantity);
    }

    if (existing.totalQuantity > 0) {
      existing.averagePrice = existing.totalCost / existing.totalQuantity;
    } else {
      existing.totalCost = 0;
      existing.averagePrice = 0;
    }
    holdingsMap.set(sym, existing);
  }

  return Array.from(holdingsMap.values()).filter((h) => h.totalQuantity > 0);
}

/**
 * Compute Dividend Yield on Cost (YOC) per symbol and portfolio-level metrics.
 */
export interface DividendYieldInfo {
  symbol: string;
  totalDividends: number;
  costBasis: number;
  yieldOnCost: number; // percentage (e.g., 2.5 = 2.5%)
}

export interface DividendMonthlyIncome {
  month: string; // "YYYY-MM"
  label: string; // "Jan 2024"
  amount: number;
}

export function computeDividendYOC(dividends: Dividend[], holdings: Holding[]): DividendYieldInfo[] {
  // Group dividends by symbol
  const divBySymbol = new Map<string, number>();
  for (const d of dividends) {
    const current = divBySymbol.get(d.symbol) || 0;
    divBySymbol.set(d.symbol, current + Number(d.amount));
  }

  const costBySymbol = new Map<string, number>();
  for (const h of holdings) {
    costBySymbol.set(h.symbol, h.totalCost);
  }

  const result: DividendYieldInfo[] = [];
  for (const [symbol, totalDividends] of divBySymbol) {
    const costBasis = costBySymbol.get(symbol) || 0;
    result.push({
      symbol,
      totalDividends,
      costBasis,
      yieldOnCost: costBasis > 0 ? (totalDividends / costBasis) * 100 : 0,
    });
  }

  // Sort by YOC descending
  result.sort((a, b) => b.yieldOnCost - a.yieldOnCost);
  return result;
}

/**
 * Group dividends by month for the income calendar chart.
 */
export function computeDividendIncomeByMonth(dividends: Dividend[]): DividendMonthlyIncome[] {
  const byMonth = new Map<string, number>();

  for (const d of dividends) {
    const monthKey = d.date.slice(0, 7); // "YYYY-MM"
    const current = byMonth.get(monthKey) || 0;
    byMonth.set(monthKey, current + Number(d.amount));
  }

  const sorted = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => {
      const [year, m] = month.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${months[parseInt(m, 10) - 1]} ${year}`;
      return { month, label, amount };
    });

  return sorted;
}

/**
 * Target allocation entry for rebalancing.
 */
export interface TargetAllocation {
  symbol: string;
  targetPercent: number; // e.g., 30 = 30%
}

/**
 * Rebalancing recommendation for a single holding.
 */
export interface RebalanceRecommendation {
  symbol: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  deviation: number; // percentage points
  recommendedAction: "BUY" | "SELL" | "HOLD";
  recommendedAmount: number; // $ amount to buy (positive) or sell (negative)
  sharesToTrade: number; // approximate shares to buy/sell (using current price)
}

/**
 * Compute rebalancing recommendations given current holdings, market prices, and target allocations.
 */
export function computeRebalancing(
  holdings: Holding[],
  prices: Map<string, { price: number | null }>,
  targets: TargetAllocation[],
  totalPortfolioValue: number,
  deviationThreshold: number = 5, // percentage points
): RebalanceRecommendation[] {
  if (totalPortfolioValue <= 0 || targets.length === 0) return [];

  const targetMap = new Map(targets.map((t) => [t.symbol, t.targetPercent]));

  const results: RebalanceRecommendation[] = [];

  for (const h of holdings) {
    const targetPercent = targetMap.get(h.symbol);
    if (targetPercent == null) continue; // No target set for this holding

    const stockPrice = prices.get(h.symbol);
    const currentPrice = stockPrice?.price ?? h.averagePrice;
    const currentValue = currentPrice * h.totalQuantity;
    const currentPercent = (currentValue / totalPortfolioValue) * 100;
    const deviation = currentPercent - targetPercent;

    let recommendedAction: "BUY" | "SELL" | "HOLD" = "HOLD";
    let recommendedAmount = 0;
    let sharesToTrade = 0;

    if (Math.abs(deviation) > deviationThreshold) {
      if (deviation > 0) {
        // Overweight — sell
        recommendedAction = "SELL";
        const targetValue = (targetPercent / 100) * totalPortfolioValue;
        recommendedAmount = currentValue - targetValue;
        sharesToTrade = currentPrice > 0 ? Math.round(recommendedAmount / currentPrice) : 0;
      } else {
        // Underweight — buy
        recommendedAction = "BUY";
        const targetValue = (targetPercent / 100) * totalPortfolioValue;
        recommendedAmount = targetValue - currentValue;
        sharesToTrade = currentPrice > 0 ? Math.round(recommendedAmount / currentPrice) : 0;
      }
    }

    results.push({
      symbol: h.symbol,
      currentValue,
      currentPercent,
      targetPercent,
      deviation,
      recommendedAction,
      recommendedAmount,
      sharesToTrade,
    });
  }

  // Sort by absolute deviation descending
  results.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  return results;
}

/**
 * LocalStorage helpers for target allocations.
 */
const TARGETS_KEY = "etf_target_allocations";

export function loadTargets(): TargetAllocation[] {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTargets(targets: TargetAllocation[]): void {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}

/**
 * Performance metrics for the portfolio.
 */
export interface PerformanceMetrics {
  /** Percentage of profitable closed trades (e.g., 65.5 = 65.5%) */
  winRate: number | null;
  totalWins: number;
  totalLosses: number;
  totalClosedTrades: number;
  /** Simple total return percentage (e.g., 25.5 = 25.5%) */
  totalReturn: number | null;
  /** Compound Annual Growth Rate percentage (e.g., 12.3 = 12.3%) */
  cagr: number | null;
  /** Time-Weighted Rate of Return percentage */
  twrr: number | null;
  /** Number of days since first trade */
  daysSinceStart: number;
}

/**
 * Compute portfolio performance metrics.
 *
 * winRate: based on closed (SELL) trades — each SELL's profit vs its cost basis
 * totalReturn: (currentMarketValue / cumulativeInvestment - 1) * 100
 * cagr: (currentMarketValue / cumulativeInvestment)^(1/years) - 1
 * twrr: chained returns between cash-flow dates using cost-basis history
 */
export function computePerformanceMetrics(
  trades: Trade[],
  currentMarketValue: number,
  dailyHistory: DailyPortfolioValue[],
): PerformanceMetrics {
  const defaultMetrics: PerformanceMetrics = {
    winRate: null,
    totalWins: 0,
    totalLosses: 0,
    totalClosedTrades: 0,
    totalReturn: null,
    cagr: null,
    twrr: null,
    daysSinceStart: 0,
  };

  if (trades.length === 0) return defaultMetrics;

  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstDate = new Date(sorted[0].date);
  const today = new Date();
  const daysSinceStart = Math.max(
    1,
    Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const yearsSinceStart = daysSinceStart / 365;

  // --- Win Rate ---
  // Track average cost for each symbol to determine if a SELL was profitable
  const costTracker = new Map<string, { qty: number; cost: number }>();
  let wins = 0;
  let losses = 0;

  for (const trade of sorted) {
    const sym = trade.symbol;
    const existing = costTracker.get(sym) || { qty: 0, cost: 0 };

    if (trade.type === "BUY") {
      existing.qty += Number(trade.quantity);
      existing.cost += Number(trade.total_value);
    } else {
      // SELL
      const qtySold = Number(trade.quantity);
      const proceeds = Number(trade.total_value);
      const avgCost = existing.qty > 0 ? existing.cost / existing.qty : 0;
      const costOfSold = avgCost * qtySold;
      const profit = proceeds - costOfSold;

      if (profit >= 0) wins++;
      else losses++;

      existing.qty -= qtySold;
      existing.cost -= costOfSold;
      if (existing.qty <= 0) {
        existing.qty = 0;
        existing.cost = 0;
      }
    }
    costTracker.set(sym, existing);
  }

  const totalClosedTrades = wins + losses;
  const winRate = totalClosedTrades > 0 ? (wins / totalClosedTrades) * 100 : null;

  // --- Total Return & CAGR ---
  // Total net investment = sum of all BUY total_values - return of capital from SELLs
  // Simpler approach: use the final investment value from dailyHistory
  const finalHistory = dailyHistory.length > 0 ? dailyHistory[dailyHistory.length - 1] : null;
  const cumulativeInvestment = finalHistory?.investment ?? 0;

  let totalReturn: number | null = null;
  let cagr: number | null = null;

  if (cumulativeInvestment > 0) {
    totalReturn = ((currentMarketValue - cumulativeInvestment) / cumulativeInvestment) * 100;
    if (yearsSinceStart > 0) {
      cagr = (Math.pow(currentMarketValue / cumulativeInvestment, 1 / yearsSinceStart) - 1) * 100;
    }
  }

  // --- TWRR (simplified) ---
  // Use dailyHistory to chain returns between cash-flow events
  // For each date, compute the holding period return vs the previous date where investment changed
  let twrr: number | null = null;

  if (dailyHistory.length >= 2 && cumulativeInvestment > 0) {
    // Group by "stable periods" — days where the investment didn't change
    const periods: { startValue: number; endValue: number }[] = [];
    let periodStartValue = dailyHistory[0].value;
    let prevInvestment = dailyHistory[0].investment;

    for (let i = 1; i < dailyHistory.length; i++) {
      const day = dailyHistory[i];
      const prevDay = dailyHistory[i - 1];

      // If investment changed, this is a cash-flow boundary
      if (day.investment !== prevInvestment) {
        // End the previous period at yesterday's value (before cash flow)
        if (prevDay.value > 0) {
          periods.push({ startValue: periodStartValue, endValue: prevDay.value });
        }
        // Start new period at today's value (after cash flow)
        periodStartValue = day.value;
        prevInvestment = day.investment;
      }
    }

    // Final period: from last cash flow to current market value
    if (periodStartValue > 0 && currentMarketValue > 0) {
      // Use the last day's investment-adjusted value vs current market value
      periods.push({ startValue: periodStartValue, endValue: currentMarketValue });
    }

    // Chain the returns
    if (periods.length > 0) {
      let chain = 1;
      for (const p of periods) {
        if (p.startValue > 0) {
          chain *= 1 + (p.endValue - p.startValue) / p.startValue;
        }
      }
      twrr = (chain - 1) * 100;
    }
  }

  return {
    winRate,
    totalWins: wins,
    totalLosses: losses,
    totalClosedTrades,
    totalReturn,
    cagr,
    twrr,
    daysSinceStart,
  };
}

/**
 * Compute realized P/L from trades.
 */
export function computeRealizedPL(trades: Trade[], holdings: Holding[]): number {
  let totalPL = 0;
  const holdingsCost = new Map<string, number>();

  for (const trade of trades) {
    if (trade.type === "BUY") {
      const current = holdingsCost.get(trade.symbol) || 0;
      holdingsCost.set(trade.symbol, current + Number(trade.total_value));
    } else {
      const costBasis = holdingsCost.get(trade.symbol) || 0;
      const holding = holdings.find((h) => h.symbol === trade.symbol);
      const totalQtySold = Number(trade.quantity);
      const avgCost = costBasis > 0 ? costBasis / (holding ? holding.totalQuantity + totalQtySold : totalQtySold) : 0;
      totalPL += Number(trade.total_value) - avgCost * totalQtySold - Number(trade.broker_fee);

      const remaining = costBasis - avgCost * totalQtySold;
      holdingsCost.set(trade.symbol, Math.max(0, remaining));
    }
  }

  return totalPL;
}
