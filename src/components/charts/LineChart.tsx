"use client";

import {
  LineChart as RechartsLine,
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
      <p className="text-sm text-muted-foreground">{label}</p>
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
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLine data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => formatDateShort(val)}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tickFormatter={(val) => formatCompactCurrency(val)}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e" }}
              />
              {hasInvestment && (
                <Line
                  type="monotone"
                  dataKey="investment"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                />
              )}
            </RechartsLine>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
