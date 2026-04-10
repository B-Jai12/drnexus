from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
import shutil
import os
import uuid
from ..services.parser import parse_statement
from ..services.classifier import categorize_transactions

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

jobs = {}

def process_file_background(job_id: str, file_path: str):
    try:
        raw_transactions = parse_statement(file_path)

        if isinstance(raw_transactions, dict) and "error" in raw_transactions:
            jobs[job_id] = {"status": "error", "error": raw_transactions["error"]}
            return

        if not raw_transactions:
            jobs[job_id] = {
                "status": "error", 
                "error": "No valid transactions found in file. Check that your file has columns like 'Description', 'Amount', 'Debit', or 'Credit'."
            }
            return

        final_analysis = categorize_transactions(raw_transactions)
        jobs[job_id] = {"status": "done", "data": final_analysis}

    except Exception as e:
        jobs[job_id] = {"status": "error", "error": str(e)}

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@router.post("/api/process-statement")
async def process_statement(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    try:
        # 1️⃣ Validate extension
        filename = file.filename.lower().strip()
        allowed_extensions = ['.csv', '.xlsx', '.xls', '.pdf']

        print(f"\n[UPLOAD] Received file: {file.filename} (content_type: {file.content_type})")

        if not any(filename.endswith(ext) for ext in allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail="Unsupported format. Upload PDF, Excel, or CSV."
            )

        # 2️⃣ Create safe unique filename
        unique_name = f"{uuid.uuid4()}{os.path.splitext(filename)[1]}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        # 3️⃣ Save file safely
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file.file.close()
        file_size = os.path.getsize(file_path)
        print(f"[UPLOAD] File saved: {file_path} ({file_size} bytes)")

        # 4️⃣ Background processing
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"status": "processing"}
        background_tasks.add_task(process_file_background, job_id, file_path)

        return {"jobId": job_id, "status": "processing"}

    except HTTPException:
        raise

    except Exception as e:
        print("SERVER CRASH:", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: {str(e)}"
        )

@router.get("/api/upload/status/{jobId}")
async def get_status(jobId: str):
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[jobId]