"""
Phase 2 — Smart Auto-Labeling
Applies keyword-based labeling with confidence scoring.
Exports labeled.csv and review_needed.csv, then PAUSES.
"""

import sys, io, pathlib, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd

ROOT    = pathlib.Path(__file__).resolve().parent.parent
DATA    = ROOT / "training" / "data"
OUT_DIR = DATA

CATEGORIES = {
    "Food": [
        "swiggy", "zomato", "dominos", "pizzahut", "pizza hut", "mcdonalds", "mcdonald",
        "kfc", "subway", "blinkit", "dunzo", "bigbasket", "big basket", "grofers",
        "instamart", "restaurant", "cafe", "dhaba", "hotel", "bakery", "juice",
        "biryani", "burger", "chaiwala", "chai", "coffee", "haldiram", "haldirams",
        "amul", "milkbasket", "zepto", "jiomart", "spar", "foodpanda", "baskin",
        "naturals", "ice cream", "fruit", "canteen", "mess", "tiffin", "lunch",
        "dinner", "breakfast", "grocery", "vegetables", "meat", "fish", "chicken",
        "mutton", "eatery", "dabba", "paratha", "dosa",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa", "snapdeal",
        "shopclues", "tatacliq", "tata cliq", "reliance", "dmart", "d-mart",
        "mall", "store", "retail", "fashion", "clothing", "shoes", "apparel",
        "garment", "boutique", "zudio", "westside", "max fashion", "v-mart",
        "pantaloons", "lifestyle", "shoppers stop", "buy", "purchase",
        "trendyol", "bewakoof", "fabindia", "silk", "cotton", "jeans", "shirt",
        "kurti", "saree", "watch", "jewel", "electronics", "mobile", "laptop",
        "headphone", "earphone", "charger", "cable", "case", "cover",
    ],
    "Travel": [
        "makemytrip", "goibibo", "irctc", "yatra", "cleartrip", "booking",
        "airbnb", "flight", "train", "bus", "spicejet", "indigo", "airindia",
        "air india", "vistara", "akasa", "redbus", "abhibus", "oyo", "treebo",
        "fabhotels", "goair", "bluedart", "dhl", "fedex", "dtdc",
        "ixigo", "railyatri", "railofy", "traveller", "airport", "terminal",
        "lounge", "checkin", "baggage", "luggage", "cab booking",
    ],
    "Transport": [
        "uber", "ola", "rapido", "namma metro", "metro", "auto", "autorickshaw",
        "petrol", "fuel", "diesel", "cng", "parking", "fastag", "toll",
        "honda", "bajaj", "tvs", "hero", "yamaha", "suzuki", "hyundai",
        "maruti", "tata motors", "service station", "indian oil", "hp petrol",
        "bharat petroleum", "iocl", "hpcl", "bpcl", "shell", "essar",
        "e-rickshaw", "rickshaw", "bike", "cycle", "taxi", "cab", "ride",
        "commute", "shuttle", "bus pass", "monthly pass",
    ],
    "Bills": [
        "electricity", "bescom", "msedcl", "tsspdcl", "apspdcl", "tangedco",
        "cesc", "water", "gas", "lpg", "piped gas", "mgl", "igl", "broadband",
        "airtel", "jio", "bsnl", "vodafone", "vi ", "idea", "postpaid",
        "prepaid", "recharge", "dth", "tatasky", "tata sky", "dish tv",
        "dishtv", "sun direct", "d2h", "municipality", "property tax",
        "maintenance", "society", "rent", "wifi", "internet", "landline",
        "insurance premium", "health insurance", "life insurance",
    ],
    "Entertainment": [
        "netflix", "prime video", "hotstar", "disney", "zee5", "sonyliv",
        "sony liv", "bookmyshow", "pvr", "inox", "spotify", "gaana",
        "youtube", "gaming", "steam", "playstation", "xbox", "nintendo",
        "epic games", "pubg", "bgmi", "valorant", "free fire", "game",
        "cinema", "movie", "theatre", "concert", "event", "ticket", "show",
        "park", "amusement", "bowling", "esports", "loot", "junglee",
        "mxplayer", "hungama", "colors", "voot", "jiocinema",
    ],
    "Subscriptions": [
        "linkedin", "notion", "figma", "canva", "dropbox", "icloud",
        "microsoft", "office365", "google workspace", "apple", "adobe",
        "github", "chatgpt", "openai", "medium", "substack", "coursera",
        "udemy", "unacademy", "byju", "toppr", "khan academy", "duolingo",
        "grammarly", "1password", "lastpass", "zoom", "slack", "jira",
        "confluence", "trello", "asana", "monday", "notion",
        "prime membership", "membership", "subscription", "annual plan",
        "monthly plan", "renewal", "auto-renewal",
    ],
    "Healthcare": [
        "pharmacy", "medplus", "apollo pharmacy", "apollo", "netmeds", "1mg",
        "practo", "doctor", "hospital", "clinic", "lab", "diagnostic",
        "health", "medicine", "dental", "teeth", "eye", "optical",
        "lens", "spectacle", "pathology", "scan", "mri", "xray", "x-ray",
        "blood test", "test", "thyrocare", "lal path", "dr lal",
        "medlife", "pharmeasy", "tata health", "max hospital", "fortis",
        "manipal", "care hospital", "nimhans", "vaccine", "vaccination",
        "covid", "icu", "operation", "surgery", "chemist",
    ],
    "EMI/Loans": [
        "emi", "loan", "bajaj finance", "capital first", "equitas",
        "muthoot", "manappuram", "finance", "hdfc loan", "icici loan",
        "sbi loan", "home loan", "car loan", "personal loan", "gold loan",
        "installment", "repayment", "bajaj", "credit card", "credit card payment",
        "cibil", "lic", "life insurance corporation", "premium", "policy",
        "sip", "mutual fund", "ppf", "elss", "fd", "lumpsum",
        "nps", "pension", "provident fund", "epf", "gratuity",
        "debt", "overdue", "dues", "ecs mit", "nach debit",
    ],
    "Miscellaneous": [
        "atm", "cash", "withdrawal", "deposit", "cheque", "dd",
        "demand draft", "refund", "cashback", "reward", "bank charge",
        "interest", "penalty", "late fee", "bounce", "return", "reversal",
        "unknown", "misc", "other", "general", "money", "fund",
        "salary", "wages", "income", "bonus", "stipend", "freelance",
        "commission", "dividend", "gift", "wallet", "paytm", "mobikwik",
        "freecharge", "phonepe wallet", "googlepay", "gpay", "cred",
    ],
}


def label_transaction(desc_clean: str) -> tuple[str | None, int, list[str]]:
    """
    Returns (category, match_count, matched_keywords).
    match_count > 1 means high confidence.
    """
    desc = str(desc_clean).lower()
    best_cat    = None
    best_count  = 0
    best_kws    = []

    for cat, keywords in CATEGORIES.items():
        matched = [kw for kw in keywords if kw in desc]
        if len(matched) > best_count:
            best_count = len(matched)
            best_cat   = cat
            best_kws   = matched

    return best_cat, best_count, best_kws


def run_phase2(df: pd.DataFrame = None) -> pd.DataFrame:
    print("\n" + "="*60)
    print("PHASE 2 — SMART AUTO-LABELING")
    print("="*60)

    if df is None:
        csv_path = DATA / "phase1_cleaned.csv"
        if not csv_path.exists():
            raise FileNotFoundError("Run phase1_clean.py first!")
        df = pd.read_csv(csv_path, encoding='utf-8-sig')

    df['category']         = None
    df['match_count']      = 0
    df['matched_keywords'] = ''
    df['needs_review']     = False

    for idx, row in df.iterrows():
        desc = str(row.get('description_clean', row.get('description', '')))
        cat, count, kws = label_transaction(desc)

        if count >= 1:
            df.at[idx, 'category']         = cat
            df.at[idx, 'match_count']      = count
            df.at[idx, 'matched_keywords'] = ', '.join(kws)
        else:
            # Also try on raw description
            desc_raw = str(row.get('description_raw', row.get('description', '')))
            cat2, count2, kws2 = label_transaction(desc_raw.lower())
            if count2 >= 1:
                df.at[idx, 'category']         = cat2
                df.at[idx, 'match_count']      = count2
                df.at[idx, 'matched_keywords'] = ', '.join(kws2)
            else:
                df.at[idx, 'needs_review'] = True

    labeled    = df[~df['needs_review']].copy()
    review     = df[df['needs_review']].copy()

    # Coverage report
    total       = len(df)
    auto_count  = len(labeled)
    rev_count   = len(review)
    print(f"\n  Total transactions:  {total}")
    print(f"  Auto-labeled:        {auto_count} ({round(auto_count/total*100, 1)}%)")
    print(f"  Needs review:        {rev_count} ({round(rev_count/total*100, 1)}%)")

    print("\n  Category distribution (auto-labeled):")
    if not labeled.empty:
        cats = labeled['category'].value_counts()
        for cat, cnt in cats.items():
            bar = '█' * (cnt // 2)
            print(f"    {cat:<20} {cnt:>4}  {bar}")

    # Save labeled
    labeled_path = DATA / "phase2_labeled.csv"
    labeled.to_csv(labeled_path, index=False, encoding='utf-8-sig')
    print(f"\n  Saved labeled data → {labeled_path}")

    # Save review_needed
    review_cols = ['description_raw', 'description_clean', 'amount', 'type', 'date', 'source_file']
    review_cols = [c for c in review_cols if c in review.columns]
    review_export = review[review_cols].copy()
    review_export['category'] = ''   # User fills this column
    review_export['notes']    = ''   # Optional notes

    review_path = DATA / "review_needed.csv"
    review_export.to_csv(review_path, index=False, encoding='utf-8-sig')
    print(f"  Saved review file  → {review_path}")

    # ── PAUSE GATE ──────────────────────────────────────────────────────────
    if rev_count > 0:
        print("\n" + "╔" + "═"*58 + "╗")
        print("║  ⏸  PAUSE — MANUAL LABELING REQUIRED                    ║")
        print("╠" + "═"*58 + "╣")
        print("║                                                          ║")
        print("║  1. Open this file in Excel / VS Code:                   ║")
        print(f"║     {str(review_path)[:50]:<50}  ║")
        print("║                                                          ║")
        print("║  2. Fill the empty 'category' column for each row.       ║")
        print("║     Valid values:                                        ║")
        print("║     Food, Shopping, Travel, Transport, Bills,            ║")
        print("║     Entertainment, Subscriptions, Healthcare,            ║")
        print("║     EMI/Loans, Miscellaneous                             ║")
        print("║                                                          ║")
        print("║  3. Save the file (keep the same filename)               ║")
        print("║                                                          ║")
        print("║  4. Come back and run:                                   ║")
        print("║     python training/run_all.py --from-phase 3            ║")
        print("║                                                          ║")
        print("╚" + "═"*58 + "╝")
        print(f"\nPreview of {min(10, rev_count)} rows needing review:")
        print(review_export[['description_raw', 'amount', 'type']].head(10).to_string(index=False))
    else:
        print("\n  ✅ All transactions auto-labeled! Skipping manual review.")

    print("\n✅ Phase 2 complete!\n")
    return labeled, review_export


if __name__ == '__main__':
    labeled, review = run_phase2()
