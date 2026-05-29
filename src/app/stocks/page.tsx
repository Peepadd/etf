"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, BarChart3, ExternalLink, Search, Building2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, formatCompactCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { computePortfolioHistory } from "@/lib/portfolio";
import { useStockPrices } from "@/hooks/useStockPrices";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import type { Trade, StockPrice } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChartCard } from "@/components/charts/LineChart";

interface StockPosition {
  symbol: string;
  totalQuantity: number;
  totalCost: number;
  averagePrice: number;
  marketPrice: number | null;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number | null;
  change: number | null;
  changePercent: number | null;
}

function computePositions(trades: Trade[], prices: Map<string, StockPrice>): StockPosition[] {
  const holdingsMap = new Map<string, { qty: number; cost: number }>();

  for (const trade of trades) {
    const sym = trade.symbol;
    const existing = holdingsMap.get(sym) || { qty: 0, cost: 0 };

    if (trade.type === "BUY") {
      existing.qty += Number(trade.quantity);
      existing.cost += Number(trade.total_value);
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
  }

  // Also include stocks that were fully sold (to show 0 position)
  const allSymbols = new Set(trades.map((t) => t.symbol));
  const positions: StockPosition[] = [];

  for (const sym of allSymbols) {
    const holding = holdingsMap.get(sym) || { qty: 0, cost: 0 };
    const stockPrice = prices.get(sym);
    const mktPrice = stockPrice?.price ?? null;
    const mv = mktPrice != null ? mktPrice * holding.qty : holding.cost;
    const upl = mktPrice != null ? mv - holding.cost : 0;
    const uplPct = holding.cost > 0 && mktPrice != null ? ((mktPrice - holding.cost / (holding.qty || 1)) / (holding.cost / (holding.qty || 1))) * 100 : null;

    // For fully sold positions, use the trade price info for display
    const avgPrice = holding.qty > 0 ? holding.cost / holding.qty : 0;

    positions.push({
      symbol: sym,
      totalQuantity: holding.qty,
      totalCost: holding.cost,
      averagePrice: avgPrice,
      marketPrice: mktPrice,
      marketValue: mv,
      unrealizedPL: upl,
      unrealizedPLPercent: holding.qty > 0 ? uplPct : null,
      change: stockPrice?.change ?? null,
      changePercent: stockPrice?.changePercent ?? null,
    });
  }

  // Sort by market value descending (active holdings first)
  positions.sort((a, b) => b.marketValue - a.marketValue);

  return positions;
}

type SortKey = "symbol" | "marketValue" | "unrealizedPL" | "changePercent" | "trailingPE" | "marketCap" | "totalQuantity";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

export default function StocksPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSymbol, setFilterSymbol] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<SortState>({ key: "marketValue", direction: "desc" });
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [chartRange, setChartRange] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("1Y");

  const loadTrades = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      setTrades((data || []) as Trade[]);
    } catch (error) {
      console.error("Failed to load trades:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.symbol))],
    [trades],
  );

  const { prices, loading: pricesLoading } = useStockPrices(symbols);
  const { fundamentals, loading: fundamentalsLoading } = useStockFundamentals(symbols);

  const positions = useMemo(
    () => computePositions(trades, prices),
    [trades, prices],
  );

  const filteredPositions = useMemo(() => {
    let result = positions;

    // Status filter
    if (statusFilter === "ACTIVE") {
      result = result.filter((p) => p.totalQuantity > 0);
    } else if (statusFilter === "CLOSED") {
      result = result.filter((p) => p.totalQuantity === 0);
    }

    // Symbol search
    if (filterSymbol) {
      result = result.filter((p) =>
        p.symbol.toLowerCase().includes(filterSymbol.toLowerCase()),
      );
    }

    // Sort
    const { key, direction } = sort;
    const multiplier = direction === "asc" ? 1 : -1;

    result.sort((a, b) => {
      // Active holdings first when sorting by marketValue
      if (key === "marketValue" && a.totalQuantity === 0 && b.totalQuantity > 0) return 1;
      if (key === "marketValue" && a.totalQuantity > 0 && b.totalQuantity === 0) return -1;

      const aVal = getSortValue(a, key, fundamentals.get(a.symbol));
      const bVal = getSortValue(b, key, fundamentals.get(b.symbol));

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });

    return result;
  }, [positions, filterSymbol, statusFilter, sort, fundamentals]);

  function getSortValue(pos: StockPosition, key: SortKey, fd: { trailingPE?: number | null; marketCap?: number | null } | undefined): number | string | null {
    switch (key) {
      case "symbol": return pos.symbol;
      case "marketValue": return pos.marketValue;
      case "unrealizedPL": return pos.unrealizedPL;
      case "changePercent": return pos.changePercent;
      case "trailingPE": return fd?.trailingPE ?? null;
      case "marketCap": return fd?.marketCap ?? null;
      case "totalQuantity": return pos.totalQuantity;
      default: return null;
    }
  }

  const totalMarketValue = useMemo(
    () => positions.reduce((sum, p) => sum + p.marketValue, 0),
    [positions],
  );

  const totalUnrealizedPL = useMemo(
    () => positions.reduce((sum, p) => sum + p.unrealizedPL, 0),
    [positions],
  );

  const activeHoldings = useMemo(
    () => positions.filter((p) => p.totalQuantity > 0),
    [positions],
  );

  const portfolioHistory = useMemo(
    () => computePortfolioHistory(trades),
    [trades],
  );

  const filteredChartData = useMemo(() => {
    if (chartRange === "ALL" || portfolioHistory.length === 0) return portfolioHistory;

    const now = new Date();
    let cutoff: Date;

    switch (chartRange) {
      case "1M": cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); break;
      case "3M": cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3); break;
      case "6M": cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 6); break;
      case "1Y": cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      default: return portfolioHistory;
    }

    const cutoffStr = cutoff.toISOString().split("T")[0];
    return portfolioHistory.filter((d) => d.date >= cutoffStr);
  }, [portfolioHistory, chartRange]);

  const isReady = !loading && trades.length > 0;
  const isPricesReady = !pricesLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stocks</h1>
        <p className="text-sm text-muted-foreground">
          All your traded stocks with live market prices.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Stocks</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-xl font-bold">{symbols.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Holdings</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-xl font-bold">{activeHoldings.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Value</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-24" />
            ) : (
              <p className="mt-1 text-xl font-bold text-green-500">
                {formatCompactCurrency(totalMarketValue)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total P&L</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-24" />
            ) : (
              <p
                className={cn(
                  "mt-1 text-xl font-bold",
                  totalUnrealizedPL >= 0 ? "text-green-500" : "text-red-500",
                )}
              >
                {totalUnrealizedPL >= 0 ? "+" : ""}
                {formatCompactCurrency(totalUnrealizedPL)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Value Chart */}
      {isReady && portfolioHistory.length > 1 && (
        <div className="space-y-1">
          <div className="flex justify-end">
            {/* Range selector */}
            <div className="flex gap-0.5 rounded-lg border bg-muted/30 p-0.5">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setChartRange(opt)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    chartRange === opt
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt === "ALL" ? "All" : opt}
                </button>
              ))}
            </div>
          </div>
          <LineChartCard data={filteredChartData} loading={false} showInvestment />
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stocks..."
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Stocks</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort key */}
        <div className="flex items-center gap-2">
          <Select
            value={sort.key}
            onValueChange={(v) => setSort((prev) => ({ ...prev, key: v as SortKey }))}
          >
            <SelectTrigger className="w-36 h-9">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketValue">Market Value</SelectItem>
              <SelectItem value="unrealizedPL">P&amp;L</SelectItem>
              <SelectItem value="changePercent">Change %</SelectItem>
              <SelectItem value="symbol">Symbol</SelectItem>
              <SelectItem value="totalQuantity">Shares</SelectItem>
              <SelectItem value="trailingPE">P/E</SelectItem>
              <SelectItem value="marketCap">Market Cap</SelectItem>
            </SelectContent>
          </Select>

          {/* Direction toggle */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() =>
              setSort((prev) => ({
                ...prev,
                direction: prev.direction === "asc" ? "desc" : "asc",
              }))
            }
            title={sort.direction === "asc" ? "Ascending" : "Descending"}
          >
            {sort.direction === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "card"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Stocks Content */}
      {loading ? (
        viewMode === "card" ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="h-4 w-24 ml-auto" />
                      <Skeleton className="h-3 w-16 ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Symbol</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Mkt Value</TableHead>
                  <TableHead className="text-right">P&amp;L</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">P/E</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-[80px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : !isReady ? (
        <div className="flex flex-col items-center justify-center rounded-md border py-16 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add trades in the Trades tab to see stock data here.
          </p>
          <Link href="/trades">
            <Button variant="outline" size="sm" className="mt-4">
              Go to Trades
            </Button>
          </Link>
        </div>
      ) : filteredPositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No stocks match &quot;{filterSymbol}&quot;
          </p>
        </div>
      ) : viewMode === "card" ? (
        <div className="space-y-2">
          {filteredPositions.map((pos) => {
            const isUp = pos.change != null && pos.change > 0;
            const isDown = pos.change != null && pos.change < 0;
            const priceColor = isUp ? "text-green-500" : isDown ? "text-red-500" : "text-muted-foreground";
            const PriceIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

            const plUp = pos.unrealizedPL > 0;
            const plDown = pos.unrealizedPL < 0;

            return (
              <div
                key={pos.symbol}
                onClick={() => setSelectedSymbol(pos.symbol)}
                className="group block cursor-pointer"
              >
                <Card className="transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Symbol icon */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card">
                        <span className="text-sm font-bold">{pos.symbol.charAt(0)}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{pos.symbol}</span>
                          {pos.totalQuantity > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                              {formatNumber(pos.totalQuantity)} shares
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                              Closed
                            </Badge>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          {pos.totalQuantity > 0 && (
                            <>
                              <span>
                                Avg: {formatCurrency(pos.averagePrice)}
                              </span>
                              <span>
                                Cost: {formatCompactCurrency(pos.totalCost)}
                              </span>
                            </>
                          )}
                          <span>
                            Trades: {trades.filter((t) => t.symbol === pos.symbol).length}
                          </span>
                        </div>
                        {/* Fundamentals */}
                        {!fundamentalsLoading && (() => {
                          const fd = fundamentals.get(pos.symbol);
                          if (!fd) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                              {fd.sector && (
                                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0 text-muted-foreground">
                                  <Building2 className="h-2.5 w-2.5" />
                                  {fd.sector}
                                </span>
                              )}
                              {fd.trailingPE != null && fd.trailingPE > 0 && (
                                <span className="text-muted-foreground">
                                  P/E: <span className="font-medium text-foreground">{fd.trailingPE.toFixed(1)}</span>
                                </span>
                              )}
                              {fd.marketCap != null && fd.marketCap > 0 && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <DollarSign className="h-2.5 w-2.5" />
                                  <span className="font-medium text-foreground">{formatCompactCurrency(fd.marketCap)}</span>
                                </span>
                              )}
                              {fd.dividendYield != null && fd.dividendYield > 0 && (
                                <span className="text-muted-foreground">
                                  Div: <span className="font-medium text-foreground">{(fd.dividendYield * 100).toFixed(2)}%</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Price & P&L */}
                      <div className="text-right shrink-0">
                        {pos.marketPrice != null && pos.marketPrice > 0 ? (
                          <>
                            <span className="text-lg font-bold tabular-nums">
                              {formatCurrency(pos.marketPrice)}
                            </span>
                            <div className="flex items-center justify-end gap-1">
                              <PriceIcon className={`h-3 w-3 ${priceColor}`} />
                              <span className={`text-xs font-medium ${priceColor}`}>
                                {pos.change != null
                                  ? `${pos.change >= 0 ? "+" : ""}${pos.change.toFixed(2)}`
                                  : "—"}
                              </span>
                              <span className={`text-xs ${priceColor}`}>
                                ({pos.changePercent != null
                                  ? `${pos.changePercent >= 0 ? "+" : ""}${pos.changePercent.toFixed(2)}%`
                                  : "—"})
                              </span>
                            </div>
                            {pos.totalQuantity > 0 && isPricesReady && pos.marketPrice != null && (
                              <div
                                className={cn(
                                  "text-xs font-medium mt-0.5",
                                  plUp ? "text-green-500" : plDown ? "text-red-500" : "text-muted-foreground",
                                )}
                              >
                                P&L: {pos.unrealizedPL >= 0 ? "+" : ""}
                                {formatCompactCurrency(pos.unrealizedPL)}
                                {pos.unrealizedPLPercent != null && (
                                  <span>
                                    {" "}
                                    ({pos.unrealizedPLPercent >= 0 ? "+" : ""}
                                    {pos.unrealizedPLPercent.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="h-5" />
                            <span className="text-xs text-muted-foreground">
                              {isPricesReady ? "—" : "Loading..."}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Symbol</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Mkt Value</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">P/E</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.map((pos) => {
                const fd = fundamentals.get(pos.symbol);
                const isUp = pos.change != null && pos.change > 0;
                const isDown = pos.change != null && pos.change < 0;
                const priceColor = isUp ? "text-green-500" : isDown ? "text-red-500" : "text-muted-foreground";
                const PriceIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
                const plUp = pos.unrealizedPL > 0;
                const plDown = pos.unrealizedPL < 0;

                return (
                  <TableRow
                    key={pos.symbol}
                    className="cursor-pointer"
                    onClick={() => setSelectedSymbol(pos.symbol)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-card">
                          <span className="text-[10px] font-bold">{pos.symbol.charAt(0)}</span>
                        </div>
                        {pos.symbol}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {pos.marketPrice != null && pos.marketPrice > 0
                        ? formatCurrency(pos.marketPrice)
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {pos.change != null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${priceColor}`}>
                          <PriceIcon className="h-3 w-3" />
                          {pos.changePercent != null
                            ? `${pos.changePercent >= 0 ? "+" : ""}${pos.changePercent.toFixed(2)}%`
                            : "—"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pos.totalQuantity > 0 ? formatNumber(pos.totalQuantity) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pos.totalQuantity > 0 ? formatCurrency(pos.averagePrice) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {pos.totalQuantity > 0 ? formatCompactCurrency(pos.marketValue) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pos.totalQuantity > 0 && isPricesReady ? (
                        <span className={cn("tabular-nums text-xs font-medium", plUp ? "text-green-500" : plDown ? "text-red-500" : "")}>
                          {pos.unrealizedPL >= 0 ? "+" : ""}{formatCompactCurrency(pos.unrealizedPL)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[120px]">
                      <span className="truncate text-xs text-muted-foreground block">
                        {!fundamentalsLoading && fd?.sector ? fd.sector : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fd?.trailingPE != null && fd.trailingPE > 0
                        ? fd.trailingPE.toFixed(1)
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Stock Detail Modal */}
      <Dialog
        open={selectedSymbol != null}
        onOpenChange={(open) => {
          if (!open) setSelectedSymbol(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          {selectedSymbol && (() => {
            const pos = positions.find((p) => p.symbol === selectedSymbol);
            const fd = fundamentals.get(selectedSymbol);
            const symTrades = trades.filter((t) => t.symbol === selectedSymbol).slice(0, 10);
            if (!pos) return null;

            const isUp = pos.change != null && pos.change > 0;
            const isDown = pos.change != null && pos.change < 0;
            const priceColor = isUp ? "text-green-500" : isDown ? "text-red-500" : "text-muted-foreground";
            const PriceIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
            const plUp = pos.unrealizedPL > 0;
            const plDown = pos.unrealizedPL < 0;

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card shadow-sm">
                        <span className="text-lg font-bold">{selectedSymbol.charAt(0)}</span>
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{selectedSymbol}</DialogTitle>
                        {fd?.longName && (
                          <DialogDescription className="text-xs mt-0.5">
                            {fd.longName}
                          </DialogDescription>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/stock/${selectedSymbol}`}
                      onClick={() => setSelectedSymbol(null)}
                    >
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Full Details
                      </Button>
                    </Link>
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Current Price */}
                  {pos.marketPrice != null && pos.marketPrice > 0 && (
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold tabular-nums">
                        {formatCurrency(pos.marketPrice)}
                      </span>
                      <span className={`flex items-center gap-1 text-sm font-medium ${priceColor}`}>
                        <PriceIcon className="h-4 w-4" />
                        {pos.change != null ? `${pos.change >= 0 ? "+" : ""}${pos.change.toFixed(2)}` : "—"}
                        <span>
                          ({pos.changePercent != null
                            ? `${pos.changePercent >= 0 ? "+" : ""}${pos.changePercent.toFixed(2)}%`
                            : "—"})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Position Summary */}
                  {pos.totalQuantity > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shares</p>
                        <p className="mt-0.5 text-lg font-bold">{formatNumber(pos.totalQuantity)}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Cost</p>
                        <p className="mt-0.5 text-lg font-bold">{formatCurrency(pos.averagePrice)}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Market Value</p>
                        <p className="mt-0.5 text-lg font-bold">{formatCompactCurrency(pos.marketValue)}</p>
                      </div>
                    </div>
                  )}

                  {/* P&L */}
                  {pos.totalQuantity > 0 && (
                    <div
                      className={cn(
                        "rounded-lg border p-3 text-center",
                        plUp ? "border-green-500/20 bg-green-500/5" : plDown ? "border-red-500/20 bg-red-500/5" : "",
                      )}
                    >
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Unrealized P&amp;L
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-xl font-bold",
                          plUp ? "text-green-500" : plDown ? "text-red-500" : "text-muted-foreground",
                        )}
                      >
                        {pos.unrealizedPL >= 0 ? "+" : ""}
                        {formatCurrency(pos.unrealizedPL)}
                        {pos.unrealizedPLPercent != null && (
                          <span className="text-sm font-medium ml-1">
                            ({pos.unrealizedPLPercent >= 0 ? "+" : ""}
                            {pos.unrealizedPLPercent.toFixed(1)}%)
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Fundamentals */}
                  {fd && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Fundamentals</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {fd.sector && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">Sector</p>
                            <p className="text-sm font-medium">{fd.sector}</p>
                          </div>
                        )}
                        {fd.industry && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">Industry</p>
                            <p className="text-sm font-medium">{fd.industry}</p>
                          </div>
                        )}
                        {fd.trailingPE != null && fd.trailingPE > 0 && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">P/E (TTM)</p>
                            <p className="text-sm font-medium">{fd.trailingPE.toFixed(2)}</p>
                          </div>
                        )}
                        {fd.forwardPE != null && fd.forwardPE > 0 && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">Forward P/E</p>
                            <p className="text-sm font-medium">{fd.forwardPE.toFixed(2)}</p>
                          </div>
                        )}
                        {fd.marketCap != null && fd.marketCap > 0 && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">Market Cap</p>
                            <p className="text-sm font-medium">{formatCompactCurrency(fd.marketCap)}</p>
                          </div>
                        )}
                        {fd.dividendYield != null && fd.dividendYield > 0 && (
                          <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[10px] text-muted-foreground">Div Yield</p>
                            <p className="text-sm font-medium">{(fd.dividendYield * 100).toFixed(2)}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Trades */}
                  {symTrades.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Recent Trades ({trades.filter((t) => t.symbol === selectedSymbol).length} total)
                      </h4>
                      <div className="space-y-1">
                        {symTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={trade.type === "BUY" ? "default" : "destructive"}
                                className="text-[10px] px-1.5 py-0 h-5"
                              >
                                {trade.type}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {formatDate(trade.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="tabular-nums">{formatNumber(trade.quantity)} shares</span>
                              <span className="tabular-nums text-muted-foreground">@ {formatCurrency(trade.price)}</span>
                              <span className="tabular-nums font-medium">{formatCurrency(trade.total_value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
