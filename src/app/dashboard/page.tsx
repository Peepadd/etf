"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LayoutDashboard, TrendingUp, DollarSign, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import { useStockPrices } from "@/hooks/useStockPrices";
import type { Trade, Dividend, PortfolioEntry, DailyPortfolioValue } from "@/lib/types";
import { KpiCard } from "@/components/KpiCard";
import { PieChartCard } from "@/components/charts/PieChart";
import { LineChartCard } from "@/components/charts/LineChart";

async function fetchDashboardData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [tradesResult, dividendsResult] = await Promise.all([
    supabase.from("trades").select("*").eq("user_id", user.id),
    supabase.from("dividends").select("*").eq("user_id", user.id),
  ]);

  if (tradesResult.error) throw tradesResult.error;
  if (dividendsResult.error) throw dividendsResult.error;

  return {
    trades: (tradesResult.data || []) as Trade[],
    dividends: (dividendsResult.data || []) as Dividend[],
  };
}

function computeHoldings(trades: Trade[]) {
  // Build holdings: net quantity per symbol
  const holdingsMap = new Map<string, { symbol: string; totalQuantity: number; totalCost: number; averagePrice: number }>();

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
      // On sell, reduce quantity and proportionally reduce cost basis
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

function computeRealizedPL(trades: Trade[], holdings: ReturnType<typeof computeHoldings>): number {
  let totalPL = 0;
  const holdingsCost = new Map<string, number>();

  // Track cost basis for each symbol
  for (const trade of trades) {
    if (trade.type === "BUY") {
      const current = holdingsCost.get(trade.symbol) || 0;
      holdingsCost.set(trade.symbol, current + Number(trade.total_value));
    } else {
      // Realized P&L on sell
      const costBasis = holdingsCost.get(trade.symbol) || 0;
      const holding = holdings.find((h) => h.symbol === trade.symbol);
      const totalQtySold = Number(trade.quantity);
      const avgCost = costBasis > 0 ? costBasis / (holding ? holding.totalQuantity + totalQtySold : totalQtySold) : 0;
      totalPL += Number(trade.total_value) - avgCost * totalQtySold - Number(trade.broker_fee);

      // Reduce cost basis
      const remaining = costBasis - avgCost * totalQtySold;
      holdingsCost.set(trade.symbol, Math.max(0, remaining));
    }
  }

  return totalPL;
}

function generateDailyValues(latestValue: number): DailyPortfolioValue[] {
  const values: DailyPortfolioValue[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dateStr = day.toISOString().split("T")[0];
    values.push({ date: dateStr, value: latestValue });
  }
  return values;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchDashboardData();
      setTrades(result.trades);
      setDividends(result.dividends);
      setDataLoaded(true);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get unique symbols from holdings for price fetching
  const holdings = useMemo(() => computeHoldings(trades), [trades]);

  const symbols = useMemo(
    () => [...new Set(holdings.map((h) => h.symbol))],
    [holdings],
  );

  const { prices, loading: pricesLoading } = useStockPrices(symbols);

  // Compute real portfolio value using market prices
  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const stockPrice = prices.get(h.symbol);
      const currentPrice = stockPrice?.price ?? h.averagePrice;
      return sum + currentPrice * h.totalQuantity;
    }, 0);
  }, [holdings, prices]);

  const totalCostBasis = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.totalCost, 0);
  }, [holdings]);

  const totalUnrealizedPL = useMemo(() => {
    return totalPortfolioValue - totalCostBasis;
  }, [totalPortfolioValue, totalCostBasis]);

  const totalRealizedPL = useMemo(() => computeRealizedPL(trades, holdings), [trades, holdings]);
  const totalPL = totalRealizedPL + totalUnrealizedPL;

  const totalDividends = useMemo(
    () => dividends.reduce((sum, d) => sum + Number(d.amount), 0),
    [dividends],
  );

  const numberOfHoldings = holdings.length;

  // Asset Allocation (top 5 + others)
  const portfolioEntries = useMemo(() => {
    const sorted = [...holdings]
      .map((h) => {
        const stockPrice = prices.get(h.symbol);
        const currentPrice = stockPrice?.price ?? h.averagePrice;
        return { symbol: h.symbol, value: currentPrice * h.totalQuantity };
      })
      .sort((a, b) => b.value - a.value);

    const top5 = sorted.slice(0, 5);
    const othersValue = sorted.slice(5).reduce((sum, h) => sum + h.value, 0);

    const entries: PortfolioEntry[] = top5.map((h) => ({
      symbol: h.symbol,
      value: h.value,
      percentage: totalPortfolioValue > 0 ? (h.value / totalPortfolioValue) * 100 : 0,
    }));

    if (othersValue > 0 && sorted.length > 5) {
      entries.push({
        symbol: "Others",
        value: othersValue,
        percentage: (othersValue / totalPortfolioValue) * 100,
      });
    }

    return entries;
  }, [holdings, prices, totalPortfolioValue]);

  const dailyValues = useMemo(() => generateDailyValues(totalPortfolioValue), [totalPortfolioValue]);

  const isLoaded = !loading && dataLoaded;
  const isPricesReady = !pricesLoading && symbols.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Portfolio overview with live market prices.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Portfolio Value"
          value={formatCompactCurrency(totalPortfolioValue)}
          icon={Briefcase}
          valueClassName="text-green-500"
          loading={!isLoaded}
        />
        <KpiCard
          title="Total P/L"
          value={formatCompactCurrency(totalPL)}
          icon={TrendingUp}
          valueClassName={totalPL >= 0 ? "text-green-500" : "text-red-500"}
          loading={!isLoaded}
        />
        <KpiCard
          title="Dividends"
          value={formatCompactCurrency(totalDividends)}
          icon={DollarSign}
          valueClassName="text-green-500"
          loading={!isLoaded}
        />
        <KpiCard
          title="Holdings"
          value={String(numberOfHoldings)}
          icon={LayoutDashboard}
          loading={!isLoaded}
        />
      </div>

      {/* Additional P/L Detail */}
      {isLoaded && trades.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-muted-foreground">
            Realized P/L:{" "}
            <span className={totalRealizedPL >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
              {formatCurrency(totalRealizedPL)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Unrealized P/L:{" "}
            <span className={totalUnrealizedPL >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
              {formatCurrency(totalUnrealizedPL)}
            </span>
          </span>
          {isPricesReady && (
            <span className="text-muted-foreground">
              Cost basis:{" "}
              <span className="text-foreground font-medium">{formatCurrency(totalCostBasis)}</span>
            </span>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartCard data={portfolioEntries} loading={!isLoaded} />
        <LineChartCard data={dailyValues} loading={!isLoaded} />
      </div>
    </div>
  );
}
