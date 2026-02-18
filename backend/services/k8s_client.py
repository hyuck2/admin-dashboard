import logging
from typing import Optional

from kubernetes import client, config

logger = logging.getLogger(__name__)


def parse_cpu(cpu_str: str) -> int:
    """Convert CPU string to millicores. '1' -> 1000, '500m' -> 500, '100n' -> 0"""
    if not cpu_str:
        return 0
    cpu_str = str(cpu_str)
    if cpu_str.endswith("n"):
        return int(cpu_str[:-1]) // 1_000_000
    if cpu_str.endswith("u"):
        return int(cpu_str[:-1]) // 1_000
    if cpu_str.endswith("m"):
        return int(cpu_str[:-1])
    return int(cpu_str) * 1000


def parse_memory(mem_str: str) -> int:
    """Convert memory string to bytes."""
    if not mem_str:
        return 0
    mem_str = str(mem_str)
    units = {
        "Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4,
        "K": 1000, "M": 1000**2, "G": 1000**3, "T": 1000**4,
    }
    for suffix, multiplier in units.items():
        if mem_str.endswith(suffix):
            return int(mem_str[: -len(suffix)]) * multiplier
    return int(mem_str)


class K8sClientManager:
    """Manages Kubernetes API clients for multiple clusters."""

    def __init__(self, kubeconfig_path: str):
        self._kubeconfig = kubeconfig_path
        self._clients: dict[str, client.ApiClient] = {}

    def _get_client(self, context_name: str) -> client.ApiClient:
        if context_name not in self._clients:
            api_client = config.new_client_from_config(
                config_file=self._kubeconfig,
                context=context_name,
            )
            self._clients[context_name] = api_client
        return self._clients[context_name]

    def core_v1(self, context: str) -> client.CoreV1Api:
        return client.CoreV1Api(self._get_client(context))

    def apps_v1(self, context: str) -> client.AppsV1Api:
        return client.AppsV1Api(self._get_client(context))

    def custom_objects(self, context: str) -> client.CustomObjectsApi:
        return client.CustomObjectsApi(self._get_client(context))

    def test_connection(self, context: str) -> bool:
        try:
            self.core_v1(context).list_namespace(_request_timeout=5)
            return True
        except Exception as e:
            logger.warning("Connection test failed for %s: %s", context, e)
            return False

    def close_client(self, context: str):
        c = self._clients.pop(context, None)
        if c:
            c.close()

    def close_all(self):
        for c in self._clients.values():
            c.close()
        self._clients.clear()
