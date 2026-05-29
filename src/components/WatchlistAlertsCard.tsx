"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Bell, BellOff, Star, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import type { WatchlistItem, StockPrice } from "@/lib/types";

interface WatchlistAlertsCardProps {
  items: WatchlistItem[];
  prices: Map<string, StockPrice>;
  pricesLoading: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "HIGH":
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">HIGH</Badge>;
    case "MEDIUM":
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">MEDIUM</Badge>;
    case "LOW":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">LOW</Badge>;
    default:
      return null;
  }
}

export function WatchlistAlertsCard({
  items,
  prices,
  pricesLoading,
  loading,
  onRefresh,
}: WatchlistAlertsCardProps) {
  // Compute triggered alerts: items where current price <= target_price (for BUY-targets)
  const triggeredAlerts = useMemo(() => {
    return items.filter((item) => {
      if (!item.target_price) return false;
      const price = prices.get(item.symbol)?.price;
      return price != null && price > 0 && price <= item.target_price;
    });
  }, [items, prices]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Watchlist Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) return null;

  // Separate watchlist items: triggered first, then by priority
  const triggeredSymbols = new Set(triggeredAlerts.map((a) => a.id));
  const sortedItems = [...items].sort((a, b) => {
    // Triggered items first
    const aTriggered = triggeredSymbols.has(a.id) ? 0 : 1;
    const bTriggered = triggeredSymbols.has(b.id) ? 0 : 1;
    if (aTriggered !== bTriggered) return aTriggered - bTriggered;
    // Then by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Star className="h-4 w-4" />
            Watchlist
          </CardTitle>
          {triggeredAlerts.length > 0 && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-[10px] px-1.5 py-0 h-5">
              {triggeredAlerts.length} alert{triggeredAlerts.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRefresh}>
              Refresh
            </Button>
          )}
          <Link href="/watchlist">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Manage
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {sortedItems.map((item) => {
            const stockPrice = prices.get(item.symbol);
            const currentPrice = stockPrice?.price ?? null;
            const isUp = stockPrice?.change != null && stockPrice.change > 0;
            const isDown = stockPrice?.change != null && stockPrice.change < 0;
            const isTriggered = item.target_price != null && currentPrice != null && currentPrice > 0 && currentPrice <= item.target_price;

            return (
              <Link
                href={`/stock/${item.symbol}`}
                key={item.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 group hover:bg-accent/30 -mx-2 px-2 rounded-sm transition-colors"
              >
                {/* Triggered indicator */}
                <div className="shrink-0 w-6 flex justify-center">
                  {isTriggered ? (
                    <Bell className="h-4 w-4 text-green-500" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>

                {/* Symbol + Priority */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.symbol}</span>
                    {getPriorityBadge(item.priority)}
                    {isTriggered && (
                      <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px] px-1.5 py-0 h-5">
                        Target Hit
                      </Badge>
                    )}
                  </div>
                  {item.reason && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.reason}</p>
                  )}
                </div>

                {/* Price info */}
                <div className="text-right shrink-0">
                  {currentPrice != null && currentPrice > 0 ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-sm font-bold tabular-nums">
                          {formatCurrency(currentPrice)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        {stockPrice?.change != null && (
                          <span className={cn(
                            "text-xs tabular-nums",
                            isUp ? "text-green-500" : isDown ? "text-red-500" : "text-muted-foreground"
                          )}>
                            {stockPrice.change >= 0 ? "+" : ""}{stockPrice.change.toFixed(2)}
                          </span>
                        )}
                        {item.target_price && (
                          <span className="text-[10px] text-muted-foreground">
                            / Target {formatCurrency(item.target_price)}
                          </span>
                        )}
                      </div>
                    </>
                  ) : pricesLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty state within card */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Star className="h-6 w-6 text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">No stocks in watchlist</p>
            <Link href="/watchlist">
              <Button variant="outline" size="sm" className="mt-2">
                Add Stocks
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
