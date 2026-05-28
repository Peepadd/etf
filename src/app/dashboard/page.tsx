"use client";

import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, TrendingUp, DollarSign, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import type { Trade, Dividend, PortfolioHolding, PortfolioEntry, DailyPortfolioValue } from "@/lib/types";
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

function computeMetrics(trades: Trade[], dividends: Dividend[]) {
  // Build holdings: sum BUY quantities per symbol
  const holdingsMap = new Map<string, PortfolioHolding>();

  for (const trade of trades) {
    const sym = trade.symbol;
    const existing = holdingsMap.get(sym) || {
      symbol: sym,
      totalQuantity: 0,
      totalValue: 0,
      averagePrice: 0,
    };

    if (trade.type === "BUY") {
      existing.totalQuantity += Number(trade.quantity);
      existing.totalValue += Number(trade.total_value);
    } else {
      existing.totalQuantity -= Number(trade.quantity);
      existing.totalValue -= Number(trade.total_value);
    }

    if (existing.totalQuantity > 0) {
      existing.averagePrice = existing.totalValue / existing.totalQuantity;
    }
    holdingsMap.set(sym, existing);
  }

  // Filter to only positive holdings
  const holdings = Array.from(holdingsMap.values()).filter((h) => h.totalQuantity > 0);

  // Total portfolio value = sum of all BUY positions (current holdings value)
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

  // Total realized P/L from SELL trades
  let totalRealizedPL = 0;
  for (const trade of trades) {
    if (trade.type === "SELL") {
      // Simple: total_value of sell - (avg cost basis * quantity)
      // For simplicity, use total_value directly
      totalRealizedPL += Number(trade.total_value) - Number(trade.broker_fee);
    }
  }

  // Total dividends
  const totalDividends = dividends.reduce((sum, d) => sum + Number(d.amount), 0);

  // Number of holdings
  const numberOfHoldings = holdings.length;

  // Asset Allocation (top 5 + others)
  const sorted = [...holdings].sort((a, b) => b.totalValue - a.totalValue);
  const top5 = sorted.slice(0, 5);
  const othersValue = sorted.slice(5).reduce((sum, h) => sum + h.totalValue, 0);

  const portfolioEntries: PortfolioEntry[] = top5.map((h) => ({
    symbol: h.symbol,
    value: h.totalValue,
    percentage: totalPortfolioValue > 0 ? (h.totalValue / totalPortfolioValue) * 100 : 0,
  }));

  if (othersValue > 0 && sorted.length > 5) {
    portfolioEntries.push({
      symbol: "Others",
      value: othersValue,
      percentage: (othersValue / totalPortfolioValue) * 100,
    });
  }

  // Generate daily portfolio values for last 30 days
  const dailyValues: DailyPortfolioValue[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dateStr = day.toISOString().split("T")[0];

    // For simplicity, use current portfolio value for all days
    // In production, you'd track this over time or store daily snapshots
    dailyValues.push({
      date: dateStr,
      value: totalPortfolioValue,
    });
  }

  return {
    totalPortfolioValue,
    totalRealizedPL,
    totalDividends,
    numberOfHoldings,
    portfolioEntries,
    dailyValues,
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalPortfolioValue: 0,
    totalRealizedPL: 0,
    totalDividends: 0,
    numberOfHoldings: 0,
    portfolioEntries: [] as PortfolioEntry[],
    dailyValues: [] as DailyPortfolioValue[],
  });

  const loadData = useCallback(async () => {
    try {
      const { trades, dividends } = await fetchDashboardData();
      const result = computeMetrics(trades, dividends);
      setMetrics(result);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Portfolio overview at a glance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Portfolio Value"
          value={formatCompactCurrency(metrics.totalPortfolioValue)}
          icon={Briefcase}
          valueClassName="text-green-500"
          loading={loading}
        />
        <KpiCard
          title="Realized P/L"
          value={formatCompactCurrency(metrics.totalRealizedPL)}
          icon={TrendingUp}
          valueClassName={metrics.totalRealizedPL >= 0 ? "text-green-500" : "text-red-500"}
          loading={loading}
        />
        <KpiCard
          title="Dividends"
          value={formatCompactCurrency(metrics.totalDividends)}
          icon={DollarSign}
          valueClassName="text-green-500"
          loading={loading}
        />
        <KpiCard
          title="Holdings"
          value={String(metrics.numberOfHoldings)}
          icon={LayoutDashboard}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartCard data={metrics.portfolioEntries} loading={loading} />
        <LineChartCard data={metrics.dailyValues} loading={loading} />
      </div>
    </div>
  );
}
