"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useStockHistory } from "@/hooks/useStockHistory";
import { formatCurrency, formatCompactCurrency, cn } from "@/lib/utils";
import { StockChart } from "@/components/charts/StockChart";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatVolume(vol: number | null): string {
  if (vol == null) return "—";
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString();
}

export default function StockDetailPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();

  const { history, meta, loading, error, range, setRange, refresh } = useStockHistory(symbol);

  // Current price from meta (real-time from API)
  const currentPrice = meta?.regularMarketPrice ?? null;
  const previousClose = meta?.previousClose ?? null;
  const change =
    currentPrice != null && previousClose != null ? currentPrice - previousClose : null;
  const changePercent =
    change != null && previousClose != null && previousClose !== 0
      ? (change / previousClose) * 100
      : null;

  const isUp = change != null && change > 0;
  const isDown = change != null && change < 0;
  const colorClass = isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground";
  const bgColorClass = isUp
    ? "bg-green-500/10 border-green-500/20"
    : isDown
      ? "bg-red-500/10 border-red-500/20"
      : "bg-muted/30 border-border";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  // Stats grid data
  const stats = useMemo(
    () => [
      { label: "Open", value: meta?.regularMarketOpen != null ? formatCurrency(meta.regularMarketOpen) : "—" },
      { label: "High", value: meta?.regularMarketDayHigh != null ? formatCurrency(meta.regularMarketDayHigh) : "—" },
      { label: "Low", value: meta?.regularMarketDayLow != null ? formatCurrency(meta.regularMarketDayLow) : "—" },
      { label: "Volume", value: formatVolume(meta?.regularMarketVolume ?? null) },
      { label: "Previous Close", value: previousClose != null ? formatCurrency(previousClose) : "—" },
      { label: "52W High", value: meta?.fiftyTwoWeekHigh != null ? formatCurrency(meta.fiftyTwoWeekHigh) : "—" },
      { label: "52W Low", value: meta?.fiftyTwoWeekLow != null ? formatCurrency(meta.fiftyTwoWeekLow) : "—" },
    ],
    [meta, previousClose],
  );

  // Mini sparkline data for quick glance (last 20 points)
  const sparkData = useMemo(() => history.slice(-20), [history]);
  const sparkUp = sparkData.length >= 2;
  const sparkFirst = sparkData.find((d) => d.close != null);
  const sparkLast = sparkData.findLast((d) => d.close != null);
  const sparkColor =
    sparkUp && sparkFirst?.close != null && sparkLast?.close != null
      ? sparkLast.close >= sparkFirst.close
        ? "#22c55e"
        : "#ef4444"
      : "#6b7280";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Link href="/watchlist">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/watchlist" className="hover:text-foreground transition-colors">
            Watchlist
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{symbol}</span>
        </nav>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-card shadow-sm">
            <span className="text-xl font-bold text-foreground">{symbol.charAt(0)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
              {meta?.longName && (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  {meta.longName}
                </Badge>
              )}
            </div>
            {loading ? (
              <div className="mt-1 space-y-1">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : error ? (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            ) : currentPrice != null ? (
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-bold">{formatCurrency(currentPrice)}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold",
                    bgColorClass,
                    colorClass,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}` : "—"} (
                  {changePercent != null
                    ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
                    : "—"}
                  )
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Price unavailable</p>
            )}
          </div>
        </div>

        {/* Quick sparkline */}
        {sparkData.length >= 2 && !loading && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="text-right">
              <p className="text-xs text-foreground/70">30d Range</p>
              <p className="text-xs font-medium text-foreground">
                {sparkFirst?.close != null ? formatCompactCurrency(sparkFirst.close) : "—"}
                {" — "}
                {sparkLast?.close != null ? formatCompactCurrency(sparkLast.close) : "—"}
              </p>
            </div>
            <svg width="80" height="36" viewBox={`0 0 ${sparkData.length - 1} 36`} className="shrink-0">
              <polyline
                points={sparkData
                  .map((d, i) => {
                    const vals = sparkData.map((p) => p.close).filter((c): c is number => c != null);
                    if (vals.length < 2) return "";
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min || 1;
                    const y = d.close != null ? 34 - ((d.close - min) / range) * 30 : 17;
                    return `${i},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={sparkColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-foreground/70 mb-1">{stat.label}</p>
              <p className="text-sm font-semibold text-foreground">
                {loading ? <Skeleton className="mx-auto h-4 w-16" /> : stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <StockChart
        data={history}
        loading={loading}
        range={range}
        onRangeChange={setRange}
        currency={meta?.currency ?? "USD"}
      />

      {/* Error state */}
      {error && !loading && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
