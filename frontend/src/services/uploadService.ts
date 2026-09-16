import { getApiBaseUrl } from "./api";

export async function processStatementUpload(file: File) {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/upload/process-statement`;

  const formData = new FormData();
  formData.append("file", file);

  // Step 1: Upload file to backend / API route
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    let errorDetail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorDetail = parsed.message || parsed.detail || parsed.error || errorText;
    } catch {
      // not JSON
    }
    throw new Error(`Upload failed (${response.status}): ${errorDetail}`);
  }

  const payload = await response.json();
  const jobId = payload.jobId;

  if (!jobId) {
    // Backend returned ML analysis directly
    return payload?.ml ?? payload;
  }

  // Step 2: Poll for result every 2 seconds if async jobId
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;

    const statusRes = await fetch(`${baseUrl}/api/upload/status/${jobId}`, {
      credentials: "include",
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed (${statusRes.status})`);
    }

    const statusData = await statusRes.json();

    if (statusData.status === "done") {
      return statusData.data ?? statusData;
    }

    if (statusData.status === "error") {
      throw new Error(statusData.error || "Processing failed on server");
    }
  }

  throw new Error("Processing timed out after 60 seconds");
}
