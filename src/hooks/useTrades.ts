"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Trade, SortConfig } from "@/lib/types";

interface UseTradesReturn {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  refetch: () => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  getTrade: (id: string) => Trade | undefined;
}

export function useTrades(): UseTradesReturn {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });

  // Create client lazily so it only runs on the client (not during SSR prerender)
  const [supabase] = useState(() => createClient());

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("trades")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      // Apply sorting
      const { key, direction } = sortConfig;
      const allowedKeys = ["date", "symbol", "type", "quantity", "price", "total_value", "broker_fee", "created_at"];
      if (allowedKeys.includes(key)) {
        query = query.order(key, { ascending: direction === "asc" });
      } else {
        query = query.order("date", { ascending: false });
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setTrades(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  }, [sortConfig, supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteTrade = async (id: string) => {
    const { error: deleteError } = await supabase.from("trades").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setTrades((prev) => prev.filter((t) => t.id !== id));
    setTotalCount((prev) => prev - 1);
  };

  const getTrade = (id: string) => trades.find((t) => t.id === id);

  return {
    trades,
    loading,
    error,
    totalCount,
    sortConfig,
    setSortConfig,
    refetch,
    deleteTrade,
    getTrade,
  };
}
