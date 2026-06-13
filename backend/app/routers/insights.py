from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.auth import check_role
from backend.app.schemas import InsightsResponse
from backend.app.services.insights import calculate_business_health_and_insights

router = APIRouter(prefix="/api/insights", tags=["Insights"])

@router.get("", response_model=InsightsResponse)
def get_insights(
    db: Session = Depends(get_db),
    current_user = Depends(check_role(["admin"]))
):
    return calculate_business_health_and_insights(db)
