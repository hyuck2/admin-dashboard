from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Auth ---
class LoginRequest(BaseModel):
    userId: str
    password: str


class UserResponse(BaseModel):
    id: int
    userId: str
    department: str
    role: str
    isActive: bool
    passwordChanged: bool
    createdAt: str
    updatedAt: str
    groups: list[int]


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class ChangePasswordResponse(BaseModel):
    message: str
    user: UserResponse


# --- App ---
class AppStatusResponse(BaseModel):
    appName: str
    env: str
    deployVersion: str
    k8sVersion: str
    syncStatus: str
    replicaCurrent: int
    replicaDesired: int


class AppTagResponse(BaseModel):
    tag: str
    createdAt: str


class RollbackRequest(BaseModel):
    appName: str
    env: str
    targetVersion: str


class ReplicaChangeRequest(BaseModel):
    appName: str
    env: str
    replicas: int


# --- User Management ---
class CreateUserRequest(BaseModel):
    userId: str
    password: str
    department: str
    role: str
    groups: list[int] = []


class UpdateUserRequest(BaseModel):
    department: Optional[str] = None
    role: Optional[str] = None
    isActive: Optional[bool] = None
    groups: Optional[list[int]] = None


# --- Group ---
class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    createdAt: str
    updatedAt: str
    permissions: list[int]
    members: list[int]


class CreateGroupRequest(BaseModel):
    name: str
    description: str
    permissions: list[int] = []


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[int]] = None


# --- Permission ---
class PermissionResponse(BaseModel):
    id: int
    type: str
    target: str
    action: str


# --- Audit ---
class AuditLogResponse(BaseModel):
    id: int
    userId: int
    userName: str
    action: str
    menu: str
    targetType: str
    targetName: str
    detail: dict
    result: str
    ipAddress: str
    createdAt: str


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    pageSize: int
    totalPages: int


class MessageResponse(BaseModel):
    message: str
