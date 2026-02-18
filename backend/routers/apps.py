import os
import subprocess
import logging

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from config import (
    BANANA_DEPLOY_GIT_URL, BANANA_DEPLOY_LOCAL_PATH,
    APP_REPOS_LOCAL_PATH, get_app_git_urls, inject_token,
)
from database import get_db
from models import User, Permission, AuditLog
from schemas import (
    AppStatusResponse, AppTagResponse, RollbackRequest, ReplicaChangeRequest, MessageResponse
)
from deps import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/apps", tags=["apps"])

EXCLUDED_DIRS = {"common-chart", ".git", "admin-dashboard-frontend", "admin-dashboard-backend"}


def _run(cmd: list[str], cwd: str = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=120)


# ---------------------------------------------------------------------------
# Git repo sync helpers
# ---------------------------------------------------------------------------

def _sync_repo(git_url: str, local_path: str) -> str:
    """Clone if not exists, otherwise fetch + reset to origin/master. Returns local_path."""
    if os.path.isdir(os.path.join(local_path, ".git")):
        result = _run(["git", "-C", local_path, "fetch", "--all", "--tags"])
        if result.returncode != 0:
            logger.warning("git fetch failed for %s: %s", local_path, result.stderr)
        _run(["git", "-C", local_path, "reset", "--hard", "origin/master"])
    else:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        result = _run(["git", "clone", git_url, local_path])
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"git clone failed: {result.stderr}")
    return local_path


def _sync_banana_deploy() -> str:
    """Sync banana-deploy repo and return local path."""
    return _sync_repo(inject_token(BANANA_DEPLOY_GIT_URL), BANANA_DEPLOY_LOCAL_PATH)


def _sync_app_repo(app_name: str) -> str:
    """Sync an app repo and return local path."""
    urls = get_app_git_urls()
    if app_name not in urls:
        raise HTTPException(status_code=404, detail=f"App '{app_name}' not configured")
    local_path = os.path.join(APP_REPOS_LOCAL_PATH, app_name)
    return _sync_repo(inject_token(urls[app_name]), local_path)


# ---------------------------------------------------------------------------
# K8s helpers
# ---------------------------------------------------------------------------

def _get_deploy_version(deploy_path: str, app_name: str, env: str) -> str:
    env_yaml_path = os.path.join(deploy_path, app_name, "image", f"{env}.yaml")
    if not os.path.isfile(env_yaml_path):
        return "unknown"
    with open(env_yaml_path, "r") as f:
        data = yaml.safe_load(f)
    return data.get("image", {}).get("tag", "unknown") if data else "unknown"


def _get_k8s_info(app_name: str, env: str) -> dict:
    ns = f"{app_name}-{env}"
    deploy_name = f"{app_name}-{env}"

    result = _run([
        "kubectl", "get", "deploy", deploy_name,
        "-n", ns,
        "-o", "jsonpath={.spec.replicas} {.status.readyReplicas} {.spec.template.spec.containers[0].image}"
    ])

    if result.returncode != 0:
        return {"k8sVersion": "unknown", "replicaDesired": 0, "replicaCurrent": 0}

    parts = result.stdout.strip().split(" ", 2)
    desired = int(parts[0]) if len(parts) > 0 and parts[0] else 0
    current = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    image = parts[2] if len(parts) > 2 else ""

    k8s_version = image.split(":")[-1] if ":" in image else "unknown"

    return {"k8sVersion": k8s_version, "replicaDesired": desired, "replicaCurrent": current}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AppStatusResponse])
def get_apps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deploy_path = _sync_banana_deploy()
    apps = []
    discovered_apps = set()

    for entry in os.listdir(deploy_path):
        if entry in EXCLUDED_DIRS:
            continue
        common_yaml = os.path.join(deploy_path, entry, "common.yaml")
        if not os.path.isfile(common_yaml):
            continue

        image_dir = os.path.join(deploy_path, entry, "image")
        if not os.path.isdir(image_dir):
            continue

        discovered_apps.add(entry)

        for env_file in os.listdir(image_dir):
            if not env_file.endswith(".yaml"):
                continue
            env = env_file.replace(".yaml", "")
            deploy_version = _get_deploy_version(deploy_path, entry, env)
            k8s_info = _get_k8s_info(entry, env)

            sync_status = "Synced" if deploy_version == k8s_info["k8sVersion"] else "OutOfSync"

            apps.append({
                "appName": entry,
                "env": env,
                "deployVersion": deploy_version,
                "k8sVersion": k8s_info["k8sVersion"],
                "syncStatus": sync_status,
                "replicaCurrent": k8s_info["replicaCurrent"],
                "replicaDesired": k8s_info["replicaDesired"],
            })

    # Auto-create app_deploy permissions for newly discovered apps
    existing_targets = {
        p.target for p in db.query(Permission).filter(Permission.type == "app_deploy").all()
    }
    for app_name in discovered_apps:
        if app_name not in existing_targets:
            db.add(Permission(type="app_deploy", target=app_name, action="write"))
            logger.info("Auto-created permission: app_deploy %s write", app_name)
    db.commit()

    return apps


@router.get("/tags", response_model=list[AppTagResponse])
def get_tags(
    appName: str = Query(..., description="App name"),
    current_user: User = Depends(get_current_user),
):
    repo_path = _sync_app_repo(appName)

    result = _run([
        "git", "-C", repo_path,
        "for-each-ref",
        "--format=%(refname:short) %(creatordate:iso8601)",
        "--sort=-version:refname",
        "refs/tags/"
    ])

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"git error: {result.stderr}")

    tags = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.strip().split(" ", 1)
        tag = parts[0]
        created_at = parts[1].strip() if len(parts) > 1 else ""
        tags.append({"tag": tag, "createdAt": created_at})

    return tags


@router.post("/rollback", response_model=MessageResponse)
def rollback(
    req: RollbackRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "app_deploy", req.appName, "write")
    deploy_path = _sync_banana_deploy()

    # Validate app directory exists
    common_yaml = os.path.join(deploy_path, req.appName, "common.yaml")
    if not os.path.isfile(common_yaml):
        raise HTTPException(status_code=404, detail=f"App '{req.appName}' not found in banana-deploy")

    env_yaml_path = os.path.join(deploy_path, req.appName, "image", f"{req.env}.yaml")
    if not os.path.isfile(env_yaml_path):
        raise HTTPException(status_code=404, detail=f"Environment '{req.env}' not found for {req.appName}")

    # 1. Update image tag in env yaml
    with open(env_yaml_path, "w") as f:
        yaml.dump({"image": {"tag": req.targetVersion}}, f, default_flow_style=False)

    # 2. Try loading image to Kind cluster (optional)
    try:
        _run([
            "kind", "load", "docker-image",
            f"{req.appName}:{req.targetVersion}",
            "--name", "cluster-staging"
        ])
    except FileNotFoundError:
        logger.info("kind not available, skipping image load")

    # 3. Git commit + push the yaml change
    _run(["git", "-C", deploy_path, "config", "user.email", "admin-dashboard@banana.local"])
    _run(["git", "-C", deploy_path, "config", "user.name", "admin-dashboard"])
    _run(["git", "-C", deploy_path, "add", env_yaml_path])
    commit_result = _run([
        "git", "-C", deploy_path, "commit",
        "-m", f"rollback: {req.appName} {req.env} to {req.targetVersion}",
    ])
    if commit_result.returncode == 0:
        push_result = _run(["git", "-C", deploy_path, "push", "origin", "master"])
        if push_result.returncode != 0:
            logger.warning("git push failed: %s", push_result.stderr)

    # 4. Deploy via bash helm-deploy.sh
    result = _run(
        ["bash", "helm-deploy.sh", req.appName, req.env],
        cwd=deploy_path,
    )

    success = result.returncode == 0

    audit = AuditLog(
        user_id=current_user.id,
        action="rollback",
        menu="apps",
        target_type="app",
        target_name=req.appName,
        detail={
            "env": req.env,
            "targetVersion": req.targetVersion,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        },
        result="success" if success else "failed",
        ip_address=request.client.host if request.client else "",
    )
    db.add(audit)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail=f"Rollback failed: {result.stderr}")

    return {"message": f"Rollback to {req.targetVersion} completed"}


@router.post("/replica", response_model=MessageResponse)
def change_replica(
    req: ReplicaChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "app_deploy", req.appName, "write")
    ns = f"{req.appName}-{req.env}"
    deploy_name = f"{req.appName}-{req.env}"

    result = _run([
        "kubectl", "scale", "deploy", deploy_name,
        "-n", ns,
        f"--replicas={req.replicas}"
    ])

    success = result.returncode == 0

    audit = AuditLog(
        user_id=current_user.id,
        action="scale",
        menu="apps",
        target_type="app",
        target_name=req.appName,
        detail={
            "env": req.env,
            "replicas": req.replicas,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
        },
        result="success" if success else "failed",
        ip_address=request.client.host if request.client else "",
    )
    db.add(audit)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail=f"Scale failed: {result.stderr}")

    return {"message": f"Replica changed to {req.replicas}"}
