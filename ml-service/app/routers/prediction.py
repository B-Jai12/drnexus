"""
/api/predict  — Transaction classification endpoint.

POST /api/predict
    Body:    { "transactions": [{"description": "...", "amount": 250, "type": "DEBIT"}, ...] }
    Returns: per-transaction category, confidence, top-3 alternatives

GET /api/predict/status
    Returns: quick model-ready check (subset of /api/health)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services.model_registry import get_registry

router = APIRouter()


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class TransactionInput(BaseModel):
    description: str
    amount: Optional[float] = None
    type: Optional[str] = "DEBIT"   # "DEBIT" | "CREDIT"

class PredictRequest(BaseModel):
    transactions: list[TransactionInput]


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.post("/api/predict")
def predict_transactions(body: PredictRequest):
    """
    Classify a list of transactions using the trained ensemble model.

    CREDIT transactions are always labelled "Income" — no ML overhead.
    DEBIT transactions are sent through the ensemble (or fallback).
    Falls back gracefully to rule-based TF-IDF if training hasn't run yet.
    """
    if not body.transactions:
        raise HTTPException(status_code=422, detail="transactions list cannot be empty")
    if len(body.transactions) > 500:
        raise HTTPException(status_code=422, detail="Maximum 500 transactions per request")

    registry = get_registry()

    # Split credit (always "Income") vs debit (needs classification)
    credit_flags = [(txn.type or "DEBIT").upper() == "CREDIT" for txn in body.transactions]
    debit_descs  = [
        txn.description
        for txn, is_credit in zip(body.transactions, credit_flags)
        if not is_credit
    ]

    # Run inference only on debit transactions
    if debit_descs:
        debit_preds, used_trained = registry.predict(debit_descs)
    else:
        debit_preds, used_trained = [], True

    # Reassemble in original order
    debit_iter  = iter(debit_preds)
    predictions = []
    for txn, is_credit in zip(body.transactions, credit_flags):
        if is_credit:
            predictions.append({
                "description": txn.description,
                "amount":      txn.amount,
                "type":        "CREDIT",
                "category":    "Income",
                "confidence":  1.0,
                "top3":        [{"category": "Income", "confidence": 1.0}],
                "model":       "rule_based",
            })
        else:
            pred = next(debit_iter)
            predictions.append({
                "description": txn.description,
                "amount":      txn.amount,
                "type":        "DEBIT",
                **pred,
            })

    warning = (
        None if used_trained
        else (
            "Trained model not available — using rule-based TF-IDF fallback. "
            "Run the training pipeline (phase1 → phase5) to enable full ML predictions."
        )
    )

    return {
        "model_loaded": registry.is_loaded,
        "model_type":   "ensemble_v1" if used_trained else "fallback_tfidf",
        "count":        len(predictions),
        "warning":      warning,
        "predictions":  predictions,
    }


@router.get("/api/predict/status")
def prediction_status():
    """Is the trained model loaded and ready?"""
    registry = get_registry()
    status   = registry.get_status()
    return {
        "ready":        status["loaded"],
        "version":      status["version"],
        "trained_at":   status["trained_at"],
        "categories":   status["categories"],
        "n_categories": status["n_categories"],
        "error":        status["error"],
    }