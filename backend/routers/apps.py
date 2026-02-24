import os
import subprocess
import logging

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from config import (
    BANANA_DEPLOY_GIT_URL, BANANA_DEPLOY_LOCAL_PATH, DEPLOY_GIT_BRANCH,
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

def _sync_repo(git_url: str, local_path: str, branch: str = "master") -> str:
    """Clone if not exists, otherwise fetch + reset to origin/{branch}. Returns local_path."""
    if os.path.isdir(os.path.join(local_path, ".git")):
        # Fetch latest changes from remote
        result = _run(["git", "-C", local_path, "fetch", "--all", "--tags"])
        if result.returncode != 0:
            logger.warning("git fetch failed for %s: %s", local_path, result.stderr)
            # Continue with existing state if fetch fails (network issues, etc.)

        # Reset to match remote branch exactly (discards local changes)
        result = _run(["git", "-C", local_path, "reset", "--hard", f"origin/{branch}"])
        if result.returncode != 0:
            logger.error("git reset failed for %s: %s", local_path, result.stderr)
            raise HTTPException(status_code=500, detail=f"Failed to sync repo: {result.stderr}")

        logger.info("Synced repo %s to %s", local_path, branch)
    else:
        # Clone repo for the first time
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        result = _run(["git", "clone", "-b", branch, git_url, local_path])
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"git clone failed: {result.stderr}")
        logger.info("Cloned repo to %s", local_path)
    return local_path


def _sync_banana_deploy() -> str:
    """Sync banana-deploy repo and return local path."""
    return _sync_repo(inject_token(BANANA_DEPLOY_GIT_URL), BANANA_DEPLOY_LOCAL_PATH, DEPLOY_GIT_BRANCH)


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


def _get_k8s_info(component_name: str, env: str, repo_name: str = None) -> dict:
    """
    Get K8s deployment info.
    - For multi-component apps: namespace = {repo_name}-{env}, deployment = {component_name}-{env}
    - For single-component apps: namespace = {component_name}-{env}, deployment = {component_name}-{env}
    """
    if repo_name:
        ns = f"{repo_name}-{env}"
        deploy_name = f"{component_name}-{env}"
    else:
        # Backward compatibility: single component app
        ns = f"{component_name}-{env}"
        deploy_name = f"{component_name}-{env}"

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
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.warning("Failed to sync deploy repo: %s", str(e))
        return []

    apps = []
    discovered_apps = set()

    # Scan repo folders (e.g., project1, project2)
    for repo_folder in os.listdir(deploy_path):
        if repo_folder in EXCLUDED_DIRS:
            continue

        repo_path = os.path.join(deploy_path, repo_folder)
        if not os.path.isdir(repo_path):
            continue

        image_dir = os.path.join(repo_path, "image")
        if not os.path.isdir(image_dir):
            continue

        discovered_apps.add(repo_folder)

        # Find all component folders ending with -ui
        component_folders = []
        for item in os.listdir(repo_path):
            item_path = os.path.join(repo_path, item)
            if os.path.isdir(item_path) and item.endswith("-ui"):
                common_yaml = os.path.join(item_path, "common.yaml")
                if os.path.isfile(common_yaml):
                    component_folders.append(item)

        if not component_folders:
            continue

        # Process each environment
        for env_file in os.listdir(image_dir):
            if not env_file.endswith(".yaml"):
                continue
            env = env_file.replace(".yaml", "")
            deploy_version = _get_deploy_version(deploy_path, repo_folder, env)

            # Gather component info
            components = []
            total_replica_current = 0
            total_replica_desired = 0
            all_synced = True

            for comp_name in sorted(component_folders):
                k8s_info = _get_k8s_info(comp_name, env, repo_folder)
                comp_sync = "Synced" if deploy_version == k8s_info["k8sVersion"] else "OutOfSync"

                if comp_sync == "OutOfSync":
                    all_synced = False

                components.append({
                    "name": comp_name,
                    "deployVersion": deploy_version,
                    "k8sVersion": k8s_info["k8sVersion"],
                    "syncStatus": comp_sync,
                    "replicaCurrent": k8s_info["replicaCurrent"],
                    "replicaDesired": k8s_info["replicaDesired"],
                })

                total_replica_current += k8s_info["replicaCurrent"]
                total_replica_desired += k8s_info["replicaDesired"]

            apps.append({
                "appName": repo_folder,
                "env": env,
                "deployVersion": deploy_version,
                "components": components,
                "overallSyncStatus": "Synced" if all_synced else "OutOfSync",
                "totalReplicaCurrent": total_replica_current,
                "totalReplicaDesired": total_replica_desired,
            })

    # Auto-create app_deploy permissions
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
    env: str = Query(..., description="Environment (prod/stage)"),
    current_user: User = Depends(get_current_user),
):
    # Get tags from deploy repo git history instead of app repo
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.warning("Failed to sync deploy repo: %s", str(e))
        raise HTTPException(status_code=503, detail="Deploy repository not configured.")

    env_yaml_path = f"{appName}/image/{env}.yaml"

    # Get git log for the specific env yaml file to find previous versions
    result = _run([
        "git", "-C", deploy_path, "log",
        "--format=%H %aI",
        "--all",
        "-100",  # Last 100 commits
        "--", env_yaml_path
    ])

    if result.returncode != 0:
        logger.warning("git log failed: %s", result.stderr)
        return []

    # Extract tags from each commit
    tags_dict = {}
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.strip().split(" ", 1)
        if len(parts) < 2:
            continue
        commit_hash = parts[0]
        commit_date = parts[1]

        # Get the tag value from this commit
        show_result = _run([
            "git", "-C", deploy_path, "show",
            f"{commit_hash}:{env_yaml_path}"
        ])

        if show_result.returncode == 0:
            try:
                data = yaml.safe_load(show_result.stdout)
                if data and "image" in data and "tag" in data["image"]:
                    tag = data["image"]["tag"]
                    if tag not in tags_dict:
                        tags_dict[tag] = commit_date
            except Exception:
                pass

    # Convert to list and sort by version
    tags = [{"tag": tag, "createdAt": date} for tag, date in tags_dict.items()]
    tags.sort(key=lambda x: x["tag"], reverse=True)

    return tags


@router.post("/rollback", response_model=MessageResponse)
def rollback(
    req: RollbackRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "app_deploy", req.appName, "write")
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.error("Failed to sync deploy repo: %s", str(e))
        raise HTTPException(status_code=503, detail="Deploy repository not configured. Set DEPLOY_GIT_URL in environment.")

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

    git_push_success = False
    if commit_result.returncode == 0:
        from config import DEPLOY_GIT_BRANCH
        push_result = _run(["git", "-C", deploy_path, "push", "origin", DEPLOY_GIT_BRANCH])
        if push_result.returncode == 0:
            git_push_success = True
            logger.info("Git push successful for %s %s to %s", req.appName, req.env, req.targetVersion)
        else:
            logger.warning("git push failed (GIT_TOKEN may not be set): %s", push_result.stderr)
    else:
        logger.warning("git commit returned code %d: %s", commit_result.returncode, commit_result.stderr)

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

    message = f"Rollback to {req.targetVersion} completed (K8s deployed)"
    if not git_push_success:
        message += " ⚠️ Deploy repo not updated (GIT_TOKEN not configured)"

    return {"message": message}


@router.post("/replica", response_model=MessageResponse)
def change_replica(
    req: ReplicaChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "app_deploy", req.appName, "write")
    ns = f"{req.appName}-{req.env}"
    deploy_name = f"{req.componentName}-{req.env}"

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
        target_type="component",
        target_name=req.componentName,
        detail={
            "appName": req.appName,
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
