export interface Trade {
  id: string;
  user_id: string;
  date: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total_value: number;
  broker_fee: number;
  notes: string | null;
  created_at: string;
}

export interface Dividend {
  id: string;
  user_id: string;
  date: string;
  symbol: string;
  amount: number;
  tax_withheld: number;
  notes: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number | null;
  reason: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  created_at: string;
}

export interface PortfolioHolding {
  symbol: string;
  totalQuantity: number;
  totalValue: number;
  averagePrice: number;
}

export interface DashboardMetrics {
  totalPortfolioValue: number;
  totalRealizedPL: number;
  totalDividends: number;
  numberOfHoldings: number;
}

export interface PortfolioEntry {
  symbol: string;
  value: number;
  percentage: number;
}

export interface DailyPortfolioValue {
  date: string;
  value: number;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface StockPrice {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
}
