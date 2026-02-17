from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
import math

from database import get_db
from models import User, AuditLog
from schemas import AuditLogResponse, PaginatedResponse
from deps import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=PaginatedResponse)
def get_audit_logs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    startDate: str = Query(None),
    endDate: str = Query(None),
    userId: int = Query(None),
    menu: str = Query(None),
    action: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    if startDate:
        query = query.filter(AuditLog.created_at >= datetime.fromisoformat(startDate))
    if endDate:
        end = datetime.fromisoformat(endDate)
        end = end.replace(hour=23, minute=59, second=59)
        query = query.filter(AuditLog.created_at <= end)
    if userId:
        query = query.filter(AuditLog.user_id == userId)
    if menu:
        query = query.filter(AuditLog.menu == menu)
    if action:
        query = query.filter(AuditLog.action == action)

    total = query.count()
    total_pages = math.ceil(total / pageSize) if total > 0 else 1

    logs = (
        query.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    # Join user names
    user_ids = {log.user_id for log in logs}
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u.user_id for u in users}

    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "userId": log.user_id,
            "userName": users_map.get(log.user_id, "unknown"),
            "action": log.action,
            "menu": log.menu,
            "targetType": log.target_type,
            "targetName": log.target_name,
            "detail": log.detail or {},
            "result": log.result,
            "ipAddress": log.ip_address,
            "createdAt": log.created_at.isoformat() if log.created_at else "",
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": total_pages,
    }
