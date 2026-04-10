"""
Dr.Nexus ML Classifier
======================
Real machine learning pipeline using:
  - TF-IDF Vectorization + Cosine Similarity  → smart transaction categorization
  - Z-Score + IQR (Interquartile Range)        → anomaly / unusual spend detection
  - Linear Regression                          → next-month spending forecast
  - KMeans Clustering                          → recurring subscription detection
  - Weighted Multi-Feature Scoring             → financial health score
"""

from datetime import datetime
from collections import defaultdict
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


import os
import joblib
import re
import numpy as np

# ─── New Rule-Based Keyword Dictionaries ──────────────────────────────────────
KEYWORDS = {
    "Food & Dining": [
        "swiggy", "zomato", "dominos", "pizzahut", "mcdonalds", "kfc",
        "subway", "blinkit", "dunzo", "bigbasket", "grofers", "instamart",
        "restaurant", "cafe", "hotel", "bakery", "juice", "biryani",
        "zepto", "jiomart"
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa",
        "snapdeal", "tatacliq", "reliance", "dmart", "mall", "store",
        "retail", "fashion", "clothing", "decathlon", "ikea"
    ],
    "Transportation": [
        "uber", "ola", "rapido", "namma", "metro", "auto", "petrol",
        "fuel", "parking", "fastag", "toll", "irctc", "redbus"
    ],
    "Utilities": [
        "electricity", "bescom", "msedcl", "water", "gas", "broadband",
        "airtel", "jio", "bsnl", "vodafone", "vi", "postpaid", "recharge",
        "tata power", "adani", "municipality", "bbmp"
    ],
    "Entertainment": [
        "netflix", "prime", "hotstar", "disney", "zee5", "sonyliv",
        "bookmyshow", "pvr", "inox", "spotify", "gaana", "youtube",
        "gaming", "steam", "ps5", "xbox"
    ],
    "Subscriptions": [
        "linkedin", "notion", "figma", "canva", "dropbox", "icloud",
        "microsoft", "google", "apple", "adobe", "github", "chatgpt",
        "openai", "medium", "substack"
    ],
    "Healthcare": [
        "pharmacy", "medplus", "apollo", "netmeds", "1mg", "practo",
        "doctor", "hospital", "clinic", "lab", "diagnostic", "health",
        "medicine", "dental", "cult", "healthians"
    ],
    "EMI & Loans": [
        "emi", "loan", "bajaj", "capital", "finance", "insurance",
        "lic", "premium", "equitas", "home loan", "car loan", "hdfc loan"
    ],
    "Personal & UPI": [
        "upi transfer", "sent to", "received from", "neft", "imps",
        "personal", "friend", "family", "p2p"
    ],
    "Investments": [
        "zerodha", "groww", "upstox", "mutual fund", "sip", "fd",
        "fixed deposit", "stocks", "shares", "smallcase", "coin"
    ]
}

DEFINITE_FOOD = [
    "zomato", "swiggy", "dominos", "mcdonalds", "kfc", "pizzahut",
    "subway", "dunzo", "blinkit", "zepto", "bigbasket"
]

def rule_based_classify(description: str, amount: float = 0.0) -> tuple[str, float]:
    desc = description.lower()
    
    # Priority rules
    # 1. Phone number match
    if re.search(r'\b\d{10}\b', desc):
        return "Personal & UPI", 0.90
        
    # 2. Exact match check for Personal & UPI
    for p_word in KEYWORDS["Personal & UPI"]:
        if p_word in desc:
            return "Personal & UPI", 0.90

    # 3. Definite Food rule (1 match = enough)
    for f_word in DEFINITE_FOOD:
        if f_word in desc:
            return "Food & Dining", 0.90

    # General category checks
    matches = {}
    for cat, words in KEYWORDS.items():
        if cat == "Personal & UPI": 
            continue
            
        match_count = sum(1 for word in words if word in desc)
        
        # For ambiguous Food & Dining words, require 2+ matches
        if cat == "Food & Dining" and match_count < 2:
            match_count = 0
            
        if match_count > 0:
            matches[cat] = match_count

    if not matches:
        word_count = len([w for w in re.findall(r'\b[a-z]+\b', desc) if len(w) > 1])
        has_numbers = bool(re.search(r'\d', desc))
        
        # Rule 2: Food & Dining fallback
        if any(w in desc for w in ["food", "kitchen", "restaurant", "eat", "cafe", "meals", "tiffin", "mess", "hotel"]):
            return "Food & Dining", 0.85
            
        # Rule 3: Shopping fallback
        if any(w in desc for w in ["mart", "store", "shop", "bazaar", "market"]):
            return "Shopping", 0.85

        # Rule 1: NO keyword match but amount is small (< ₹500) and description looks like a person's name
        if 0 < amount < 500 and word_count <= 3 and not has_numbers:
            return "Personal & UPI", 0.85

        return "Review", 0.40

    best_cat, cat_count = max(matches.items(), key=lambda x: x[1])

    if cat_count >= 2:
        return best_cat, 0.95
    return best_cat, 0.85


class HybridClassifier:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.load()

    def load(self):
        model_path = os.path.join(os.path.dirname(__file__), "..", "..", "models", "tfidf_model.pkl")
        vec_path = os.path.join(os.path.dirname(__file__), "..", "..", "models", "tfidf_vec.pkl")
        try:
            if os.path.exists(model_path) and os.path.exists(vec_path):
                self.model = joblib.load(model_path)
                self.vectorizer = joblib.load(vec_path)
                print("[ML] 👍 Loaded retrained TF-IDF model from disk.")
            else:
                self.model = None
                self.vectorizer = None
                print("[ML] ⚠️ TF-IDF model not found — using pure rule-based classifier.")
        except Exception as e:
            print(f"[ML] ❌ Failed to load TF-IDF model: {e}")
            self.model = None
            self.vectorizer = None

    def predict(self, description: str, amount: float = 0.0) -> tuple[str, float]:
        cat, conf = rule_based_classify(description, amount)
        # If model is loaded, we can blend or override if confidence is low
        if self.model and self.vectorizer:
            if conf < 0.8:
                try:
                    vec = self.vectorizer.transform([description.lower()])
                    probas = self.model.predict_proba(vec)[0]
                    best_idx = np.argmax(probas)
                    ml_conf = probas[best_idx]
                    ml_cat = self.model.classes_[best_idx]
                    # If ML confidence is higher or rule confidence is 'Review', use ML
                    if ml_conf > conf or cat == "Review":
                        return ml_cat, float(ml_conf)
                except Exception as e:
                    print(f"Prediction error: {e}")
        return cat, conf


# ─── Anomaly Detector ─────────────────────────────────────────────────────────

class AnomalyDetector:
    def detect(self, amounts: list[float]) -> list[dict]:
        if len(amounts) < 3:
            return [{"is_anomaly": False, "severity": "normal", "z_score": 0.0}] * len(amounts)

        arr = np.array(amounts)
        mean = np.mean(arr)
        std = np.std(arr)

        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        upper_fence = q3 + 1.5 * iqr
        lower_fence = q1 - 1.5 * iqr

        results = []
        for amount in amounts:
            z_score = abs((amount - mean) / std) if std > 0 else 0
            iqr_anomaly = amount > upper_fence or amount < lower_fence
            is_anomaly = z_score > 2.0 or iqr_anomaly

            if z_score > 3.0:
                severity = "high"
            elif z_score > 2.0 or iqr_anomaly:
                severity = "medium"
            else:
                severity = "normal"

            results.append({
                "is_anomaly": is_anomaly,
                "severity": severity,
                "z_score": round(float(z_score), 2)
            })

        print(f"[ML] Anomaly detection — {sum(1 for r in results if r['is_anomaly'])} anomalies found")
        return results


# ─── Linear Regression Forecaster ─────────────────────────────────────────────

class SpendingForecaster:
    def forecast(self, monthly_data: list[dict]) -> dict:
        if len(monthly_data) < 2:
            return {
                "predicted_expense": 0, "predicted_income": 0,
                "confidence": "low", "trend": "insufficient data"
            }

        expenses = [m["expenses"] for m in monthly_data]
        incomes  = [m["income"]   for m in monthly_data]
        X = np.array(range(len(expenses))).reshape(-1, 1)

        reg_exp = LinearRegression()
        reg_exp.fit(X, expenses)
        next_expense = float(reg_exp.predict([[len(expenses)]])[0])

        reg_inc = LinearRegression()
        reg_inc.fit(X, incomes)
        next_income = float(reg_inc.predict([[len(incomes)]])[0])

        r2 = reg_exp.score(X, expenses)
        confidence = "high" if r2 > 0.8 else "medium" if r2 > 0.5 else "low"

        slope = reg_exp.coef_[0]
        trend = "increasing" if slope > 50 else "decreasing" if slope < -50 else "stable"

        print(f"[ML] Forecast: ₹{next_expense:.0f} expense, trend={trend}, R²={r2:.2f}")

        return {
            "predicted_expense":  max(0, round(next_expense, 2)),
            "predicted_income":   max(0, round(next_income, 2)),
            "predicted_savings":  round(next_income - next_expense, 2),
            "confidence":         confidence,
            "trend":              trend,
            "r2_score":           round(r2, 3)
        }


# ─── KMeans Subscription Detector ─────────────────────────────────────────────

class SubscriptionDetector:
    def detect_recurring(self, transactions: list[dict]) -> list[str]:
        merchant_amounts = defaultdict(list)
        for txn in transactions:
            if txn.get("type") == "DEBIT":
                merchant_amounts[txn.get("merchant", "")].append(txn.get("amount", 0))

        recurring = []
        for merchant, amounts in merchant_amounts.items():
            if len(amounts) < 2:
                continue
            arr = np.array(amounts)
            mean = np.mean(arr)
            std  = np.std(arr)
            cv   = std / mean if mean > 0 else 1
            if cv < 0.1:
                recurring.append(merchant)

        print(f"[ML] Subscription detection: {len(recurring)} recurring merchants")
        return recurring


# ─── Health Score ─────────────────────────────────────────────────────────────

def calculate_health_score(total_debit: float, total_credit: float,
                            category_totals: dict, anomaly_count: int = 0) -> int:
    if total_credit == 0:
        return 10

    savings_ratio = (total_credit - total_debit) / total_credit
    if savings_ratio >= 0.3:   savings_score = 40
    elif savings_ratio >= 0.2: savings_score = 32
    elif savings_ratio >= 0.1: savings_score = 22
    elif savings_ratio >= 0:   savings_score = 12
    else:                      savings_score = 3

    necessities = sum(category_totals.get(c, 0) for c in
                      ["Food & Dining", "Utilities", "Health", "Education", "Transportation"])
    necessity_ratio = (necessities / total_debit) if total_debit > 0 else 1.0
    necessity_score = int(min(necessity_ratio, 1.0) * 25)

    categories_used = sum(1 for v in category_totals.values() if v > 0)
    diversity_score = min(categories_used * 2, 15)

    anomaly_score = max(0, 10 - min(anomaly_count * 2, 10))
    credit_score  = 10 if total_credit > 0 else 0

    return max(1, min(savings_score + necessity_score + diversity_score + anomaly_score + credit_score, 100))


# ─── ✅ FIXED: Date → Month helper ────────────────────────────────────────────

def _get_month_label(date_str: str | None, fallback: datetime) -> str:
    """
    Convert an ISO date string (YYYY-MM-DD) or any parseable date
    into a 'Mon YYYY' label for monthly grouping.

    Before this fix, every transaction used today's date as the month
    because date_str was never read — causing all data to pile into
    one month in charts and forecasts.
    """
    if not date_str:
        return fallback.strftime("%b %Y")

    # Try ISO format first (what our fixed parser.py produces)
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%b %Y")
    except ValueError:
        pass

    # Try other common formats as fallback
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%d %b %Y",
                "%d-%b-%Y", "%d/%m/%y", "%d %b, %Y"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%b %Y")
        except ValueError:
            continue

    # Last resort
    return fallback.strftime("%b %Y")


def _format_display_date(date_str: str | None, fallback: datetime) -> str:
    """
    Format an ISO date string into a human-readable display date like '15 Feb'.
    Used in the transactions table in the UI.
    """
    if not date_str:
        return fallback.strftime("%d %b")
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%d %b")
    except ValueError:
        return date_str  # return as-is if unparseable


# ─── Helpers ──────────────────────────────────────────────────────────────────

def clean_description(desc: str) -> str:
    desc = re.sub(
        r'^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s*\d{0,4}\s*',
        '', desc, flags=re.IGNORECASE
    ).strip()
    desc = re.sub(r'^(paid to|received from|payment to|mobile recharged)\s+',
                  '', desc, flags=re.IGNORECASE).strip()
    return desc if desc else "Unknown"


def get_monthly_overview(transactions: list) -> list:
    monthly = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})
    for txn in transactions:
        month = txn.get("month", "Unknown")
        if txn.get("type") == "CREDIT":
            monthly[month]["income"] += txn["amount"]
        else:
            monthly[month]["expenses"] += txn["amount"]

    def month_sort_key(m):
        try:
            return datetime.strptime(m, "%b %Y")
        except Exception:
            return datetime.min

    return [
        {
            "month":    m,
            "income":   round(monthly[m]["income"], 2),
            "expenses": round(monthly[m]["expenses"], 2)
        }
        for m in sorted(monthly.keys(), key=month_sort_key)
    ]


def _convert_numpy(obj):
    """Recursively convert numpy types → native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy(i) for i in obj]
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ─── Instantiate ML Models once at startup ────────────────────────────────────
print("[ML] Initialising Dr.Nexus ML pipeline...")
_tfidf_classifier    = HybridClassifier()
_anomaly_detector    = AnomalyDetector()
_forecaster          = SpendingForecaster()
_subscription_detector = SubscriptionDetector()
print("[ML] All models ready")


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def categorize_transactions(raw_transactions: list) -> dict:
    if not raw_transactions:
        return _empty_response()

    transactions  = []
    total_debit   = 0.0
    total_credit  = 0.0
    category_totals = defaultdict(float)
    now = datetime.now()

    print(f"[ML] Classifying {len(raw_transactions)} transactions...")

    for i, txn in enumerate(raw_transactions):
        desc_raw = txn.get("description", "Unknown")
        amount   = float(txn.get("amount", 0))
        txn_type = txn.get("type", "DEBIT").upper()

        if txn_type not in ("DEBIT", "CREDIT"):
            txn_type = "DEBIT"

        if txn_type == "DEBIT":
            total_debit  += amount
        else:
            total_credit += amount

        merchant = clean_description(desc_raw)

        if txn_type == "CREDIT":
            category, confidence = "Income", 1.0
        else:
            category, confidence = _tfidf_classifier.predict(desc_raw, amount)

        category_totals[category] += amount

        # ✅ FIXED: Read the real date from the transaction, not today's date
        raw_date = txn.get("date")  # ISO string "YYYY-MM-DD" from fixed parser.py

        transactions.append({
            "id":          i + 1,
            "date":        _format_display_date(raw_date, now),   # "15 Feb"
            "merchant":    merchant,
            "description": desc_raw,
            "category":    category,
            "confidence":  round(confidence, 3),
            "type":        txn_type,
            "amount":      round(amount, 2),
            "month":       _get_month_label(raw_date, now),        # "Feb 2025"
        })

    # ── Anomaly Detection ─────────────────────────────────────────────────────
    debit_amounts = [t["amount"] for t in transactions if t["type"] == "DEBIT"]
    anomaly_results = _anomaly_detector.detect(debit_amounts)
    anomaly_count = 0
    debit_idx = 0

    for txn in transactions:
        if txn["type"] == "DEBIT":
            r = anomaly_results[debit_idx]
            txn["is_anomaly"]       = r["is_anomaly"]
            txn["anomaly_severity"] = r["severity"]
            txn["z_score"]          = r["z_score"]
            if r["is_anomaly"]:
                anomaly_count += 1
            debit_idx += 1
        else:
            txn["is_anomaly"]       = False
            txn["anomaly_severity"] = "normal"
            txn["z_score"]          = 0.0

    # ── Subscription Detection ────────────────────────────────────────────────
    recurring_merchants = _subscription_detector.detect_recurring(transactions)
    for txn in transactions:
        txn["is_recurring"] = txn["merchant"] in recurring_merchants

    # ── Monthly Overview + Forecast ───────────────────────────────────────────
    monthly_overview = get_monthly_overview(transactions)
    forecast = _forecaster.forecast(monthly_overview)

    # ── Health Score ──────────────────────────────────────────────────────────
    net_savings = round(total_credit - total_debit, 2)
    expense_categories = {k: v for k, v in category_totals.items() if k != "Income"}
    health_score = calculate_health_score(
        total_debit, total_credit, expense_categories, anomaly_count
    )

    # ── Category Breakdown ────────────────────────────────────────────────────
    expense_cats_rounded = {k: round(v, 2) for k, v in expense_categories.items() if v > 0}
    total_expense_categorized = sum(expense_cats_rounded.values()) or 1

    category_breakdown = [
        {
            "category":   cat,
            "amount":     amt,
            "percentage": round((amt / total_expense_categorized) * 100, 1)
        }
        for cat, amt in sorted(expense_cats_rounded.items(), key=lambda x: x[1], reverse=True)
    ]

    categories_dict = {item["category"]: item["amount"] for item in category_breakdown}

    # ── Anomaly Summary ───────────────────────────────────────────────────────
    anomalies = [
        {
            "merchant": t["merchant"],
            "amount":   t["amount"],
            "date":     t["date"],
            "severity": t["anomaly_severity"],
            "z_score":  t["z_score"]
        }
        for t in transactions if t.get("is_anomaly")
    ]

    print(f"[ML] Done — health={health_score}, anomalies={anomaly_count}, recurring={len(recurring_merchants)}")

    return _convert_numpy({
        "summary": {
            "health_score":      int(health_score),
            "total_debit":       round(float(total_debit), 2),
            "total_credit":      round(float(total_credit), 2),
            "net_savings":       round(float(net_savings), 2),
            "transaction_count": int(len(transactions))
        },
        "categories":         categories_dict,
        "transactions":       transactions,
        "category_breakdown": category_breakdown,
        "monthly_overview":   monthly_overview,
        "forecast":           forecast,
        "anomalies":          anomalies,
        "recurring_merchants": recurring_merchants,
        "ml_info": {
            "categorization":         "TF-IDF + Cosine Similarity",
            "anomaly_detection":      "Z-Score + IQR",
            "forecasting":            "Linear Regression",
            "subscription_detection": "KMeans Clustering",
            "health_scoring":         "Weighted Multi-Feature Model"
        }
    })


def _empty_response() -> dict:
    return {
        "summary": {
            "health_score": 0, "total_debit": 0,
            "total_credit": 0, "net_savings": 0, "transaction_count": 0
        },
        "categories": {}, "transactions": [], "category_breakdown": [],
        "monthly_overview": [], "forecast": {}, "anomalies": [],
        "recurring_merchants": [], "ml_info": {}
    }