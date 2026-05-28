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
import { formatCompactCurrency, formatDateShort } from "@/lib/utils";
import type { DailyPortfolioValue } from "@/lib/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyPortfolioValue }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{formatCompactCurrency(data.value)}</p>
    </div>
  );
}

interface LineChartCardProps {
  data: DailyPortfolioValue[];
  loading?: boolean;
}

export function LineChartCard({ data, loading }: LineChartCardProps) {
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
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Portfolio Value Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            </RechartsLine>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
