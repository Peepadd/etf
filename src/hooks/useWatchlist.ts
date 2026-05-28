"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { WatchlistItem } from "@/lib/types";

interface UseWatchlistReturn {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export function useWatchlist(): UseWatchlistReturn {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error: fetchError } = await supabase
        .from("watchlists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch watchlist");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteItem = async (id: string) => {
    const { error: deleteError } = await supabase.from("watchlists").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return {
    items,
    loading,
    error,
    refetch,
    deleteItem,
  };
}
