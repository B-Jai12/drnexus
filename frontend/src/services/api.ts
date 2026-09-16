export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    // In a production browser (e.g. Vercel deployment), ALWAYS use relative URL ("")
    // This routes all requests to same-origin /api/... endpoints hosted directly on Vercel,
    // completely eliminating CORS errors, unreachable external hosts, and mixed content issues.
    if (!isLocalhost) {
      return "";
    }

    const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    return envUrl || "http://localhost:5000";
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  return envUrl || "http://localhost:5000";
}

export async function apiGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const rawUrl = `${baseUrl}${path}`;
  const url = baseUrl ? new URL(rawUrl) : new URL(path, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new ApiError("Request timed out after 15 seconds", 408);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    throw new ApiError(payload?.message || payload?.detail || `Request failed: ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

export const API_BASE_URL = getApiBaseUrl();
