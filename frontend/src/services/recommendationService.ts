import { apiGet } from "@/src/services/api";

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  potential_savings: number;
  action_label: string;
}

export interface RecommendationsResponse {
  summary: string;
  items: RecommendationItem[];
  total_potential_savings: number;
  ai_generated: boolean;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getRecommendations() {
  // 1. Try localStorage first (latest ML upload result — includes Gemini recommendations)
  try {
    const cached = typeof window !== "undefined"
      ? localStorage.getItem("drnexus_latest_analysis")
      : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      const data = parsed?.ml ?? parsed;
      const recs = data?.recommendations;
      if (recs && Array.isArray(recs?.items) && recs.items.length > 0) {
        const items = recs.items.map((item: any) => ({
          id: String(item?.id ?? ""),
          title: String(item?.title ?? ""),
          description: String(item?.description ?? ""),
          category: String(item?.category ?? "insight"),
          priority: (item?.priority ?? "medium") as "high" | "medium" | "low",
          potential_savings: toNumber(item?.potential_savings ?? item?.potentialSavings, 0),
          action_label: String(item?.action_label ?? item?.actionLabel ?? "Apply"),
        }));
        return {
          summary: String(recs?.summary ?? ""),
          items,
          total_potential_savings: toNumber(recs?.total_potential_savings, items.reduce((s: number, i: any) => s + i.potential_savings, 0)),
          ai_generated: Boolean(recs?.ai_generated),
        } satisfies RecommendationsResponse;
      }
    }
  } catch {
    // ignore localStorage errors
  }

  // 2. Fallback: backend API (MongoDB)
  const raw = await apiGet<any>("/api/recommendations");
  const items = Array.isArray(raw?.items)
    ? raw.items.map((item: any) => ({
        id: String(item?.id ?? ""),
        title: String(item?.title ?? ""),
        description: String(item?.description ?? ""),
        category: String(item?.category ?? "insight"),
        priority: (item?.priority ?? "medium") as "high" | "medium" | "low",
        potential_savings: toNumber(item?.potential_savings ?? item?.potentialSavings, 0),
        action_label: String(item?.action_label ?? item?.actionLabel ?? "Apply"),
      }))
    : [];

  return {
    summary: String(raw?.summary ?? ""),
    items,
    total_potential_savings:
      toNumber(raw?.total_potential_savings ?? raw?.totalPotentialSavings, items.reduce((s, i) => s + i.potential_savings, 0)),
    ai_generated: Boolean(raw?.ai_generated ?? raw?.aiGenerated),
  } satisfies RecommendationsResponse;
}
