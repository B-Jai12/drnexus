# services/recommender.py
"""
Dr.Nexus — Gemini AI Recommendations Engine
============================================
Generates personalised financial recommendations using Google Gemini AI.
Smart UPI-aware prompt that correctly handles:
  - Peer-to-peer transfers (friends, family) vs real income
  - Student spending patterns (food courts, Zepto, Zomato, recharges)
  - Accurate savings calculations based on actual spend data
  - Subscription detection with correct annual savings math
"""

import os
import json
import traceback
from google import genai

# ── Configure Gemini ──────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
    print("[GEMINI] Client initialized")
else:
    print("[GEMINI] WARNING: GEMINI_API_KEY not set in .env")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def generate_recommendations(analysis_result: dict) -> dict:
    """
    Takes the full ML analysis result and returns Gemini AI recommendations.
    Falls back to rule-based recommendations if Gemini is unavailable.
    """
    if not GEMINI_API_KEY:
        print("[GEMINI] No API key — using rule-based fallback")
        return _rule_based_fallback(analysis_result)

    try:
        prompt = _build_prompt(analysis_result)
        response_text = _call_gemini(prompt)
        recommendations = _parse_response(response_text, analysis_result)
        print(f"[GEMINI] Generated {len(recommendations.get('items', []))} recommendations")
        return recommendations
    except Exception as e:
        print(f"[GEMINI] Error: {e}")
        traceback.print_exc()
        print("[GEMINI] Falling back to rule-based recommendations")
        return _rule_based_fallback(analysis_result)


# ─────────────────────────────────────────────────────────────────────────────
# SMART INCOME CLASSIFIER
# Separates real income from UPI peer transfers before building the prompt
# ─────────────────────────────────────────────────────────────────────────────

# Keywords that indicate family/friend transfers — NOT real income
_PEER_KEYWORDS = [
    "mummy", "mama", "dad", "papa", "father", "mother", "mom",
    "bhai", "didi", "anna", "akka", "uncle", "aunty",
    "friend", "mru", "panda", "manoj", "revanth", "vijji",
    "sharanyaa", "charan", "rajji", "bhanu", "amit", "vamshi",
    "pradeep", "pushpa", "naga", "akshaya", "bodduluri",
    "prince", "bhavadeep", "chimpanzee", "google pay", "cashback",
    "phonepe", "refund", "reversal"
]

# Keywords that indicate genuine income
_INCOME_KEYWORDS = [
    "salary", "stipend", "freelance", "payment received", "client",
    "neft", "rtgs", "employer", "payroll", "wages"
]


def _classify_income(transactions: list, total_credit: float) -> dict:
    """
    Analyses credit transactions to estimate real income vs peer transfers.
    Returns a dict with real_income, peer_transfers, cashback amounts.
    """
    real_income = 0.0
    peer_transfers = 0.0
    cashback = 0.0

    for txn in transactions:
        if txn.get("type", "").upper() != "CREDIT":
            continue

        amt = float(txn.get("amount", 0))
        merchant = (txn.get("merchant", "") or txn.get("description", "")).lower()

        if any(kw in merchant for kw in ["cashback", "phonepe reward", "google pay reward"]):
            cashback += amt
        elif any(kw in merchant for kw in _PEER_KEYWORDS):
            peer_transfers += amt
        elif any(kw in merchant for kw in _INCOME_KEYWORDS):
            real_income += amt
        else:
            # Ambiguous — treat large recurring credits as potential income
            # Small one-off credits from unknown sources → peer transfer
            if amt >= 5000:
                real_income += amt
            else:
                peer_transfers += amt

    # If we couldn't identify any real income, use the largest single credit
    # as a proxy (common for students receiving monthly pocket money)
    if real_income == 0 and total_credit > 0:
        real_income = total_credit  # fallback — let Gemini sort it out

    return {
        "real_income": round(real_income, 2),
        "peer_transfers": round(peer_transfers, 2),
        "cashback": round(cashback, 2),
    }


def _extract_food_delivery_spend(transactions: list) -> dict:
    """Break down food delivery apps separately for accurate recommendations."""
    FOOD_DELIVERY_APPS = {
        "zomato": 0.0,
        "swiggy": 0.0,
        "blinkit": 0.0,
        "zepto": 0.0,
        "zeptonow": 0.0,
    }
    total = 0.0

    for txn in transactions:
        if txn.get("type", "").upper() != "DEBIT":
            continue
        merchant = (txn.get("merchant", "") or "").lower()
        amt = float(txn.get("amount", 0))
        for app in FOOD_DELIVERY_APPS:
            if app in merchant:
                FOOD_DELIVERY_APPS[app] += amt
                total += amt
                break

    return {k: round(v, 2) for k, v in FOOD_DELIVERY_APPS.items() if v > 0}, round(total, 2)


def _extract_subscriptions(transactions: list) -> list:
    """Find real subscription payments with their actual amounts."""
    SUB_KEYWORDS = {
        "spotify": "Spotify",
        "netflix": "Netflix",
        "amazon prime": "Amazon Prime",
        "hotstar": "Disney+ Hotstar",
        "youtube": "YouTube Premium",
        "google one": "Google One",
        "apple": "Apple",
        "jio": "Jio",
        "airtel": "Airtel",
    }
    found = {}

    for txn in transactions:
        if txn.get("type", "").upper() != "DEBIT":
            continue
        merchant = (txn.get("merchant", "") or "").lower()
        amt = float(txn.get("amount", 0))
        for kw, label in SUB_KEYWORDS.items():
            if kw in merchant and amt > 0:
                if label not in found:
                    found[label] = {"amounts": [], "label": label}
                found[label]["amounts"].append(amt)

    # Calculate monthly cost for each subscription
    result = []
    for label, info in found.items():
        amounts = info["amounts"]
        avg_monthly = sum(amounts) / max(len(amounts), 1)
        annual_cost = avg_monthly * 12
        # Approximate annual plan savings (typically 15-25% cheaper)
        annual_plan_cost = avg_monthly * 10  # ~2 months free
        annual_savings = round(annual_cost - annual_plan_cost)
        result.append({
            "name": label,
            "monthly_cost": round(avg_monthly),
            "annual_cost": round(annual_cost),
            "switch_to_annual_saves": annual_savings,
            "occurrences": len(amounts),
        })

    return result


def _get_top_merchants_by_spend(transactions: list, top_n: int = 8) -> list:
    """Aggregate debit spend per merchant, return top N."""
    merchant_totals = {}
    for txn in transactions:
        if txn.get("type", "").upper() != "DEBIT":
            continue
        merchant = txn.get("merchant", "Unknown")
        amt = float(txn.get("amount", 0))
        merchant_totals[merchant] = merchant_totals.get(merchant, 0) + amt

    sorted_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)
    return [{"merchant": m, "total": round(t, 2)} for m, t in sorted_merchants[:top_n]]


# ─────────────────────────────────────────────────────────────────────────────
# PROMPT BUILDER  (the core improvement)
# ─────────────────────────────────────────────────────────────────────────────

def _build_prompt(data: dict) -> str:
    summary      = data.get("summary", {})
    categories   = data.get("categories", {})
    forecast     = data.get("forecast", {})
    recurring    = data.get("recurring_merchants", [])
    anomalies    = data.get("anomalies", [])
    transactions = data.get("transactions", [])

    total_debit  = summary.get("total_debit", 0)
    total_credit = summary.get("total_credit", 0)
    net_savings  = summary.get("net_savings", 0)
    health_score = summary.get("health_score", 0)
    txn_count    = summary.get("transaction_count", 0)

    # ── Smart income classification ──────────────────────────────────────────
    income_info  = _classify_income(transactions, total_credit)
    real_income  = income_info["real_income"]
    peer_in      = income_info["peer_transfers"]

    # ── Food delivery breakdown ──────────────────────────────────────────────
    food_apps, food_delivery_total = _extract_food_delivery_spend(transactions)
    food_delivery_lines = "\n".join(
        f"    {app}: ₹{amt:,.0f}" for app, amt in food_apps.items()
    ) or "    None detected"

    # Count food delivery transactions per month for context
    food_txn_days = {}
    for txn in transactions:
        merchant = (txn.get("merchant", "") or "").lower()
        if any(app in merchant for app in ["zomato", "swiggy", "blinkit", "zepto"]):
            date_str = txn.get("date", "")[:7]  # YYYY-MM
            food_txn_days[date_str] = food_txn_days.get(date_str, 0) + 1
    avg_food_orders_per_month = round(
        sum(food_txn_days.values()) / max(len(food_txn_days), 1), 1
    )

    # ── Subscriptions with accurate savings math ─────────────────────────────
    subs = _extract_subscriptions(transactions)
    sub_lines = "\n".join(
        f"    {s['name']}: ₹{s['monthly_cost']}/mo — annual plan saves ₹{s['switch_to_annual_saves']}/yr"
        for s in subs
    ) or "    None detected"
    total_sub_monthly = sum(s["monthly_cost"] for s in subs)
    total_sub_annual_savings = sum(s["switch_to_annual_saves"] for s in subs)

    # ── Top merchants ────────────────────────────────────────────────────────
    top_merchants = _get_top_merchants_by_spend(transactions, top_n=8)
    merchant_lines = "\n".join(
        f"    {i+1}. {m['merchant']}: ₹{m['total']:,.0f}" for i, m in enumerate(top_merchants)
    ) or "    None"

    # ── Categories ──────────────────────────────────────────────────────────
    cat_lines = "\n".join(
        f"    {cat}: ₹{amt:,.0f} ({round(amt / total_debit * 100, 1) if total_debit else 0}%)"
        for cat, amt in sorted(categories.items(), key=lambda x: x[1], reverse=True)
    ) or "    No categories available"

    # ── Anomalies ────────────────────────────────────────────────────────────
    anomaly_lines = "\n".join(
        f"    {a['merchant']}: ₹{a['amount']:,.0f} on {a.get('date','?')} (z-score severity: {a['severity']})"
        for a in anomalies[:6]
    ) or "    None"

    # ── Savings rate on REAL disposable income ───────────────────────────────
    # Real disposable = real_income + peer_in (pocket money still counts as usable funds)
    disposable = total_credit  # use total for student context
    actual_savings_rate = round((net_savings / disposable * 100), 1) if disposable > 0 else 0

    trend = forecast.get("trend", "stable")
    predicted_expense = forecast.get("predicted_expense", 0)
    months_covered = len(set(
        txn.get("date", "")[:7] for txn in transactions if txn.get("date")
    )) or 1
    avg_monthly_spend = round(total_debit / months_covered)

    prompt = f"""
You are Dr.Nexus, an expert AI financial advisor for Indian users. You specialise in UPI-based spending analysis.

IMPORTANT CONTEXT:
This is a PhonePe UPI statement for a STUDENT or young adult in India.
- "Credits" include both real income AND peer transfers (family/friends sending money via UPI)
- Peer transfers like "Received from Mummy", "Received from Revanth", "Received from Panda" are NOT salary income
- The user relies heavily on family support (pocket money) and occasionally receives/sends money with friends
- Food delivery (Zomato, Swiggy, Zepto, Blinkit) is the #1 controllable expense category
- Subscriptions like Spotify are autopay — real recurring costs
- Mobile recharges are a real recurring need, not a luxury

══════════════════════════════════════════════════════════
FINANCIAL OVERVIEW  ({months_covered} months of data, {txn_count} transactions)
══════════════════════════════════════════════════════════
Total Money Received (Credits): ₹{total_credit:,.0f}
  └─ Estimated peer transfers  : ₹{peer_in:,.0f}  ← family/friends UPI (NOT income)
  └─ Estimated real income     : ₹{real_income:,.0f}

Total Spent (Debits)           : ₹{total_debit:,.0f}
  └─ Average per month         : ₹{avg_monthly_spend:,.0f}

Net Balance Change             : ₹{net_savings:,.0f}
Savings Rate                   : {actual_savings_rate}%
Financial Health Score         : {health_score}/100
Spending Trend                 : {trend} (next month predicted: ₹{predicted_expense:,.0f})

══════════════════════════════════════════════════════════
FOOD DELIVERY BREAKDOWN  (your biggest controllable cost)
══════════════════════════════════════════════════════════
Total food delivery spend      : ₹{food_delivery_total:,.0f} over {months_covered} months
Average per month              : ₹{round(food_delivery_total / months_covered):,.0f}
Average orders per month       : {avg_food_orders_per_month}
Breakdown by app:
{food_delivery_lines}

══════════════════════════════════════════════════════════
SUBSCRIPTIONS  (autopay / recurring)
══════════════════════════════════════════════════════════
Total subscription cost        : ₹{total_sub_monthly}/mo
Annual savings if switch to annual plans: ₹{total_sub_annual_savings}/yr
Breakdown:
{sub_lines}

══════════════════════════════════════════════════════════
TOP MERCHANTS BY TOTAL SPEND
══════════════════════════════════════════════════════════
{merchant_lines}

══════════════════════════════════════════════════════════
SPEND BY CATEGORY
══════════════════════════════════════════════════════════
{cat_lines}

══════════════════════════════════════════════════════════
ANOMALOUS / UNUSUALLY LARGE TRANSACTIONS
══════════════════════════════════════════════════════════
{anomaly_lines}

══════════════════════════════════════════════════════════
══════════════════════════════════════════════════════════
YOUR TASK
══════════════════════════════════════════════════════════
Generate exactly 6 specific, actionable recommendations based on the user's spending data.
You MUST cover at least 5 of these areas:
1. Category Spend Optimization
2. Subscription Audit
3. Saving Opportunities
4. Anomaly Alerts
5. Vendor/Merchant concentration
6. Weekend vs Weekday analysis
7. EMI & Debt advice
8. Cashflow timing

Context rules:
- Format in Indian Rupees (₹).
- Keep each recommendation under two sentences.
- Be highly specific (name the merchants and exact amounts).

IMPORTANT: Return the response strictly as a JSON array of objects. Do not include markdown code blocks, backticks, or any other text. Follow this schema:
[
  {
    "type": "alert|opportunity|insight|saving",
    "title": "Short title",
    "description": "Specific finding and what to do about it",
    "amount": numeric_value_if_relevant_else_0,
    "icon": "lucide_icon_name"
  }
]
"""
    return prompt.strip()


# ─────────────────────────────────────────────────────────────────────────────
# GEMINI API CALL
# ─────────────────────────────────────────────────────────────────────────────

def _call_gemini(prompt: str) -> str:
    """Send prompt to Gemini and return raw text response."""
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    print("[GEMINI] Sending prompt to gemini-2.5-flash...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            temperature=1,
            max_output_tokens=8192,
            response_mime_type="application/json",
        )
    )
    
    text = response.text
    print(f"[GEMINI] Received {len(text)} character response")
    return text


# ─────────────────────────────────────────────────────────────────────────────
# RESPONSE PARSER
# ─────────────────────────────────────────────────────────────────────────────

def _parse_response(text: str, fallback_data: dict) -> dict:
    """Parse Gemini JSON response, with safety fallback."""
    clean = text.strip()
    if clean.startswith("```json"):
        clean = "\n".join(clean.split("\n")[1:])
    elif clean.startswith("```"):
        clean = "\n".join(clean.split("\n")[1:])
    if clean.endswith("```"):
        clean = "\n".join(clean.split("\n")[:-1])
    clean = clean.strip()

    try:
        parsed = json.loads(clean)

        items = []
        if isinstance(parsed, list):
            for i, p in enumerate(parsed):
                items.append({
                    "id": f"rec_{i+1}",
                    "title": p.get("title", ""),
                    "description": p.get("description", ""),
                    "category": p.get("type", "insight"),
                    "priority": "high" if str(p.get("type")) == "alert" else "medium",
                    "potential_savings": max(0, int(p.get("amount", 0))),
                    "action_label": "Take Action"
                })
            return {
                "summary": "AI generated insights based on your spending.",
                "items": items,
                "total_potential_savings": sum(i["potential_savings"] for i in items),
                "ai_generated": True
            }
        elif isinstance(parsed, dict) and "items" in parsed:
            for i, item in enumerate(parsed["items"]):
                item.setdefault("id", f"rec_{i+1}")
                item.setdefault("priority", "medium")
                item.setdefault("potential_savings", 0)
                item.setdefault("action_label", "Take Action")
                item.setdefault("category", "insight")
                item["potential_savings"] = max(0, int(item.get("potential_savings", 0)))
            parsed["ai_generated"] = True
            return parsed
        else:
            raise ValueError("Unexpected JSON structure in Gemini response")

    except Exception as e:
        print(f"[GEMINI] JSON parse error: {e}")
        print(f"[GEMINI] Raw response: {text[:300]}...")
        return _rule_based_fallback(fallback_data)


# ─────────────────────────────────────────────────────────────────────────────
# RULE-BASED FALLBACK
# Updated to also use smart income classification
# ─────────────────────────────────────────────────────────────────────────────

def _rule_based_fallback(data: dict) -> dict:
    """
    Deterministic rule-based recommendations when Gemini API is unavailable.
    UPI-aware: correctly separates peer transfers from income.
    """
    summary      = data.get("summary", {})
    categories   = data.get("categories", {})
    recurring    = data.get("recurring_merchants", [])
    transactions = data.get("transactions", [])

    total_debit  = summary.get("total_debit", 0) or 1
    total_credit = summary.get("total_credit", 0) or 1
    health_score = summary.get("health_score", 0)
    net_savings  = summary.get("net_savings", 0)

    income_info = _classify_income(transactions, total_credit)
    peer_in     = income_info["peer_transfers"]
    real_income = income_info["real_income"]

    subs = _extract_subscriptions(transactions)
    _, food_delivery_total = _extract_food_delivery_spend(transactions)
    months_covered = len(set(
        txn.get("date", "")[:7] for txn in transactions if txn.get("date")
    )) or 1
    avg_monthly_food_delivery = round(food_delivery_total / months_covered)

    total_sub_monthly = sum(s["monthly_cost"] for s in subs)
    total_sub_annual_savings = sum(s["switch_to_annual_saves"] for s in subs)

    savings_rate = round((net_savings / total_credit * 100), 1) if total_credit > 0 else 0

    items = []

    # 1. Food delivery reduction
    food_saving = round(avg_monthly_food_delivery * 0.4)
    items.append({
        "id": "rec_1",
        "title": "Cut Food Delivery by 40%",
        "description": (
            f"You spend ₹{avg_monthly_food_delivery:,.0f}/month on food delivery apps. "
            f"Ordering from campus mess or cooking 3 days a week could save ₹{food_saving:,.0f}/month. "
            f"Try limiting Zomato/Zepto to weekends only."
        ),
        "category": "spending",
        "priority": "high" if avg_monthly_food_delivery > 500 else "medium",
        "potential_savings": food_saving,
        "action_label": "Set Limit"
    })

    # 2. Subscription audit
    sub_desc = (
        f"You pay ₹{total_sub_monthly}/mo on subscriptions ({', '.join(s['name'] for s in subs[:3])}). "
        f"Switching all to annual plans saves ₹{total_sub_annual_savings}/yr. "
        f"Cancel anything you haven't used in 2 weeks."
    ) if subs else (
        "No subscriptions detected yet. Avoid signing up for trials that auto-convert to paid plans."
    )
    items.append({
        "id": "rec_2",
        "title": "Switch to Annual Plans",
        "description": sub_desc,
        "category": "subscription",
        "priority": "medium",
        "potential_savings": round(total_sub_annual_savings / 12),  # monthly equivalent
        "action_label": "Review Subs"
    })

    # 3. Top category reduction
    if categories:
        top_cat, top_amt = max(categories.items(), key=lambda x: x[1])
        top_monthly = round(top_amt / months_covered)
        saving = round(top_monthly * 0.25)
        items.append({
            "id": "rec_3",
            "title": f"Budget Your {top_cat}",
            "description": (
                f"'{top_cat}' is your largest expense at ₹{top_monthly:,.0f}/month on average. "
                f"Setting a strict ₹{round(top_monthly * 0.75):,.0f}/month limit saves ₹{saving:,.0f}/month. "
                f"Track every purchase in this category weekly."
            ),
            "category": "budget",
            "priority": "high",
            "potential_savings": saving,
            "action_label": "Set Budget"
        })

    # 4. Peer transfers insight
    items.append({
        "id": "rec_4",
        "title": "Track Family Support Separately",
        "description": (
            f"₹{peer_in:,.0f} of your credits came from family/friends (pocket money, split bills). "
            f"This is NOT income — track it separately so you know your true self-sufficiency ratio. "
            f"Aim to cover at least 30% of your own expenses from part-time work or internship."
        ),
        "category": "insight",
        "priority": "medium",
        "potential_savings": 0,
        "action_label": "Learn More"
    })

    # 5. Small savings habit
    realistic_save = max(200, round((total_credit - total_debit) * 0.5)) if net_savings > 0 else 200
    items.append({
        "id": "rec_5",
        "title": "Start a ₹200/Week Save Habit",
        "description": (
            f"Even saving ₹200/week = ₹2,400/year — enough for one semester's exam fees or a trip. "
            f"Open a separate zero-balance savings account (like Fi or Jupiter) and auto-transfer after "
            f"every UPI credit you receive."
        ),
        "category": "savings",
        "priority": "medium",
        "potential_savings": realistic_save,
        "action_label": "Start Saving"
    })

    # 6. Health score
    items.append({
        "id": "rec_6",
        "title": f"Boost Health Score: {health_score} → {min(health_score + 15, 100)}",
        "description": (
            f"Your health score is {health_score}/100. "
            f"{'You are spending more than you receive — reduce food delivery immediately.' if net_savings < 0 else f'You saved ₹{net_savings:,.0f} this period — good start!'} "
            f"Hitting a 20% savings rate and reducing delivery orders will push your score above {min(health_score + 15, 100)}."
        ),
        "category": "insight",
        "priority": "high" if health_score < 50 else "low",
        "potential_savings": 0,
        "action_label": "View Details"
    })

    total_savings = sum(i["potential_savings"] for i in items)

    return {
        "summary": (
            f"Student account with {months_covered} months of data: "
            f"₹{peer_in:,.0f} received from family/friends, ₹{avg_monthly_food_delivery:,.0f}/mo on food delivery. "
            f"Following these steps could save ₹{total_savings:,.0f}/month."
        ),
        "items": items,
        "total_potential_savings": total_savings,
        "ai_generated": False
    }