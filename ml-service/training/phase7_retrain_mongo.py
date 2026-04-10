import os
import sys
import joblib
import requests
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.services.classifier import rule_based_classify

def run():
    print("[1] Connecting to MongoDB...")
    URI = "mongodb+srv://drnexus_admin:1029384756@cluster0.hnhhst7.mongodb.net/drnexus?retryWrites=true&w=majority&appName=Cluster0"
    client = MongoClient(URI)
    db = client.drnexus
    collection = db.transactions

    txns = list(collection.find({}))
    print(f"[2] Fetched {len(txns)} transactions from MongoDB")

    updated_count = 0
    corpus = []
    labels = []

    print("[3] Applying corrected labels via Keyword Rules...")
    for txn in txns:
        desc = txn.get("description", "").lower()
        if not desc:
            continue
            
        # Ignore credit/income unless misclassified
        if txn.get("type", "").lower() == "credit":
            continue

        cat, conf = rule_based_classify(desc)
        
        collection.update_one(
            {"_id": txn["_id"]},
            {"$set": {"category": cat, "confidence": conf}}
        )
        updated_count += 1
        
        # Add to training corpus
        corpus.append(desc)
        labels.append(cat)

    print(f"[4] Updated {updated_count} transactions in MongoDB.")
    
    if len(corpus) == 0:
        print("[!] No transactions found for training, exiting.")
        return

    print("[5] Training TF-IDF Classifier with class weights...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        analyzer='word',
        sublinear_tf=True
    )
    
    # We use SVC with probability=True and class_weight='balanced' to handle small datasets and imbalance
    model = SVC(kernel='linear', probability=True, class_weight='balanced', random_state=42)
    
    X = vectorizer.fit_transform(corpus)
    model.fit(X, labels)

    print("[6] Saving Models...")
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    joblib.dump(model, os.path.join(models_dir, "tfidf_model.pkl"))
    joblib.dump(vectorizer, os.path.join(models_dir, "tfidf_vec.pkl"))

    print("[7] Triggering FastAPI Hot-Reload...")
    try:
        resp = requests.post("http://localhost:8000/api/ml/reload")
        if resp.status_code == 200:
            print("[8] Successfully hot-reloaded the model in FastAPI!")
        else:
            print(f"[!] Failed to hot-reload: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"[!] Connection to FastAPI failed: {e}")

if __name__ == "__main__":
    run()
