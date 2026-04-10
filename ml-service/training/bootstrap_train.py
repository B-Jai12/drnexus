"""
Bootstrap Training — Trains the full ensemble from the built-in keyword corpus.

No bank PDFs required.  Run this once to bootstrap the ML model so the
FastAPI server can load it at startup and use it for real predictions.

Usage (from the ml-service/ directory):
    python training/bootstrap_train.py

Saves models to:
    models/transaction-classifier/
        xgboost/model.json + tfidf.pkl
        svm/model.pkl      + tfidf.pkl
        embedding_lr/model.pkl + tfidf.pkl
        tokenizer/label_encoder.pkl
        ensemble/config.json
        category_labels.json
"""

import sys, io, pathlib, json, pickle, warnings
warnings.filterwarnings('ignore')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import numpy as np
from sklearn.feature_extraction.text  import TfidfVectorizer
from sklearn.linear_model             import LogisticRegression
from sklearn.svm                      import LinearSVC
from sklearn.calibration              import CalibratedClassifierCV
from sklearn.preprocessing            import LabelEncoder
from sklearn.utils                    import class_weight
from sklearn.model_selection          import StratifiedKFold
from sklearn.metrics                  import f1_score, classification_report
import xgboost as xgb

ROOT   = pathlib.Path(__file__).resolve().parent.parent
MODELS = ROOT / "models" / "transaction-classifier"

# ─── Expanded synthetic corpus ────────────────────────────────────────────────
# Each tuple: (description, category)
# Categories match phase2_label.py exactly so the label encoder is consistent.

CORPUS = [
    # ── Food ─────────────────────────────────────────────────────────────────
    ("swiggy food delivery order", "Food"),
    ("swiggy order restaurant", "Food"),
    ("zomato food delivery", "Food"),
    ("zomato restaurant order", "Food"),
    ("dominos pizza delivery", "Food"),
    ("pizza hut order", "Food"),
    ("mcdonalds burger", "Food"),
    ("kfc fried chicken", "Food"),
    ("blinkit grocery delivery", "Food"),
    ("bigbasket grocery order", "Food"),
    ("zepto grocery", "Food"),
    ("cafe coffee breakfast", "Food"),
    ("restaurant dining lunch dinner", "Food"),
    ("dhaba biryani food", "Food"),
    ("canteen mess tiffin", "Food"),
    ("haldirams snacks", "Food"),
    ("naturals ice cream", "Food"),
    ("fruit vegetables grocery", "Food"),
    ("milkbasket milk delivery", "Food"),
    ("food delivery payment", "Food"),
    ("paid to swiggy order", "Food"),
    ("online food order charge", "Food"),
    ("instamart grocery delivery", "Food"),
    ("jiomart grocery purchase", "Food"),
    ("subway sandwich fast food", "Food"),
    ("burger king fast food", "Food"),
    ("dunzo delivery groceries", "Food"),
    ("grofers grocery order", "Food"),
    ("dinner restaurant payment", "Food"),
    ("lunch dhaba payment", "Food"),

    # ── Shopping ─────────────────────────────────────────────────────────────
    ("amazon online shopping purchase", "Shopping"),
    ("amazon order delivery", "Shopping"),
    ("flipkart purchase online", "Shopping"),
    ("flipkart order product", "Shopping"),
    ("myntra fashion clothing", "Shopping"),
    ("meesho fashion apparel", "Shopping"),
    ("ajio clothing purchase", "Shopping"),
    ("nykaa beauty cosmetics", "Shopping"),
    ("snapdeal online buy", "Shopping"),
    ("reliance retail store", "Shopping"),
    ("dmart supermarket shopping", "Shopping"),
    ("tata cliq electronics", "Shopping"),
    ("zudio fashion clothing", "Shopping"),
    ("westside apparel purchase", "Shopping"),
    ("pantaloons fashion store", "Shopping"),
    ("lifestyle store shopping", "Shopping"),
    ("shoppers stop retail", "Shopping"),
    ("fabindia ethnic wear", "Shopping"),
    ("bewakoof tshirt purchase", "Shopping"),
    ("electronics mobile laptop headphone", "Shopping"),
    ("online purchase delivery", "Shopping"),
    ("store purchase payment", "Shopping"),
    ("mall retail clothing buy", "Shopping"),
    ("saree kurti ethnic garment", "Shopping"),
    ("shoes footwear purchase", "Shopping"),
    ("watch jewellery buy", "Shopping"),
    ("charger cable mobile accessory", "Shopping"),

    # ── Travel ───────────────────────────────────────────────────────────────
    ("makemytrip flight booking", "Travel"),
    ("makemytrip hotel booking", "Travel"),
    ("goibibo travel booking", "Travel"),
    ("irctc railway train ticket", "Travel"),
    ("yatra flight booking", "Travel"),
    ("cleartrip travel", "Travel"),
    ("airbnb hotel stay", "Travel"),
    ("oyo hotel booking", "Travel"),
    ("spicejet flight ticket", "Travel"),
    ("indigo airline ticket", "Travel"),
    ("air india flight booking", "Travel"),
    ("vistara airfare", "Travel"),
    ("redbus bus ticket", "Travel"),
    ("abhibus bus booking", "Travel"),
    ("ixigo train booking", "Travel"),
    ("flight booking payment", "Travel"),
    ("hotel accommodation payment", "Travel"),
    ("airport lounge access", "Travel"),
    ("baggage luggage airline", "Travel"),
    ("cab booking travel airport", "Travel"),
    ("treebo hotel stay", "Travel"),
    ("fabhotels accommodation", "Travel"),

    # ── Transport ────────────────────────────────────────────────────────────
    ("uber cab ride", "Transport"),
    ("ola cab taxi", "Transport"),
    ("rapido bike taxi ride", "Transport"),
    ("auto rickshaw transport", "Transport"),
    ("metro card recharge", "Transport"),
    ("namma metro rail", "Transport"),
    ("petrol fuel filling", "Transport"),
    ("diesel fuel charge", "Transport"),
    ("fastag toll payment", "Transport"),
    ("parking charge fee", "Transport"),
    ("indian oil petrol pump", "Transport"),
    ("hpcl bharat petroleum fuel", "Transport"),
    ("honda service station", "Transport"),
    ("taxi cab commute", "Transport"),
    ("bus pass monthly", "Transport"),
    ("shuttle service commute", "Transport"),
    ("bike cycle maintenance", "Transport"),
    ("cng fuel charge", "Transport"),
    ("e-rickshaw ride", "Transport"),
    ("ridesharing uber ola payment", "Transport"),

    # ── Bills ────────────────────────────────────────────────────────────────
    ("electricity bill payment bescom", "Bills"),
    ("msedcl electricity charge", "Bills"),
    ("water bill municipal", "Bills"),
    ("gas lpg cylinder", "Bills"),
    ("piped gas mgl igl", "Bills"),
    ("airtel broadband wifi internet", "Bills"),
    ("jio recharge prepaid mobile", "Bills"),
    ("vodafone vi idea postpaid", "Bills"),
    ("bsnl phone bill", "Bills"),
    ("tatasky dth dish tv", "Bills"),
    ("dishtv sun direct cable", "Bills"),
    ("property tax municipality", "Bills"),
    ("society maintenance charges", "Bills"),
    ("rent house monthly", "Bills"),
    ("insurance premium policy", "Bills"),
    ("health insurance premium", "Bills"),
    ("life insurance lic premium", "Bills"),
    ("mobile recharge prepaid plan", "Bills"),
    ("broadband internet bill payment", "Bills"),
    ("electricity power bill charge", "Bills"),

    # ── Entertainment ────────────────────────────────────────────────────────
    ("netflix subscription streaming", "Entertainment"),
    ("prime video amazon subscription", "Entertainment"),
    ("hotstar disney plus streaming", "Entertainment"),
    ("zee5 sonyliv streaming", "Entertainment"),
    ("bookmyshow movie ticket", "Entertainment"),
    ("pvr cinema movie", "Entertainment"),
    ("inox multiplex ticket", "Entertainment"),
    ("spotify music premium", "Entertainment"),
    ("youtube premium subscription", "Entertainment"),
    ("gaming steam purchase", "Entertainment"),
    ("pubg bgmi game top up", "Entertainment"),
    ("concert event ticket", "Entertainment"),
    ("amusement park entertainment", "Entertainment"),
    ("jiocinema streaming", "Entertainment"),
    ("mxplayer hungama ott", "Entertainment"),
    ("gaming subscription monthly", "Entertainment"),
    ("esports tournament", "Entertainment"),
    ("bowling sports activity", "Entertainment"),

    # ── Subscriptions ────────────────────────────────────────────────────────
    ("linkedin premium subscription", "Subscriptions"),
    ("notion workspace subscription", "Subscriptions"),
    ("figma design tool subscription", "Subscriptions"),
    ("canva pro monthly", "Subscriptions"),
    ("dropbox cloud storage", "Subscriptions"),
    ("icloud storage apple", "Subscriptions"),
    ("microsoft office 365 subscription", "Subscriptions"),
    ("google workspace subscription", "Subscriptions"),
    ("adobe creative cloud", "Subscriptions"),
    ("github copilot subscription", "Subscriptions"),
    ("chatgpt openai subscription", "Subscriptions"),
    ("grammarly premium monthly", "Subscriptions"),
    ("zoom meeting subscription", "Subscriptions"),
    ("slack workspace plan", "Subscriptions"),
    ("annual plan renewal membership", "Subscriptions"),
    ("monthly subscription auto renewal", "Subscriptions"),
    ("1password lastpass password manager", "Subscriptions"),
    ("medium substack newsletter", "Subscriptions"),

    # ── Healthcare ───────────────────────────────────────────────────────────
    ("medplus pharmacy medicine", "Healthcare"),
    ("apollo pharmacy purchase", "Healthcare"),
    ("netmeds online pharmacy", "Healthcare"),
    ("1mg medicines online", "Healthcare"),
    ("practo doctor consultation", "Healthcare"),
    ("hospital clinic doctor appointment", "Healthcare"),
    ("lab diagnostic blood test", "Healthcare"),
    ("thyrocare dr lal path lab", "Healthcare"),
    ("dental teeth clinic", "Healthcare"),
    ("eye optical spectacle lens", "Healthcare"),
    ("mri scan xray pathology", "Healthcare"),
    ("medicine chemist purchase", "Healthcare"),
    ("max hospital fortis healthcare", "Healthcare"),
    ("manipal care hospital", "Healthcare"),
    ("vaccine vaccination covid", "Healthcare"),
    ("health checkup medical", "Healthcare"),
    ("pharmeasy tata health", "Healthcare"),
    ("surgery operation medical", "Healthcare"),

    # ── EMI/Loans ────────────────────────────────────────────────────────────
    ("emi loan payment monthly", "EMI/Loans"),
    ("bajaj finance emi", "EMI/Loans"),
    ("home loan repayment", "EMI/Loans"),
    ("car loan installment", "EMI/Loans"),
    ("personal loan payment", "EMI/Loans"),
    ("gold loan muthoot manappuram", "EMI/Loans"),
    ("credit card payment dues", "EMI/Loans"),
    ("sip mutual fund investment", "EMI/Loans"),
    ("ppf elss fd investment", "EMI/Loans"),
    ("nps pension provident fund", "EMI/Loans"),
    ("epf gratuity contribution", "EMI/Loans"),
    ("nach debit ecs payment", "EMI/Loans"),
    ("equitas capital first finance", "EMI/Loans"),
    ("insurance policy premium payment", "EMI/Loans"),
    ("loan overdue penalty", "EMI/Loans"),
    ("debt repayment installment", "EMI/Loans"),

    # ── Miscellaneous ────────────────────────────────────────────────────────
    ("atm cash withdrawal", "Miscellaneous"),
    ("cash deposit bank", "Miscellaneous"),
    ("cheque demand draft", "Miscellaneous"),
    ("refund cashback reward", "Miscellaneous"),
    ("bank charge interest penalty", "Miscellaneous"),
    ("late fee bounce return", "Miscellaneous"),
    ("paytm wallet transfer", "Miscellaneous"),
    ("phonepe wallet payment", "Miscellaneous"),
    ("googlepay gpay transfer", "Miscellaneous"),
    ("mobikwik freecharge wallet", "Miscellaneous"),
    ("cred credit card", "Miscellaneous"),
    ("salary wages income credit", "Miscellaneous"),
    ("freelance commission dividend", "Miscellaneous"),
    ("gift bonus stipend", "Miscellaneous"),
    ("unknown misc general transfer", "Miscellaneous"),
    ("reversal return transaction", "Miscellaneous"),
    ("fund transfer neft imps", "Miscellaneous"),
]


def build_tfidf(ngram_max=2, max_features=10000):
    return TfidfVectorizer(
        ngram_range=(1, ngram_max),
        max_features=max_features,
        sublinear_tf=True,
        min_df=1,
    )


def run_bootstrap():
    print("\n" + "=" * 60)
    print("BOOTSTRAP TRAINING — Synthetic Corpus Ensemble")
    print("=" * 60)

    # ── Prepare data ─────────────────────────────────────────────────────────
    texts  = [t for t, _ in CORPUS]
    labels = [l for _, l in CORPUS]

    le      = LabelEncoder()
    y_enc   = le.fit_transform(labels)
    classes = list(le.classes_)
    print(f"\n  Samples : {len(texts)}")
    print(f"  Classes : {len(classes)} → {classes}")

    cw      = class_weight.compute_class_weight('balanced', classes=np.unique(y_enc), y=y_enc)
    sw      = np.array([cw[yi] for yi in y_enc])

    # ── 5-Fold CV to determine ensemble weights ───────────────────────────────
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    xgb_f1s, svc_f1s, lr_f1s = [], [], []

    print("\n  Running 5-Fold CV to calibrate ensemble weights...")
    print(f"  {'Fold':<6} {'XGB F1':>8} {'SVC F1':>8} {'LR F1':>8}")
    print("  " + "-" * 35)

    for fold, (tr_idx, va_idx) in enumerate(cv.split(texts, y_enc)):
        X_tr = [texts[i] for i in tr_idx]
        X_va = [texts[i] for i in va_idx]
        y_tr = y_enc[tr_idx];  y_va = y_enc[va_idx]
        sw_tr = sw[tr_idx]

        # XGBoost
        tf1  = build_tfidf(); Xt1 = tf1.fit_transform(X_tr).toarray(); Xv1 = tf1.transform(X_va).toarray()
        clf1 = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.15,
                                   tree_method='hist', device='cpu', verbosity=0,
                                   eval_metric='mlogloss', random_state=42)
        clf1.fit(Xt1, y_tr, sample_weight=sw_tr)
        xgb_f1s.append(f1_score(y_va, clf1.predict(Xv1), average='weighted'))

        # LinearSVC
        tf2  = build_tfidf(); Xt2 = tf2.fit_transform(X_tr); Xv2 = tf2.transform(X_va)
        clf2 = CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=2000, random_state=42))
        clf2.fit(Xt2, y_tr, sample_weight=sw_tr)
        svc_f1s.append(f1_score(y_va, clf2.predict(Xv2), average='weighted'))

        # Logistic Regression
        tf3  = build_tfidf(); Xt3 = tf3.fit_transform(X_tr); Xv3 = tf3.transform(X_va)
        clf3 = LogisticRegression(max_iter=500, C=5.0, class_weight='balanced', random_state=42)
        clf3.fit(Xt3, y_tr)
        lr_f1s.append(f1_score(y_va, clf3.predict(Xv3), average='weighted'))

        print(f"  Fold {fold+1}:   {xgb_f1s[-1]:.4f}   {svc_f1s[-1]:.4f}   {lr_f1s[-1]:.4f}")

    print("  " + "-" * 35)
    print(f"  {'Mean':<6}   {np.mean(xgb_f1s):.4f}   {np.mean(svc_f1s):.4f}   {np.mean(lr_f1s):.4f}")

    # ── Train final models on full corpus ────────────────────────────────────
    print("\n  Training final models on full corpus...")

    tfidf_xgb = build_tfidf()
    X_xgb = tfidf_xgb.fit_transform(texts).toarray()
    final_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.15,
                                     tree_method='hist', device='cpu', verbosity=0,
                                     eval_metric='mlogloss', random_state=42)
    final_xgb.fit(X_xgb, y_enc, sample_weight=sw)
    print("    ✅ XGBoost")

    tfidf_svc = build_tfidf()
    X_svc = tfidf_svc.fit_transform(texts)
    final_svc = CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=2000, random_state=42))
    final_svc.fit(X_svc, y_enc, sample_weight=sw)
    print("    ✅ LinearSVC")

    tfidf_lr = build_tfidf()
    X_lr = tfidf_lr.fit_transform(texts)
    final_lr = LogisticRegression(max_iter=500, C=5.0, class_weight='balanced', random_state=42)
    final_lr.fit(X_lr, y_enc)
    print("    ✅ Logistic Regression")

    # ── Ensemble weights (proportional to CV F1) ─────────────────────────────
    total = np.mean(xgb_f1s) + np.mean(svc_f1s) + np.mean(lr_f1s)
    ensemble_cfg = {
        "xgboost": round(np.mean(xgb_f1s) / total, 3),
        "svc":     round(np.mean(svc_f1s) / total, 3),
        "lr":      round(np.mean(lr_f1s)  / total, 3),
    }
    print(f"\n  Ensemble weights: {ensemble_cfg}")

    # ── Save ─────────────────────────────────────────────────────────────────
    print("\n  Saving model artifacts...")
    MODELS.mkdir(parents=True, exist_ok=True)

    xgb_dir = MODELS / "xgboost";       xgb_dir.mkdir(exist_ok=True)
    svc_dir = MODELS / "svm";           svc_dir.mkdir(exist_ok=True)
    lr_dir  = MODELS / "embedding_lr";  lr_dir.mkdir(exist_ok=True)
    tok_dir = MODELS / "tokenizer";     tok_dir.mkdir(exist_ok=True)
    ens_dir = MODELS / "ensemble";      ens_dir.mkdir(exist_ok=True)

    final_xgb.save_model(str(xgb_dir / "model.json"))
    with open(xgb_dir / "tfidf.pkl", "wb") as f: pickle.dump(tfidf_xgb, f)
    print(f"    → {xgb_dir}")

    with open(svc_dir / "model.pkl",  "wb") as f: pickle.dump(final_svc, f)
    with open(svc_dir / "tfidf.pkl",  "wb") as f: pickle.dump(tfidf_svc, f)
    print(f"    → {svc_dir}")

    with open(lr_dir / "model.pkl",  "wb") as f: pickle.dump(final_lr, f)
    with open(lr_dir / "tfidf.pkl",  "wb") as f: pickle.dump(tfidf_lr, f)
    print(f"    → {lr_dir}")

    with open(tok_dir / "label_encoder.pkl", "wb") as f: pickle.dump(le, f)
    print(f"    → {tok_dir}/label_encoder.pkl")

    with open(ens_dir / "config.json", "w") as f: json.dump(ensemble_cfg, f, indent=2)
    print(f"    → {ens_dir}/config.json")

    label_map = {i: c for i, c in enumerate(classes)}
    with open(MODELS / "category_labels.json", "w") as f:
        json.dump({"categories": classes,
                   "id2label":   label_map,
                   "label2id":   {v: k for k, v in label_map.items()},
                   "source":     "bootstrap_synthetic_corpus",
                   "n_samples":  len(texts)}, f, indent=2)
    print(f"    → {MODELS}/category_labels.json")

    # ── Quick smoke test ──────────────────────────────────────────────────────
    print("\n  Smoke-testing the saved model via TransactionEnsemble.load()...")
    sys.path.insert(0, str(ROOT))
    from app.services.predictor import TransactionEnsemble
    model = TransactionEnsemble.load()

    smoke_tests = [
        "zomato food order",
        "amazon purchase online",
        "uber cab ride",
        "netflix subscription",
        "electricity bill bescom",
        "airtel broadband",
        "apollo pharmacy",
        "emi loan bajaj",
        "atm cash withdrawal",
        "irctc train ticket",
    ]

    print(f"\n  {'Description':<35} {'Category':<18} {'Conf':>6}")
    print("  " + "-" * 62)
    for desc in smoke_tests:
        pred = model.predict_one(desc)
        print(f"  {desc:<35} {pred['category']:<18} {pred['confidence']:>6.1%}")

    print(f"\n✅ Bootstrap complete! Model saved to: {MODELS}")
    print("   Restart the FastAPI server — it will auto-load the ensemble.\n")


if __name__ == "__main__":
    run_bootstrap()
