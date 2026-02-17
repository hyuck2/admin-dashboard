from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, Enum, DateTime, JSON, ForeignKey, Table
)
from sqlalchemy.orm import relationship

from database import Base

user_groups = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)

group_permissions = Table(
    "group_permissions",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False, default="")
    role = Column(Enum("admin", "user"), nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    password_changed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    groups = relationship("Group", secondary=user_groups, back_populates="members")
    permissions = relationship("Permission", secondary=user_permissions)
    audit_logs = relationship("AuditLog", back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    permissions = relationship("Permission", secondary=group_permissions, back_populates="groups")
    members = relationship("User", secondary=user_groups, back_populates="groups")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(Enum("app_deploy", "page_access"), nullable=False)
    target = Column(String(100), nullable=False)
    action = Column(Enum("read", "write"), nullable=False)

    groups = relationship("Group", secondary=group_permissions, back_populates="permissions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    menu = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_name = Column(String(200), nullable=False)
    detail = Column(JSON, nullable=True)
    result = Column(Enum("success", "failed"), nullable=False, default="success")
    ip_address = Column(String(45), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
