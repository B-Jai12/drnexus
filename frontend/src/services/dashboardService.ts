import { apiGet } from "@/src/services/api";

export interface DashboardOverviewResponse {
  summary: {
    health_score: number;
    total_debit: number;
    total_credit: number;
    net_savings: number;
    transaction_count: number;
  };
  categories: Record<string, number>;
  transactions: Array<{
    id: number | string;
    date: string;
    merchant: string;
    description: string;
    category: string;
    confidence: number;
    type: string;
    amount: number;
    month: string;
    is_anomaly: boolean;
    anomaly_severity: string;
    z_score: number;
    is_recurring: boolean;
  }>;
  category_breakdown: Array<{ category: string; amount: number; percentage: number }>;
  monthly_overview: Array<{ month: string; income: number; expenses: number }>;
  forecast?: {
    predicted_expense: number;
    predicted_income: number;
    predicted_savings: number;
    confidence: string;
    trend: string;
    r2_score: number;
  };
  anomalies?: Array<{ merchant: string; amount: number; date: string; severity: string; z_score: number }>;
  recurring_merchants?: string[];
  ml_info?: Record<string, string>;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOverviewResponse(raw: any): DashboardOverviewResponse {
  const summaryRaw = raw?.summary || {};
  const forecastRaw = raw?.forecast || {};

  const transactions = Array.isArray(raw?.transactions)
    ? raw.transactions.map((txn: any) => ({
        id: txn?.id ?? "",
        date: String(txn?.date ?? ""),
        merchant: String(txn?.merchant ?? ""),
        description: String(txn?.description ?? ""),
        category: String(txn?.category ?? "Other"),
        confidence: toNumber(txn?.confidence, 0),
        type: String(txn?.type ?? "").toUpperCase(),
        amount: toNumber(txn?.amount, 0),
        month: String(txn?.month ?? ""),
        is_anomaly: Boolean(txn?.is_anomaly ?? txn?.isAnomaly),
        anomaly_severity: String(txn?.anomaly_severity ?? txn?.anomalySeverity ?? "normal"),
        z_score: toNumber(txn?.z_score ?? txn?.zScore, 0),
        is_recurring: Boolean(txn?.is_recurring ?? txn?.isRecurring),
      }))
    : [];

  const categories = raw?.categories && typeof raw.categories === "object" ? raw.categories : {};
  const category_breakdown = Array.isArray(raw?.category_breakdown ?? raw?.categoryBreakdown)
    ? (raw.category_breakdown ?? raw.categoryBreakdown).map((c: any) => ({
        category: String(c?.category ?? "Other"),
        amount: toNumber(c?.amount, 0),
        percentage: toNumber(c?.percentage, 0),
      }))
    : [];

  const monthly_overview = Array.isArray(raw?.monthly_overview ?? raw?.monthlyOverview)
    ? (raw.monthly_overview ?? raw.monthlyOverview).map((m: any) => ({
        month: String(m?.month ?? ""),
        income: toNumber(m?.income, 0),
        expenses: toNumber(m?.expenses, 0),
      }))
    : [];

  const anomalies = Array.isArray(raw?.anomalies)
    ? raw.anomalies.map((a: any) => ({
        merchant: String(a?.merchant ?? ""),
        amount: toNumber(a?.amount, 0),
        date: String(a?.date ?? ""),
        severity: String(a?.severity ?? "medium"),
        z_score: toNumber(a?.z_score ?? a?.zScore, 0),
      }))
    : [];

  const recurring_merchants = Array.isArray(raw?.recurring_merchants ?? raw?.recurringMerchants)
    ? (raw.recurring_merchants ?? raw.recurringMerchants).map((m: any) => String(m))
    : [];

  return {
    summary: {
      health_score: toNumber(summaryRaw?.health_score ?? summaryRaw?.healthScore, 0),
      total_debit: toNumber(summaryRaw?.total_debit ?? summaryRaw?.totalDebit, 0),
      total_credit: toNumber(summaryRaw?.total_credit ?? summaryRaw?.totalCredit, 0),
      net_savings: toNumber(summaryRaw?.net_savings ?? summaryRaw?.netSavings, 0),
      transaction_count: toNumber(summaryRaw?.transaction_count ?? summaryRaw?.transactionCount, 0),
    },
    categories,
    transactions,
    category_breakdown,
    monthly_overview,
    forecast: raw?.forecast
      ? {
          predicted_expense: toNumber(forecastRaw?.predicted_expense ?? forecastRaw?.predictedExpense, 0),
          predicted_income: toNumber(forecastRaw?.predicted_income ?? forecastRaw?.predictedIncome, 0),
          predicted_savings: toNumber(forecastRaw?.predicted_savings ?? forecastRaw?.predictedSavings, 0),
          confidence: String(forecastRaw?.confidence ?? "medium"),
          trend: String(forecastRaw?.trend ?? "stable"),
          r2_score: toNumber(forecastRaw?.r2_score ?? forecastRaw?.r2Score, 0),
        }
      : undefined,
    anomalies,
    recurring_merchants,
    ml_info: raw?.ml_info ?? raw?.mlInfo ?? {},
  };
}

/**
 * Load dashboard overview.
 * Priority: localStorage (latest ML upload) → backend API (MongoDB)
 * This ensures your uploaded analysis always shows up, even without MongoDB.
 */
export async function getDashboardOverview() {
  // 1. Try localStorage first — this is where upload page saves the full ML result
  try {
    const cached = typeof window !== "undefined"
      ? localStorage.getItem("drnexus_latest_analysis")
      : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      // Make sure it has real transaction data
      if (parsed?.transactions?.length > 0 || parsed?.ml?.transactions?.length > 0) {
        const data = parsed?.ml ?? parsed;
        return normalizeOverviewResponse(data);
      }
    }
  } catch {
    // ignore localStorage errors
  }

  // 2. Fallback: backend API (reads from MongoDB)
  const raw = await apiGet<any>("/api/dashboard/overview");
  return normalizeOverviewResponse(raw);
}
