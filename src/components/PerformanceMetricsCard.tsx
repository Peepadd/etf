"use client";

import { useMemo } from "react";
import { TrendingUp, Percent, Clock, Award, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { computePerformanceMetrics } from "@/lib/portfolio";
import type { Trade, DailyPortfolioValue } from "@/lib/types";

interface PerformanceMetricsCardProps {
  trades: Trade[];
  currentMarketValue: number;
  dailyHistory: DailyPortfolioValue[];
  loading?: boolean;
}

export function PerformanceMetricsCard({
  trades,
  currentMarketValue,
  dailyHistory,
  loading,
}: PerformanceMetricsCardProps) {
  const metrics = useMemo(
    () => computePerformanceMetrics(trades, currentMarketValue, dailyHistory),
    [trades, currentMarketValue, dailyHistory],
  );

  const formatPct = (val: number | null, decimals = 2) => {
    if (val == null) return "—";
    const prefix = val >= 0 ? "+" : "";
    return `${prefix}${val.toFixed(decimals)}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trades.length === 0) return null;

  const winRateColor =
    metrics.winRate != null
      ? metrics.winRate >= 60
        ? "text-green-500"
        : metrics.winRate >= 40
          ? "text-amber-500"
          : "text-red-500"
      : "text-muted-foreground";

  const returnColor =
    metrics.totalReturn != null
      ? metrics.totalReturn >= 0
        ? "text-green-500"
        : "text-red-500"
      : "text-muted-foreground";

  const cagrColor =
    metrics.cagr != null
      ? metrics.cagr >= 0
        ? "text-green-500"
        : "text-red-500"
      : "text-muted-foreground";

  const twrrColor =
    metrics.twrr != null
      ? metrics.twrr >= 0
        ? "text-green-500"
        : "text-red-500"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {/* Win Rate */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Award className="h-3.5 w-3.5" />
              Win Rate
            </div>
            <p className={`mt-1 text-xl font-bold tabular-nums ${winRateColor}`}>
              {metrics.winRate != null ? `${metrics.winRate.toFixed(1)}%` : "—"}
            </p>
            {metrics.totalClosedTrades > 0 && (
              <p className="text-[11px] text-foreground mt-0.5">
                {metrics.totalWins}W / {metrics.totalLosses}L ({metrics.totalClosedTrades} closed)
              </p>
            )}
          </div>

          {/* Total Return */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Return
            </div>
            <p className={`mt-1 text-xl font-bold tabular-nums ${returnColor}`}>
              {formatPct(metrics.totalReturn)}
            </p>
            {metrics.daysSinceStart > 0 && (
              <p className="text-[11px] text-foreground mt-0.5">
                Over {metrics.daysSinceStart} days
              </p>
            )}
          </div>

          {/* CAGR */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              CAGR
            </div>
            <p className={`mt-1 text-xl font-bold tabular-nums ${cagrColor}`}>
              {formatPct(metrics.cagr)}
            </p>
            <p className="text-[11px] text-foreground/70 mt-0.5">
              Compound annual growth
            </p>
          </div>

          {/* TWRR */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              TWRR
            </div>
            <p className={`mt-1 text-xl font-bold tabular-nums ${twrrColor}`}>
              {formatPct(metrics.twrr)}
            </p>
            <p className="text-[11px] text-foreground/70 mt-0.5">
              Time-weighted return
            </p>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[10px] text-foreground/70 mt-4 leading-relaxed">
          Win rate based on closed (SELL) trades. CAGR calculated from total invested vs current market value over {(metrics.daysSinceStart / 365).toFixed(1)} years. TWRR chains returns between cash-flow events.
        </p>
      </CardContent>
    </Card>
  );
}
