# routers/upload.py
"""
Upload router for Dr.Nexus
Pipeline: save → detect format → OCR/parse → classify → Gemini recommendations → return JSON
Supports: PhonePe PDF, Google Pay PDF, CSV, Excel, Images (OCR)
"""

import os
import logging
import shutil
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from ..services.ocr_engine import extract_transactions
from ..services.classifier import categorize_transactions
from ..services.recommender import generate_recommendations
from ..services.gpay_parser import is_gpay_pdf, parse_gpay_to_standard
from ..services.parser import parse_statement as _parse_statement

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf", ".csv", ".xlsx", ".xls",
    ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif",
}

MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "temp_uploads")


@router.post("/api/process-statement")
async def process_statement(file: UploadFile = File(...)):

    # 1. Validate extension
    original_name = file.filename or "upload"
    ext = os.path.splitext(original_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 2. Save to temp
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, original_name)

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({size_mb:.1f} MB). Max: {MAX_FILE_SIZE_MB} MB"
            )
        logger.info("[UPLOAD] Saved: %s (%.2f MB)", file_path, size_mb)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    try:
        # 3. Detect format and extract transactions
        logger.info("[UPLOAD] Detecting statement format for %s...", ext)

        if ext == ".pdf":
            # ── Auto-detect GPay vs PhonePe/standard ─────────────────────
            if is_gpay_pdf(file_path):
                logger.info("[UPLOAD] Detected: Google Pay PDF")
                parsed = parse_gpay_to_standard(file_path)
                raw_transactions = parsed["transactions"]
                source = "gpay"
            else:
                logger.info("[UPLOAD] Detected: PhonePe / Standard PDF → using parser")
                raw_transactions = _parse_statement(file_path)
                if not raw_transactions or (isinstance(raw_transactions, list) and len(raw_transactions) == 0):
                    logger.info("[UPLOAD] Parser returned 0 transactions → falling back to Multimodal / OCR extraction")
                    raw_transactions = extract_transactions(file_path)
                source = "phonepe"

        elif ext == ".csv":
            logger.info("[UPLOAD] Detected: CSV file")
            raw_transactions = _parse_statement(file_path)
            source = "csv"

        elif ext in (".xlsx", ".xls"):
            logger.info("[UPLOAD] Detected: Excel file")
            raw_transactions = _parse_statement(file_path)
            source = "excel"

        else:
            # Images — Multimodal / OCR path
            logger.info("[UPLOAD] Detected: %s image → using Multimodal / OCR", ext)
            raw_transactions = extract_transactions(file_path)
            source = ext.lstrip(".")

        # parse_statement() can return a dict with {"error": ...} on failure
        if isinstance(raw_transactions, dict) and "error" in raw_transactions:
            # Try OCR before failing
            logger.info("[UPLOAD] Parser error encountered → trying Multimodal / OCR extraction")
            raw_transactions = extract_transactions(file_path)
            if isinstance(raw_transactions, dict) and "error" in raw_transactions:
                raise HTTPException(status_code=422, detail=raw_transactions["error"])

        logger.info("[UPLOAD] Extracted %d transactions from %s", len(raw_transactions), source)

        if not raw_transactions:
            return JSONResponse(status_code=200, content={
                "success": False,
                "message": "No transactions found. Make sure it's a valid bank statement.",
                "transactions": [],
                "summary": {},
                "recommendations": {},
                "source": source,
            })

        # 4. ML Classification
        logger.info("[UPLOAD] Running ML classification...")
        analyzed_data = categorize_transactions(raw_transactions)
        analyzed_data["source"] = source  # tell frontend which app it came from

        # 5. Gemini AI Recommendations
        logger.info("[UPLOAD] Generating Gemini AI recommendations...")
        recommendations = generate_recommendations(analyzed_data)
        analyzed_data["recommendations"] = recommendations

        logger.info(
            "[UPLOAD] Complete — %d txns | source=%s | health=%s | ai=%s",
            len(raw_transactions),
            source,
            analyzed_data["summary"]["health_score"],
            recommendations.get("ai_generated", False),
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    finally:
        # Always clean up temp file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass

    # 6. Return full result
    return JSONResponse(status_code=200, content={
        "success": True,
        "filename": original_name,
        "transaction_count": len(raw_transactions),
        **analyzed_data,
    })


@router.get("/api/health")
async def health_check():
    vision_ready = bool(
        os.getenv("GOOGLE_VISION_API_KEY") or os.getenv("GOOGLE_CLOUD_VISION_API_KEY")
    )
    return {
        "status": "ok",
        "ocr_ready": vision_ready,
        "gemini_ready": bool(os.getenv("GEMINI_API_KEY")),
        "upload_dir": UPLOAD_DIR,
        "max_file_mb": MAX_FILE_SIZE_MB,
        "supported_formats": ["PhonePe PDF", "Google Pay PDF", "CSV", "Excel", "Images (OCR)"],
    }