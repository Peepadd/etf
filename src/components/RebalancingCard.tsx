"use client";

import { useState, useMemo, useEffect } from "react";
import { Pencil, RotateCcw, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import type { Holding, RebalanceRecommendation } from "@/lib/portfolio";
import { computeRebalancing, loadTargets, saveTargets } from "@/lib/portfolio";
import type { StockPrice } from "@/lib/types";

interface RebalancingCardProps {
  holdings: Holding[];
  prices: Map<string, StockPrice>;
  totalPortfolioValue: number;
  loading?: boolean;
}

export function RebalancingCard({
  holdings,
  prices,
  totalPortfolioValue,
  loading,
}: RebalancingCardProps) {
  const [editing, setEditing] = useState(false);
  const [totalError, setTotalError] = useState(false);
  const [targets, setTargets] = useState<{ symbol: string; pct: string }[]>([]);

  // Sync targets with current holdings, preserving saved preferences
  useEffect(() => {
    if (editing) return;
    const saved = loadTargets();
    const savedMap = new Map(saved.map((t) => [t.symbol, t.targetPercent]));
    const equalPct = holdings.length > 0 ? (100 / holdings.length).toFixed(1) : "0";
    setTargets(
      holdings.map((h) => ({
        symbol: h.symbol,
        pct: savedMap.has(h.symbol) ? String(savedMap.get(h.symbol)!) : equalPct,
      })),
    );
  }, [holdings, editing]);

  // Convert targets state to TargetAllocation[]
  const targetAllocations = useMemo(() => {
    return targets
      .filter((t) => t.pct !== "" && !isNaN(Number(t.pct)))
      .map((t) => ({ symbol: t.symbol, targetPercent: Number(t.pct) }));
  }, [targets]);

  const totalPct = useMemo(() => {
    return targets.reduce((sum, t) => sum + (Number(t.pct) || 0), 0);
  }, [targets]);

  const recommendations = useMemo(
    () => computeRebalancing(holdings, prices, targetAllocations, totalPortfolioValue),
    [holdings, prices, targetAllocations, totalPortfolioValue],
  );

  const needsRebalancing = recommendations.some(
    (r) => r.recommendedAction !== "HOLD",
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Target Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) return null;

  const handleEditToggle = () => {
    if (editing) {
      // Saving: validate total = 100
      if (Math.abs(totalPct - 100) > 0.5) {
        setTotalError(true);
        return;
      }
      setTotalError(false);
      saveTargets(targetAllocations);
    }
    setEditing(!editing);
  };

  const handleReset = () => {
    const equalPct = holdings.length > 0 ? (100 / holdings.length).toFixed(1) : "0";
    setTargets(holdings.map((h) => ({ symbol: h.symbol, pct: equalPct })));
    setTotalError(false);
  };

  const updateTarget = (symbol: string, value: string) => {
    setTargets((prev) =>
      prev.map((t) => (t.symbol === symbol ? { ...t, pct: value } : t)),
    );
    setTotalError(false);
  };

  // Merge recommendations into a lookup for easy access
  const recMap = useMemo(
    () => new Map(recommendations.map((r) => [r.symbol, r])),
    [recommendations],
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Target Allocation
          </CardTitle>
          {needsRebalancing && editing && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">
              Needs rebalance
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reset to equal weight">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleEditToggle}>
            {editing ? (
              <>Save Targets</>
            ) : (
              <><Pencil className="h-3.5 w-3.5" /> Set Targets</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalError && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600">
              Target percentages must sum to 100% (currently {totalPct.toFixed(1)}%)
            </p>
          </div>
        )}

        <div className="divide-y">
          {/* Header row */}
          <div className="flex items-center gap-2 pb-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            <div className="flex-1">Symbol</div>
            <div className="w-16 text-right">Current</div>
            <div className="w-16 text-right">Target</div>
            <div className="w-16 text-right">Deviation</div>
          </div>

          {holdings.map((h) => {
            const rec = recMap.get(h.symbol);
            const currentPct =
              totalPortfolioValue > 0
                ? (((prices.get(h.symbol)?.price ?? h.averagePrice) * h.totalQuantity) /
                    totalPortfolioValue) *
                  100
                : 0;
            const target = targets.find((t) => t.symbol === h.symbol);
            const targetVal = target ? Number(target.pct) : 0;
            const deviation = currentPct - targetVal;
            const absDev = Math.abs(deviation);

            return (
              <div
                key={h.symbol}
                className={`flex items-center gap-2 py-2.5 first:pt-0 last:pb-0 ${
                  editing ? "hover:bg-accent/30 -mx-2 px-2 rounded-sm transition-colors" : ""
                }`}
              >
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-medium text-sm">{h.symbol}</span>
                  {rec && rec.recommendedAction !== "HOLD" && !editing && (
                    rec.recommendedAction === "BUY" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    )
                  )}
                </div>
                <div className="w-16 text-right text-sm tabular-nums">
                  {currentPct.toFixed(1)}%
                </div>
                <div className="w-16 text-right">
                  {editing ? (
                    <Input
                      value={target?.pct ?? ""}
                      onChange={(e) => updateTarget(h.symbol, e.target.value)}
                      className="h-7 w-16 text-xs text-right tabular-nums"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                  ) : (
                    <span className="text-sm tabular-nums">
                      {targetVal > 0 ? `${targetVal.toFixed(1)}%` : "—"}
                    </span>
                  )}
                </div>
                <div className="w-16 text-right">
                  {targetVal > 0 && !editing ? (
                    <span
                      className={`text-sm tabular-nums font-medium ${
                        absDev <= 1
                          ? "text-foreground"
                          : deviation > 0
                            ? "text-red-500"
                            : "text-green-500"
                      }`}
                    >
                      {deviation > 0 ? "+" : ""}
                      {deviation.toFixed(1)}%
                    </span>                    ) : editing ? (
                    <span className="text-xs text-muted-foreground" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rebalancing Recommendations */}
        {needsRebalancing && !editing && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Rebalancing Suggestions
            </h4>
            <div className="space-y-1.5">
              {recommendations
                .filter((r) => r.recommendedAction !== "HOLD")
                .map((r) => (
                  <div
                    key={r.symbol}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {r.recommendedAction === "BUY" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                      <span>
                        <span className="font-medium">{r.symbol}</span>
                        {" is "}
                        <span className={r.deviation > 0 ? "text-red-500" : "text-green-500"}>
                          {r.deviation > 0 ? "overweight" : "underweight"}
                        </span>
                        {" by "}
                        <span className="font-medium">{Math.abs(r.deviation).toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="text-right">
                      {r.recommendedAction === "BUY" ? (
                        <span className="text-green-500 font-medium">
                          Buy ~{r.sharesToTrade} shares ({formatCompactCurrency(r.recommendedAmount)})
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">
                          Sell ~{r.sharesToTrade} shares ({formatCompactCurrency(r.recommendedAmount)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Summary: totals match */}
        {!editing && targetAllocations.length > 0 && !needsRebalancing && (
          <div className="mt-3 pt-2 border-t">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Minus className="h-3 w-3 text-green-500" />
              All holdings within target range
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
