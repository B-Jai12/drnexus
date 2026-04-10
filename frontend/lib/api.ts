import { apiGet } from "@/src/services/api";
import { getTransactions } from "@/src/services/transactionService";
import { getRecommendations } from "@/src/services/recommendationService";

export async function fetchTransactions(filters?: {
  search?: string;
  category?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  return getTransactions(filters || {});
}

export async function fetchFinancialSummary() {
  return apiGet("/api/dashboard/overview");
}

export async function fetchPredictions() {
  return apiGet("/api/predictions");
}

export async function fetchRecommendations() {
  return getRecommendations();
}

export async function fetchMerchantSpending() {
  return apiGet("/api/analytics/merchants");
}

export async function fetchWeeklyTrends() {
  return apiGet("/api/analytics/weekly-trends");
}

export async function fetchHeatmapData() {
  return apiGet("/api/analytics/heatmap");
}
