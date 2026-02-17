from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import (
    LoginRequest, LoginResponse, ChangePasswordRequest, ChangePasswordResponse, UserResponse
)
from deps import verify_password, hash_password, create_token, get_current_user, user_to_response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == req.userId).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    token = create_token(user.user_id, user.role)
    return {"token": token, "user": user_to_response(user)}


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(req.newPassword)
    current_user.password_changed = True
    db.commit()
    db.refresh(current_user)

    return {"message": "Password changed successfully", "user": user_to_response(current_user)}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)
