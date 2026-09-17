<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,25,30&height=220&section=header&text=Dr.Nexus&fontSize=80&fontAlignY=38&desc=ML-Powered%20Financial%20Statement%20Intelligence%20%26%20Analytics%20Engine&descAlignY=60&animation=fadeIn&fontColor=ffffff" width="100%"/>

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Recommendations-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

<br/>

> **Transform messy, unformatted bank statements into actionable financial intelligence.**  
> Dr.Nexus pairs an OCR-driven machine learning extraction pipeline with Google Gemini reasoning to parse multi-bank PDFs, classify raw transactions, detect anomalous spending, and generate personalized budgeting recommendations.

<br/>

**[📊 System Overview](#-system-overview) &nbsp;•&nbsp; [⚙️ Three-Tier Architecture](#-three-tier-architecture) &nbsp;•&nbsp; [🔍 ML & OCR Pipeline](#-ml--ocr-pipeline) &nbsp;•&nbsp; [🚀 Quickstart](#-getting-started) &nbsp;•&nbsp; [🧪 Testing](#-testing)**

<br/>

</div>

---

## 💡 The Financial Data Bottleneck

Raw financial records from banks, UPI apps, and credit cards are fragmented:
- **Disjointed Formats:** Statements come as scanned image PDFs, multi-page text PDFs, raw CSVs, or spreadsheet exports with inconsistent column structures.
- **Cryptic Narration Strings:** Line items like `UPI/4291823/SWIGGY-BLR/P2M` are indecipherable to standard budgeting rules.
- **Lack of Predictive Insights:** Most personal finance tools only look backward without forecasting upcoming recurring expenses or identifying money leaks.

**Dr.Nexus automates this end-to-end.** Upload any statement file — Dr.Nexus standardizes the data, runs ML categorization, and produces predictive financial insights.

---

## ⚙️ Three-Tier Architecture

Dr.Nexus is designed as a decoupled, microservice-style monorepo:

```
                  ┌───────────────────────────────┐
                  │    Next.js Frontend (Port 3000)│
                  │   Interactive Charts & Upload │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   Node.js Backend (Port 5000) │
                  │   Session & Gateway Controller│
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │  FastAPI ML Service (Port 8000)│
                  │  • PDF/Image OCR Extraction   │
                  │  • Transaction Classifier     │
                  │  • Gemini Financial Advisory  │
                  └───────────────────────────────┘
```

---

## 🔍 ML & OCR Pipeline

The intelligence core lives inside `ml-service/`:

1. **Document Ingestion & OCR:**
   - Detects format: PDF (native vector or scanned raster), XLSX, CSV, or camera image.
   - Extracts raw transaction tables using document heuristics and OCR text zoning.
2. **Transaction Normalization & Classification:**
   - Cleans messy payment gateway descriptions, UPI reference tags, and vendor identifiers.
   - Categorizes spending into structured buckets (Dining, Utilities, Groceries, Travel, Investments, Subscriptions).
3. **Gemini-Powered Financial Recommendations:**
   - Synthesizes user cash-flow trends.
   - Generates contextual advice, flagging subscription creep and suggesting realistic budget adjustments.

---

## 📁 Repository Structure

```
drnexus/
├── frontend/                # Next.js 14 UI (React, Tailwind CSS, Radix UI)
│   ├── app/                 # Next.js App Router (Dashboard, Analytics, Upload)
│   ├── components/          # Reusable visualization charts and tables
│   └── lib/                 # Client utilities and API consumers
├── backend/                 # Node.js + Express API Gateway
│   ├── app/api/             # Transaction and upload routing
│   ├── lib/actions/         # Analytics, user sessions, and prediction dispatch
│   └── prisma/              # Database schema definitions
├── ml-service/              # Python FastAPI Machine Learning microservice
│   ├── app/                 # FastAPI controllers, OCR extractors, categorization models
│   ├── requirements.txt     # Python ML dependencies
│   └── run.py               # ML server bootstrap
├── docker-compose.yml       # Containerized multi-service orchestration
├── package.json             # Root supervisor with concurrent execution scripts
└── HOW_TO_RUN.md            # Comprehensive operational runbook
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Google Gemini API Key

### Option 1: Run All Services Concurrently (Recommended)

From the root repository directory:

```bash
# 1. Install root dependencies
npm install

# 2. Install frontend and backend dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 3. Setup Python virtual environment for ML service
cd ml-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 4. Launch all 3 services simultaneously
npm run dev
```

The supervisor will automatically start:
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`
- **ML Microservice:** `http://localhost:8000` (FastAPI Swagger docs at `/docs`)

---

### Option 2: Running Services Individually

If you prefer running services in separate terminal windows:

#### 1. ML Microservice (FastAPI)
```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

#### 2. Backend Gateway (Express)
```bash
cd backend
npm install
npm run dev
```

#### 3. Frontend UI (Next.js)
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing

A sample statement is included in the root directory for rapid testing:
```bash
# Verify parsing against the included benchmark data
test_statement.csv
```

---

## 👤 Author

**Jaideep Botla** ([@B-Jai12](https://github.com/B-Jai12))  
B.Tech AIML Student & Product Builder • Focused on real-world machine learning systems, data extraction pipelines, and full-stack software.
