# services/ocr_engine.py
"""
OCR Engine for Dr.Nexus
Supports:
  - Scanned PDF bank statements   → pdf2image + Google Cloud Vision
  - Photo / screenshot (JPG, PNG) → Google Cloud Vision directly
  - Native/digital PDF            → pdfplumber (fast, no Vision needed)
  - Excel files                   → openpyxl (unchanged)

All paths return the same shape:
  [{ "date": "YYYY-MM-DD" | None, "description": str, "amount": float, "type": str | None }]
"""

import os
import re
import base64
import requests
import tempfile
import traceback
from typing import List, Dict, Optional

import pdfplumber
import openpyxl
from PIL import Image

# ── Load API key from .env (python-dotenv) ────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional — key can be set directly in environment

VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "") or os.getenv("GOOGLE_CLOUD_VISION_API_KEY", "")
VISION_ENDPOINT = (
    "https://vision.googleapis.com/v1/images:annotate"
    f"?key={VISION_API_KEY}"
)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def extract_transactions(file_path: str) -> List[Dict]:
    """
    Main entry point.  Call this from your upload router.
    Auto-detects file type and picks the right extraction strategy.
    """
    ext = os.path.splitext(file_path)[1].lower()
    print(f"\n[OCR] Processing: {file_path}  (ext={ext})")

    try:
        if ext == ".pdf":
            return _handle_pdf(file_path)
        elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"):
            return _handle_image(file_path)
        elif ext in (".xlsx", ".xls"):
            return extract_text_from_excel(file_path)
        else:
            print(f"[OCR] Unsupported format: {ext}")
            return []
    except Exception as e:
        print(f"[OCR] FATAL: {e}")
        traceback.print_exc()
        return []


# ─────────────────────────────────────────────────────────────────────────────
# PDF HANDLING
# ── Gemini Client Initialization ───────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as _e:
        print(f"[OCR] Could not initialize Gemini client: {_e}")


def _gemini_extract_multimodal(file_path: str, mime_type: str) -> List[Dict]:
    """
    Extract transactions from image or PDF using Gemini 2.5 Flash multimodal capabilities.
    Works for receipts, screenshots, handwritten/scanned bank statements without requiring Poppler or GCP Vision billing.
    """
    if not _gemini_client:
        return []

    try:
        from google.genai import types
        import json

        with open(file_path, "rb") as f:
            file_bytes = f.read()

        prompt = """
You are an expert financial document and bank statement parser.
Extract ALL financial transactions visible in this document/image.
Return a valid JSON array of objects with the exact schema:
[
  {
    "date": "YYYY-MM-DD",
    "description": "Merchant, recipient, or narration name",
    "amount": 123.45,
    "type": "DEBIT" or "CREDIT"
  }
]
Rules:
- "date": String in ISO format YYYY-MM-DD. If year is missing, assume 2026. If date is not visible, return null.
- "description": Clean merchant or payee name (e.g. "Zomato", "Swiggy", "Electric Bill", "Salary").
- "amount": Positive float number representing the transaction amount (remove currency symbols like ₹, $, commas).
- "type": Either "DEBIT" (expenses/sent/withdrawal) or "CREDIT" (received/income/deposit).
- If no transactions are found, return [].
Output ONLY the JSON array without any markdown wrappers or commentary.
"""
        part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        response = _gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[part, prompt],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )

        clean_text = (response.text or "").strip()
        if not clean_text:
            return []

        parsed = json.loads(clean_text)
        if isinstance(parsed, list):
            valid_results = []
            for item in parsed:
                amt = _parse_amount(item.get("amount"))
                if amt and amt > 0:
                    valid_results.append({
                        "date": _parse_date_str(item.get("date")),
                        "description": str(item.get("description") or "Transaction").strip(),
                        "amount": amt,
                        "type": _normalize_type(item.get("type")),
                    })
            print(f"[OCR] Gemini multimodal extracted {len(valid_results)} transactions")
            return valid_results
    except Exception as e:
        print(f"[OCR] Gemini multimodal extraction failed: {e}")
        traceback.print_exc()

    return []


# ─────────────────────────────────────────────────────────────────────────────
# PDF HANDLING
# ─────────────────────────────────────────────────────────────────────────────

def _handle_pdf(file_path: str) -> List[Dict]:
    """
    1. Try pdfplumber (fast — works for digital/native PDFs).
    2. If no usable transactions found, try Gemini direct PDF parsing (scanned PDFs without needing Poppler).
    3. If Gemini is unavailable, fallback to pdf2image + Vision OCR.
    """
    print("[OCR] Trying pdfplumber on PDF...")
    results = _pdfplumber_extract(file_path)

    if results and len(results) > 0:
        print(f"[OCR] pdfplumber succeeded: {len(results)} transactions")
        return results

    print("[OCR] pdfplumber found nothing — trying Gemini Multimodal PDF extraction...")
    gemini_results = _gemini_extract_multimodal(file_path, "application/pdf")
    if gemini_results and len(gemini_results) > 0:
        return gemini_results

    print("[OCR] Switching to Vision OCR (scanned PDF)")
    return _vision_pdf(file_path)


def _pdfplumber_extract(file_path: str) -> List[Dict]:
    """Extract from a digital PDF using pdfplumber (no API call needed)."""
    all_text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # Try table first
                table = page.extract_table()
                if table and len(table) > 1:
                    parsed = _parse_table(table)
                    if parsed:
                        return parsed
                # Otherwise grab raw text
                text = page.extract_text() or ""
                all_text += text + "\n"
    except Exception as e:
        print(f"[OCR] pdfplumber error: {e}")
        return []

    return _parse_raw_text(all_text)


def _vision_pdf(file_path: str) -> List[Dict]:
    """Convert each PDF page to an image, then run Vision OCR on each."""
    try:
        from pdf2image import convert_from_path
    except ImportError:
        print("[OCR] pdf2image not installed. Run: pip install pdf2image")
        return []

    if not VISION_API_KEY:
        print("[OCR] ERROR: GOOGLE_VISION_API_KEY (or GOOGLE_CLOUD_VISION_API_KEY) not set in .env")
        return []

    results = []
    try:
        pages = convert_from_path(file_path, dpi=200)
        print(f"[OCR] Converted PDF to {len(pages)} image(s)")

        for i, page_img in enumerate(pages):
            print(f"[OCR] Running Vision OCR on page {i + 1}...")
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                page_img.save(tmp.name, "PNG")
                page_results = _vision_ocr_image(tmp.name)
                results.extend(page_results)
                os.unlink(tmp.name)

    except Exception as e:
        print(f"[OCR] PDF→image conversion error: {e}")

    print(f"[OCR] Vision PDF total: {len(results)} transactions")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE HANDLING (JPG / PNG / screenshot)
# ─────────────────────────────────────────────────────────────────────────────

def _handle_image(file_path: str) -> List[Dict]:
    """
    1. Try Gemini Vision directly (reliable, handles receipts, UPI screenshots, scanned statements).
    2. Fallback to Google Cloud Vision if Gemini unavailable.
    """
    ext = os.path.splitext(file_path)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".webp": "image/webp",
        ".bmp": "image/bmp",  ".tiff": "image/tiff", ".tif": "image/tiff",
    }
    mime_type = mime_map.get(ext, "image/png")

    print(f"[OCR] Running Gemini Vision extraction on {file_path} ({mime_type})...")
    gemini_results = _gemini_extract_multimodal(file_path, mime_type)
    if gemini_results and len(gemini_results) > 0:
        return gemini_results

    if not VISION_API_KEY:
        print("[OCR] Warning: GOOGLE_VISION_API_KEY not set or Gemini handled it.")
        return gemini_results

    print(f"[OCR] Running Google Cloud Vision OCR fallback on image: {file_path}")
    results = _vision_ocr_image(file_path)
    print(f"[OCR] Vision OCR found: {len(results)} transactions")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# GOOGLE CLOUD VISION API CALL
# ─────────────────────────────────────────────────────────────────────────────

def _vision_ocr_image(image_path: str) -> List[Dict]:
    """
    Send one image to Google Cloud Vision TEXT_DETECTION.
    Returns parsed transactions from the OCR'd text.
    """
    # Read and base64-encode the image
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    # Detect image mime type
    ext = os.path.splitext(image_path)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".webp": "image/webp",
        ".bmp": "image/bmp",  ".tiff": "image/tiff", ".tif": "image/tiff",
    }
    mime_type = mime_map.get(ext, "image/png")

    payload = {
        "requests": [
            {
                "image": {"content": image_data},
                "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
                "imageContext": {"languageHints": ["en"]},
            }
        ]
    }

    try:
        resp = requests.post(VISION_ENDPOINT, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"[OCR] Vision API request failed: {e}")
        return []

    # Check for API-level errors
    responses = data.get("responses", [])
    if not responses:
        print("[OCR] Vision API returned empty responses")
        return []

    error = responses[0].get("error")
    if error:
        print(f"[OCR] Vision API error: {error.get('message', 'Unknown error')}")
        print("[OCR] Make sure Cloud Vision API is enabled at console.cloud.google.com/apis/library")
        return []

    # Extract full text annotation (most complete)
    full_text = ""
    annotation = responses[0].get("fullTextAnnotation")
    if annotation:
        full_text = annotation.get("text", "")
    else:
        # Fallback to textAnnotations
        text_annotations = responses[0].get("textAnnotations", [])
        if text_annotations:
            full_text = text_annotations[0].get("description", "")

    if not full_text.strip():
        print("[OCR] Vision API found no text in image")
        return []

    print(f"[OCR] Vision extracted {len(full_text)} characters of text")
    return _parse_raw_text(full_text)


# ─────────────────────────────────────────────────────────────────────────────
# TEXT PARSING — converts raw OCR text → transaction dicts
# ─────────────────────────────────────────────────────────────────────────────

def _parse_raw_text(text: str) -> List[Dict]:
    """
    Parse raw OCR/extracted text into transaction records.
    Handles PhonePe, Paytm, GPay, HDFC, SBI, Axis, ICICI statement formats.
    """
    results = []

    # ── Pattern 1: DEBIT/CREDIT keyword style (PhonePe, Paytm, GPay) ─────────
    # e.g. "Paid to Zomato   DEBIT  ₹213.52"
    # e.g. "15/02/2025  Received from Mummy  CREDIT  ₹3,400"
    p1 = re.compile(
        r'(?:(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+)?'   # optional date
        r'([^\n\r]+?)\s+'                                        # description
        r'(DEBIT|CREDIT|DR|CR)\s+'                              # type
        r'[₹$]?\s*([\d,]+(?:\.\d{1,2})?)',                     # amount
        re.IGNORECASE
    )

    # ── Pattern 2: tabular bank style (HDFC, SBI) ────────────────────────────
    # e.g. "15/02/2025  NEFT-Zomato  10,000.00  "
    # e.g. "15-Feb-2025  UPI/CR/Salary  50000.00"
    p2 = re.compile(
        r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\-\s][A-Za-z]{3}[\-\s]\d{2,4})'
        r'\s+'
        r'([A-Za-z0-9\/\-\s\(\)\.,:&\']{4,60?}?)'
        r'\s+'
        r'[₹$]?\s*([\d,]+(?:\.\d{1,2})?)\s*$',
        re.MULTILINE
    )

    matched_by_p1 = set()

    for m in p1.finditer(text):
        date_str, desc, txn_type, amount_str = m.groups()
        desc = desc.strip()
        if _is_header(desc):
            continue
        amount = _parse_amount(amount_str)
        if amount is None or amount == 0:
            continue
        results.append({
            "date": _parse_date_str(date_str),
            "description": desc,
            "amount": amount,
            "type": _normalize_type(txn_type),
        })
        matched_by_p1.add(m.start())

    # Only use p2 if p1 found nothing (avoid duplicates)
    if not results:
        for m in p2.finditer(text):
            date_str, desc, amount_str = m.groups()
            desc = desc.strip()
            if _is_header(desc):
                continue
            amount = _parse_amount(amount_str)
            if amount is None or amount == 0:
                continue
            results.append({
                "date": _parse_date_str(date_str),
                "description": desc,
                "amount": amount,
                "type": None,
            })

    # ── Pattern 3: last-resort line-by-line ───────────────────────────────────
    if not results:
        results = _line_by_line_parse(text)

    print(f"[OCR] _parse_raw_text found {len(results)} transactions")
    return results


def _line_by_line_parse(text: str) -> List[Dict]:
    """Last resort: scan each line for any ₹/$ amount."""
    results = []
    amount_re = re.compile(r'[₹$]\s*([\d,]+(?:\.\d{1,2})?)')
    date_re = re.compile(r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b')

    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 5:
            continue
        amt_match = amount_re.search(line)
        if not amt_match:
            continue
        amount = _parse_amount(amt_match.group(1))
        if not amount:
            continue
        date_match = date_re.search(line)
        desc = line[:amt_match.start()].strip() or line
        results.append({
            "date": _parse_date_str(date_match.group(1)) if date_match else None,
            "description": desc,
            "amount": amount,
            "type": None,
        })
    return results


def _parse_table(table: list) -> List[Dict]:
    """Parse a pdfplumber table (list of lists) into transaction dicts."""
    if not table or len(table) < 2:
        return []

    headers = [str(h).lower().strip() if h else "" for h in table[0]]

    def find_col(keywords):
        for kw in keywords:
            for i, h in enumerate(headers):
                if kw in h:
                    return i
        return None

    date_i   = find_col(["date"])
    desc_i   = find_col(["desc", "narr", "particular", "detail", "payee", "ref"])
    debit_i  = find_col(["debit", "dr", "withdrawal", "out"])
    credit_i = find_col(["credit", "cr", "deposit"])
    amt_i    = find_col(["amount", "amt", "value"])

    if desc_i is None:
        return []

    results = []
    for row in table[1:]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        def cell(i):
            return str(row[i]).strip() if i is not None and i < len(row) and row[i] is not None else ""

        amount = None
        for i in [debit_i, amt_i, credit_i]:
            v = _parse_amount(cell(i))
            if v:
                amount = v
                break

        if not amount:
            continue

        results.append({
            "date": _parse_date_str(cell(date_i)) if date_i is not None else None,
            "description": cell(desc_i) or "Unknown",
            "amount": amount,
            "type": None,
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# EXCEL (unchanged from original, just integrated)
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_excel(file_path: str) -> List[Dict]:
    """Extract transactions from Excel (.xlsx/.xls)."""
    transactions = []
    try:
        workbook = openpyxl.load_workbook(file_path)
        worksheet = workbook.active
        for row in worksheet.iter_rows(min_row=2, values_only=True):
            if not row or not any(row):
                continue
            try:
                date_val  = str(row[0]) if row[0] is not None else None
                desc_val  = str(row[1]) if row[1] is not None else "Unknown"
                amt_val   = row[2]
                if amt_val is None:
                    continue
                transactions.append({
                    "date": _parse_date_str(date_val),
                    "description": desc_val,
                    "amount": abs(float(amt_val)),
                    "type": None,
                })
            except (ValueError, TypeError, IndexError):
                continue
    except Exception as e:
        print(f"[OCR] Excel error: {e}")
    return transactions


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _parse_amount(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    cleaned = str(raw).replace(",", "").replace("₹", "").replace("$", "").strip()
    if not cleaned or cleaned.lower() in ("nan", "-", "none", ""):
        return None
    try:
        v = float(cleaned)
        return v if v > 0 else None
    except ValueError:
        return None


def _normalize_type(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    r = raw.upper().strip()
    if r in ("DEBIT", "DR"):
        return "DEBIT"
    if r in ("CREDIT", "CR"):
        return "CREDIT"
    return r


def _is_header(text: str) -> bool:
    """Filter out common table header rows."""
    headers = {
        "description", "details", "narration", "transaction details",
        "particulars", "remarks", "ref no", "reference", "date",
        "amount", "debit", "credit", "balance",
    }
    return text.lower().strip() in headers


def _parse_date_str(raw) -> Optional[str]:
    """
    Parse a date string into ISO format YYYY-MM-DD.
    Delegates to the same robust parser used in parser.py.
    """
    if not raw:
        return None
    from datetime import datetime

    raw_str = str(raw).strip()
    if not raw_str or raw_str.lower() in ("nan", "none", "nat", "", "-"):
        return None

    # Remove ordinal suffixes
    raw_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', raw_str, flags=re.IGNORECASE)

    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d",
        "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
        "%d/%m/%y", "%m/%d/%y", "%d-%b-%Y", "%d-%b-%y",
        "%Y/%m/%d", "%d.%m.%Y", "%d.%m.%y", "%b %d %Y",
        "%d %b, %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    try:
        import pandas as pd
        return pd.to_datetime(raw_str, dayfirst=True, errors="raise").strftime("%Y-%m-%d")
    except Exception:
        pass

    return None