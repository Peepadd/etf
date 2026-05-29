"use client";

import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactCurrency } from "@/lib/utils";
import type { PortfolioEntry } from "@/lib/types";

// Brighter, more saturated palette optimized for dark backgrounds
const COLORS = [
  "#4ade80", // green
  "#60a5fa", // blue
  "#fbbf24", // amber
  "#f87171", // red
  "#a78bfa", // purple
  "#818cf8", // indigo
  "#2dd4bf", // teal
  "#fb923c", // orange
  "#a1a1aa", // zinc
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PortfolioEntry }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="font-medium text-foreground">{entry.symbol}</p>
      <p className="text-sm text-foreground">{formatCompactCurrency(entry.value)}</p>
      <p className="text-sm text-foreground">{entry.percentage.toFixed(1)}%</p>
    </div>
  );
}

interface PieChartCardProps {
  data: PortfolioEntry[];
  loading?: boolean;
}

export function PieChartCard({ data, loading }: PieChartCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
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
          Asset Allocation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-foreground/70">No holdings yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPie>
              {/* Center label showing total value */}
              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--foreground))" fontSize="18" fontWeight="bold" fontFamily="var(--font-sans)">
                {formatCompactCurrency(data.reduce((s, e) => s + e.value, 0))}
              </text>
              <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize="11">
                Total Value
              </text>
              <Pie
                data={data}
                dataKey="value"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                paddingAngle={2}
                strokeWidth={3}
                stroke="hsl(var(--background))"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
              stroke="hsl(var(--background))"
              strokeWidth={2}
                    className="outline-none hover:opacity-90 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
                wrapperStyle={{ paddingTop: 16 }}
              />
            </RechartsPie>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
