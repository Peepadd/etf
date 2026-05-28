"use client";

import { useState, useEffect, useRef, type ForwardedRef, forwardRef } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { StockPrice } from "@/lib/types";

interface StockSymbolInputProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export const StockSymbolInput = forwardRef(function StockSymbolInput(
  {
    id = "symbol",
    placeholder = "AAPL",
    value = "",
    onChange,
    onBlur,
    error,
    disabled,
  }: StockSymbolInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [priceData, setPriceData] = useState<StockPrice | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const symbol = value.trim().toUpperCase();

  useEffect(() => {
    // Clear previous debounce and abort
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    // Reset state when symbol is empty or too short
    if (!symbol || symbol.length < 1) {
      setPriceData(null);
      setFetching(false);
      setFetchError(null);
      return;
    }

    // Wait 400ms after user stops typing before fetching
    setFetching(true);
    setFetchError(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/stock?symbols=${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        const data = json.data as StockPrice[];
        const found = data.find((s) => s.symbol === symbol);

        if (found) {
          setPriceData(found);            if (found.price == null) {
              setFetchError("No price data");
            } else {
              setFetchError(null);
            }
        } else {
          setPriceData(null);
          setFetchError("Symbol not found");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFetchError("Failed to load price");
        setPriceData(null);
      } finally {
        setFetching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [symbol]);

  const isUp = priceData?.change != null && priceData.change > 0;
  const isDown = priceData?.change != null && priceData.change < 0;
  const priceColor = isUp ? "text-green-500" : isDown ? "text-red-500" : "text-muted-foreground";
  const PriceIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={error ? "border-red-500" : ""}
        />
        {/* Price indicator — appears inside the input on the right */}
        {(fetching || priceData || fetchError) && symbol.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {fetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : fetchError ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : priceData?.price != null && priceData.price > 0 ? (
              <div className="flex items-center gap-1.5">
                <PriceIcon className={`h-3.5 w-3.5 ${priceColor}`} />
                <span className={`text-sm font-medium tabular-nums ${priceColor}`}>
                  {formatCurrency(priceData.price)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        )}
      </div>

      {/* Change indicator below the input */}
      {priceData?.price != null && priceData.price > 0 && (
        <div className={`flex items-center gap-1.5 text-xs ${priceColor} pl-1`}>
          <PriceIcon className="h-3 w-3" />
          <span>
            {priceData.change != null
              ? `${priceData.change >= 0 ? "+" : ""}${priceData.change.toFixed(2)}`
              : "—"}
          </span>
          <span>
            {priceData.changePercent != null
              ? `(${priceData.changePercent >= 0 ? "+" : ""}${priceData.changePercent.toFixed(2)}%)`
              : ""}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});
