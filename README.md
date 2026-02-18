# Admin Dashboard

UI 앱 배포/롤백, 사용자/권한 관리, 감사 로그를 위한 통합 관리 대시보드.

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + MySQL
- **Infra**: K8s (K3s/Kind) + Helm + Traefik

---

## Setup (K8s 배포)

> **전제 조건**: K3s(또는 Kind) 클러스터 + Traefik IngressController가 이미 구성되어 있어야 합니다.

### 1. MySQL 배포

```bash
kubectl apply -f admin-dashboard/k8s/mysql.yaml
kubectl -n admin-db wait --for=condition=available deployment/mysql --timeout=120s
```

생성되는 리소스:
- Namespace `admin-db`, MySQL 8.0 Deployment + Service (port 3306)
- 스키마 자동 생성 (users, groups, permissions, audit_logs 등)
- 시드 데이터: `admin/admin` 계정, 7개 권한, 관리자 그룹

> **사내 환경 참고**: `mysql.yaml`의 `nodeSelector`를 실제 워커 노드 hostname으로 변경하세요.

### 2. Backend RBAC 생성

백엔드가 `kubectl`로 Deployment 조회/스케일링을 하기 위한 ServiceAccount + ClusterRole입니다.

```bash
kubectl apply -f admin-dashboard/k8s/backend-rbac.yaml
```

### 3. Git Token Secret 생성 (필수)

백엔드가 banana-deploy, app1, app2 등의 **private git repo**에 접근하기 위해 필요합니다.
GitHub PAT 또는 GitLab Access Token을 K8s Secret으로 생성하세요.

```bash
kubectl -n admin-dashboard-backend-prod create secret generic git-token \
  --from-literal=GIT_TOKEN=<YOUR_GIT_TOKEN>
```

> **이 Secret이 없으면 앱 목록 조회, 태그 조회, 롤백이 동작하지 않습니다.**

토큰에 필요한 권한:
- GitHub: `repo` (Full control of private repositories)
- GitLab: `read_repository` 이상

### 4. Docker 이미지 빌드

`banana-org` 루트 디렉토리에서 실행합니다.

```bash
# Frontend
docker build -f banana-deploy/admin-dashboard-frontend/Dockerfile \
  -t admin-dashboard-frontend:v0.1.0 .

# Backend
docker build -f banana-deploy/admin-dashboard-backend/Dockerfile \
  -t admin-dashboard-backend:v0.1.0 .
```

> **사내 격리망**: 베이스 이미지(`python:3.11-slim`, `node:22-alpine`, `nginx:alpine`)를 사내 레지스트리에서 pull하도록 Dockerfile을 수정하세요. kubectl, helm 바이너리도 오프라인 설치로 변경이 필요합니다.

### 5. 이미지 로드 (Kind 환경만 해당)

```bash
kind load docker-image admin-dashboard-frontend:v0.1.0 --name <cluster-name>
kind load docker-image admin-dashboard-backend:v0.1.0 --name <cluster-name>
```

> K3s나 사내 환경에서는 사내 레지스트리에 push 후 `common.yaml`의 `image.repository`를 레지스트리 주소로 변경합니다.

### 6. Helm 배포

```bash
cd banana-deploy
bash helm-deploy.sh admin-dashboard-frontend prod
bash helm-deploy.sh admin-dashboard-backend prod
```

### 7. 접속 확인

```
http://<클러스터IP>/prod/admin-dashboard-frontend/
```

초기 계정: `admin` / `admin` (첫 로그인 시 비밀번호 변경 필수)

---

## 환경변수 (Backend)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `DATABASE_URL` | MySQL 접속 URL | `mysql+pymysql://admin:admin@localhost:3306/admin_dashboard` |
| `GIT_TOKEN` | Git private repo 인증 토큰 | (없음, **K8s Secret으로 주입**) |
| `BANANA_DEPLOY_GIT_URL` | banana-deploy repo URL | `https://github.com/hyuck2/banana-deploy.git` |
| `APP_GIT_URLS` | 앱 repo URL 목록 (쉼표 구분) | `app1=https://...app1.git,app2=https://...app2.git` |
| `JWT_SECRET` | JWT 서명 시크릿 | `banana-admin-secret` |
| `JWT_EXPIRE_HOURS` | JWT 만료 시간(시) | `24` |

> **사내 환경**: Git URL을 사내 GitLab/Gitea 주소로 변경하세요. `banana-deploy/admin-dashboard-backend/common.yaml`의 `extraEnv`에서 수정합니다.

---

## 사내 환경 (Rocky 8.6 + K3s) 배포 체크리스트

- [ ] 사내 Git 서버에 banana-deploy, app1, app2, admin-dashboard repo 미러링
- [ ] `banana-deploy/admin-dashboard-backend/common.yaml`의 Git URL을 사내 주소로 변경
- [ ] Git Token Secret 생성 (사내 GitLab/Gitea 토큰)
- [ ] `mysql.yaml`의 `nodeSelector` hostname을 실제 워커 노드로 변경
- [ ] `mysql.yaml`의 hostPath(`/data/mysql`) 경로가 존재하고 쓰기 가능한지 확인
- [ ] Dockerfile의 베이스 이미지를 사내 레지스트리 경로로 변경
- [ ] Dockerfile 내 kubectl/helm 설치를 오프라인 바이너리로 변경
- [ ] Docker 이미지 빌드 후 사내 레지스트리에 push
- [ ] `common.yaml`의 `image.repository`를 사내 레지스트리 주소로 변경
- [ ] RBAC 적용 → MySQL 배포 → Secret 생성 → Helm 배포 순서로 실행
- [ ] `http://<서버IP>/prod/admin-dashboard-frontend/` 접속 확인

---

## 로컬 개발 (Dev Mode)

```bash
# 1. MySQL 실행 (K8s port-forward 또는 로컬 Docker)
kubectl -n admin-db port-forward svc/mysql 3306:3306

# 2. Backend 실행
cd admin-dashboard/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Frontend 실행 (Vite dev server, /api → localhost:8000 프록시 자동)
cd admin-dashboard
npm install
npm run dev
```

---

## 프로젝트 구조

```
admin-dashboard/
├── src/                    # React 프론트엔드
│   ├── services/           #   API 클라이언트
│   ├── pages/              #   페이지 컴포넌트
│   ├── components/         #   공통 UI 컴포넌트
│   ├── types/              #   TypeScript 타입 정의
│   └── contexts/           #   Auth, Theme Context
├── backend/                # FastAPI 백엔드
│   ├── main.py             #   앱 진입점
│   ├── config.py           #   환경변수 설정
│   ├── models.py           #   SQLAlchemy ORM 모델
│   ├── schemas.py          #   Pydantic 요청/응답 스키마
│   ├── deps.py             #   인증, 비밀번호 해싱
│   └── routers/            #   API 라우터
│       ├── auth.py         #     로그인, 비밀번호 변경
│       ├── apps.py         #     앱 목록, 태그, 롤백, 레플리카
│       ├── users.py        #     사용자/그룹 CRUD
│       └── audit.py        #     감사 로그 조회
├── k8s/                    # K8s 매니페스트
│   ├── mysql.yaml          #   MySQL Deployment + 스키마
│   └── backend-rbac.yaml   #   Backend ServiceAccount + RBAC
└── docs/
    └── requirements.md     # 상세 요구사항 문서
```
