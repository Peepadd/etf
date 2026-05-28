"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockHistory, HistoryPoint, TimeRange } from "@/lib/types";

interface UseStockHistoryReturn {
  history: HistoryPoint[];
  meta: StockHistory["meta"] | null;
  loading: boolean;
  error: string | null;
  range: TimeRange;
  setRange: (range: TimeRange) => void;
  refresh: () => void;
}

export function useStockHistory(symbol: string): UseStockHistoryReturn {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [meta, setMeta] = useState<StockHistory["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("1mo");
  const mountedRef = useRef(true);

  const fetchHistory = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to fetch stock history");
      }
      const json = (await res.json()) as StockHistory;
      if (!mountedRef.current) return;
      setHistory(json.data);
      setMeta(json.meta);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch history");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    mountedRef.current = true;
    fetchHistory();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchHistory]);

  return { history, meta, loading, error, range, setRange, refresh: fetchHistory };
}
