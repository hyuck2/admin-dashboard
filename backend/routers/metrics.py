import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User, AuditLog, MetricSource, Server
from schemas import (
    MetricSourceResponse, CreateMetricSourceRequest, UpdateMetricSourceRequest,
    MetricTargetResponse, ServerMetricsResponse, MessageResponse,
)
from deps import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])


def _audit(db, user, action, target_type, target_name, detail, result, ip):
    db.add(AuditLog(
        user_id=user.id, action=action, menu="servers",
        target_type=target_type, target_name=target_name,
        detail=detail, result=result, ip_address=ip,
    ))
    db.commit()


def _source_to_response(s: MetricSource) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "url": s.url,
        "description": s.description,
        "isActive": s.is_active,
        "createdAt": s.created_at.isoformat() if s.created_at else "",
        "updatedAt": s.updated_at.isoformat() if s.updated_at else "",
    }


# ---------------------------------------------------------------------------
# Metric Source CRUD
# ---------------------------------------------------------------------------

@router.get("/sources", response_model=list[MetricSourceResponse])
def list_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    sources = db.query(MetricSource).order_by(MetricSource.name).all()
    return [MetricSourceResponse(**_source_to_response(s)) for s in sources]


@router.post("/sources", response_model=MetricSourceResponse)
def create_source(
    req: CreateMetricSourceRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = MetricSource(name=req.name, url=req.url.rstrip("/"), description=req.description, is_active=req.isActive)
    db.add(s)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 존재하는 소스명입니다.")
    db.refresh(s)
    _audit(db, current_user, "create", "metric_source", s.name, {}, "success",
           request.client.host if request.client else "")
    return MetricSourceResponse(**_source_to_response(s))


@router.put("/sources/{source_id}", response_model=MetricSourceResponse)
def update_source(
    source_id: int,
    req: UpdateMetricSourceRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = db.query(MetricSource).filter(MetricSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="소스를 찾을 수 없습니다.")
    if req.name is not None:
        s.name = req.name
    if req.url is not None:
        s.url = req.url.rstrip("/")
    if req.description is not None:
        s.description = req.description
    if req.isActive is not None:
        s.is_active = req.isActive
    db.commit()
    db.refresh(s)
    _audit(db, current_user, "update", "metric_source", s.name, {}, "success",
           request.client.host if request.client else "")
    return MetricSourceResponse(**_source_to_response(s))


@router.delete("/sources/{source_id}", response_model=MessageResponse)
def delete_source(
    source_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = db.query(MetricSource).filter(MetricSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="소스를 찾을 수 없습니다.")
    name = s.name
    db.delete(s)
    db.commit()
    _audit(db, current_user, "delete", "metric_source", name, {}, "success",
           request.client.host if request.client else "")
    return MessageResponse(message=f"메트릭 소스 '{name}' 삭제 완료")


@router.post("/sources/{source_id}/test", response_model=MessageResponse)
def test_source(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    s = db.query(MetricSource).filter(MetricSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="소스를 찾을 수 없습니다.")
    try:
        resp = httpx.get(f"{s.url}/api/v1/status/config", timeout=5)
        if resp.status_code == 200:
            return MessageResponse(message="연결 성공")
        raise HTTPException(status_code=400, detail=f"HTTP {resp.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"연결 실패: {e}")


# ---------------------------------------------------------------------------
# Targets & Metrics
# ---------------------------------------------------------------------------

@router.get("/sources/{source_id}/targets", response_model=list[MetricTargetResponse])
def get_targets(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    s = db.query(MetricSource).filter(MetricSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="소스를 찾을 수 없습니다.")

    try:
        resp = httpx.get(f"{s.url}/api/v1/targets", timeout=10)
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"타겟 조회 실패: {e}")

    # Build server IP lookup
    servers = db.query(Server).all()
    ip_map = {}
    for sv in servers:
        ip_map[sv.ip_address] = sv

    results = []
    active_targets = data.get("data", {}).get("activeTargets", [])
    for t in active_targets:
        instance = t.get("labels", {}).get("instance", "")
        job = t.get("labels", {}).get("job", "")
        health = t.get("health", "unknown")
        # Extract IP from instance (ip:port)
        ip = instance.split(":")[0] if ":" in instance else instance
        matched = ip_map.get(ip)
        results.append(MetricTargetResponse(
            instance=instance, job=job, health=health,
            matchedServerId=matched.id if matched else None,
            matchedHostname=matched.hostname if matched else None,
        ))
    return results


@router.get("/sources/{source_id}/metrics", response_model=ServerMetricsResponse)
def get_metrics(
    source_id: int,
    ip: str = Query(...),
    range: str = Query("1h"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    s = db.query(MetricSource).filter(MetricSource.id == source_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="소스를 찾을 수 없습니다.")

    # Parse range to seconds
    range_map = {"1h": 3600, "6h": 21600, "24h": 86400, "7d": 604800}
    duration = range_map.get(range, 3600)
    end = datetime.now(timezone.utc)
    start = end.timestamp() - duration
    step = max(duration // 120, 15)

    queries = {
        "cpu": f'100 - avg(irate(node_cpu_seconds_total{{mode="idle",instance=~"{ip}:.*"}}[5m])) * 100',
        "memory": f'(1 - node_memory_MemAvailable_bytes{{instance=~"{ip}:.*"}} / node_memory_MemTotal_bytes{{instance=~"{ip}:.*"}}) * 100',
        "disk": f'(1 - node_filesystem_avail_bytes{{instance=~"{ip}:.*",mountpoint="/"}} / node_filesystem_size_bytes{{instance=~"{ip}:.*",mountpoint="/"}}) * 100',
    }

    result = {"cpu": [], "memory": [], "disk": []}
    for key, query in queries.items():
        try:
            resp = httpx.get(f"{s.url}/api/v1/query_range", params={
                "query": query,
                "start": start,
                "end": end.timestamp(),
                "step": step,
            }, timeout=10)
            data = resp.json()
            values = data.get("data", {}).get("result", [])
            if values:
                result[key] = values[0].get("values", [])
        except Exception:
            pass

    return ServerMetricsResponse(**result)
