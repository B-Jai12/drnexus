import { apiGet } from "@/src/services/api";

export interface HealthScoreResponse {
  health_score: number;
}

export async function getHealthScore() {
  // 1. Try localStorage first (from saved ML upload result)
  try {
    const cached = typeof window !== "undefined"
      ? localStorage.getItem("drnexus_latest_analysis")
      : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      const data = parsed?.ml ?? parsed;
      const score = Number(data?.summary?.health_score ?? 0);
      if (score > 0) return { health_score: score } satisfies HealthScoreResponse;
    }
  } catch { /* ignore */ }

  // 2. Fallback: backend API
  const raw = await apiGet<any>("/api/health-score");
  return {
    health_score: Number(raw?.health_score ?? raw?.score ?? 0),
  } satisfies HealthScoreResponse;
}
