# SpendSense AI

ML-powered finance analytics dashboard.

## What it does
- Upload a bank statement (PDF/CSV/XLSX/image)
- Extract and parse transactions (OCR + parsing)
- Classify transactions into spending categories
- Show insights, forecasts, and Gemini-based recommendations

## Repo layout
- `frontend/`: Next.js (React + Tailwind)
- `backend/`: Node.js + Express (currently a minimal skeleton)
- `ml-service/`: Python + FastAPI (OCR + ML categorization + recommendations)
- `shared/`: shared types/constants (optional)

## Local setup (recommended: run services separately)

### 1) ML service (FastAPI)
From `ml-service/`:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Service runs on `http://localhost:8000`.

### 2) Frontend (Next.js)
From `frontend/`:

```bash
npm install
copy .env.example .env.local
npm run dev
```

App runs on `http://localhost:3000`.

### 3) Backend (Express)
From `backend/`:

```bash
npm install
copy .env.example .env
npm run dev
```

Backend runs on `http://localhost:5000`.

## Docker (optional)
From repo root:

```bash
docker compose up
```

## Environment variables
- **Frontend**:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_ML_API_URL` (used by upload page to call the ML service)
  - `NEXT_PUBLIC_FIREBASE_*` values from Firebase web config
- **Backend**:
  - `MONGODB_URI`
  - `FIREBASE_SERVICE_ACCOUNT` (path to Firebase Admin JSON)
- **ML service**:
  - `CORS_ORIGINS` (comma-separated)
  - `GOOGLE_VISION_API_KEY` (preferred; optional, needed for scanned PDFs/images)
  - `GOOGLE_CLOUD_VISION_API_KEY` (legacy alias, still supported)
  - `GEMINI_API_KEY` (optional; enables Gemini recommendations)

