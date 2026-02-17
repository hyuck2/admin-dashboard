from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User, Group, Permission, AuditLog
from schemas import (
    CreateUserRequest, UpdateUserRequest, UserResponse,
    CreateGroupRequest, UpdateGroupRequest, GroupResponse,
    PermissionResponse, MessageResponse,
)
from deps import get_current_user, hash_password, user_to_response

router = APIRouter(tags=["users"])


def group_to_response(group: Group) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "createdAt": group.created_at.isoformat() if group.created_at else "",
        "updatedAt": group.updated_at.isoformat() if group.updated_at else "",
        "permissions": [p.id for p in group.permissions],
        "members": [u.id for u in group.members],
    }


def _audit(db: Session, user: User, action: str, target_type: str, target_name: str, detail: dict, request: Request):
    db.add(AuditLog(
        user_id=user.id,
        action=action,
        menu="users",
        target_type=target_type,
        target_name=target_name,
        detail=detail,
        result="success",
        ip_address=request.client.host if request.client else "",
    ))


# --- Users ---
@router.get("/users", response_model=list[UserResponse])
def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [user_to_response(u) for u in users]


@router.post("/users", response_model=UserResponse)
def create_user(
    req: CreateUserRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.user_id == req.userId).first():
        raise HTTPException(status_code=400, detail="User ID already exists")

    user = User(
        user_id=req.userId,
        password_hash=hash_password(req.password),
        department=req.department,
        role=req.role,
        is_active=True,
        password_changed=False,
    )

    if req.groups:
        groups = db.query(Group).filter(Group.id.in_(req.groups)).all()
        user.groups = groups

    db.add(user)
    db.commit()
    db.refresh(user)

    _audit(db, current_user, "create", "user", req.userId, {"department": req.department, "role": req.role}, request)
    db.commit()

    return user_to_response(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes = {}
    if req.department is not None:
        changes["department"] = req.department
        user.department = req.department
    if req.role is not None:
        changes["role"] = req.role
        user.role = req.role
    if req.isActive is not None:
        changes["isActive"] = req.isActive
        user.is_active = req.isActive
    if req.groups is not None:
        changes["groups"] = req.groups
        groups = db.query(Group).filter(Group.id.in_(req.groups)).all()
        user.groups = groups

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    _audit(db, current_user, "update", "user", user.user_id, changes, request)
    db.commit()

    return user_to_response(user)


@router.delete("/users/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_name = user.user_id
    db.delete(user)
    db.commit()

    _audit(db, current_user, "delete", "user", user_name, {}, request)
    db.commit()

    return {"message": f"User '{user_name}' deleted"}


# --- Groups ---
@router.get("/groups", response_model=list[GroupResponse])
def get_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    groups = db.query(Group).all()
    return [group_to_response(g) for g in groups]


@router.post("/groups", response_model=GroupResponse)
def create_group(
    req: CreateGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(Group).filter(Group.name == req.name).first():
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = Group(name=req.name, description=req.description)

    if req.permissions:
        perms = db.query(Permission).filter(Permission.id.in_(req.permissions)).all()
        group.permissions = perms

    db.add(group)
    db.commit()
    db.refresh(group)

    _audit(db, current_user, "create", "group", req.name, {"description": req.description}, request)
    db.commit()

    return group_to_response(group)


@router.put("/groups/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    req: UpdateGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    changes = {}
    if req.name is not None:
        changes["name"] = req.name
        group.name = req.name
    if req.description is not None:
        changes["description"] = req.description
        group.description = req.description
    if req.permissions is not None:
        changes["permissions"] = req.permissions
        perms = db.query(Permission).filter(Permission.id.in_(req.permissions)).all()
        group.permissions = perms

    group.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(group)

    _audit(db, current_user, "update", "group", group.name, changes, request)
    db.commit()

    return group_to_response(group)


@router.delete("/groups/{group_id}", response_model=MessageResponse)
def delete_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group_name = group.name
    db.delete(group)
    db.commit()

    _audit(db, current_user, "delete", "group", group_name, {}, request)
    db.commit()

    return {"message": f"Group '{group_name}' deleted"}


# --- Permissions ---
@router.get("/permissions", response_model=list[PermissionResponse])
def get_permissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    perms = db.query(Permission).all()
    return [{"id": p.id, "type": p.type, "target": p.target, "action": p.action} for p in perms]
