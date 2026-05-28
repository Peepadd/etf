import { NextRequest, NextResponse } from "next/server";

interface HistoryPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

interface HistoryResponse {
  symbol: string;
  data: HistoryPoint[];
  meta: {
    currency: string;
    longName: string | null;
    regularMarketPrice: number | null;
    regularMarketOpen: number | null;
    previousClose: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    regularMarketDayHigh: number | null;
    regularMarketDayLow: number | null;
    regularMarketVolume: number | null;
  };
}

const RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "5d": { range: "5d", interval: "5m" },
  "1mo": { range: "1mo", interval: "1d" },
  "3mo": { range: "3mo", interval: "1d" },
  "6mo": { range: "6mo", interval: "1wk" },
  "1y": { range: "1y", interval: "1wk" },
  "5y": { range: "5y", interval: "1mo" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const rangeParam = searchParams.get("range") ?? "1mo";

  if (!symbol) {
    return NextResponse.json({ error: "Missing 'symbol' query parameter" }, { status: 400 });
  }

  const rangeConfig = RANGE_MAP[rangeParam] ?? RANGE_MAP["1mo"];

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${rangeConfig.interval}&range=${rangeConfig.range}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch historical data" }, { status: 502 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }

    const meta = result.meta;
    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = quote.open ?? [];
    const highs: (number | null)[] = quote.high ?? [];
    const lows: (number | null)[] = quote.low ?? [];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    const data: HistoryPoint[] = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      open: opens[i] ?? null,
      high: highs[i] ?? null,
      low: lows[i] ?? null,
      close: closes[i] ?? null,
      volume: volumes[i] ?? null,
    }));

    const response: HistoryResponse = {
      symbol,
      data,
      meta: {
        currency: meta.currency ?? "USD",
        longName: meta.longName ?? null,
        regularMarketPrice: meta.regularMarketPrice ?? null,
        regularMarketOpen: meta.regularMarketOpen ?? null,
        previousClose: meta.chartPreviousClose ?? null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
        regularMarketDayLow: meta.regularMarketDayLow ?? null,
        regularMarketVolume: meta.regularMarketVolume ?? null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Stock history API error:", error);
    return NextResponse.json({ error: "Failed to fetch stock history" }, { status: 500 });
  }
}
