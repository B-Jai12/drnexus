import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import upload, analysis, health, prediction
from .services.model_registry import load_model

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("[Startup] Dr.Nexus ML service starting up...")
    success = load_model()
    if success:
        logger.info("[Startup] ✅ Trained ensemble model loaded — ML predictions active")
    else:
        logger.warning("[Startup] ⚠️  No trained model found — rule-based fallback active")
        logger.warning("[Startup]    Run training/phase1_clean.py → phase5_train.py to enable ML")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("[Shutdown] Dr.Nexus ML service shutting down")


app = FastAPI(title="Dr.Nexus AI Brain", lifespan=lifespan)

_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000").strip()
if _cors_origins_raw == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(health.router)
app.include_router(prediction.router)

@app.get("/")
def read_root():
    return {"status": "Backend is active and listening"}

@app.post("/api/ml/reload")
def reload_ml_model():
    from .services.classifier import _tfidf_classifier
    _tfidf_classifier.load()
    return {"status": "TFIDF model reloaded successfully"}