# SpendSense AI: How to Run Guide

Welcome to the SpendSense AI project! This guide will show you exactly how to run your 3 services in the Antigravity IDE terminal.

> [!IMPORTANT]
> The recommended order to start services is **ML Service first, Backend second, Frontend last**. This ensures each layer can connect to its dependencies properly as they start up.

## Option 1: The Quick Way (All At Once)

We have created a root `package.json` that runs all three services together automatically.

1. Open **one** terminal tab at your project root (`spendsense-ai/`).
2. Install the necessary packages (you only need to do this once):
   ```bash
   npm install
   ```
3. Run everything concurrently:
   ```bash
   npm run dev
   ```

## Option 2: The Manual Way (3 Separate Tabs)

If you need to view raw logs for each service individually or restart them independently, follow these steps by opening 3 separate terminal tabs.

### Tab 1: ML Service (Start First 🚀)
1. Open a new terminal tab and navigate into the `ml-service` folder.
2. Activate your virtual environment and start the FASTAPI server:
```powershell
cd ml-service
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
**Check it:** Go to [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Tab 2: Backend (Start Second ⚙️)
1. Open a second terminal tab and navigate into the `backend` folder.
2. Start the Express server:
```powershell
cd backend
npm run dev
```
**Check it:** Go to [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Tab 3: Frontend (Start Last 💻)
1. Open a third terminal tab and navigate into the `frontend` folder.
2. Start the Next.js frontend:
```powershell
cd frontend
npm run dev
```
**Check it:** Go to [http://localhost:3000](http://localhost:3000)

---

## ✅ Verification Checklist

Use this quick checklist to confirm everything is running smoothly:
- `[ ]` **MongoDB Atlas connected** (Verify successful connection message in the *backend* terminal logs)
- `[ ]` **ML service loaded model** (Verify `{"status": "ok"}` or similar at `http://localhost:8000/api/health`)
- `[ ]` **Backend endpoints responding** (Verify success at `http://localhost:5000/api/health`)
- `[ ]` **Frontend loads dashboard** (You can see the UI at `http://localhost:3000`)

---

## 🛠 Common Errors & Quick Fixes

> [!TIP]
> Keep this section handy when things don't work the first time!

### ❌ Port Already in Use (e.g., EADDRINUSE)
**Fix:** Find what's using the port and kill it. Alternatively, check if you already have the server running in another hidden tab.
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace PID with the number from the last column above)
taskkill /PID <PID> /F
```

### ❌ MongoDB Connection Refused / Timeout
**Fix:** This is usually because your current IP address isn't whitelisted on MongoDB Atlas.
1. Log into MongoDB Atlas.
2. Go to **Network Access**.
3. Click "Add IP Address" -> "Add Current IP Address".

### ❌ Python Module Not Found Error (e.g. `No module named 'fastapi'`)
**Fix:** Your virtual environment isn't activated or dependencies aren't installed.
```powershell
cd ml-service
.venv\Scripts\activate
pip install -r requirements.txt
```

### ❌ Next.js Build Error (e.g. `Cannot find module...`)
**Fix:** The node modules might be missing or corrupted.
```powershell
cd frontend
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run dev
```
