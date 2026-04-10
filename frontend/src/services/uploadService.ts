import { getFirebaseAuth } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:5000";

/** Force-refresh the Firebase ID token and update the session cookie. */
async function refreshFirebaseSession(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    // force=true always fetches a brand-new token from Firebase
    const idToken = await user.getIdToken(true);
    document.cookie = `firebase-session=${idToken}; path=/; max-age=3600; SameSite=Strict`;
  } catch {
    // If Firebase isn't configured or user logged out, silently continue
  }
}

export async function processStatementUpload(file: File) {
  // Always refresh the token before uploading — prevents 401 "token expired" errors
  await refreshFirebaseSession();

  const formData = new FormData();
  formData.append("file", file);

  // Step 1: Upload file and get jobId
  const response = await fetch(`${API_BASE_URL}/api/upload/process-statement`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const jobId = payload.jobId;

  if (!jobId) {
    // If backend already returned data directly
    return payload?.ml ?? payload;
  }

  // Step 2: Poll for result every 3 seconds (max 20 attempts = 60s)
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    attempts++;

    const statusRes = await fetch(`${API_BASE_URL}/api/upload/status/${jobId}`, {
      credentials: "include",
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed (${statusRes.status})`);
    }

    const statusData = await statusRes.json();

    // Step 3: Return final data when done
    if (statusData.status === "done") {
      return statusData.data ?? statusData;
    }

    // Step 4: Throw error if failed
    if (statusData.status === "error") {
      throw new Error(statusData.error || "Processing failed on server");
    }
    // If status is "processing", continue polling
  }

  throw new Error("Processing timed out after 60 seconds (20 attempts)");
}
