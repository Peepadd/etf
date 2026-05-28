"use client";

import { useState, useMemo } from "react";
import { Trash2, Star, Target } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistItem } from "@/lib/types";
import { WatchlistForm } from "@/components/forms/WatchlistForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function getPriorityVariant(priority: string) {
  switch (priority) {
    case "HIGH":
      return "high" as const;
    case "MEDIUM":
      return "medium" as const;
    case "LOW":
      return "low" as const;
    default:
      return "outline" as const;
  }
}

export default function WatchlistPage() {
  const { items, loading, refetch, deleteItem } = useWatchlist();
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WatchlistItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredItems = useMemo(() => {
    if (priorityFilter === "ALL") return items;
    return items.filter((item) => item.priority === priorityFilter);
  }, [items, priorityFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteItem(deleteTarget.id);
      toast.success("Removed from watchlist");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Failed to remove from watchlist");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-sm text-muted-foreground">Stocks you are watching.</p>
        </div>
        <WatchlistForm onSuccess={refetch} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="HIGH">HIGH</SelectItem>
            <SelectItem value="MEDIUM">MEDIUM</SelectItem>
            <SelectItem value="LOW">LOW</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border py-12 text-center">
          <Star className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "No stocks in your watchlist yet." : "No stocks match this filter."}
          </p>
          <div className="mt-4">
            <WatchlistForm onSuccess={refetch} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">{item.symbol}</CardTitle>
                    <Badge variant={getPriorityVariant(item.priority)} className="mt-1">
                      {item.priority}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setDeleteTarget(item);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {item.target_price && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-3.5 w-3.5" />
                    <span>Target: <span className="text-foreground font-medium">{formatCurrency(item.target_price)}</span></span>
                  </div>
                )}
                {item.reason && (
                  <p className="text-muted-foreground line-clamp-2">{item.reason}</p>
                )}                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <span>Added {formatDate(item.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Watchlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteTarget?.symbol} from your watchlist?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
