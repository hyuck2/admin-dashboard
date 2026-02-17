import os

BANANA_ORG_PATH = os.getenv("BANANA_ORG_PATH", "C:/Users/hyuck2/code/banana-org")
BANANA_DEPLOY_PATH = os.getenv("BANANA_DEPLOY_PATH", "C:/Users/hyuck2/code/banana-org/banana-deploy")
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://admin:admin@localhost:3306/admin_dashboard")
JWT_SECRET = os.getenv("JWT_SECRET", "banana-admin-secret")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))
