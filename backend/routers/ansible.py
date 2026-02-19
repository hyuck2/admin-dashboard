import logging
import os
import subprocess
import tempfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User, AuditLog, AnsiblePlaybook, AnsibleInventory, AnsibleExecution,
    Server, ServerGroup,
)
from schemas import (
    PlaybookResponse, CreatePlaybookRequest, UpdatePlaybookRequest,
    InventoryResponse, CreateInventoryRequest, UpdateInventoryRequest,
    ExecutePlaybookRequest, AnsibleExecutionResponse, MessageResponse,
    PaginatedResponse,
)
from deps import get_current_user, require_permission
from services.encryption import decrypt_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ansible", tags=["ansible"])


def _audit(db, user, action, target_type, target_name, detail, result, ip):
    db.add(AuditLog(
        user_id=user.id, action=action, menu="servers",
        target_type=target_type, target_name=target_name,
        detail=detail, result=result, ip_address=ip,
    ))
    db.commit()


# ---------------------------------------------------------------------------
# Playbooks
# ---------------------------------------------------------------------------

@router.get("/playbooks", response_model=list[PlaybookResponse])
def list_playbooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    playbooks = db.query(AnsiblePlaybook).order_by(AnsiblePlaybook.name).all()
    return [PlaybookResponse(
        id=p.id, name=p.name, description=p.description, content=p.content,
        createdAt=p.created_at.isoformat() if p.created_at else "",
        updatedAt=p.updated_at.isoformat() if p.updated_at else "",
    ) for p in playbooks]


@router.post("/playbooks", response_model=PlaybookResponse)
def create_playbook(
    req: CreatePlaybookRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    p = AnsiblePlaybook(name=req.name, description=req.description, content=req.content)
    db.add(p)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 존재하는 Playbook명입니다.")
    db.refresh(p)
    _audit(db, current_user, "create", "playbook", p.name, {}, "success",
           request.client.host if request.client else "")
    return PlaybookResponse(
        id=p.id, name=p.name, description=p.description, content=p.content,
        createdAt=p.created_at.isoformat() if p.created_at else "",
        updatedAt=p.updated_at.isoformat() if p.updated_at else "",
    )


@router.get("/playbooks/{playbook_id}", response_model=PlaybookResponse)
def get_playbook(
    playbook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    p = db.query(AnsiblePlaybook).filter(AnsiblePlaybook.id == playbook_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Playbook을 찾을 수 없습니다.")
    return PlaybookResponse(
        id=p.id, name=p.name, description=p.description, content=p.content,
        createdAt=p.created_at.isoformat() if p.created_at else "",
        updatedAt=p.updated_at.isoformat() if p.updated_at else "",
    )


@router.put("/playbooks/{playbook_id}", response_model=PlaybookResponse)
def update_playbook(
    playbook_id: int,
    req: UpdatePlaybookRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    p = db.query(AnsiblePlaybook).filter(AnsiblePlaybook.id == playbook_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Playbook을 찾을 수 없습니다.")
    if req.name is not None:
        p.name = req.name
    if req.description is not None:
        p.description = req.description
    if req.content is not None:
        p.content = req.content
    db.commit()
    db.refresh(p)
    _audit(db, current_user, "update", "playbook", p.name, {}, "success",
           request.client.host if request.client else "")
    return PlaybookResponse(
        id=p.id, name=p.name, description=p.description, content=p.content,
        createdAt=p.created_at.isoformat() if p.created_at else "",
        updatedAt=p.updated_at.isoformat() if p.updated_at else "",
    )


@router.delete("/playbooks/{playbook_id}", response_model=MessageResponse)
def delete_playbook(
    playbook_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    p = db.query(AnsiblePlaybook).filter(AnsiblePlaybook.id == playbook_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Playbook을 찾을 수 없습니다.")
    name = p.name
    db.delete(p)
    db.commit()
    _audit(db, current_user, "delete", "playbook", name, {}, "success",
           request.client.host if request.client else "")
    return MessageResponse(message=f"Playbook '{name}' 삭제 완료")


# ---------------------------------------------------------------------------
# Inventories
# ---------------------------------------------------------------------------

@router.get("/inventories", response_model=list[InventoryResponse])
def list_inventories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    inventories = db.query(AnsibleInventory).order_by(AnsibleInventory.name).all()
    return [InventoryResponse(
        id=inv.id, name=inv.name, groupId=inv.group_id,
        groupName=inv.group.name if inv.group else None,
        content=inv.content,
        createdAt=inv.created_at.isoformat() if inv.created_at else "",
        updatedAt=inv.updated_at.isoformat() if inv.updated_at else "",
    ) for inv in inventories]


@router.post("/inventories", response_model=InventoryResponse)
def create_inventory(
    req: CreateInventoryRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    inv = AnsibleInventory(name=req.name, group_id=req.groupId, content=req.content)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    _audit(db, current_user, "create", "inventory", inv.name, {}, "success",
           request.client.host if request.client else "")
    return InventoryResponse(
        id=inv.id, name=inv.name, groupId=inv.group_id,
        groupName=inv.group.name if inv.group else None,
        content=inv.content,
        createdAt=inv.created_at.isoformat() if inv.created_at else "",
        updatedAt=inv.updated_at.isoformat() if inv.updated_at else "",
    )


@router.get("/inventories/{inventory_id}", response_model=InventoryResponse)
def get_inventory(
    inventory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    inv = db.query(AnsibleInventory).filter(AnsibleInventory.id == inventory_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory를 찾을 수 없습니다.")
    return InventoryResponse(
        id=inv.id, name=inv.name, groupId=inv.group_id,
        groupName=inv.group.name if inv.group else None,
        content=inv.content,
        createdAt=inv.created_at.isoformat() if inv.created_at else "",
        updatedAt=inv.updated_at.isoformat() if inv.updated_at else "",
    )


@router.put("/inventories/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: int,
    req: UpdateInventoryRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    inv = db.query(AnsibleInventory).filter(AnsibleInventory.id == inventory_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory를 찾을 수 없습니다.")
    if req.name is not None:
        inv.name = req.name
    if req.groupId is not None:
        inv.group_id = req.groupId if req.groupId != 0 else None
    if req.content is not None:
        inv.content = req.content
    db.commit()
    db.refresh(inv)
    _audit(db, current_user, "update", "inventory", inv.name, {}, "success",
           request.client.host if request.client else "")
    return InventoryResponse(
        id=inv.id, name=inv.name, groupId=inv.group_id,
        groupName=inv.group.name if inv.group else None,
        content=inv.content,
        createdAt=inv.created_at.isoformat() if inv.created_at else "",
        updatedAt=inv.updated_at.isoformat() if inv.updated_at else "",
    )


@router.delete("/inventories/{inventory_id}", response_model=MessageResponse)
def delete_inventory(
    inventory_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    inv = db.query(AnsibleInventory).filter(AnsibleInventory.id == inventory_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory를 찾을 수 없습니다.")
    name = inv.name
    db.delete(inv)
    db.commit()
    _audit(db, current_user, "delete", "inventory", name, {}, "success",
           request.client.host if request.client else "")
    return MessageResponse(message=f"Inventory '{name}' 삭제 완료")


@router.post("/inventories/generate/{group_id}")
def generate_inventory(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    group = db.query(ServerGroup).filter(ServerGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    servers = db.query(Server).filter(Server.group_id == group_id).all()
    if not servers:
        raise HTTPException(status_code=400, detail="그룹에 서버가 없습니다.")

    lines = [f"[{group.name}]"]
    for s in servers:
        password = decrypt_password(s.ssh_password_enc)
        lines.append(
            f"{s.ip_address} ansible_port={s.ssh_port} "
            f"ansible_user={s.ssh_username} ansible_ssh_pass={password} "
            f"# {s.hostname}"
        )
    return {"content": "\n".join(lines)}


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

@router.post("/playbooks/{playbook_id}/execute", response_model=AnsibleExecutionResponse)
def execute_playbook(
    playbook_id: int,
    req: ExecutePlaybookRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    playbook = db.query(AnsiblePlaybook).filter(AnsiblePlaybook.id == playbook_id).first()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook을 찾을 수 없습니다.")
    inventory = db.query(AnsibleInventory).filter(AnsibleInventory.id == req.inventoryId).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory를 찾을 수 없습니다.")

    execution = AnsibleExecution(
        playbook_id=playbook.id,
        inventory_id=inventory.id,
        target_type="group",
        target_ids=[inventory.group_id] if inventory.group_id else [],
        status="running",
        started_by=current_user.id,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Write temp files and run in background
    import threading

    def _run():
        try:
            tmpdir = tempfile.mkdtemp(prefix=f"ansible-{execution.id}-")
            inv_path = os.path.join(tmpdir, "inventory.ini")
            pb_path = os.path.join(tmpdir, "playbook.yml")
            with open(inv_path, "w") as f:
                f.write(inventory.content)
            with open(pb_path, "w") as f:
                f.write(playbook.content)

            cmd = ["ansible-playbook", "-i", inv_path, pb_path]
            if req.extraVars:
                cmd.extend(["-e", req.extraVars])

            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300,
                env={**os.environ, "ANSIBLE_HOST_KEY_CHECKING": "False"},
            )

            from database import SessionLocal
            session = SessionLocal()
            ex = session.query(AnsibleExecution).filter(AnsibleExecution.id == execution.id).first()
            if ex:
                ex.log = proc.stdout + proc.stderr
                ex.status = "success" if proc.returncode == 0 else "failed"
                ex.finished_at = datetime.now(timezone.utc)
                session.commit()
            session.close()
        except Exception as e:
            from database import SessionLocal
            session = SessionLocal()
            ex = session.query(AnsibleExecution).filter(AnsibleExecution.id == execution.id).first()
            if ex:
                ex.log = str(e)
                ex.status = "failed"
                ex.finished_at = datetime.now(timezone.utc)
                session.commit()
            session.close()

    threading.Thread(target=_run, daemon=True).start()

    _audit(db, current_user, "execute", "playbook", playbook.name,
           {"inventoryId": inventory.id}, "success",
           request.client.host if request.client else "")

    return AnsibleExecutionResponse(
        id=execution.id, playbookId=playbook.id, playbookName=playbook.name,
        inventoryId=inventory.id,
        targetType=execution.target_type, targetIds=execution.target_ids,
        status=execution.status, startedBy=current_user.id,
        startedByName=current_user.user_id,
        log=execution.log,
        startedAt=execution.started_at.isoformat() if execution.started_at else "",
        finishedAt=execution.finished_at.isoformat() if execution.finished_at else None,
    )


@router.get("/executions", response_model=PaginatedResponse)
def list_executions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    total = db.query(AnsibleExecution).count()
    execs = (
        db.query(AnsibleExecution)
        .order_by(AnsibleExecution.started_at.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )
    items = []
    for ex in execs:
        items.append({
            "id": ex.id,
            "playbookId": ex.playbook_id,
            "playbookName": ex.playbook.name if ex.playbook else "",
            "inventoryId": ex.inventory_id,
            "targetType": ex.target_type,
            "targetIds": ex.target_ids,
            "status": ex.status,
            "startedBy": ex.started_by,
            "startedByName": ex.user.user_id if ex.user else "",
            "log": None,
            "startedAt": ex.started_at.isoformat() if ex.started_at else "",
            "finishedAt": ex.finished_at.isoformat() if ex.finished_at else None,
        })
    return PaginatedResponse(
        items=items, total=total, page=page, pageSize=pageSize,
        totalPages=(total + pageSize - 1) // pageSize,
    )


@router.get("/executions/{execution_id}", response_model=AnsibleExecutionResponse)
def get_execution(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    ex = db.query(AnsibleExecution).filter(AnsibleExecution.id == execution_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="실행 이력을 찾을 수 없습니다.")
    return AnsibleExecutionResponse(
        id=ex.id, playbookId=ex.playbook_id,
        playbookName=ex.playbook.name if ex.playbook else "",
        inventoryId=ex.inventory_id,
        targetType=ex.target_type, targetIds=ex.target_ids,
        status=ex.status, startedBy=ex.started_by,
        startedByName=ex.user.user_id if ex.user else "",
        log=ex.log,
        startedAt=ex.started_at.isoformat() if ex.started_at else "",
        finishedAt=ex.finished_at.isoformat() if ex.finished_at else None,
    )


# ---------------------------------------------------------------------------
# WebSocket for Ansible log streaming
# ---------------------------------------------------------------------------

@router.websocket("/ws/ansible")
async def ws_ansible(ws: WebSocket):
    import asyncio

    token = ws.query_params.get("token")
    execution_id = ws.query_params.get("executionId")

    if not token or not execution_id:
        await ws.close(code=1008, reason="Missing parameters")
        return

    try:
        from deps import decode_token
        decode_token(token)
    except Exception:
        await ws.close(code=1008, reason="Invalid token")
        return

    await ws.accept()

    try:
        from database import SessionLocal
        last_len = 0
        while True:
            session = SessionLocal()
            ex = session.query(AnsibleExecution).filter(
                AnsibleExecution.id == int(execution_id)
            ).first()
            if not ex:
                await ws.send_text("Execution not found")
                break
            current_log = ex.log or ""
            if len(current_log) > last_len:
                await ws.send_text(current_log[last_len:])
                last_len = len(current_log)
            if ex.status in ("success", "failed", "cancelled"):
                await ws.send_text(f"\n--- {ex.status.upper()} ---\n")
                break
            session.close()
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await ws.send_text(f"\nError: {e}\n")
    finally:
        await ws.close()
