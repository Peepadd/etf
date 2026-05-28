import { NextRequest, NextResponse } from "next/server";

interface QuoteResult {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");

  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing 'symbols' query parameter" }, { status: 400 });
  }

  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  try {
    const results: QuoteResult[] = [];

    // Fetch each symbol with a stagger delay to avoid Yahoo Finance rate limiting
    const fetches = symbols.map(async (symbol, index) => {
      // Stagger requests by 200ms per symbol to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, index * 200));

      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          return null;
        }

        const data = await res.json();
        const result = data?.chart?.result?.[0];

        if (!result?.meta || result.meta.regularMarketPrice == null) {
          return null;
        }

        const price = result.meta.regularMarketPrice;
        const previousClose = result.meta.chartPreviousClose;
        const change = previousClose != null ? price - previousClose : null;
        const changePercent =
          change != null && previousClose != null && previousClose !== 0
            ? (change / previousClose) * 100
            : null;

        return {
          symbol,
          price,
          change,
          changePercent,
          currency: result.meta.currency ?? "USD",
        } as QuoteResult;
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(fetches);
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value);
      }
    }

    // For symbols that failed, add a placeholder with null values
    const foundSymbols = new Set(results.map((r) => r.symbol));
    for (const sym of symbols) {
      if (!foundSymbols.has(sym)) {
        results.push({
          symbol: sym,
          price: null,
          change: null,
          changePercent: null,
          currency: "USD",
        });
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Stock API error:", error);
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
