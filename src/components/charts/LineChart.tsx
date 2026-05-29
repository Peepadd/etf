"use client";

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactCurrency, formatDateShort, cn } from "@/lib/utils";
import type { DailyPortfolioValue } from "@/lib/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyPortfolioValue }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const diff =
    data.investment != null ? data.value - data.investment : null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm text-foreground/80">{label}</p>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">Portfolio</span>
          </span>
          <span className="text-xs font-medium tabular-nums">
            {formatCompactCurrency(data.value)}
          </span>
        </div>
        {data.investment != null && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-[#6366f1]" />
                <span className="text-muted-foreground">Invested</span>
              </span>
              <span className="text-xs font-medium tabular-nums">
                {formatCompactCurrency(data.investment)}
              </span>
            </div>
            {diff != null && (
              <div className="flex items-center justify-between gap-4 border-t pt-1 mt-1">
                <span className="text-xs text-muted-foreground">P&amp;L</span>
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    diff >= 0 ? "text-green-500" : "text-red-500",
                  )}
                >
                  {diff >= 0 ? "+" : ""}
                  {formatCompactCurrency(diff)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface LineChartCardProps {
  data: DailyPortfolioValue[];
  loading?: boolean;
  showInvestment?: boolean;
}

export function LineChartCard({ data, loading, showInvestment }: LineChartCardProps) {
  const hasInvestment = showInvestment && data.length > 0 && data[0].investment != null;
  const chartData = data.filter(d => d.value > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Portfolio Value Over Time
          </CardTitle>
          {hasInvestment && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                <span className="text-muted-foreground">Value</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-[#6366f1]" />
                <span className="text-muted-foreground">Invested</span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-foreground/70">No data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>

              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => formatDateShort(val)}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--muted-foreground) / 0.2)"
              />
              <YAxis
                domain={[(dataMin: number) => dataMin * 0.98, (dataMax: number) => dataMax * 1.02]}
                tickFormatter={(val) => formatCompactCurrency(val)}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--muted-foreground) / 0.2)"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#valueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "#22c55e", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />                {hasInvestment && (
                  <Line
                    type="monotone"
                    dataKey="investment"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 5, fill: "#6366f1", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  />
                )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
