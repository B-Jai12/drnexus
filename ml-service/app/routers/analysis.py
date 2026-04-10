# routers/analysis.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from ..services.recommender import generate_recommendations

router = APIRouter()


@router.get("/api/analysis")
def get_analysis():
    return {
        "message": "Analysis endpoint active. Upload a statement to get analysis.",
        "status": "ok"
    }


@router.post("/api/recommendations")
def get_recommendations(analysis_result: dict):
    try:
        recommendations = generate_recommendations(analysis_result)
        return JSONResponse(content=recommendations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendations failed: {str(e)}")