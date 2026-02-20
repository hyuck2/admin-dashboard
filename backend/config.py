import os
from urllib.parse import urlparse, urlunparse

GIT_TOKEN = os.getenv("GIT_TOKEN", "")
DEPLOY_GIT_URL = os.getenv("DEPLOY_GIT_URL", "https://github.com/hyuck2/banana-deploy.git")
DEPLOY_GIT_BRANCH = os.getenv("DEPLOY_GIT_BRANCH", "master")
BANANA_DEPLOY_GIT_URL = DEPLOY_GIT_URL  # Legacy alias
BANANA_DEPLOY_LOCAL_PATH = os.getenv("BANANA_DEPLOY_LOCAL_PATH", "/tmp/banana-deploy")
APP_GIT_URLS = os.getenv("APP_GIT_URLS", "")  # Deprecated - apps are in deploy repo
APP_REPOS_LOCAL_PATH = os.getenv("APP_REPOS_LOCAL_PATH", "/tmp/app-repos")
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://admin:admin@localhost:3306/admin_dashboard")
JWT_SECRET = os.getenv("JWT_SECRET", "banana-admin-secret")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))
KUBECONFIG_PATH = os.getenv("KUBECONFIG_PATH", os.getenv("KUBECONFIG", os.path.expanduser("~/.kube/config")))
FERNET_KEY = os.getenv("FERNET_KEY", "")


def inject_token(url: str) -> str:
    """Inject GIT_TOKEN into https git URL: https://github.com/... -> https://{token}@github.com/..."""
    if not GIT_TOKEN:
        return url
    parsed = urlparse(url)
    authed = parsed._replace(netloc=f"{GIT_TOKEN}@{parsed.hostname}")
    return urlunparse(authed)


def get_app_git_urls() -> dict[str, str]:
    """Parse APP_GIT_URLS env: 'app1=url1,app2=url2' -> {app1: url1, app2: url2}"""
    result = {}
    for entry in APP_GIT_URLS.split(","):
        entry = entry.strip()
        if "=" in entry:
            name, url = entry.split("=", 1)
            result[name.strip()] = url.strip()
    return result
