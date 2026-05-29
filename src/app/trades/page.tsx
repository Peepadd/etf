"use client";

import { useState, useMemo, useEffect } from "react";
import { Trash2, TrendingUp, TrendingDown, Minus, DollarSign, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useTrades } from "@/hooks/useTrades";
import { useStockPrices } from "@/hooks/useStockPrices";
import type { Trade, SortConfig } from "@/lib/types";
import { TradeForm } from "@/components/forms/TradeForm";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";

export default function TradesPage() {
  const { trades, loading, sortConfig, setSortConfig, refetch, deleteTrade } = useTrades();
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mktSortDir, setMktSortDir] = useState<"asc" | "desc" | null>(null);
  const pageSize = 20;

  // Get unique symbols for market price fetching
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))], [trades]);
  const { prices } = useStockPrices(symbols);

  // Compute total unrealized P&L from BUY trades
  const unrealizedPnL = useMemo(() => {
    let totalInvestment = 0;
    let totalMarketValue = 0;

    for (const trade of trades) {
      if (trade.type !== "BUY") continue;
      const sp = prices.get(trade.symbol);
      const mktPrice = sp?.price;
      if (mktPrice == null || mktPrice <= 0) continue;

      totalInvestment += trade.price * trade.quantity;
      totalMarketValue += mktPrice * trade.quantity;
    }

    const pnl = totalMarketValue - totalInvestment;
    const pnlPercent = totalInvestment > 0 ? (pnl / totalInvestment) * 100 : 0;

    return {
      pnl,
      pnlPercent,
      totalInvestment,
      totalMarketValue,
      hasData: totalInvestment > 0,
    };
  }, [trades, prices]);

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (filterSymbol && !trade.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) {
        return false;
      }
      if (filterType !== "ALL" && trade.type !== filterType) {
        return false;
      }
      return true;
    });
  }, [trades, filterSymbol, filterType]);

  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSymbol, filterType]);

  // Sort trades for Mkt column (% change)
  const sortedPaginatedTrades = useMemo(() => {
    if (!mktSortDir) return paginatedTrades;

    return [...paginatedTrades].sort((a, b) => {
      const spA = prices.get(a.symbol);
      const spB = prices.get(b.symbol);
      const mktA = spA?.price ?? 0;
      const mktB = spB?.price ?? 0;

      // Trades without valid market prices go to the end
      if (mktA <= 0 && mktB <= 0) return 0;
      if (mktA <= 0) return 1;
      if (mktB <= 0) return -1;

      const diffA = a.type === "BUY" ? mktA - a.price : a.price - mktA;
      const diffB = b.type === "BUY" ? mktB - b.price : b.price - mktB;
      const pctA = a.price > 0 ? (diffA / a.price) * 100 : 0;
      const pctB = b.price > 0 ? (diffB / b.price) * 100 : 0;
      return mktSortDir === "asc" ? pctA - pctB : pctB - pctA;
    });
  }, [paginatedTrades, prices, mktSortDir]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTrade(deleteTarget.id);
      toast.success("Trade deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Failed to delete trade");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Trade>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (t) => formatDate(t.date),
    },
    {
      key: "symbol",
      label: "Symbol",
      sortable: true,
      render: (t) => (
        <span className="font-medium">{t.symbol}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (t) => (
        <Badge variant={t.type === "BUY" ? "default" : "destructive"}>
          {t.type}
        </Badge>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (t) => formatNumber(t.quantity),
      className: "text-right",
    },
    {
      key: "price",
      label: "Buy Price",
      sortable: true,
      render: (t) => formatCurrency(t.price),
      className: "text-right",
    },
    {
      key: "mkt_price",
      label: "Mkt",
      sortable: true,
      render: (t) => {
        const sp = prices.get(t.symbol);
        const mktPrice = sp?.price;
        if (mktPrice == null || mktPrice <= 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const diff = t.type === "BUY" ? mktPrice - t.price : t.price - mktPrice;
        const isProfit = diff > 0;
        const isLoss = diff < 0;
        const diffPct = t.price > 0 ? (diff / t.price) * 100 : 0;
        const totalPnL = diff * t.quantity;
        const colorClass = isProfit ? "text-green-500" : isLoss ? "text-red-500" : "text-foreground";
        const Icon = isProfit ? TrendingUp : isLoss ? TrendingDown : Minus;
        const pnlPrefix = totalPnL >= 0 ? "+" : "";
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs font-medium tabular-nums">{formatCurrency(mktPrice)}</span>
            <span className={`flex items-center gap-1 text-[11px] ${colorClass}`}>
              <Icon className="h-3 w-3" />
              <span className="font-semibold">{pnlPrefix}{formatCurrency(totalPnL)}</span>
              <span className="opacity-70">({pnlPrefix}{diffPct.toFixed(1)}%)</span>
            </span>
          </div>
        );
      },
      className: "text-right",
    },
    {
      key: "total_value",
      label: "Total",
      sortable: true,
      render: (t) => formatCurrency(t.total_value),
      className: "text-right font-medium",
    },
    {
      key: "broker_fee",
      label: "Fee",
      sortable: true,
      render: (t) => formatCurrency(t.broker_fee),
      className: "text-right",
    },
    {
      key: "notes",
      label: "Notes",
      render: (t) => (
        <span className="max-w-[200px] truncate text-muted-foreground">
          {t.notes || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (t) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setDeleteTarget(t);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </div>
      ),
      className: "w-[60px]",
    },
  ];

  const handleSort = (key: string) => {
    if (key === "mkt_price") {
      // Toggle Mkt sort: none → desc → asc → none
      const newDir = mktSortDir === null ? "desc" : mktSortDir === "desc" ? "asc" : null;
      setMktSortDir(newDir);
    } else {
      // Reset Mkt sort and use server-side sort
      setMktSortDir(null);
      const direction =
        sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
      setSortConfig({ key, direction } as SortConfig);
    }
  };

  // Active sort key/direction for the DataTable
  const activeSortKey = mktSortDir ? "mkt_price" : sortConfig.key;
  const activeSortDir = mktSortDir || sortConfig.direction;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">Record and manage your trades.</p>
        </div>
        <TradeForm onSuccess={refetch} />
      </div>

      {/* Unrealized P&L Summary */}
      {unrealizedPnL.hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            title="Unrealized P&L"
            value={`${unrealizedPnL.pnl >= 0 ? "+" : ""}${formatCurrency(unrealizedPnL.pnl)}`}
            description={`${unrealizedPnL.pnlPercent >= 0 ? "+" : ""}${unrealizedPnL.pnlPercent.toFixed(2)}%`}
            icon={unrealizedPnL.pnl >= 0 ? TrendingUp : TrendingDown}
            valueClassName={unrealizedPnL.pnl >= 0 ? "text-green-500" : "text-red-500"}
          />
          <KpiCard
            title="Cost Basis"
            value={formatCurrency(unrealizedPnL.totalInvestment)}
            icon={DollarSign}
          />
          <KpiCard
            title="Market Value"
            value={formatCurrency(unrealizedPnL.totalMarketValue)}
            icon={Wallet}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-48">
          <Input
            placeholder="Filter by symbol..."
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="h-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="BUY">BUY</SelectItem>
            <SelectItem value="SELL">SELL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={sortedPaginatedTrades}
        loading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalCount={filteredTrades.length}
        sortKey={activeSortKey}
        sortDirection={activeSortDir}
        onSort={handleSort}
        emptyMessage="No trades recorded yet."
        emptyAction={<TradeForm onSuccess={refetch} />}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Trade</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trade? This action cannot be undone.
              {deleteTarget && (
                <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                  <p>{deleteTarget.symbol} — {deleteTarget.type}</p>
                  <p>
                    {formatDate(deleteTarget.date)} · {formatNumber(deleteTarget.quantity)} shares @ {formatCurrency(deleteTarget.price)}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
