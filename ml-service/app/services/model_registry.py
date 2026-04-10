"""
Model Registry — Singleton that holds the live TransactionEnsemble.

Called once from the FastAPI lifespan (app/main.py) at server startup.
All routers then call get_registry() to access the model safely.

If the training pipeline hasn't been run yet:
  - is_loaded → False
  - predict() falls back to the rule-based TF-IDF classifier
  - a warning is returned in every prediction response
  - the server NEVER crashes
"""

import logging
import pathlib
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class _ModelRegistry:
    """Internal singleton. Access via module-level helpers below."""

    def __init__(self):
        self._model        = None
        self._loaded: bool = False
        self._error: Optional[str]  = None
        self._loaded_at: Optional[str] = None
        self._started_at: str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ─── Loading ───────────────────────────────────────────────────────────────

    def load(self, model_dir: Optional[pathlib.Path] = None) -> bool:
        """
        Try to load the trained ensemble from disk.
        Returns True on success, False on failure. Never raises.
        """
        if self._loaded:
            logger.info("[ModelRegistry] Already loaded — skipping reload")
            return True

        try:
            from .predictor import TransactionEnsemble
            self._model     = TransactionEnsemble.load(model_dir)
            self._loaded    = True
            self._error     = None
            self._loaded_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            logger.info("[ModelRegistry] ✅ Trained ensemble loaded and ready")
            return True

        except FileNotFoundError as exc:
            msg = (
                f"Trained model not found — run the training pipeline first. "
                f"Missing: {exc.filename or exc}"
            )
            logger.warning(f"[ModelRegistry] ⚠️  {msg}")
            self._error  = msg
            self._loaded = False
            return False

        except ImportError as exc:
            msg = f"Missing dependency: {exc}"
            logger.error(f"[ModelRegistry] ❌ {msg}")
            self._error  = msg
            self._loaded = False
            return False

        except Exception as exc:
            msg = f"{type(exc).__name__}: {exc}"
            logger.error(f"[ModelRegistry] ❌ Failed to load model — {msg}", exc_info=True)
            self._error  = msg
            self._loaded = False
            return False

    # ─── Public API ────────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def started_at(self) -> str:
        return self._started_at

    def get_status(self) -> dict:
        """Full model metadata for /api/health."""
        if self._loaded and self._model:
            return {
                "loaded":       True,
                "version":      "ensemble_v1",
                "trained_at":   self._model.trained_at,
                "loaded_at":    self._loaded_at,
                "categories":   self._model.categories,
                "n_categories": len(self._model.categories),
                "weights":      self._model.weights,
                "error":        None,
            }
        return {
            "loaded":       False,
            "version":      None,
            "trained_at":   None,
            "loaded_at":    None,
            "categories":   [],
            "n_categories": 0,
            "weights":      {},
            "error":        self._error or "Model not loaded",
        }

    def predict(self, descriptions: list) -> tuple:
        """
        Predict categories for a list of description strings.
        Returns (predictions: list[dict], used_trained_model: bool).

        When trained model is unavailable, silently falls back to the
        rule-based TF-IDF classifier already used by the upload route.
        """
        if self._loaded and self._model:
            preds = self._model.predict_batch(descriptions)
            return preds, True

        # ── Fallback: rule-based TF-IDF from classifier.py ────────────────────
        logger.warning(
            "[ModelRegistry] ⚠️  No trained model — using rule-based fallback. "
            "Run training pipeline to enable ML predictions."
        )
        from .classifier import _tfidf_classifier
        results = []
        for desc in descriptions:
            category, confidence = _tfidf_classifier.predict(desc)
            results.append({
                "category":   category,
                "confidence": round(confidence, 4),
                "top3":       [{"category": category, "confidence": round(confidence, 4)}],
                "model":      "fallback_tfidf",
            })
        return results, False


# ─── Module-level singleton ────────────────────────────────────────────────────

_registry = _ModelRegistry()


def get_registry() -> _ModelRegistry:
    """Return the global registry instance (used by routers)."""
    return _registry


def load_model(model_dir: Optional[pathlib.Path] = None) -> bool:
    """Called from FastAPI lifespan to load the model at startup."""
    return _registry.load(model_dir)
