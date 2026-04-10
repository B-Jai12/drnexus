#!/usr/bin/env python
"""
Run script for the Dr.Nexus ML Service.
Execute from the ml-service directory: python run.py
"""
import sys
import os

# Add current directory to path so 'app' package is found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn

    is_dev = os.getenv("APP_ENV", "development") != "production"

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_dev,
        # Only watch the app/ package — training/, models/, temp_uploads/
        # are completely ignored, preventing watchfiles reload loops.
        reload_dirs=["app"] if is_dev else None,
        log_level="info",
    )
