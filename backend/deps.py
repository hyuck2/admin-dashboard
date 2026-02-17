import base64
import json
from datetime import datetime, timedelta, timezone

import jwt
import bcrypt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import JWT_SECRET, JWT_EXPIRE_HOURS
from database import get_db
from models import User

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "userId": user_id,
        "role": role,
        "exp": int(exp.timestamp() * 1000),
    }
    # Frontend uses base64-encoded JSON (not standard JWT)
    return base64.b64encode(json.dumps(payload).encode()).decode()


def decode_token(token: str) -> dict:
    try:
        payload = json.loads(base64.b64decode(token))
        if payload.get("exp", 0) < datetime.now(timezone.utc).timestamp() * 1000:
            raise HTTPException(status_code=401, detail="Token expired")
        return payload
    except (json.JSONDecodeError, Exception):
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user = db.query(User).filter(User.user_id == payload["userId"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    return user


def user_to_response(user: User) -> dict:
    return {
        "id": user.id,
        "userId": user.user_id,
        "department": user.department,
        "role": user.role,
        "isActive": user.is_active,
        "passwordChanged": user.password_changed,
        "createdAt": user.created_at.isoformat() if user.created_at else "",
        "updatedAt": user.updated_at.isoformat() if user.updated_at else "",
        "groups": [g.id for g in user.groups],
    }
