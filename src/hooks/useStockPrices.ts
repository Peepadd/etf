"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockPrice } from "@/lib/types";

interface UseStockPricesReturn {
  prices: Map<string, StockPrice>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useStockPrices(symbols: string[]): UseStockPricesReturn {
  const [prices, setPrices] = useState<Map<string, StockPrice>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) {
      if (mountedRef.current) setPrices(new Map());
      return;
    }

    try {
      if (mountedRef.current) setLoading(true);
      const res = await fetch(`/api/stock?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        throw new Error("Failed to fetch stock prices");
      }
      const json = await res.json();
      const data = json.data as StockPrice[];

      if (!mountedRef.current) return;

      const map = new Map<string, StockPrice>();
      for (const item of data) {
        map.set(item.symbol, item);
      }
      setPrices(map);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch prices");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPrices();

    // Refresh prices every 60 seconds
    intervalRef.current = setInterval(fetchPrices, 60000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrices]);

  return { prices, loading, error, lastUpdated };
}
