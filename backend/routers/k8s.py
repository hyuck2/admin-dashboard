import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from kubernetes.client.exceptions import ApiException
from sqlalchemy.orm import Session

from config import KUBECONFIG_PATH
from database import get_db
from models import User, AuditLog
from schemas import (
    ClusterInfoResponse, ClusterListResponse, NodeInfoResponse, NodeTaint,
    ResourceUsage, NodeStatus, NamespaceInfoResponse,
    DeploymentInfoResponse, DeploymentLogsResponse, PodLogEntry,
    ScaleRequest, ScaleResponse, MessageResponse,
)
from deps import get_current_user
from services.k8s_client import K8sClientManager, parse_cpu, parse_memory
from services.kubeconfig_parser import KubeconfigParser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/k8s", tags=["k8s"])

_parser = KubeconfigParser(KUBECONFIG_PATH)
_k8s = K8sClientManager(KUBECONFIG_PATH)


def _audit(db, user, action, target_type, target_name, detail, result, ip):
    db.add(AuditLog(
        user_id=user.id, action=action, menu="k8s",
        target_type=target_type, target_name=target_name,
        detail=detail, result=result, ip_address=ip,
    ))
    db.commit()


# ---------------------------------------------------------------------------
# Clusters
# ---------------------------------------------------------------------------

@router.get("/clusters", response_model=ClusterListResponse)
def list_clusters(current_user: User = Depends(get_current_user)):
    _parser.load_config()
    contexts = _parser.get_contexts()
    clusters = []

    for ctx in contexts:
        cluster_info = _parser.get_cluster_info(ctx["cluster"])
        api_server = cluster_info["server"] if cluster_info else "unknown"
        context_name = ctx["name"]

        healthy = _k8s.test_connection(context_name)
        status = "healthy" if healthy else "unhealthy"

        node_status = None
        cpu_usage = None
        mem_usage = None

        if healthy:
            try:
                core = _k8s.core_v1(context_name)
                nodes = core.list_node().items
                ready_count = sum(
                    1 for n in nodes
                    if any(c.type == "Ready" and c.status == "True" for c in (n.status.conditions or []))
                )
                node_status = NodeStatus(total=len(nodes), ready=ready_count)

                # Aggregate allocatable resources
                total_cpu = 0
                total_mem = 0
                for n in nodes:
                    alloc = n.status.allocatable or {}
                    total_cpu += parse_cpu(alloc.get("cpu", "0"))
                    total_mem += parse_memory(alloc.get("memory", "0"))

                # Get used from metrics API
                used_cpu = 0
                used_mem = 0
                try:
                    metrics = _k8s.custom_objects(context_name).list_cluster_custom_object(
                        "metrics.k8s.io", "v1beta1", "nodes"
                    )
                    for item in metrics.get("items", []):
                        usage = item.get("usage", {})
                        used_cpu += parse_cpu(usage.get("cpu", "0"))
                        used_mem += parse_memory(usage.get("memory", "0"))
                except Exception:
                    pass

                cpu_usage = ResourceUsage(
                    total=total_cpu, used=used_cpu,
                    percentage=round(used_cpu / total_cpu * 100, 1) if total_cpu else 0,
                )
                mem_usage = ResourceUsage(
                    total=total_mem, used=used_mem,
                    percentage=round(used_mem / total_mem * 100, 1) if total_mem else 0,
                )
            except Exception as e:
                logger.warning("Failed to get cluster details for %s: %s", context_name, e)

        clusters.append(ClusterInfoResponse(
            name=ctx["cluster"],
            context=context_name,
            apiServer=api_server,
            status=status,
            nodes=node_status,
            cpu=cpu_usage,
            memory=mem_usage,
        ))

    return ClusterListResponse(clusters=clusters, total=len(clusters))


@router.get("/clusters/{context}/nodes", response_model=list[NodeInfoResponse])
def list_nodes(context: str, current_user: User = Depends(get_current_user)):
    try:
        core = _k8s.core_v1(context)
        nodes = core.list_node().items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Get node metrics
    node_metrics = {}
    try:
        metrics = _k8s.custom_objects(context).list_cluster_custom_object(
            "metrics.k8s.io", "v1beta1", "nodes"
        )
        for item in metrics.get("items", []):
            name = item["metadata"]["name"]
            usage = item.get("usage", {})
            node_metrics[name] = {
                "cpu": parse_cpu(usage.get("cpu", "0")),
                "memory": parse_memory(usage.get("memory", "0")),
            }
    except Exception:
        pass

    result = []
    for n in nodes:
        alloc = n.status.allocatable or {}
        total_cpu = parse_cpu(alloc.get("cpu", "0"))
        total_mem = parse_memory(alloc.get("memory", "0"))
        used = node_metrics.get(n.metadata.name, {"cpu": 0, "memory": 0})

        # Determine status
        status = "Unknown"
        for cond in (n.status.conditions or []):
            if cond.type == "Ready":
                status = "Ready" if cond.status == "True" else "NotReady"

        # Roles from labels
        roles = []
        for label_key in (n.metadata.labels or {}):
            if label_key.startswith("node-role.kubernetes.io/"):
                roles.append(label_key.split("/")[1])
        if not roles:
            roles = ["worker"]

        # Taints
        taints = []
        for t in (n.spec.taints or []):
            taints.append(NodeTaint(key=t.key, value=t.value, effect=t.effect))

        result.append(NodeInfoResponse(
            name=n.metadata.name,
            status=status,
            roles=roles,
            cpu=ResourceUsage(
                total=total_cpu, used=used["cpu"],
                percentage=round(used["cpu"] / total_cpu * 100, 1) if total_cpu else 0,
            ),
            memory=ResourceUsage(
                total=total_mem, used=used["memory"],
                percentage=round(used["memory"] / total_mem * 100, 1) if total_mem else 0,
            ),
            taints=taints,
            labels=dict(n.metadata.labels or {}),
            createdAt=n.metadata.creation_timestamp.isoformat() if n.metadata.creation_timestamp else None,
        ))

    return result


# ---------------------------------------------------------------------------
# Namespaces
# ---------------------------------------------------------------------------

@router.get("/clusters/{context}/namespaces", response_model=list[NamespaceInfoResponse])
def list_namespaces(context: str, current_user: User = Depends(get_current_user)):
    try:
        core = _k8s.core_v1(context)
        namespaces = core.list_namespace().items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Pod metrics per namespace
    ns_metrics: dict[str, dict] = {}
    try:
        metrics = _k8s.custom_objects(context).list_cluster_custom_object(
            "metrics.k8s.io", "v1beta1", "pods"
        )
        for item in metrics.get("items", []):
            ns = item["metadata"]["namespace"]
            if ns not in ns_metrics:
                ns_metrics[ns] = {"cpu": 0, "memory": 0}
            for container in item.get("containers", []):
                usage = container.get("usage", {})
                ns_metrics[ns]["cpu"] += parse_cpu(usage.get("cpu", "0"))
                ns_metrics[ns]["memory"] += parse_memory(usage.get("memory", "0"))
    except Exception:
        pass

    # Pod counts per namespace
    ns_pod_counts: dict[str, int] = {}
    try:
        pods = core.list_pod_for_all_namespaces().items
        for pod in pods:
            ns = pod.metadata.namespace
            ns_pod_counts[ns] = ns_pod_counts.get(ns, 0) + 1
    except Exception:
        pass

    result = []
    for ns in namespaces:
        name = ns.metadata.name
        m = ns_metrics.get(name, {"cpu": 0, "memory": 0})
        result.append(NamespaceInfoResponse(
            name=name,
            status=ns.status.phase if ns.status else "Unknown",
            cpuUsage=round(m["cpu"] / 1000, 3),  # millicores -> cores
            memoryUsage=m["memory"],
            podCount=ns_pod_counts.get(name, 0),
            createdAt=ns.metadata.creation_timestamp.isoformat() if ns.metadata.creation_timestamp else None,
        ))

    return result


# ---------------------------------------------------------------------------
# Deployments
# ---------------------------------------------------------------------------

@router.get("/clusters/{context}/namespaces/{namespace}/deployments", response_model=list[DeploymentInfoResponse])
def list_deployments(
    context: str,
    namespace: str,
    current_user: User = Depends(get_current_user),
):
    try:
        apps = _k8s.apps_v1(context)
        deploys = apps.list_namespaced_deployment(namespace).items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    result = []
    for d in deploys:
        replicas = d.spec.replicas or 0
        ready = d.status.ready_replicas or 0
        available = d.status.available_replicas or 0

        if ready == replicas and replicas > 0:
            status = "Running"
        elif ready == 0 and replicas > 0:
            status = "Pending"
        else:
            status = "Running"

        image = ""
        if d.spec.template.spec.containers:
            image = d.spec.template.spec.containers[0].image or ""

        result.append(DeploymentInfoResponse(
            name=d.metadata.name,
            namespace=namespace,
            replicas=replicas,
            readyReplicas=ready,
            availableReplicas=available,
            status=status,
            image=image,
            createdAt=d.metadata.creation_timestamp.isoformat() if d.metadata.creation_timestamp else None,
        ))

    return result


@router.get("/clusters/{context}/namespaces/{namespace}/deployments/{name}", response_model=DeploymentInfoResponse)
def get_deployment(
    context: str,
    namespace: str,
    name: str,
    current_user: User = Depends(get_current_user),
):
    try:
        d = _k8s.apps_v1(context).read_namespaced_deployment(name, namespace)
    except ApiException as e:
        raise HTTPException(status_code=e.status or 500, detail=e.reason)

    replicas = d.spec.replicas or 0
    ready = d.status.ready_replicas or 0
    available = d.status.available_replicas or 0
    status = "Running" if ready == replicas and replicas > 0 else "Pending"

    image = ""
    if d.spec.template.spec.containers:
        image = d.spec.template.spec.containers[0].image or ""

    return DeploymentInfoResponse(
        name=d.metadata.name,
        namespace=namespace,
        replicas=replicas,
        readyReplicas=ready,
        availableReplicas=available,
        status=status,
        image=image,
        createdAt=d.metadata.creation_timestamp.isoformat() if d.metadata.creation_timestamp else None,
    )


@router.get("/clusters/{context}/namespaces/{namespace}/deployments/{name}/describe")
def describe_deployment(
    context: str,
    namespace: str,
    name: str,
    current_user: User = Depends(get_current_user),
):
    try:
        apps = _k8s.apps_v1(context)
        core = _k8s.core_v1(context)
        d = apps.read_namespaced_deployment(name, namespace)
    except ApiException as e:
        raise HTTPException(status_code=e.status or 500, detail=e.reason)

    lines = []
    lines.append(f"Name:               {d.metadata.name}")
    lines.append(f"Namespace:          {namespace}")
    lines.append(f"CreationTimestamp:   {d.metadata.creation_timestamp}")
    lines.append(f"Labels:             {d.metadata.labels}")
    lines.append(f"Replicas:           {d.spec.replicas} desired | "
                 f"{d.status.updated_replicas or 0} updated | "
                 f"{d.status.replicas or 0} total | "
                 f"{d.status.available_replicas or 0} available | "
                 f"{d.status.unavailable_replicas or 0} unavailable")

    # Containers
    for c in d.spec.template.spec.containers:
        lines.append(f"\nContainer:          {c.name}")
        lines.append(f"  Image:            {c.image}")
        if c.ports:
            lines.append(f"  Ports:            {', '.join(str(p.container_port) for p in c.ports)}")
        if c.resources:
            if c.resources.requests:
                lines.append(f"  Requests:         cpu={c.resources.requests.get('cpu','')}, memory={c.resources.requests.get('memory','')}")
            if c.resources.limits:
                lines.append(f"  Limits:           cpu={c.resources.limits.get('cpu','')}, memory={c.resources.limits.get('memory','')}")

    # Conditions
    lines.append("\nConditions:")
    for cond in (d.status.conditions or []):
        lines.append(f"  {cond.type}: {cond.status} ({cond.reason})")

    # Events
    try:
        events = core.list_namespaced_event(
            namespace,
            field_selector=f"involvedObject.name={name},involvedObject.kind=Deployment"
        ).items
        if events:
            lines.append("\nEvents:")
            lines.append(f"  {'Type':<10} {'Reason':<20} {'Age':<15} {'Message'}")
            for ev in events[-10:]:
                age = ""
                if ev.last_timestamp:
                    delta = datetime.now(timezone.utc) - ev.last_timestamp.replace(tzinfo=timezone.utc)
                    mins = int(delta.total_seconds() / 60)
                    age = f"{mins}m" if mins < 60 else f"{mins // 60}h{mins % 60}m"
                lines.append(f"  {ev.type or '':<10} {ev.reason or '':<20} {age:<15} {ev.message or ''}")
    except Exception:
        pass

    return {"describe": "\n".join(lines)}


@router.get("/clusters/{context}/namespaces/{namespace}/deployments/{name}/logs", response_model=DeploymentLogsResponse)
def get_deployment_logs(
    context: str,
    namespace: str,
    name: str,
    tailLines: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
):
    try:
        core = _k8s.core_v1(context)
        d = _k8s.apps_v1(context).read_namespaced_deployment(name, namespace)
    except ApiException as e:
        raise HTTPException(status_code=e.status or 500, detail=e.reason)

    # Find pods by label selector
    selector = d.spec.selector.match_labels or {}
    label_selector = ",".join(f"{k}={v}" for k, v in selector.items())

    try:
        pods = core.list_namespaced_pod(namespace, label_selector=label_selector).items
    except Exception:
        pods = []

    pod_logs = []
    for pod in pods:
        pod_status = pod.status.phase or "Unknown"
        for container in pod.spec.containers:
            log_text = ""
            try:
                log_text = core.read_namespaced_pod_log(
                    pod.metadata.name,
                    namespace,
                    container=container.name,
                    tail_lines=tailLines,
                )
            except Exception as e:
                log_text = f"Error reading logs: {e}"

            pod_logs.append(PodLogEntry(
                podName=pod.metadata.name,
                containerName=container.name,
                status=pod_status,
                logs=log_text,
            ))

    return DeploymentLogsResponse(
        deployment=name,
        pods=pod_logs,
        totalPods=len(pods),
    )


# ---------------------------------------------------------------------------
# Actions (scale, restart) - with audit log
# ---------------------------------------------------------------------------

@router.patch("/clusters/{context}/namespaces/{namespace}/deployments/{name}/scale", response_model=ScaleResponse)
def scale_deployment(
    context: str,
    namespace: str,
    name: str,
    req: ScaleRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        apps = _k8s.apps_v1(context)
        d = apps.read_namespaced_deployment(name, namespace)
        old_replicas = d.spec.replicas or 0
        d.spec.replicas = req.replicas
        apps.patch_namespaced_deployment(name, namespace, {"spec": {"replicas": req.replicas}})
    except ApiException as e:
        _audit(db, current_user, "scale", "deployment", f"{context}/{namespace}/{name}",
               {"replicas": req.replicas, "error": str(e)}, "failed",
               request.client.host if request.client else "")
        raise HTTPException(status_code=e.status or 500, detail=e.reason)

    _audit(db, current_user, "scale", "deployment", f"{context}/{namespace}/{name}",
           {"from": old_replicas, "to": req.replicas}, "success",
           request.client.host if request.client else "")

    return ScaleResponse(success=True, message=f"Scaled to {req.replicas}", replicas=req.replicas)


@router.post("/clusters/{context}/namespaces/{namespace}/deployments/{name}/restart", response_model=MessageResponse)
def restart_deployment(
    context: str,
    namespace: str,
    name: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        apps = _k8s.apps_v1(context)
        # Rolling restart via annotation update
        now = datetime.now(timezone.utc).isoformat()
        body = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/restartedAt": now,
                        }
                    }
                }
            }
        }
        apps.patch_namespaced_deployment(name, namespace, body)
    except ApiException as e:
        _audit(db, current_user, "restart", "deployment", f"{context}/{namespace}/{name}",
               {"error": str(e)}, "failed",
               request.client.host if request.client else "")
        raise HTTPException(status_code=e.status or 500, detail=e.reason)

    _audit(db, current_user, "restart", "deployment", f"{context}/{namespace}/{name}",
           {}, "success",
           request.client.host if request.client else "")

    return MessageResponse(message=f"Deployment {name} restarting")
