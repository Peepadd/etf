"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockFundamentals } from "@/lib/types";

interface UseStockFundamentalsReturn {
  fundamentals: Map<string, StockFundamentals>;
  loading: boolean;
  error: string | null;
}

export function useStockFundamentals(symbols: string[]): UseStockFundamentalsReturn {
  const [fundamentals, setFundamentals] = useState<Map<string, StockFundamentals>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchFundamentals = useCallback(async () => {
    if (symbols.length === 0) {
      if (mountedRef.current) setFundamentals(new Map());
      return;
    }

    try {
      if (mountedRef.current) setLoading(true);
      const res = await fetch(`/api/stock/fundamentals?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        throw new Error("Failed to fetch stock fundamentals");
      }
      const json = await res.json();
      const data = json.data as StockFundamentals[];

      if (!mountedRef.current) return;

      const map = new Map<string, StockFundamentals>();
      for (const item of data) {
        map.set(item.symbol, item);
      }
      setFundamentals(map);
      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch fundamentals");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    mountedRef.current = true;
    fetchFundamentals();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchFundamentals]);

  return { fundamentals, loading, error };
}
