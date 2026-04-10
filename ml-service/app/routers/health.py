"""
GET /api/health — Enhanced health check with model status.

Returns:
  status          "ok" always (server is running)
  service         service name
  timestamp       current UTC time
  server_started  when uvicorn started
  model
    loaded          bool — is the trained ensemble in memory?
    version         "ensemble_v1" | null
    trained_at      timestamp string | null
    categories      list of supported category strings
    n_categories    int
    weights         per-model ensemble weights
    error           error message if load failed
"""

from fastapi import APIRouter
from datetime import datetime, timezone

from ..services.model_registry import get_registry

router = APIRouter()


@router.get("/api/health")
def health_check():
    registry   = get_registry()
    model_info = registry.get_status()

    return {
        "status":         "ok",
        "service":        "Dr.Nexus AI Brain",
        "timestamp":      datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "server_started": registry.started_at,
        "model": {
            "loaded":       model_info["loaded"],
            "version":      model_info["version"],
            "trained_at":   model_info["trained_at"],
            "categories":   model_info["categories"],
            "n_categories": model_info["n_categories"],
            "weights":      model_info["weights"],
            "error":        model_info["error"],
        },
    }