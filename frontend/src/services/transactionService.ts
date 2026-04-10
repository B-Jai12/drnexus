import { apiGet } from "@/src/services/api";

export interface TransactionsResponse {
  data: Array<{
    id: number | string;
    date: string;
    merchant: string;
    description: string;
    category: string;
    confidence?: number;
    type: string;
    amount: number;
    is_anomaly?: boolean;
    anomaly_severity?: string;
    z_score?: number;
    is_recurring?: boolean;
  }>;
  total: number;
}

export async function getTransactions(params: {
  search?: string;
  category?: string;
  type?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  flag?: "all" | "anomaly" | "recurring";
}) {
  // 1. Try localStorage first (latest ML upload result)
  try {
    const cached = typeof window !== "undefined"
      ? localStorage.getItem("drnexus_latest_analysis")
      : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      const data = parsed?.ml ?? parsed;
      let txns: any[] = Array.isArray(data?.transactions) ? data.transactions : [];
      if (txns.length > 0) {
        // Apply filters client-side
        if (params.search) {
          const q = params.search.toLowerCase();
          txns = txns.filter(t =>
            t.merchant?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.category?.toLowerCase().includes(q)
          );
        }
        if (params.category && params.category !== "all") {
          txns = txns.filter(t => t.category === params.category);
        }
        if (params.type && params.type !== "all") {
          txns = txns.filter(t => t.type?.toUpperCase() === params.type?.toUpperCase());
        }
        if (params.flag === "anomaly") txns = txns.filter(t => t.is_anomaly);
        if (params.flag === "recurring") txns = txns.filter(t => t.is_recurring);
        if (params.sortOrder === "asc") txns = [...txns].sort((a, b) => a.amount - b.amount);
        else txns = [...txns].sort((a, b) => b.amount - a.amount);

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        const start = (page - 1) * pageSize;
        return { data: txns.slice(start, start + pageSize), total: txns.length };
      }
    }
  } catch {
    // ignore localStorage errors
  }

  // 2. Fallback: backend API (MongoDB)
  const query: Record<string, string | number | undefined> = {
    search: params.search,
    category: params.category && params.category !== "all" ? params.category : undefined,
    type: params.type && params.type !== "all" ? params.type : undefined,
    sortOrder: params.sortOrder,
    page: params.page,
    pageSize: params.pageSize,
  };
  return apiGet<TransactionsResponse>("/api/transactions", query);
}
