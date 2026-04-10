# services/gpay_parser.py
import re
from datetime import datetime

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

X_DATE_MAX    = 140
X_DETAILS_MIN = 140
X_AMOUNT_MIN  = 520

DATE_RE   = re.compile(r"^\d{1,2}[A-Za-z]{3},?\d{4}$")
TIME_RE   = re.compile(r"^\d{1,2}:\d{2}(AM|PM)$")
AMOUNT_RE = re.compile(r"^₹[\d,]+\.?\d*$")

def _parse_date(s):
    s = s.strip().replace(" ", "")
    m = re.match(r"(\d{1,2})([A-Za-z]{3}),?(\d{4})", s)
    if m:
        day, mon, year = m.groups()
        try:
            return datetime.strptime(f"{day}{mon}{year}", "%d%b%Y").strftime("%Y-%m-%d")
        except:
            pass
    return s

def _parse_amount(s):
    try:
        return float(s.replace("₹","").replace(",","").strip())
    except:
        return 0.0

def _extract_merchant_type(details):
    t = details.replace(" ", "")
    if re.match(r"(?i)paidto", t):
        merchant = re.sub(r"(?i)^paidto", "", t).strip()
        return merchant, "DEBIT"
    if re.match(r"(?i)receivedfrom", t):
        merchant = re.sub(r"(?i)^receivedfrom", "", t).strip()
        return merchant, "CREDIT"
    return details, "DEBIT"

def _group_words_by_row(words, tol=5):
    if not words:
        return []
    words_s = sorted(words, key=lambda w: (round(w["top"]/tol)*tol, w["x0"]))
    rows, cur_row, cur_y = [], [words_s[0]], words_s[0]["top"]
    for w in words_s[1:]:
        if abs(w["top"] - cur_y) <= tol:
            cur_row.append(w)
        else:
            rows.append(sorted(cur_row, key=lambda x: x["x0"]))
            cur_row, cur_y = [w], w["top"]
    if cur_row:
        rows.append(sorted(cur_row, key=lambda x: x["x0"]))
    return rows

def _cols(row):
    d = " ".join(w["text"] for w in row if w["x0"] < X_DATE_MAX)
    det = " ".join(w["text"] for w in row if X_DATE_MAX <= w["x0"] < X_AMOUNT_MIN)
    a = " ".join(w["text"] for w in row if w["x0"] >= X_AMOUNT_MIN)
    return d.strip(), det.strip(), a.strip()

def _is_date(s):
    return bool(DATE_RE.match(s.replace(" ","")))

def _is_txn(s):
    ns = s.replace(" ","").lower()
    return ns.startswith("paidto") or ns.startswith("receivedfrom")

def _is_time(s):
    return bool(TIME_RE.match(s.replace(" ","")))

def parse_gpay_pdf(file_path):
    if pdfplumber is None:
        raise ImportError("pip install pdfplumber")
    
    transactions = []
    
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=1, y_tolerance=1)
            if not words:
                continue
            rows = _group_words_by_row(words, tol=5)
            
            cur_date = cur_detail = cur_upi = ""
            cur_amt = 0.0
            
            for row in rows:
                date_col, detail_col, amt_col = _cols(row)
                
                if _is_date(date_col) and _is_txn(detail_col) and AMOUNT_RE.match(amt_col):
                    # Save previous
                    if cur_detail and cur_amt > 0:
                        merchant, typ = _extract_merchant_type(cur_detail)
                        transactions.append({
                            "date": cur_date, "merchant": merchant,
                            "description": cur_detail, "type": typ,
                            "amount": cur_amt, "upi_ref": cur_upi,
                        })
                    cur_date  = _parse_date(date_col)
                    cur_detail= detail_col
                    cur_amt   = _parse_amount(amt_col)
                    cur_upi   = ""
                
                elif _is_time(date_col) and "UPITransactionID" in detail_col.replace(" ",""):
                    m = re.search(r"(\d{9,})", detail_col)
                    if m:
                        cur_upi = m.group(1)
            
            # Save last on page
            if cur_detail and cur_amt > 0:
                merchant, typ = _extract_merchant_type(cur_detail)
                transactions.append({
                    "date": cur_date, "merchant": merchant,
                    "description": cur_detail, "type": typ,
                    "amount": cur_amt, "upi_ref": cur_upi,
                })
    
    # Deduplicate by UPI ref
    seen, unique = set(), []
    for t in transactions:
        key = t["upi_ref"] or f"{t['date']}_{t['merchant']}_{t['amount']}"
        if key not in seen:
            seen.add(key)
            unique.append(t)
    
    print(f"[GPAY PARSER] Extracted {len(unique)} transactions")
    return unique

def parse_gpay_to_standard(file_path):
    raw = parse_gpay_pdf(file_path)
    standardized = []
    for i, txn in enumerate(raw):
        standardized.append({
            "id": i+1, "date": txn["date"], "merchant": txn["merchant"],
            "description": txn["description"], "type": txn["type"],
            "amount": txn["amount"], "category": "", "confidence": 0.0,
            "month": txn["date"][:7] if txn["date"] else "",
            "is_anomaly": False, "anomaly_severity": "", "z_score": 0.0, "is_recurring": False,
        })
    return {"transactions": standardized, "source": "gpay", "total_rows": len(standardized)}

def is_gpay_pdf(file_path):
    if pdfplumber is None:
        return False
    try:
        with pdfplumber.open(file_path) as pdf:
            if not pdf.pages:
                return False
            words = pdf.pages[0].extract_words()
            text = " ".join(w["text"] for w in words).replace(" ","").lower()
            return "googlepay" in text or "upitransactionid" in text
    except:
        return False

# Add merchant name humanizer using regex word boundary detection
import re as _re

def _add_spaces_to_merchant(name: str) -> str:
    """
    Inserts spaces into merged merchant names from GPay PDFs.
    "CYBERABADFILLINGSTATION" stays as-is (too ambiguous to split).
    "BodduluriVardhan" -> "Bodduluri Vardhan" (camelCase detected).
    """
    # Already has spaces
    if " " in name:
        return name
    # CamelCase detection - insert space before uppercase letters
    # that follow lowercase letters: "BodduluriVardhan" -> "Bodduluri Vardhan"
    spaced = _re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
    return spaced