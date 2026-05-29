"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LayoutDashboard, TrendingUp, DollarSign, Briefcase, Percent, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCompactCurrency, formatCurrency, cn } from "@/lib/utils";
import { useStockPrices } from "@/hooks/useStockPrices";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import { computeHoldings, computeRealizedPL, computePortfolioHistory, computeDividendYOC, computeDividendIncomeByMonth } from "@/lib/portfolio";
import type { Trade, Dividend, PortfolioEntry, WatchlistItem } from "@/lib/types";
import { KpiCard } from "@/components/KpiCard";
import { PieChartCard } from "@/components/charts/PieChart";
import { LineChartCard } from "@/components/charts/LineChart";
import { DividendBarChart } from "@/components/charts/DividendBarChart";
import { RebalancingCard } from "@/components/RebalancingCard";
import { PerformanceMetricsCard } from "@/components/PerformanceMetricsCard";
import { WatchlistAlertsCard } from "@/components/WatchlistAlertsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function fetchDashboardData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [tradesResult, dividendsResult, watchlistResult] = await Promise.all([
    supabase.from("trades").select("*").eq("user_id", user.id),
    supabase.from("dividends").select("*").eq("user_id", user.id),
    supabase.from("watchlists").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (tradesResult.error) throw tradesResult.error;
  if (dividendsResult.error) throw dividendsResult.error;
  if (watchlistResult.error) throw watchlistResult.error;

  return {
    trades: (tradesResult.data || []) as Trade[],
    dividends: (dividendsResult.data || []) as Dividend[],
    watchlist: (watchlistResult.data || []) as WatchlistItem[],
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchDashboardData();
      setTrades(result.trades);
      setDividends(result.dividends);
      setWatchlist(result.watchlist);
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

  // Merge holdings symbols with watchlist symbols so all prices are fetched
  const symbols = useMemo(
    () => [...new Set([...holdings.map((h) => h.symbol), ...watchlist.map((w) => w.symbol)])],
    [holdings, watchlist],
  );

  const { prices, loading: pricesLoading } = useStockPrices(symbols);
  const { fundamentals } = useStockFundamentals(symbols);

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

  // Dividend Yield on Cost per stock
  const dividendYOCs = useMemo(
    () => computeDividendYOC(dividends, holdings),
    [dividends, holdings],
  );

  // Estimated annualized dividend income
  const annualizedDividend = useMemo(() => {
    let total = 0;
    for (const h of holdings) {
      const fd = fundamentals.get(h.symbol);
      const yieldPct = fd?.dividendYield ?? 0;
      if (yieldPct <= 0) continue;
      const stockPrice = prices.get(h.symbol);
      const currentPrice = stockPrice?.price ?? h.averagePrice;
      const marketValue = currentPrice * h.totalQuantity;
      total += marketValue * yieldPct;
    }
    return total;
  }, [holdings, fundamentals, prices]);

  // Weighted average portfolio dividend yield
  const avgPortfolioYield = useMemo(() => {
    let totalValue = 0;
    let weightedYield = 0;
    for (const h of holdings) {
      const fd = fundamentals.get(h.symbol);
      const yieldPct = fd?.dividendYield ?? 0;
      if (yieldPct <= 0) continue;
      const stockPrice = prices.get(h.symbol);
      const currentPrice = stockPrice?.price ?? h.averagePrice;
      const marketValue = currentPrice * h.totalQuantity;
      totalValue += marketValue;
      weightedYield += marketValue * yieldPct;
    }
    return totalValue > 0 ? (weightedYield / totalValue) * 100 : 0;
  }, [holdings, fundamentals, prices]);

  // Dividend income by month for the chart
  const dividendMonthly = useMemo(
    () => computeDividendIncomeByMonth(dividends),
    [dividends],
  );

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

  const dailyValues = useMemo(() => computePortfolioHistory(trades), [trades]);

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

      {/* Dividend Yield Section */}
      {isLoaded && totalDividends > 0 && (
        <>
          {/* Dividend KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              title="Avg Portfolio Yield"
              value={avgPortfolioYield > 0 ? `${avgPortfolioYield.toFixed(2)}%` : "—"}
              icon={Percent}
              valueClassName="text-green-500"
              loading={!isLoaded}
            />
            <KpiCard
              title="Est. Annual Dividend"
              value={annualizedDividend > 0 ? formatCompactCurrency(annualizedDividend) : "—"}
              icon={PiggyBank}
              valueClassName="text-green-500"
              loading={!isLoaded}
            />
            <KpiCard
              title="Dividend Stocks"
              value={String(dividendYOCs.length)}
              icon={Briefcase}
              loading={!isLoaded}
            />
          </div>

          {/* Per-stock YOC Table */}
          {dividendYOCs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Dividend Yield on Cost by Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {dividendYOCs.map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.symbol}</span>
                        <span className="text-xs">
                          {formatCurrency(item.totalDividends)} received
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-xs">
                          Cost: {formatCompactCurrency(item.costBasis)}
                        </span>
                        <Badge variant="outline" className="text-green-500 font-medium">
                          {item.yieldOnCost.toFixed(2)}% YOC
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartCard data={portfolioEntries} loading={!isLoaded} />
        <LineChartCard data={dailyValues} loading={!isLoaded} showInvestment />
      </div>

      {/* Watchlist Alerts */}
      {isLoaded && watchlist.length > 0 && (
        <WatchlistAlertsCard
          items={watchlist}
          prices={prices}
          pricesLoading={pricesLoading}
          loading={!isLoaded}
          onRefresh={loadData}
        />
      )}

      {/* Performance Metrics */}
      {isLoaded && trades.length > 0 && (
        <PerformanceMetricsCard
          trades={trades}
          currentMarketValue={totalPortfolioValue}
          dailyHistory={dailyValues}
          loading={!isLoaded}
        />
      )}

      {/* Portfolio Rebalancing */}
      {isLoaded && symbols.length > 0 && (
        <RebalancingCard
          holdings={holdings}
          prices={prices}
          totalPortfolioValue={totalPortfolioValue}
          loading={!isLoaded}
        />
      )}

      {/* Dividend Income Chart */}
      {dividendMonthly.length > 0 && (
        <DividendBarChart data={dividendMonthly} loading={!isLoaded} />
      )}
    </div>
  );
}
