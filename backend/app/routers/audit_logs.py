from datetime import date, datetime, time
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models import AuditLog
from backend.app.schemas import ActivityEvent
from backend.app.auth import get_current_user
from backend.app.services.activity_timeline import ENTITY_TYPE_TABLES, transform_audit_logs

router = APIRouter(prefix="/api/audit-logs", tags=["Activity Timeline"])

@router.get("", response_model=List[ActivityEvent])
def get_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity category (products, sales_orders, purchase_orders, manufacturing, boms)"),
    username: Optional[str] = Query(None, description="Filter by user who performed the action"),
    date_from: Optional[date] = Query(None, description="Filter activities on or after this date"),
    date_to: Optional[date] = Query(None, description="Filter activities on or before this date"),
    limit: int = Query(200, ge=1, le=500, description="Max activities to return"),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(AuditLog)

    if entity_type and entity_type in ENTITY_TYPE_TABLES:
        query = query.filter(AuditLog.table_name.in_(ENTITY_TYPE_TABLES[entity_type]))
    if username:
        query = query.filter(AuditLog.username == username)
    if date_from:
        query = query.filter(AuditLog.timestamp >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(AuditLog.timestamp <= datetime.combine(date_to, time.max))

    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return transform_audit_logs(db, logs)


@router.get("/users", response_model=List[str])
def get_activity_users(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    rows = (
        db.query(AuditLog.username)
        .filter(AuditLog.username.isnot(None))
        .distinct()
        .order_by(AuditLog.username)
        .all()
    )
    return [row[0] for row in rows if row[0]]
