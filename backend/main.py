from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, apps, users, audit, k8s

app = FastAPI(title="Admin Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(apps.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(k8s.router)


@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok"}
