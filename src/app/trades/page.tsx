"use client";

import { useState, useMemo, useEffect } from "react";
import { Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useTrades } from "@/hooks/useTrades";
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

export default function TradesPage() {
  const { trades, loading, sortConfig, setSortConfig, refetch, deleteTrade } = useTrades();
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 20;

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
      label: "Price",
      sortable: true,
      render: (t) => formatCurrency(t.price),
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
      className: "text-right text-muted-foreground",
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
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction } as SortConfig);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">Record and manage your trades.</p>
        </div>
        <TradeForm onSuccess={refetch} />
      </div>

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
        data={paginatedTrades}
        loading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalCount={filteredTrades.length}
        sortKey={sortConfig.key}
        sortDirection={sortConfig.direction}
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
                  <p className="text-muted-foreground">
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
