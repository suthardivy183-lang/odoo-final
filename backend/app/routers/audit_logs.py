from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models import AuditLog
from backend.app.schemas import AuditLogResponse
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    table_name: Optional[str] = Query(None, description="Filter by table name"),
    action: Optional[str] = Query(None, description="Filter by action (e.g. INSERT, UPDATE, DELETE)"),
    record_id: Optional[int] = Query(None, description="Filter by specific record ID"),
    username: Optional[str] = Query(None, description="Filter by user who performed the action"),
    limit: int = Query(100, ge=1, le=500, description="Max logs to return"),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(AuditLog)
    
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action)
    if record_id:
        query = query.filter(AuditLog.record_id == record_id)
    if username:
        query = query.filter(AuditLog.username == username)
        
    # Order by newest first
    return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
