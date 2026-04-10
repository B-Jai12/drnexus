"""
Phase 1 — Data Loading & Deep Cleaning
Loads all PDFs from the transaction folder, cleans descriptions,
and saves a cleaned CSV ready for labeling.
"""

import sys, io, os, re, pathlib, logging
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
logging.getLogger('pdfminer').setLevel(logging.ERROR)

import pandas as pd

# ── Add ml-service root to path ─────────────────────────────────────────────
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.services.parser import parse_statement

PDF_FOLDER   = pathlib.Path(r"C:\Users\Jai\OneDrive\Documents\transactionpdfs")
PHONEPE_XLSX = pathlib.Path(r"C:\Users\Jai\Downloads\PhonePe_Statement_Jan2026_Feb2026 (1).csv")
OUT_DIR      = ROOT / "training" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ─── Abbreviation expansion map ──────────────────────────────────────────────
ABBREVS = {
    "swgy": "swiggy", "swgy.in": "swiggy",
    "amzn": "amazon", "amzn.in": "amazon",
    "mcd": "mcdonalds", "mcdonald": "mcdonalds",
    "kfc": "kfc", "dominos": "dominos", "domino": "dominos",
    "mmt": "makemytrip", "git": "goibibo",
    "nmmt": "metro", "bmtc": "bus",
    "fk": "flipkart", "fkart": "flipkart",
    "nykaa": "nykaa", "ajio": "ajio",
}

# ─── Noise patterns to remove ────────────────────────────────────────────────
BANK_CODES  = r'\b(hdfc|icici|sbi|axis|kotak|yes|pnb|bob|boi|canara|federal|rbl|idbi|idfc|sc|citi|hsbc|dbs|au)\b'
GENERIC_WRD = r'\b(payment|transfer|txn|ref|no|neft|imps|rtgs|upi|to|from|by|via|towards|against|being|for|per|and|or|the|a|an)\b'
UPI_NOISE   = r'upi[-/]?(\w+)[-/]?\d{10,}[-/][a-z0-9@]+|@\w+|[-/]\w{8,}|vpa'
PHONE_NUM   = r'\b\d{10,}\b'
REF_IDS     = r'\b[a-z0-9]{9,}\b'   # alphanumeric refs >8 chars
EXTRA_CHARS = r'[^a-z0-9 ]'


def clean_description(raw: str) -> str:
    """9-step deep cleaning pipeline for transaction descriptions."""
    if not raw or str(raw).lower() in ('nan', 'none', ''):
        return 'unknown'

    text = str(raw).lower().strip()

    # 1. Extract merchant from UPI strings: UPI-SWIGGY-9876543210-OKAXIS → swiggy
    upi_match = re.search(r'upi[-/](\w+)', text)
    if upi_match:
        text = upi_match.group(1)

    # 2. Remove UPI / IMPS / NEFT prefixes
    text = re.sub(r'^(upi|imps|neft|rtgs|ach|nach|enach|ecs|clg)[-/:]?\s*', '', text)

    # 3. Remove phone numbers
    text = re.sub(PHONE_NUM, '', text)

    # 4. Remove transaction reference IDs (alphanumeric 9+ chars)
    text = re.sub(REF_IDS, '', text)

    # 5. Remove bank codes
    text = re.sub(BANK_CODES, '', text)

    # 6. Remove generic filler words
    text = re.sub(GENERIC_WRD, ' ', text)

    # 7. Remove non-alphanumeric characters
    text = re.sub(EXTRA_CHARS, ' ', text)

    # 8. Expand abbreviations
    words = text.split()
    words = [ABBREVS.get(w, w) for w in words]
    text = ' '.join(words)

    # 9. Strip extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text if len(text) >= 2 else 'unknown'


def load_all_transactions() -> pd.DataFrame:
    all_rows = []

    # Load PDFs
    for pdf in sorted(PDF_FOLDER.iterdir()):
        if not pdf.suffix.lower() == '.pdf':
            continue
        print(f"  Loading {pdf.name}...", flush=True)
        txns = parse_statement(str(pdf))
        if isinstance(txns, list):
            for t in txns:
                t['source_file'] = pdf.name
            all_rows.extend(txns)
            print(f"    → {len(txns)} transactions")

    # Load PhonePe xlsx-as-csv if it exists
    if PHONEPE_XLSX.exists():
        print(f"  Loading {PHONEPE_XLSX.name}...", flush=True)
        txns = parse_statement(str(PHONEPE_XLSX))
        if isinstance(txns, list):
            for t in txns:
                t['source_file'] = PHONEPE_XLSX.name
            all_rows.extend(txns)
            print(f"    → {len(txns)} transactions")

    df = pd.DataFrame(all_rows)

    # Standardize columns
    for col in ['description', 'amount', 'type', 'date', 'source_file']:
        if col not in df.columns:
            df[col] = None

    df = df[['date', 'description', 'amount', 'type', 'source_file']].copy()
    df.dropna(subset=['description', 'amount'], inplace=True)
    df.drop_duplicates(subset=['description', 'amount', 'date'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    return df


def run_phase1():
    print("\n" + "="*60)
    print("PHASE 1 — DATA LOADING & DEEP CLEANING")
    print("="*60)

    # Load
    print("\n[1/3] Loading transactions from all sources...")
    df = load_all_transactions()
    print(f"\nTotal raw transactions: {len(df)}")

    # Vocab before
    vocab_before = set()
    for desc in df['description']:
        for w in str(desc).lower().split():
            vocab_before.add(w)

    # Clean
    print("\n[2/3] Applying 9-step cleaning pipeline...")
    df['description_raw'] = df['description'].copy()
    df['description_clean'] = df['description'].apply(clean_description)

    # Vocab after
    vocab_after = set()
    for desc in df['description_clean']:
        for w in str(desc).split():
            vocab_after.add(w)

    # Stats
    print(f"\n  Vocabulary before: {len(vocab_before)} tokens")
    print(f"  Vocabulary after:  {len(vocab_after)} tokens")
    print(f"  Reduction:         {round((1 - len(vocab_after)/max(1,len(vocab_before)))*100, 1)}%")

    # Show 20 before/after examples
    print("\n  Sample before → after cleaning (20 examples):")
    print(f"  {'RAW':<45} → {'CLEANED'}")
    print("  " + "-"*80)
    for _, row in df.head(20).iterrows():
        raw = str(row['description_raw'])[:44]
        cln = str(row['description_clean'])[:35]
        print(f"  {raw:<45} → {cln}")

    # Most common tokens
    from collections import Counter
    token_counts = Counter()
    for desc in df['description_clean']:
        for w in str(desc).split():
            token_counts[w] += 1
    print(f"\n  Top 15 tokens after cleaning:")
    for tok, cnt in token_counts.most_common(15):
        print(f"    {tok:<25} {cnt}")

    # Save
    out_path = OUT_DIR / "phase1_cleaned.csv"
    df.to_csv(out_path, index=False, encoding='utf-8-sig')
    print(f"\n[3/3] Saved cleaned data → {out_path}")
    print(f"      Total rows: {len(df)}")

    print("\n✅ Phase 1 complete!\n")
    return df


if __name__ == '__main__':
    run_phase1()
