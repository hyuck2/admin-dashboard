from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Auth ---
class LoginRequest(BaseModel):
    userId: str
    password: str


class UserPermissionItem(BaseModel):
    id: int
    type: str
    target: str
    action: str


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
    permissions: list[UserPermissionItem] = []


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
class ComponentInfo(BaseModel):
    name: str
    deployVersion: str
    k8sVersion: str
    syncStatus: str
    replicaCurrent: int
    replicaDesired: int


class AppStatusResponse(BaseModel):
    appName: str
    env: str
    deployVersion: str
    components: list[ComponentInfo]
    overallSyncStatus: str
    totalReplicaCurrent: int
    totalReplicaDesired: int


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
    componentName: str
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


# --- K8s ---
class ResourceUsage(BaseModel):
    total: int  # millicores for CPU, bytes for memory
    used: int
    percentage: float


class NodeStatus(BaseModel):
    total: int
    ready: int


class ClusterInfoResponse(BaseModel):
    name: str
    context: str
    apiServer: str
    status: str  # healthy / unhealthy / unknown
    nodes: Optional[NodeStatus] = None
    cpu: Optional[ResourceUsage] = None
    memory: Optional[ResourceUsage] = None


class ClusterListResponse(BaseModel):
    clusters: list[ClusterInfoResponse]
    total: int


class NodeTaint(BaseModel):
    key: str
    value: Optional[str] = None
    effect: str


class NodeInfoResponse(BaseModel):
    name: str
    status: str  # Ready / NotReady / Unknown
    roles: list[str]
    ip: Optional[str] = None
    cpu: Optional[ResourceUsage] = None
    memory: Optional[ResourceUsage] = None
    taints: list[NodeTaint] = []
    labels: dict[str, str] = {}
    createdAt: Optional[str] = None


class NamespaceInfoResponse(BaseModel):
    name: str
    status: str
    cpuUsage: float = 0  # cores
    memoryUsage: int = 0  # bytes
    podCount: int = 0
    createdAt: Optional[str] = None


class DeploymentInfoResponse(BaseModel):
    name: str
    namespace: str
    replicas: int
    readyReplicas: int
    availableReplicas: int
    status: str  # Running / Pending / Failed
    image: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PodLogEntry(BaseModel):
    podName: str
    containerName: str
    status: str
    logs: str


class DeploymentLogsResponse(BaseModel):
    deployment: str
    pods: list[PodLogEntry]
    totalPods: int


class ScaleRequest(BaseModel):
    replicas: int


class ScaleResponse(BaseModel):
    success: bool
    message: str
    replicas: int


class DeploymentYamlResponse(BaseModel):
    yaml: str


class DeploymentYamlUpdateRequest(BaseModel):
    yaml: str


class ContainerInfo(BaseModel):
    name: str


class PodInfoResponse(BaseModel):
    name: str
    status: str
    containers: list[ContainerInfo]


# --- Server Management ---
class ServerGroupResponse(BaseModel):
    id: int
    name: str
    description: str
    serverCount: int = 0
    createdAt: str
    updatedAt: str


class CreateServerGroupRequest(BaseModel):
    name: str
    description: str = ""


class UpdateServerGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ServerResponse(BaseModel):
    id: int
    hostname: str
    ipAddress: str
    sshPort: int
    sshUsername: str
    osInfo: str
    description: str
    groupId: Optional[int] = None
    groupName: Optional[str] = None
    status: str
    lastCheckedAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class CreateServerRequest(BaseModel):
    hostname: str
    ipAddress: str
    sshPort: int = 22
    sshUsername: str = "root"
    sshPassword: str = ""
    osInfo: str = ""
    description: str = ""
    groupId: Optional[int] = None


class UpdateServerRequest(BaseModel):
    hostname: Optional[str] = None
    ipAddress: Optional[str] = None
    sshPort: Optional[int] = None
    sshUsername: Optional[str] = None
    sshPassword: Optional[str] = None
    osInfo: Optional[str] = None
    description: Optional[str] = None
    groupId: Optional[int] = None


class BulkCreateServerRequest(BaseModel):
    servers: list[CreateServerRequest]


class SshTestResult(BaseModel):
    serverId: int
    hostname: str
    ipAddress: str
    success: bool
    message: str
    osInfo: str = ""


class SshTestBulkRequest(BaseModel):
    serverIds: list[int]


class GroupExecuteRequest(BaseModel):
    command: str


class GroupExecuteResult(BaseModel):
    serverId: int
    hostname: str
    ipAddress: str
    exitCode: int
    stdout: str
    stderr: str


# --- Metric Sources ---
class MetricSourceResponse(BaseModel):
    id: int
    name: str
    url: str
    description: str
    isActive: bool
    createdAt: str
    updatedAt: str


class CreateMetricSourceRequest(BaseModel):
    name: str
    url: str
    description: str = ""
    isActive: bool = True


class UpdateMetricSourceRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None


class MetricTargetResponse(BaseModel):
    instance: str
    job: str
    health: str
    matchedServerId: Optional[int] = None
    matchedHostname: Optional[str] = None


class ServerMetricsResponse(BaseModel):
    cpu: list[list] = []
    memory: list[list] = []
    disk: list[list] = []


# --- Ansible ---
class PlaybookResponse(BaseModel):
    id: int
    name: str
    description: str
    content: str
    createdAt: str
    updatedAt: str


class CreatePlaybookRequest(BaseModel):
    name: str
    description: str = ""
    content: str


class UpdatePlaybookRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None


class InventoryResponse(BaseModel):
    id: int
    name: str
    groupId: Optional[int] = None
    groupName: Optional[str] = None
    content: str
    createdAt: str
    updatedAt: str


class CreateInventoryRequest(BaseModel):
    name: str
    groupId: Optional[int] = None
    content: str


class UpdateInventoryRequest(BaseModel):
    name: Optional[str] = None
    groupId: Optional[int] = None
    content: Optional[str] = None


class ExecutePlaybookRequest(BaseModel):
    inventoryId: int
    extraVars: Optional[str] = None


class AnsibleExecutionResponse(BaseModel):
    id: int
    playbookId: int
    playbookName: str
    inventoryId: Optional[int] = None
    targetType: str
    targetIds: list
    status: str
    startedBy: int
    startedByName: str = ""
    log: Optional[str] = None
    startedAt: str
    finishedAt: Optional[str] = None
