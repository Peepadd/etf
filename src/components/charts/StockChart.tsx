"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompactCurrency, formatCurrency } from "@/lib/utils";
import type { HistoryPoint, TimeRange } from "@/lib/types";

// ─── Range option ──────────────────────────────────────────────────

interface RangeOption {
  label: string;
  value: TimeRange;
}

const RANGE_OPTIONS: RangeOption[] = [
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

// ─── Custom tooltip ────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HistoryPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">
        {p.close != null ? formatCurrency(p.close) : "—"}
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Open: {p.open != null ? formatCurrency(p.open) : "—"}</span>
        <span>High: {p.high != null ? formatCurrency(p.high) : "—"}</span>
        <span>Low: {p.low != null ? formatCurrency(p.low) : "—"}</span>
        <span>
          Vol:{" "}
          {p.volume != null
            ? p.volume >= 1_000_000
              ? `${(p.volume / 1_000_000).toFixed(1)}M`
              : `${(p.volume / 1_000).toFixed(0)}K`
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────

interface StockChartProps {
  data: HistoryPoint[];
  loading: boolean;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  currency?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export function StockChart({
  data,
  loading,
  range,
  onRangeChange,
  currency = "USD",
}: StockChartProps) {
  // Compute price direction for chart colour
  const isUp = useMemo(() => {
    if (data.length < 2) return true;
    const first = data.find((d) => d.close != null);
    const last = data.findLast((d) => d.close != null);
    if (!first || !last || first.close == null || last.close == null) return true;
    return last.close >= first.close;
  }, [data]);

  const chartColor = isUp ? "#22c55e" : "#ef4444";
  const chartGradientId = `stockGradient-${isUp ? "green" : "red"}`;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((opt) => (
                <Skeleton key={opt.value} className="h-8 w-10" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Price History · {currency}
          </p>
          {/* Time range selector */}
          <div className="flex gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onRangeChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(val: string) => {
                  if (range === "5d") {
                    // show only day/month for intraday-ish range
                    const d = new Date(val);
                    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  }
                  const parts = val.split("-");
                  return `${parts[1]}/${parts[2]}`;
                }}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={["dataMin - 5", "dataMax + 5"]}
                tickFormatter={(val: number) => formatCompactCurrency(val)}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                width={65}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#${chartGradientId})`}
                dot={false}
                activeDot={{ r: 5, fill: chartColor, stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
