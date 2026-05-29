"use client";

import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import type { DividendMonthlyIncome } from "@/lib/portfolio";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DividendMonthlyIncome }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm text-muted-foreground">{data.label}</p>
      <p className="text-lg font-bold text-green-500">
        {formatCurrency(data.amount)}
      </p>
    </div>
  );
}

interface DividendBarChartProps {
  data: DividendMonthlyIncome[];
  loading?: boolean;
}

export function DividendBarChart({ data, loading }: DividendBarChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dividend Income</CardTitle>
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
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Dividend Income Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No dividends recorded yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBar data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tickFormatter={(val: number) => formatCompactCurrency(val)}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                width={65}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="amount"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </RechartsBar>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
