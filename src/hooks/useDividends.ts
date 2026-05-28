"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Dividend, SortConfig } from "@/lib/types";

interface UseDividendsReturn {
  dividends: Dividend[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  refetch: () => Promise<void>;
  deleteDividend: (id: string) => Promise<void>;
}

export function useDividends(): UseDividendsReturn {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });

  const supabase = createClient();

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("dividends")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      const { key, direction } = sortConfig;
      const allowedKeys = ["date", "symbol", "amount", "tax_withheld", "created_at"];
      if (allowedKeys.includes(key)) {
        query = query.order(key, { ascending: direction === "asc" });
      } else {
        query = query.order("date", { ascending: false });
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const dividendsData = data || [];
      setDividends(dividendsData);
      setTotalCount(count || 0);

      // Calculate totals
      let gross = 0;
      let tax = 0;
      for (const div of dividendsData) {
        gross += Number(div.amount);
        tax += Number(div.tax_withheld);
      }
      setTotalGross(gross);
      setTotalTax(tax);
      setTotalNet(gross - tax);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dividends");
    } finally {
      setLoading(false);
    }
  }, [sortConfig, supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const deleteDividend = async (id: string) => {
    const { error: deleteError } = await supabase.from("dividends").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setDividends((prev) => prev.filter((d) => d.id !== id));
    setTotalCount((prev) => prev - 1);
  };

  return {
    dividends,
    loading,
    error,
    totalCount,
    totalGross,
    totalTax,
    totalNet,
    sortConfig,
    setSortConfig,
    refetch,
    deleteDividend,
  };
}
