import logging
from typing import Optional

import yaml

logger = logging.getLogger(__name__)


class KubeconfigParser:
    def __init__(self, kubeconfig_path: str):
        self._path = kubeconfig_path
        self._config: dict = {}

    def load_config(self) -> dict:
        with open(self._path, "r") as f:
            self._config = yaml.safe_load(f)
        return self._config

    def get_contexts(self) -> list[dict]:
        if not self._config:
            self.load_config()
        contexts = []
        for ctx in self._config.get("contexts", []):
            contexts.append({
                "name": ctx["name"],
                "cluster": ctx["context"]["cluster"],
                "user": ctx["context"].get("user", ""),
                "namespace": ctx["context"].get("namespace", "default"),
            })
        return contexts

    def get_cluster_info(self, cluster_name: str) -> Optional[dict]:
        if not self._config:
            self.load_config()
        for cluster in self._config.get("clusters", []):
            if cluster["name"] == cluster_name:
                c = cluster.get("cluster", {})
                return {
                    "server": c.get("server", ""),
                    "certificate_authority": c.get("certificate-authority-data", ""),
                    "insecure_skip_tls": c.get("insecure-skip-tls-verify", False),
                }
        return None

    def get_current_context(self) -> str:
        if not self._config:
            self.load_config()
        return self._config.get("current-context", "")

    def get_all_context_names(self) -> list[str]:
        return [ctx["name"] for ctx in self.get_contexts()]
