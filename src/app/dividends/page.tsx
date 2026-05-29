"use client";

import { useState, useMemo, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDividends } from "@/hooks/useDividends";
import type { Dividend, SortConfig } from "@/lib/types";
import { DividendForm } from "@/components/forms/DividendForm";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DividendsPage() {
  const {
    dividends,
    loading,
    totalGross,
    totalTax,
    totalNet,
    sortConfig,
    setSortConfig,
    refetch,
    deleteDividend,
  } = useDividends();

  const [filterSymbol, setFilterSymbol] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Dividend | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 20;

  const filteredDividends = useMemo(() => {
    return dividends.filter((d) => {
      if (filterSymbol && !d.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [dividends, filterSymbol]);

  const paginatedDividends = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDividends.slice(start, start + pageSize);
  }, [filteredDividends, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSymbol]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDividend(deleteTarget.id);
      toast.success("Dividend deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toast.error("Failed to delete dividend");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Dividend>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (d) => formatDate(d.date),
    },
    {
      key: "symbol",
      label: "Symbol",
      sortable: true,
      render: (d) => <span className="font-medium">{d.symbol}</span>,
    },
    {
      key: "amount",
      label: "Gross Amount",
      sortable: true,
      render: (d) => (
        <span className="text-green-500">{formatCurrency(d.amount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "tax_withheld",
      label: "Tax Withheld",
      sortable: true,
      render: (d) => (
        <span className="text-red-500">{formatCurrency(d.tax_withheld)}</span>
      ),
      className: "text-right",
    },
    {
      key: "net",
      label: "Net Amount",
      render: (d) => (
        <span className="font-medium">{formatCurrency(Number(d.amount) - Number(d.tax_withheld))}</span>
      ),
      className: "text-right",
    },
    {
      key: "notes",
      label: "Notes",
      render: (d) => (
        <span className="max-w-[200px] truncate text-muted-foreground">
          {d.notes || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (d) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setDeleteTarget(d);
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
          <h1 className="text-2xl font-bold tracking-tight">Dividends</h1>
          <p className="text-sm text-muted-foreground">Track dividend income.</p>
        </div>
        <DividendForm onSuccess={refetch} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <p className="mt-1 text-lg font-bold text-green-500">{formatCurrency(totalGross)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <p className="mt-1 text-lg font-bold text-red-500">{formatCurrency(totalTax)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <p className="mt-1 text-lg font-bold text-green-500">{formatCurrency(totalNet)}</p>
            )}
          </CardContent>
        </Card>
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
      </div>

      <DataTable
        columns={columns}
        data={paginatedDividends}
        loading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalCount={filteredDividends.length}
        sortKey={sortConfig.key}
        sortDirection={sortConfig.direction}
        onSort={handleSort}
        emptyMessage="No dividends recorded yet."
        emptyAction={<DividendForm onSuccess={refetch} />}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dividend</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this dividend record? This action cannot be undone.
              {deleteTarget && (
                <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                  <p>{deleteTarget.symbol}</p>
                  <p>
                    {formatDate(deleteTarget.date)} · {formatCurrency(deleteTarget.amount)}
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
