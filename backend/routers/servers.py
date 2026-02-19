import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import get_db
from models import User, AuditLog, Server, ServerGroup
from schemas import (
    ServerGroupResponse, CreateServerGroupRequest, UpdateServerGroupRequest,
    ServerResponse, CreateServerRequest, UpdateServerRequest,
    BulkCreateServerRequest, SshTestResult, SshTestBulkRequest,
    GroupExecuteRequest, GroupExecuteResult, MessageResponse,
)
from deps import get_current_user, require_permission
from services.encryption import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/servers", tags=["servers"])


def _audit(db, user, action, target_type, target_name, detail, result, ip):
    db.add(AuditLog(
        user_id=user.id, action=action, menu="servers",
        target_type=target_type, target_name=target_name,
        detail=detail, result=result, ip_address=ip,
    ))
    db.commit()


def _server_to_response(s: Server) -> dict:
    return {
        "id": s.id,
        "hostname": s.hostname,
        "ipAddress": s.ip_address,
        "sshPort": s.ssh_port,
        "sshUsername": s.ssh_username,
        "osInfo": s.os_info,
        "description": s.description,
        "groupId": s.group_id,
        "groupName": s.group.name if s.group else None,
        "status": s.status,
        "lastCheckedAt": s.last_checked_at.isoformat() if s.last_checked_at else None,
        "createdAt": s.created_at.isoformat() if s.created_at else "",
        "updatedAt": s.updated_at.isoformat() if s.updated_at else "",
    }


# ---------------------------------------------------------------------------
# Server Groups
# ---------------------------------------------------------------------------

@router.get("/groups", response_model=list[ServerGroupResponse])
def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    groups = db.query(ServerGroup).order_by(ServerGroup.name).all()
    result = []
    for g in groups:
        count = db.query(Server).filter(Server.group_id == g.id).count()
        result.append(ServerGroupResponse(
            id=g.id, name=g.name, description=g.description,
            serverCount=count,
            createdAt=g.created_at.isoformat() if g.created_at else "",
            updatedAt=g.updated_at.isoformat() if g.updated_at else "",
        ))
    return result


@router.post("/groups", response_model=ServerGroupResponse)
def create_group(
    req: CreateServerGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    existing = db.query(ServerGroup).filter(ServerGroup.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 그룹명입니다.")
    g = ServerGroup(name=req.name, description=req.description)
    db.add(g)
    db.commit()
    db.refresh(g)
    _audit(db, current_user, "create", "server_group", g.name, {}, "success",
           request.client.host if request.client else "")
    return ServerGroupResponse(
        id=g.id, name=g.name, description=g.description, serverCount=0,
        createdAt=g.created_at.isoformat() if g.created_at else "",
        updatedAt=g.updated_at.isoformat() if g.updated_at else "",
    )


@router.put("/groups/{group_id}", response_model=ServerGroupResponse)
def update_group(
    group_id: int,
    req: UpdateServerGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    g = db.query(ServerGroup).filter(ServerGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    if req.name is not None:
        g.name = req.name
    if req.description is not None:
        g.description = req.description
    db.commit()
    db.refresh(g)
    count = db.query(Server).filter(Server.group_id == g.id).count()
    _audit(db, current_user, "update", "server_group", g.name, {}, "success",
           request.client.host if request.client else "")
    return ServerGroupResponse(
        id=g.id, name=g.name, description=g.description, serverCount=count,
        createdAt=g.created_at.isoformat() if g.created_at else "",
        updatedAt=g.updated_at.isoformat() if g.updated_at else "",
    )


@router.delete("/groups/{group_id}", response_model=MessageResponse)
def delete_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    g = db.query(ServerGroup).filter(ServerGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    name = g.name
    db.delete(g)
    db.commit()
    _audit(db, current_user, "delete", "server_group", name, {}, "success",
           request.client.host if request.client else "")
    return MessageResponse(message=f"그룹 '{name}' 삭제 완료")


# ---------------------------------------------------------------------------
# Servers
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[ServerResponse])
def list_servers(
    groupId: int | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    q = db.query(Server)
    if groupId is not None:
        q = q.filter(Server.group_id == groupId)
    if status:
        q = q.filter(Server.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Server.hostname.ilike(like)) |
            (Server.ip_address.ilike(like)) |
            (Server.description.ilike(like))
        )
    servers = q.order_by(Server.id).all()
    return [ServerResponse(**_server_to_response(s)) for s in servers]


@router.post("/", response_model=ServerResponse)
def create_server(
    req: CreateServerRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = Server(
        hostname=req.hostname,
        ip_address=req.ipAddress,
        ssh_port=req.sshPort,
        ssh_username=req.sshUsername,
        ssh_password_enc=encrypt_password(req.sshPassword),
        os_info=req.osInfo,
        description=req.description,
        group_id=req.groupId,
    )
    db.add(s)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail="동일 IP:포트 서버가 이미 존재합니다.")
        raise HTTPException(status_code=500, detail=str(e))
    db.refresh(s)
    _audit(db, current_user, "create", "server", f"{s.hostname}({s.ip_address})", {}, "success",
           request.client.host if request.client else "")
    return ServerResponse(**_server_to_response(s))


@router.post("/bulk", response_model=list[ServerResponse])
def bulk_create_servers(
    req: BulkCreateServerRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    created = []
    for item in req.servers:
        s = Server(
            hostname=item.hostname,
            ip_address=item.ipAddress,
            ssh_port=item.sshPort,
            ssh_username=item.sshUsername,
            ssh_password_enc=encrypt_password(item.sshPassword),
            os_info=item.osInfo,
            description=item.description,
            group_id=item.groupId,
        )
        db.add(s)
        created.append(s)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"대량 등록 실패: {e}")
    for s in created:
        db.refresh(s)
    _audit(db, current_user, "bulk_create", "server", f"{len(created)}대", {}, "success",
           request.client.host if request.client else "")
    return [ServerResponse(**_server_to_response(s)) for s in created]


@router.put("/{server_id}", response_model=ServerResponse)
def update_server(
    server_id: int,
    req: UpdateServerRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = db.query(Server).filter(Server.id == server_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다.")
    if req.hostname is not None:
        s.hostname = req.hostname
    if req.ipAddress is not None:
        s.ip_address = req.ipAddress
    if req.sshPort is not None:
        s.ssh_port = req.sshPort
    if req.sshUsername is not None:
        s.ssh_username = req.sshUsername
    if req.sshPassword is not None:
        s.ssh_password_enc = encrypt_password(req.sshPassword)
    if req.osInfo is not None:
        s.os_info = req.osInfo
    if req.description is not None:
        s.description = req.description
    if req.groupId is not None:
        s.group_id = req.groupId if req.groupId != 0 else None
    db.commit()
    db.refresh(s)
    _audit(db, current_user, "update", "server", f"{s.hostname}({s.ip_address})", {}, "success",
           request.client.host if request.client else "")
    return ServerResponse(**_server_to_response(s))


@router.delete("/{server_id}", response_model=MessageResponse)
def delete_server(
    server_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    s = db.query(Server).filter(Server.id == server_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다.")
    name = f"{s.hostname}({s.ip_address})"
    db.delete(s)
    db.commit()
    _audit(db, current_user, "delete", "server", name, {}, "success",
           request.client.host if request.client else "")
    return MessageResponse(message=f"서버 '{name}' 삭제 완료")


# ---------------------------------------------------------------------------
# SSH Test
# ---------------------------------------------------------------------------

def _test_ssh(server: Server) -> SshTestResult:
    import paramiko
    try:
        password = decrypt_password(server.ssh_password_enc)
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            server.ip_address, port=server.ssh_port,
            username=server.ssh_username, password=password,
            timeout=5, allow_agent=False, look_for_keys=False,
        )
        client.close()
        return SshTestResult(
            serverId=server.id, hostname=server.hostname,
            ipAddress=server.ip_address, success=True, message="SSH 접속 성공",
        )
    except Exception as e:
        return SshTestResult(
            serverId=server.id, hostname=server.hostname,
            ipAddress=server.ip_address, success=False, message=str(e),
        )


@router.post("/{server_id}/test-ssh", response_model=SshTestResult)
def test_ssh(
    server_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    s = db.query(Server).filter(Server.id == server_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다.")
    result = _test_ssh(s)
    s.status = "online" if result.success else "offline"
    s.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    return result


@router.post("/test-ssh-bulk", response_model=list[SshTestResult])
def test_ssh_bulk(
    req: SshTestBulkRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "read")
    servers = db.query(Server).filter(Server.id.in_(req.serverIds)).all()
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_test_ssh, s): s for s in servers}
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            s = futures[future]
            s.status = "online" if result.success else "offline"
            s.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    return results


# ---------------------------------------------------------------------------
# WebSocket SSH
# ---------------------------------------------------------------------------

@router.websocket("/ws/ssh")
async def ws_ssh(ws: WebSocket):
    import asyncio
    import threading
    import paramiko

    token = ws.query_params.get("token")
    server_id = ws.query_params.get("serverId")

    if not token or not server_id:
        await ws.close(code=1008, reason="Missing parameters")
        return

    try:
        from deps import decode_token
        payload = decode_token(token)
    except Exception:
        await ws.close(code=1008, reason="Invalid token")
        return

    await ws.accept()

    # Get server from DB
    try:
        from database import get_db as _get_db
        db_gen = _get_db()
        db = next(db_gen)
        server = db.query(Server).filter(Server.id == int(server_id)).first()
        if not server:
            await ws.send_text("\r\nError: Server not found\r\n")
            await ws.close()
            db.close()
            return
        password = decrypt_password(server.ssh_password_enc)
        host = server.ip_address
        port = server.ssh_port
        username = server.ssh_username
        hostname = server.hostname

        # Audit
        user = db.query(User).filter(User.user_id == payload["userId"]).first()
        if user:
            _audit(db, user, "ssh", "server", f"{hostname}({host})", {}, "success", "")
        db.close()
    except Exception as e:
        await ws.send_text(f"\r\nError: {e}\r\n")
        await ws.close()
        return

    # SSH connect
    try:
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_client.connect(host, port=port, username=username, password=password,
                           timeout=10, allow_agent=False, look_for_keys=False)
        channel = ssh_client.invoke_shell(term="xterm-256color", width=120, height=40)
    except Exception as e:
        await ws.send_text(f"\r\nSSH connection failed: {e}\r\n")
        await ws.close()
        return

    closed = False

    def read_from_ssh():
        nonlocal closed
        try:
            while not closed:
                if channel.recv_ready():
                    data = channel.recv(4096).decode("utf-8", errors="replace")
                    asyncio.run_coroutine_threadsafe(ws.send_text(data), loop)
                elif channel.exit_status_ready():
                    break
                else:
                    import time
                    time.sleep(0.05)
        except Exception:
            pass
        finally:
            closed = True

    loop = asyncio.get_event_loop()
    reader_thread = threading.Thread(target=read_from_ssh, daemon=True)
    reader_thread.start()

    try:
        while not closed:
            data = await ws.receive_text()
            if not closed and not channel.closed:
                channel.send(data)
    except WebSocketDisconnect:
        pass
    finally:
        closed = True
        channel.close()
        ssh_client.close()


# ---------------------------------------------------------------------------
# Group Command Execution
# ---------------------------------------------------------------------------

@router.post("/groups/{group_id}/execute", response_model=list[GroupExecuteResult])
def group_execute(
    group_id: int,
    req: GroupExecuteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "page_access", "servers", "write")
    group = db.query(ServerGroup).filter(ServerGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    servers = db.query(Server).filter(Server.group_id == group_id).all()
    if not servers:
        raise HTTPException(status_code=400, detail="그룹에 서버가 없습니다.")

    def _exec_on_server(server: Server) -> GroupExecuteResult:
        import paramiko
        try:
            password = decrypt_password(server.ssh_password_enc)
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                server.ip_address, port=server.ssh_port,
                username=server.ssh_username, password=password,
                timeout=10, allow_agent=False, look_for_keys=False,
            )
            _, stdout, stderr = client.exec_command(req.command, timeout=30)
            exit_code = stdout.channel.recv_exit_status()
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            client.close()
            return GroupExecuteResult(
                serverId=server.id, hostname=server.hostname,
                ipAddress=server.ip_address, exitCode=exit_code,
                stdout=out, stderr=err,
            )
        except Exception as e:
            return GroupExecuteResult(
                serverId=server.id, hostname=server.hostname,
                ipAddress=server.ip_address, exitCode=-1,
                stdout="", stderr=str(e),
            )

    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_exec_on_server, s): s for s in servers}
        for future in as_completed(futures):
            results.append(future.result())

    _audit(db, current_user, "group_execute", "server_group", group.name,
           {"command": req.command, "serverCount": len(servers)}, "success",
           request.client.host if request.client else "")
    return results
