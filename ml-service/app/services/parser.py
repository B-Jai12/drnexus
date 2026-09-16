import pandas as pd
import pdfplumber
import os
import re
import traceback
from datetime import datetime
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass



# ─── Public entry point ────────────────────────────────────────────────────────

def parse_statement(file_path: str):
    ext = os.path.splitext(file_path)[1].lower()
    print(f"\n{'='*60}")
    print(f"[PARSER] Processing file: {file_path}")
    print(f"[PARSER] Extension: {ext}")
    print(f"{'='*60}")

    try:
        if ext == '.csv':
            result = _parse_csv(file_path)
            if not result:
                print("[PARSER] CSV returned 0 rows — attempting Excel fallback")
                try:
                    result = _parse_excel(file_path)
                except Exception as e2:
                    print(f"[PARSER] Excel fallback failed: {e2}")
            return result
        elif ext in ['.xlsx', '.xls']:
            return _parse_excel(file_path)
        elif ext == '.pdf':
            return _parse_pdf(file_path)
        else:
            return {"error": f"Format {ext} not supported."}

    except Exception as e:
        print(f"[PARSER] FATAL ERROR: {e}")
        traceback.print_exc()
        return {"error": str(e)}


# ─── Date parsing ──────────────────────────────────────────────────────────────

FORMATS = [
    "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d",
    "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
    "%d/%m/%y", "%m/%d/%y", "%d-%b-%Y", "%d-%b-%y",
    "%Y/%m/%d", "%d.%m.%Y", "%d.%m.%y", "%b %d %Y",
    "%d %b, %Y", "%d%b%Y", "%d-%B-%Y", "%d %B, %Y",
    "%d %b", "%b %d",
    "%d-%m-%y", "%m-%d-%y",
    "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S",
    "%Y-%m-%d %H:%M:%S", "%d %b %Y %H:%M:%S",
    "%b %d, %Y %I:%M %p",
]

CURRENT_YEAR = datetime.now().year

def _parse_date(raw) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, (datetime, pd.Timestamp)):
        try:
            return pd.Timestamp(raw).strftime("%Y-%m-%d")
        except Exception:
            return None

    raw_str = str(raw).strip()
    if not raw_str or raw_str.lower() in ("nan", "none", "nat", "", "-", "n/a"):
        return None

    raw_str = raw_str.split('\n')[0].strip()
    raw_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', raw_str, flags=re.IGNORECASE)
    raw_str = re.sub(r'\s+\d{1,2}:\d{2}\s*(AM|PM)?$', '', raw_str, flags=re.IGNORECASE).strip()

    for fmt in FORMATS:
        try:
            parsed = datetime.strptime(raw_str, fmt)
            if parsed.year == 1900:
                parsed = parsed.replace(year=CURRENT_YEAR)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    try:
        return pd.to_datetime(raw_str, dayfirst=True, errors="raise").strftime("%Y-%m-%d")
    except Exception:
        pass

    print(f"[PARSER] WARNING: Could not parse date '{raw_str}'")
    return None


# ─── CSV ───────────────────────────────────────────────────────────────────────

def _parse_csv(path):
    for encoding in ('utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1'):
        try:
            df = pd.read_csv(path, encoding=encoding, on_bad_lines='skip', engine='python')
            print(f"[PARSER] CSV loaded with encoding={encoding} — shape: {df.shape}")
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode CSV with any known encoding")

    df = _fix_header(df)
    return _process_df(df)


# ─── Excel ─────────────────────────────────────────────────────────────────────

def _is_phonepe_excel(df_raw: pd.DataFrame) -> bool:
    for i in range(min(10, len(df_raw))):
        row_vals = [str(v).lower().strip() for v in df_raw.iloc[i] if pd.notna(v)]
        if 'date' in row_vals and 'type' in row_vals and 'amount' in row_vals:
            return True
        for v in df_raw.iloc[i]:
            if isinstance(v, str) and re.match(r'^[A-Za-z]{3}\s+\d{1,2},\s*\d{4}\s+', v.strip()):
                return True
    return False


def _parse_phonepe_excel(path: str, sheet=0) -> list:
    print("[PARSER] Detected PhonePe Excel format — using dedicated parser")

    df = pd.read_excel(path, sheet_name=sheet, skiprows=2, header=0)
    df.columns = ['Date', 'Transaction Details', 'Type', 'Amount']

    results = []

    date_merchant_re = re.compile(
        r'^([A-Za-z]{3}\s+\d{1,2},\s*\d{4})\s+(.+)$',
        re.DOTALL
    )

    for i, row in df.iterrows():
        date_val = str(row.get('Date', '') or '').strip()
        type_val = str(row.get('Type', '') or '').strip()
        amount_val = str(row.get('Amount', '') or '').strip()

        if type_val.upper() not in ('DEBIT', 'CREDIT'):
            continue
        if not amount_val or amount_val.lower() in ('nan', '', '-'):
            continue

        m = date_merchant_re.match(date_val)
        if m:
            raw_date = m.group(1).strip()
            merchant = m.group(2).strip()
        else:
            raw_date = date_val
            merchant = date_val

        merchant = re.sub(r'[^\x00-\x7F]+', '', merchant).strip()
        merchant = re.sub(r'\s+', ' ', merchant).strip()
        merchant = re.sub(r'^(Paid to|Received from|Payment to|Paid for|Sent to)\s+', '', merchant, flags=re.IGNORECASE).strip()
        if not merchant:
            merchant = 'PhonePe Transaction'

        clean_amt = amount_val.replace('₹', '').replace(',', '').strip()
        try:
            amount = float(clean_amt)
        except ValueError:
            continue

        if amount <= 0:
            continue

        parsed_date = _parse_date(raw_date)

        results.append({
            'description': merchant,
            'amount': round(amount, 2),
            'type': type_val.upper(),
            'date': parsed_date,
        })

    print(f"[PARSER] PhonePe Excel parser extracted {len(results)} transactions")
    return results


def _parse_excel(path):
    xl = pd.ExcelFile(path)
    all_results = []

    for sheet in xl.sheet_names:
        try:
            raw = pd.read_excel(path, sheet_name=sheet, header=None)
            raw = raw.dropna(how='all').reset_index(drop=True)

            if len(raw) < 2:
                continue

            if _is_phonepe_excel(raw):
                parsed = _parse_phonepe_excel(path, sheet=sheet)
                if parsed:
                    all_results.extend(parsed)
                    continue

            header_row_idx = _find_header_row(raw)
            print(f"[PARSER] Sheet '{sheet}' — header at row {header_row_idx}")

            df = pd.read_excel(path, sheet_name=sheet, header=header_row_idx)
            df = df.dropna(how='all').reset_index(drop=True)

            rows = len(df.dropna(how='all'))
            print(f"[PARSER] Excel sheet '{sheet}' — shape: {df.shape}, usable rows: {rows}")

            if rows < 1:
                continue

            parsed = _process_df(df)
            parsed = _collapse_phonepe_rows(parsed)

            if parsed:
                all_results.extend(parsed)

        except Exception as e:
            print(f"[PARSER] Sheet '{sheet}' error: {e}")
            traceback.print_exc()

    if not all_results:
        return []

    seen = set()
    unique = []
    for t in all_results:
        key = (t.get('date'), t.get('description'), t.get('amount'), t.get('type'))
        if key not in seen:
            seen.add(key)
            unique.append(t)

    print(f"[PARSER] Total unique transactions: {len(unique)}")
    return unique


def _find_header_row(raw_df: pd.DataFrame) -> int:
    HEADER_KEYWORDS = {
        'date', 'desc', 'narr', 'detail', 'particular', 'amount',
        'debit', 'credit', 'withdrawal', 'deposit', 'balance', 'ref',
        'remarks', 'txn', 'transaction', 'value', 'dr', 'cr', 'type',
        'mode', 'merchant', 'payee', 'beneficiary'
    }

    for i in range(min(10, len(raw_df))):
        row = raw_df.iloc[i]
        hits = sum(
            1 for cell in row
            if isinstance(cell, str) and any(kw in cell.lower() for kw in HEADER_KEYWORDS)
        )
        if hits >= 2:
            return i

    return 0


def _collapse_phonepe_rows(transactions: list) -> list:
    """
    PhonePe statements have multiple rows per transaction.
    First row has date, merchant, type, amount.
    Sub-rows have transaction ID, UTR etc.
    Filter out sub-rows (those without amount or with transaction ID patterns).
    """
    result = []
    for t in transactions:
        desc = t.get('description', '')
        if re.search(r'transaction id|utr|ref no|page \d|this is a system', str(desc), re.IGNORECASE):
            continue
        if not t.get('amount'):
            continue
        result.append(t)
    return result


# ─── PDF ───────────────────────────────────────────────────────────────────────

def _parse_pdf(path):
    all_data = []
    full_text = ""

    with pdfplumber.open(path) as pdf:
        print(f"[PARSER] PDF has {len(pdf.pages)} page(s)")

        for i, page in enumerate(pdf.pages):
            # Try table extraction first (works for some bank PDFs)
            table = page.extract_table()
            if table and len(table) > 1:
                header_idx = 0
                for j, row in enumerate(table[:5]):
                    if row and any(
                        isinstance(cell, str) and any(
                            kw in cell.lower()
                            for kw in ['date', 'desc', 'amount', 'debit', 'credit', 'narr', 'detail', 'particular']
                        )
                        for cell in row
                    ):
                        header_idx = j
                        break

                cols = table[header_idx]
                data_rows = table[header_idx + 1:]
                if data_rows:
                    df = pd.DataFrame(data_rows, columns=cols)
                    print(f"[PARSER] PDF page {i+1} — table shape: {df.shape}")
                    parsed = _process_df(df)
                    all_data.extend(parsed)
                    continue

            # No table — accumulate text for text-based parsing
            text = page.extract_text()
            if text:
                full_text += text + "\n"
            else:
                print(f"[PARSER] PDF page {i+1} — no table, no text")

    if all_data:
        print(f"[PARSER] Table extraction: {len(all_data)} transactions")
        return all_data

    # Text fallback — try PhonePe-specific multi-line parser first
    print("[PARSER] Trying PhonePe multi-line text parser...")
    all_data = _parse_phonepe_pdf_text(full_text)

    if all_data:
        print(f"[PARSER] PhonePe text parser: {len(all_data)} transactions")
        return all_data

    # Last resort: generic single-line regex
    print("[PARSER] Trying generic text-based parsing...")
    all_data = _parse_pdf_text(full_text)
    print(f"[PARSER] Generic text extraction: {len(all_data)} transactions")
    return all_data


# ─── PhonePe PDF text parser ──────────────────────────────────────────────────
#
# PhonePe PDF text (from pdfplumber.extract_text) looks like:
#
#   "Feb 20, 2026        Paid to Bhanu"
#   "04:04 PM Transaction ID T2602201604013411987123 UTR No. 356122879564"
#   "Paid by XXXXXXXXXXX0385"
#   "Feb 20, 2026        Received from Manoj Kumar"
#   "01:03 PM Transaction ID T2602201303457309277060 UTR No. 507640042890"
#   "Credited to XXXXXXXXXXX0385"
#
# Some PDF renders put the amount on the same line:
#   "Feb 20, 2026  Paid to Bhanu  DEBIT  ₹100"
#
# We handle both forms.

_AMOUNT_RE = re.compile(r'[\u20b9$]\s*([\d,]+(?:\.\d{1,2})?)')
_DEBIT_CREDIT_RE = re.compile(r'\b(DEBIT|CREDIT)\b', re.IGNORECASE)


def _parse_phonepe_pdf_text(text: str) -> list:
    """
    Parse PhonePe statement PDF text (from pdfplumber.extract_text).
    Handles multi-line transaction blocks.
    """
    results = []
    lines = [l.strip() for l in text.splitlines()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for lines starting with a date pattern like "Feb 20, 2026"
        date_match = re.match(r'^([A-Za-z]{3}\s+\d{1,2},\s*\d{4})\s{1,}(.+)', line)
        if not date_match:
            i += 1
            continue

        raw_date = date_match.group(1).strip()   # "Feb 20, 2026"
        rest = date_match.group(2).strip()        # "Paid to Bhanu  DEBIT  ₹100" or just "Paid to Bhanu"

        # Skip obvious page footer lines
        if re.search(r'page \d+ of \d+|system generated|support\.phonepe', rest, re.IGNORECASE):
            i += 1
            continue

        # Determine type from "Paid to" / "Received from" prefix
        txn_type = None
        if re.match(r'(?i)^(paid\s+to|payment\s+to|sent\s+to|paid\s+for)\b', rest):
            txn_type = "DEBIT"
        elif re.match(r'(?i)^(received\s+from|credited\s+from|refund\s+from|cashback)\b', rest):
            txn_type = "CREDIT"

        # Extract DEBIT/CREDIT keyword from rest if present (overrides prefix inference)
        dc_match = _DEBIT_CREDIT_RE.search(rest)
        if dc_match:
            txn_type = dc_match.group(1).upper()

        # Extract amount from rest
        amt_match = _AMOUNT_RE.search(rest)
        amount = None
        if amt_match:
            try:
                amount = float(amt_match.group(1).replace(',', ''))
            except ValueError:
                pass

        # If no amount on this line, look ahead in next 4 lines
        if amount is None:
            for lookahead in lines[i + 1:i + 5]:
                m = _AMOUNT_RE.search(lookahead)
                if m:
                    try:
                        amount = float(m.group(1).replace(',', ''))
                        break
                    except ValueError:
                        pass
                # Also grab DEBIT/CREDIT from lookahead if not yet found
                if txn_type is None:
                    dc = _DEBIT_CREDIT_RE.search(lookahead)
                    if dc:
                        txn_type = dc.group(1).upper()

        # Clean merchant name from the "rest" string
        merchant = rest
        merchant = _DEBIT_CREDIT_RE.sub('', merchant).strip()
        merchant = _AMOUNT_RE.sub('', merchant).strip()
        merchant = re.sub(
            r'^(?:paid\s+to|payment\s+to|sent\s+to|paid\s+for|received\s+from|'
            r'credited\s+from|refund\s+from|cashback\s+from)\s+',
            '', merchant, flags=re.IGNORECASE
        ).strip()
        merchant = re.sub(r'[\-\u2013\u2014]+$', '', merchant).strip()
        # Remove non-ASCII characters (emojis etc.)
        merchant = re.sub(r'[^\x00-\x7F]+', '', merchant).strip()
        merchant = re.sub(r'\s+', ' ', merchant).strip()

        if not merchant:
            merchant = "PhonePe Transaction"

        # Default DEBIT if still unknown (most PhonePe UPI entries are debits)
        if txn_type is None:
            txn_type = "DEBIT"

        # Only add if we have a valid amount
        if amount and amount > 0:
            results.append({
                'description': merchant,
                'amount': round(amount, 2),
                'type': txn_type,
                'date': _parse_date(raw_date),
            })

        i += 1

    # Deduplicate
    seen = set()
    unique = []
    for t in results:
        key = (t['date'], t['description'], t['amount'], t['type'])
        if key not in seen:
            seen.add(key)
            unique.append(t)

    return unique


def _parse_pdf_text(text: str):
    """Generic fallback — works on statements with DEBIT/CREDIT on the same line as the merchant."""
    results = []
    pattern = re.compile(
        r'(?:(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\s+)?'
        r'([^\n\r]+?)\s+(DEBIT|CREDIT)\s+[\u20b9$]?([\d,]+(?:\.\d{1,2})?)',
        re.IGNORECASE
    )

    matches = pattern.findall(text)
    print(f"[PARSER] Text regex found {len(matches)} raw matches")

    for date_str, desc, txn_type, amount_str in matches:
        desc = desc.strip()
        if desc.lower() in ('transaction details', 'description', 'details', 'narration', 'particulars'):
            continue
        amount = _clean_amount(amount_str)
        if amount is None or amount == 0:
            continue
        results.append({
            "description": desc,
            "amount": amount,
            "type": txn_type.upper(),
            "date": _parse_date(date_str) if date_str else None,
        })

    return results


# ─── Header auto-fix ───────────────────────────────────────────────────────────

def _fix_header(df: pd.DataFrame) -> pd.DataFrame:
    HEADER_KEYWORDS = {
        'date', 'desc', 'narr', 'detail', 'particular', 'amount',
        'debit', 'credit', 'withdrawal', 'deposit', 'balance', 'ref',
        'remarks', 'txn', 'transaction', 'value', 'dr', 'cr', 'chq',
        'memo', 'type', 'mode', 'merchant'
    }

    cols_lower = [str(c).lower().strip() for c in df.columns]
    header_hits = sum(1 for c in cols_lower if any(kw in c for kw in HEADER_KEYWORDS))
    if header_hits >= 2:
        return df

    for i in range(min(10, len(df))):
        row = df.iloc[i]
        row_hits = sum(
            1 for cell in row
            if isinstance(cell, str) and any(kw in cell.lower() for kw in HEADER_KEYWORDS)
        )
        if row_hits >= 2:
            print(f"[PARSER] Found real header at row {i}: {list(row)}")
            new_df = df.iloc[i+1:].copy()
            new_df.columns = [str(c).strip() for c in row]
            new_df = new_df.reset_index(drop=True)
            return new_df

    return df


# ─── Column keywords ──────────────────────────────────────────────────────────

DESC_KW = [
    'description', 'desc', 'details', 'detail', 'particulars', 'particular',
    'narration', 'narr', 'remarks', 'remark', 'transaction details',
    'memo', 'note', 'payee', 'reference', 'ref', 'chq', 'cheque', 'utr',
    'info', 'mode', 'nature', 'instrument', 'beneficiary', 'remittance',
    'merchant', 'name',
]

DEBIT_KW = [
    'debit', 'withdrawal', 'withdraw', 'dr', 'expense', 'out',
    'debit amount', 'dr amount', 'paid', 'outflow', 'outgoing',
    'spent', 'disbursement',
]

CREDIT_KW = [
    'credit', 'deposit', 'cr', 'inflow', 'income',
    'credit amount', 'cr amount', 'received', 'incoming', 'receipt',
]

AMOUNT_KW = [
    'amount', 'amt', 'value', 'total', 'sum', 'money',
    'transaction amount', 'txn amount',
]

DATE_KW = [
    'date', 'txn date', 'transaction date', 'posting date',
    'value date', 'effective date', 'entry date', 'booking date',
    'trade date', 'settlement date',
]

BALANCE_KW = [
    'balance', 'bal', 'running balance', 'closing balance',
    'available balance', 'ledger balance',
]

TYPE_KW = ['type', 'txn type', 'transaction type', 'dr/cr', 'dr cr']


def _find_col(columns, keywords, exclude=None):
    exclude = exclude or []
    for col in columns:
        col_lower = col.lower().strip()
        if any(col_lower == ex for ex in exclude):
            continue
        for kw in keywords:
            if len(kw) <= 3:
                if re.search(r'\b' + re.escape(kw) + r'\b', col_lower):
                    return col
            else:
                if kw in col_lower:
                    return col
    return None


# ─── Core processor ───────────────────────────────────────────────────────────

def _process_df(df: pd.DataFrame):
    if df is None or df.empty:
        print("[PARSER] DataFrame is empty!")
        return []

    df = df.dropna(how='all').reset_index(drop=True)
    df.columns = [str(c).lower().strip() for c in df.columns]
    df = df.loc[:, ~df.columns.duplicated()]

    print(f"[PARSER] Columns: {list(df.columns)}")
    print(f"[PARSER] Rows after cleaning: {len(df)}")
    if len(df) > 0:
        try:
            sample = str(dict(df.iloc[0])).encode('ascii', errors='replace').decode('ascii')
            print(f"[PARSER] Sample row 0: {sample}")
        except Exception:
            pass

    balance_col = _find_col(df.columns, BALANCE_KW)
    exclude_list = [balance_col] if balance_col else []

    desc_col   = _find_col(df.columns, DESC_KW,    exclude=exclude_list)
    debit_col  = _find_col(df.columns, DEBIT_KW,   exclude=exclude_list)
    credit_col = _find_col(df.columns, CREDIT_KW,  exclude=exclude_list)
    amount_col = _find_col(df.columns, AMOUNT_KW,  exclude=exclude_list)
    date_col   = _find_col(df.columns, DATE_KW)
    type_col   = _find_col(df.columns, TYPE_KW)

    print(f"[PARSER] Matched → desc={desc_col}, debit={debit_col}, credit={credit_col}, amount={amount_col}, date={date_col}, type={type_col}, balance={balance_col}")

    # Fallback: find description column
    if not desc_col:
        known = {debit_col, credit_col, amount_col, date_col, balance_col, type_col}
        for col in df.columns:
            if col in known:
                continue
            sample = df[col].dropna().head(10)
            if len(sample) == 0:
                continue
            non_numeric = sum(1 for v in sample if not _is_numeric(str(v)))
            if non_numeric / len(sample) >= 0.6:
                desc_col = col
                print(f"[PARSER] Desc fallback → using '{col}'")
                break

    # Fallback: find amount column
    if not debit_col and not credit_col and not amount_col:
        known = {desc_col, date_col, balance_col, type_col}
        for col in df.columns:
            if col in known:
                continue
            sample = df[col].dropna().head(10)
            if len(sample) == 0:
                continue
            numeric_count = sum(1 for v in sample if _is_numeric(str(v)))
            if numeric_count / len(sample) >= 0.5:
                amount_col = col
                print(f"[PARSER] Amount fallback → using '{col}'")
                break

    if not desc_col:
        for col in df.columns:
            if col not in {date_col, balance_col, type_col}:
                desc_col = col
                print(f"[PARSER] Last-resort desc → using '{col}'")
                break

    results = []
    skipped = 0

    for idx, row in df.iterrows():
        try:
            amount = None
            txn_type = "DEBIT"

            if type_col and pd.notna(row.get(type_col)):
                type_val = str(row[type_col]).strip().upper()
                if 'CREDIT' in type_val:
                    txn_type = "CREDIT"
                elif 'DEBIT' in type_val:
                    txn_type = "DEBIT"

            if debit_col:
                v = row.get(debit_col)
                if pd.notna(v) and str(v).strip() not in ('', '-', '0', '0.0', 'nan'):
                    amount = _clean_amount(v)
                    if amount and amount > 0:
                        txn_type = "DEBIT"

            credit_amount = None
            if credit_col:
                v = row.get(credit_col)
                if pd.notna(v) and str(v).strip() not in ('', '-', '0', '0.0', 'nan'):
                    credit_amount = _clean_amount(v)

            if credit_amount and credit_amount > 0 and not (amount and amount > 0):
                amount = credit_amount
                txn_type = "CREDIT"

            if not amount or amount == 0:
                if amount_col:
                    v = row.get(amount_col)
                    if pd.notna(v):
                        raw_amount = _clean_amount(v)
                        if raw_amount is not None:
                            if raw_amount < 0:
                                txn_type = "CREDIT"
                                amount = abs(raw_amount)
                            else:
                                amount = raw_amount

                            if type_col and pd.notna(row.get(type_col)):
                                type_val = str(row[type_col]).strip().upper()
                                if 'CREDIT' in type_val:
                                    txn_type = "CREDIT"
                                elif 'DEBIT' in type_val:
                                    txn_type = "DEBIT"

            if amount is None or amount == 0:
                skipped += 1
                continue

            amount = abs(amount)

            if desc_col and pd.notna(row.get(desc_col)):
                desc_value = str(row[desc_col]).strip()
            else:
                parts = []
                for col in df.columns:
                    if col in {date_col, debit_col, credit_col, amount_col, balance_col, type_col}:
                        continue
                    v = row.get(col)
                    if pd.notna(v) and not _is_numeric(str(v)):
                        parts.append(str(v).strip())
                desc_value = " / ".join(parts) if parts else "Unknown"

            if not desc_value or desc_value.lower() in ('nan', 'none', '', '-'):
                desc_value = "Unknown"

            if re.search(r'^(date|description|particulars|narration|transaction details|amount|debit|credit|balance|type)$',
                         desc_value.lower().strip()):
                skipped += 1
                continue

            parsed_date = None
            if date_col and pd.notna(row.get(date_col)):
                parsed_date = _parse_date(row[date_col])

            results.append({
                "description": desc_value,
                "amount": round(abs(amount), 2),
                "type": txn_type,
                "date": parsed_date,
            })

            if debit_col and credit_col and amount > 0 and credit_amount and credit_amount > 0:
                results.append({
                    "description": desc_value,
                    "amount": round(credit_amount, 2),
                    "type": "CREDIT",
                    "date": parsed_date,
                })

        except Exception as e:
            print(f"[PARSER] Row {idx} error: {e}")
            skipped += 1

    print(f"[PARSER] Parsed {len(results)} transactions, skipped {skipped} rows")
    if results:
        try:
            sample = str(results[0]).encode('ascii', errors='replace').decode('ascii')
            print(f"[PARSER] Sample: {sample}")
        except Exception:
            pass

    return results


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _clean_amount(raw_val) -> float | None:
    if raw_val is None:
        return None
    cleaned = (
        str(raw_val)
        .replace('\u20b9', '').replace('$', '').replace('\u20ac', '').replace('\xa3', '')
        .replace(',', '').replace(' ', '').replace('\xa0', '')
        .strip()
    )
    if not cleaned or cleaned.lower() in ('nan', '', '-', 'none', 'n/a', '--', 'nil'):
        return None
    if cleaned.startswith('(') and cleaned.endswith(')'):
        cleaned = '-' + cleaned[1:-1]
    try:
        return float(cleaned)
    except ValueError:
        return None


def _is_numeric(val: str) -> bool:
    cleaned = (
        val.replace(',', '').replace('\u20b9', '').replace('$', '')
           .replace('\u20ac', '').replace('(', '').replace(')', '')
           .replace('-', '', 1).replace('\xa0', '').strip()
    )
    if not cleaned:
        return False
    try:
        float(cleaned)
        return True
    except ValueError:
        return False