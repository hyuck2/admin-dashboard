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


def _get_k8s_info(component_name: str, env: str, repo_name: str = None, deploy_path: str = None) -> dict:
    """
    Get K8s deployment info.
    - namespace: {env}-{repo_name} (e.g., prod-project1)
    - deployment: from common.yaml's appname or app.name field
    """
    if repo_name:
        # Multi-component app: read deployment name from common.yaml
        ns = f"{env}-{repo_name}"

        # Try to read deployment name from common.yaml
        deploy_name = component_name  # fallback
        if deploy_path:
            # Path: {deploy_path}/{repo_name}/{component_name}/common.yaml
            common_yaml_path = os.path.join(deploy_path, repo_name, component_name, "common.yaml")
            logger.debug("Reading deployment name from: %s", common_yaml_path)
            try:
                with open(common_yaml_path, "r") as f:
                    common_data = yaml.safe_load(f)
                if common_data:
                    # Try app.name first (production format), then appname (legacy)
                    app_name_from_yaml = common_data.get("app", {}).get("name")
                    if not app_name_from_yaml:
                        app_name_from_yaml = common_data.get("appname")

                    if app_name_from_yaml:
                        deploy_name = app_name_from_yaml
                        logger.debug("Using deployment name from yaml: %s", deploy_name)
                    else:
                        logger.warning("No app.name or appname found in %s, using folder name: %s", common_yaml_path, component_name)
                else:
                    logger.warning("Empty yaml data in %s", common_yaml_path)
            except FileNotFoundError:
                logger.warning("common.yaml not found at %s, using folder name: %s", common_yaml_path, component_name)
            except Exception as e:
                logger.warning("Failed to read appname from %s: %s, using folder name: %s", common_yaml_path, str(e), component_name)
    else:
        # Backward compatibility: single component app
        ns = f"{env}-{component_name}"
        deploy_name = component_name

    result = _run([
        "kubectl", "get", "deploy", deploy_name,
        "-n", ns,
        "-o", "jsonpath={.spec.replicas} {.status.readyReplicas} {.spec.template.spec.containers[0].image}"
    ])

    if result.returncode != 0:
        logger.debug("kubectl get deploy failed for %s in ns %s: %s", deploy_name, ns, result.stderr)
        return {"k8sVersion": "unknown", "replicaDesired": 0, "replicaCurrent": 0}

    try:
        parts = result.stdout.strip().split(" ", 2)

        # Parse replicas (handle empty strings and whitespace)
        desired_str = parts[0].strip() if len(parts) > 0 else ""
        current_str = parts[1].strip() if len(parts) > 1 else ""

        desired = int(desired_str) if desired_str and desired_str.isdigit() else 0
        current = int(current_str) if current_str and current_str.isdigit() else 0

        # Parse image
        image = parts[2].strip() if len(parts) > 2 else ""
        k8s_version = image.split(":")[-1] if ":" in image else "unknown"

        return {"k8sVersion": k8s_version, "replicaDesired": desired, "replicaCurrent": current}
    except (ValueError, IndexError) as e:
        logger.warning("Failed to parse kubectl output for %s: %s (output: %s)", deploy_name, str(e), result.stdout[:100])
        return {"k8sVersion": "unknown", "replicaDesired": 0, "replicaCurrent": 0}


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
                k8s_info = _get_k8s_info(comp_name, env, repo_folder, deploy_path)
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


def _get_app_repos_config(deploy_path: str) -> dict:
    """Read apps-git.yaml from deploy repo."""
    apps_git_path = os.path.join(deploy_path, "apps-git.yaml")
    if not os.path.isfile(apps_git_path):
        logger.warning("apps-git.yaml not found at %s", apps_git_path)
        return {}

    try:
        with open(apps_git_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return data or {}
    except Exception as e:
        logger.error("Failed to read apps-git.yaml: %s", str(e))
        return {}


@router.get("/tags", response_model=list[AppTagResponse])
def get_tags(
    appName: str = Query(..., description="App name"),
    env: str = Query(..., description="Environment (not used, for API compatibility)"),
    current_user: User = Depends(get_current_user),
):
    """
    Get all available versions from app's git repository.
    Returns all tags regardless of environment.
    """
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.warning("Failed to sync deploy repo: %s", str(e))
        raise HTTPException(status_code=503, detail="Deploy repository not configured.")

    # Read apps-git.yaml
    apps_config = _get_app_repos_config(deploy_path)
    if appName not in apps_config:
        logger.warning("App %s not found in apps-git.yaml", appName)
        raise HTTPException(status_code=404, detail=f"App '{appName}' not configured in apps-git.yaml")

    app_info = apps_config[appName]
    git_url = app_info.get("git_url")
    branch = app_info.get("branch", "master")

    if not git_url:
        raise HTTPException(status_code=404, detail=f"git_url not configured for app '{appName}'")

    # Sync app repo
    local_path = os.path.join(APP_REPOS_LOCAL_PATH, appName)
    try:
        _sync_repo(inject_token(git_url), local_path, branch)
    except Exception as e:
        logger.error("Failed to sync app repo %s: %s", appName, str(e))
        raise HTTPException(status_code=503, detail=f"Failed to sync app repository: {str(e)}")

    # Get all git tags from app repo
    result = _run([
        "git", "-C", local_path, "tag",
        "--sort=-creatordate",
        "--format=%(refname:short) %(creatordate:iso8601)"
    ])

    if result.returncode != 0:
        logger.warning("git tag failed for %s: %s", appName, result.stderr)
        return []

    # Parse tags
    tags = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.strip().split(" ", 1)
        tag_name = parts[0]
        created_at = parts[1] if len(parts) > 1 else ""

        tags.append({
            "tag": tag_name,
            "createdAt": created_at
        })

    return tags


@router.post("/rollback", response_model=MessageResponse)
def rollback(
    req: RollbackRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Rollback app to a specific version.
    Calls rollback_and_deploy.sh which:
    1. Updates image/{env}.yaml
    2. Git commit + tag {app}-{env}-{version}
    3. Git push
    4. Deploys to K8s
    """
    require_permission(current_user, "app_deploy", req.appName, "write")
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.error("Failed to sync deploy repo: %s", str(e))
        raise HTTPException(status_code=503, detail="Deploy repository not configured.")

    # Validate app directory exists
    env_yaml_path = os.path.join(deploy_path, req.appName, "image", f"{req.env}.yaml")
    if not os.path.isfile(env_yaml_path):
        raise HTTPException(status_code=404, detail=f"App '{req.appName}' or environment '{req.env}' not found")

    logger.info("Rolling back %s %s to %s", req.appName, req.env, req.targetVersion)

    # Call rollback_and_deploy.sh
    result = _run(
        ["bash", "rollback_and_deploy.sh", req.appName, req.env, req.targetVersion],
        cwd=deploy_path,
    )

    success = result.returncode == 0

    # Log the rollback attempt
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

    return {"message": f"Rollback to {req.targetVersion} completed and deployed"}


@router.post("/replica", response_model=MessageResponse)
def change_replica(
    req: ReplicaChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_permission(current_user, "app_deploy", req.appName, "write")

    # Namespace: {env}-{appName} (e.g., prod-project1)
    ns = f"{req.env}-{req.appName}"

    # Deployment name: read from component's common.yaml
    try:
        deploy_path = _sync_banana_deploy()
    except Exception as e:
        logger.error("Failed to sync deploy repo: %s", str(e))
        raise HTTPException(status_code=503, detail="Deploy repository not configured.")

    # Read deployment name from common.yaml
    common_yaml_path = os.path.join(deploy_path, req.appName, req.componentName, "common.yaml")
    deploy_name = req.componentName  # fallback

    try:
        with open(common_yaml_path, "r") as f:
            common_data = yaml.safe_load(f)
        if common_data:
            app_name_from_yaml = common_data.get("app", {}).get("name")
            if not app_name_from_yaml:
                app_name_from_yaml = common_data.get("appname")
            if app_name_from_yaml:
                deploy_name = app_name_from_yaml
                logger.debug("Using deployment name from yaml for scale: %s", deploy_name)
            else:
                logger.warning("No app.name or appname found in %s for scale, using component name: %s", common_yaml_path, req.componentName)
    except Exception as e:
        logger.warning("Failed to read deployment name from %s for scale: %s, using component name: %s", common_yaml_path, str(e), req.componentName)

    logger.info("Scaling deployment %s in namespace %s to %d replicas", deploy_name, ns, req.replicas)

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
