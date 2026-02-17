import os
import subprocess

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from config import BANANA_ORG_PATH, BANANA_DEPLOY_PATH
from database import get_db
from models import User, AuditLog
from schemas import (
    AppStatusResponse, AppTagResponse, RollbackRequest, ReplicaChangeRequest, MessageResponse
)
from deps import get_current_user

router = APIRouter(prefix="/apps", tags=["apps"])

EXCLUDED_DIRS = {"common-chart", ".git", "admin-dashboard-frontend", "admin-dashboard-backend"}


def _run(cmd: list[str], cwd: str = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=60)


def _get_deploy_version(app_name: str, env: str) -> str:
    env_yaml_path = os.path.join(BANANA_DEPLOY_PATH, app_name, "image", f"{env}.yaml")
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

    # image format: "app1:v0.3.0" or "registry/app1:v0.3.0"
    k8s_version = image.split(":")[-1] if ":" in image else "unknown"

    return {"k8sVersion": k8s_version, "replicaDesired": desired, "replicaCurrent": current}


@router.get("", response_model=list[AppStatusResponse])
def get_apps(current_user: User = Depends(get_current_user)):
    apps = []

    for entry in os.listdir(BANANA_DEPLOY_PATH):
        if entry in EXCLUDED_DIRS:
            continue
        common_yaml = os.path.join(BANANA_DEPLOY_PATH, entry, "common.yaml")
        if not os.path.isfile(common_yaml):
            continue

        image_dir = os.path.join(BANANA_DEPLOY_PATH, entry, "image")
        if not os.path.isdir(image_dir):
            continue

        for env_file in os.listdir(image_dir):
            if not env_file.endswith(".yaml"):
                continue
            env = env_file.replace(".yaml", "")
            deploy_version = _get_deploy_version(entry, env)
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

    return apps


@router.get("/tags", response_model=list[AppTagResponse])
def get_tags(
    appName: str = Query(..., description="App name"),
    current_user: User = Depends(get_current_user),
):
    repo_path = os.path.join(BANANA_ORG_PATH, appName)
    if not os.path.isdir(repo_path):
        raise HTTPException(status_code=404, detail=f"App repo '{appName}' not found")

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
    tag = f"{req.appName}-{req.env}-{req.targetVersion}"

    # Load image to Kind cluster
    kind_result = _run([
        "kind", "load", "docker-image",
        f"{req.appName}:{req.targetVersion}",
        "--name", "cluster-staging"
    ])

    # Execute rollback script
    result = _run(
        ["bash", "rollback-helm-deploy.sh", tag],
        cwd=BANANA_DEPLOY_PATH,
    )

    success = result.returncode == 0

    # Record audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="rollback",
        menu="apps",
        target_type="app",
        target_name=req.appName,
        detail={
            "env": req.env,
            "targetVersion": req.targetVersion,
            "tag": tag,
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
