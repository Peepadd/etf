import { NextRequest, NextResponse } from "next/server";

interface FundamentalsResult {
  symbol: string;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  sector: string | null;
  industry: string | null;
  dividendYield: number | null;
  longName: string | null;
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
    const results: FundamentalsResult[] = [];

    const fetches = symbols.map(async (symbol, index) => {
      // Stagger requests by 300ms per symbol to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, index * 300));

      try {
        const modules = "price,summaryDetail,assetProfile";
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return null;

        const data = await res.json();
        const result = data?.quoteSummary?.result?.[0];
        if (!result) return null;

        const price = result.price;
        const summaryDetail = result.summaryDetail;
        const assetProfile = result.assetProfile;

        const marketCapRaw = price?.marketCap?.raw;
        const trailingPERaw = summaryDetail?.trailingPE?.raw;
        const forwardPERaw = summaryDetail?.forwardPE?.raw;
        const dividendYieldRaw = summaryDetail?.dividendYield?.raw;
        const sector = assetProfile?.sector ?? null;
        const industry = assetProfile?.industry ?? null;
        const longName = price?.longName ?? price?.shortName ?? null;

        return {
          symbol,
          marketCap: marketCapRaw ?? null,
          trailingPE: trailingPERaw ?? null,
          forwardPE: forwardPERaw ?? null,
          sector,
          industry,
          dividendYield: dividendYieldRaw ?? null,
          longName,
        } as FundamentalsResult;
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

    // Add placeholders for failed symbols
    const foundSymbols = new Set(results.map((r) => r.symbol));
    for (const sym of symbols) {
      if (!foundSymbols.has(sym)) {
        results.push({
          symbol: sym,
          marketCap: null,
          trailingPE: null,
          forwardPE: null,
          sector: null,
          industry: null,
          dividendYield: null,
          longName: null,
        });
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Stock fundamentals API error:", error);
    return NextResponse.json({ error: "Failed to fetch stock fundamentals" }, { status: 500 });
  }
}
