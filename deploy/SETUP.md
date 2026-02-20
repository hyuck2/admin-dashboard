# Admin Dashboard 설치 가이드 (격리망 환경)

> Rocky Linux 8.6 + k3s 클러스터 + Docker Compose 기반 배포

## 전체 흐름

```
[인터넷 PC]                              [격리망 서버 (Rocky 8.6)]
  1. 소스코드 + 베이스 이미지 준비  ──USB/SCP──►  3. 프라이빗 레지스트리에 베이스 이미지 push
                                                  4. 소스에서 빌드 (npm, pip, docker build)
                                                  5. docker compose up
```

---

## 1. 사전 요구사항

### 격리망 서버

| 항목 | 요구사항 |
|------|----------|
| OS | Rocky Linux 8.6+ |
| Docker | 20.10+ (docker compose v2 포함) |
| Node.js | 18+ (npm 포함) |
| Python | 3.11+ (pip 포함) |
| 포트 | 8080 (대시보드), 3306 (MySQL, 내부) |
| k3s | 이미 설치되어 있는 클러스터 (1~3개) |
| 디스크 | 최소 10GB (소스 + 이미지 + MySQL) |
| 프라이빗 레지스트리 | 베이스 이미지 저장용 (예: 192.168.1.100:5000) |

### 인터넷 PC

| 항목 | 요구사항 |
|------|----------|
| Git | 소스코드 clone |
| Docker Desktop | 베이스 이미지 pull용 |

---

## 2. 인터넷 PC에서 준비

### 2-1. 소스코드 clone

```powershell
git clone --recurse-submodules https://github.com/your-org/banana-org.git
cd banana-org
```

### 2-2. 베이스 이미지 pull & 태그 & push

```powershell
# 프라이빗 레지스트리 주소 설정
$REGISTRY = "192.168.1.100:5000"

# 베이스 이미지 pull
docker pull mysql:8.0
docker pull python:3.11-slim
docker pull nginx:alpine
docker pull node:22-alpine

# 태그 변경 (프라이빗 레지스트리 prefix)
docker tag mysql:8.0 ${REGISTRY}/mysql:8.0
docker tag python:3.11-slim ${REGISTRY}/python:3.11-slim
docker tag nginx:alpine ${REGISTRY}/nginx:alpine
docker tag node:22-alpine ${REGISTRY}/node:22-alpine

# push (네트워크로 서버 레지스트리에 접근 가능한 경우)
docker push ${REGISTRY}/mysql:8.0
docker push ${REGISTRY}/python:3.11-slim
docker push ${REGISTRY}/nginx:alpine
docker push ${REGISTRY}/node:22-alpine

# 또는 tar로 저장 후 USB 전송
docker save ${REGISTRY}/mysql:8.0 -o mysql.tar
docker save ${REGISTRY}/python:3.11-slim -o python.tar
docker save ${REGISTRY}/nginx:alpine -o nginx.tar
docker save ${REGISTRY}/node:22-alpine -o node.tar
# → 서버에서: docker load -i *.tar && docker push ...
```

### 2-3. 전송할 파일

```
banana-org/                           # 전체 소스코드
├── admin-dashboard/
│   ├── backend/                      # FastAPI 백엔드
│   ├── src/                          # React 프론트엔드
│   ├── deploy/                       # 배포 스크립트
│   │   ├── setup.sh                  # ← 실행 스크립트
│   │   ├── SETUP.md                  # ← 이 문서
│   │   ├── docker-compose.yml
│   │   ├── nginx.conf
│   │   ├── init.sql
│   │   └── .env.example
│   ├── package.json                  # npm dependencies
│   └── ...
├── banana-deploy/                    # Dockerfile들
└── ...
```

**전송 방법:**
```bash
# 서버로 전송 (SCP)
scp -r banana-org/ user@서버IP:/opt/

# 또는 USB로 복사
```

---

## 3. 격리망 서버 설정

### 3-1. Dockerfile 수정 (프라이빗 레지스트리 사용)

```bash
cd /opt/banana-org

# 프라이빗 레지스트리 주소
REGISTRY="192.168.1.100:5000"

# 백엔드 Dockerfile 수정
sed -i "s|FROM python:3.11-slim|FROM ${REGISTRY}/python:3.11-slim|" \
    banana-deploy/admin-dashboard-backend/Dockerfile

# 프론트엔드 Dockerfile 수정
sed -i "s|FROM node:22-alpine|FROM ${REGISTRY}/node:22-alpine|" \
    banana-deploy/admin-dashboard-frontend/Dockerfile
sed -i "s|FROM nginx:alpine|FROM ${REGISTRY}/nginx:alpine|" \
    banana-deploy/admin-dashboard-frontend/Dockerfile

# docker-compose.yml MySQL 이미지 수정
sed -i "s|image: mysql:8.0|image: ${REGISTRY}/mysql:8.0|" \
    admin-dashboard/deploy/docker-compose.yml
```

### 3-2. 초기 설정

```bash
cd /opt/banana-org/admin-dashboard/deploy

bash setup.sh init
```

이 명령어가:
- `.env.example` → `.env` 복사
- kubeconfig 설정 안내 출력

### 3-3. 환경변수 설정

```bash
vi .env
```

```bash
# 필수 수정 항목:
BACKEND_TAG=v0.2.1               # 빌드할 이미지 태그
FRONTEND_TAG=v0.3.2
DASHBOARD_PORT=8080              # 대시보드 접속 포트
MYSQL_ROOT_PASSWORD=<변경>       # MySQL root 비밀번호
MYSQL_PASSWORD=<변경>            # MySQL admin 비밀번호
JWT_SECRET=<변경>                # 인증 토큰 시크릿 (랜덤 문자열)

# SSH 비밀번호 암호화 키 (선택, 미설정 시 JWT_SECRET에서 자동 파생)
FERNET_KEY=

# Git 연동 (앱 배포 기능 사용 시, 선택):
GIT_TOKEN=ghp_xxxxxxxxxxxx              # GitHub/GitLab PAT
DEPLOY_GIT_URL=https://gitlab.internal/your-org/deploy.git
DEPLOY_GIT_BRANCH=master                # Deploy 저장소 브랜치
```

**중요:**
- `FERNET_KEY`: SSH 비밀번호를 DB에 암호화 저장하는 키. 서버 등록 시 입력한 비밀번호를 암호화함.
- `DEPLOY_GIT_URL`: Helm chart + app values가 있는 저장소 (앱 배포 기능용, 선택사항)

### 3-4. kubeconfig 설정

k3s 클러스터의 kubeconfig를 가져와서 병합합니다.

#### 단일 클러스터

```bash
cd /opt/banana-org/admin-dashboard/deploy

# k3s 마스터 노드에서 복사
cp /etc/rancher/k3s/k3s.yaml ./kubeconfig

# server 주소를 마스터 실제 IP로 변경
sed -i 's|https://127.0.0.1:6443|https://10.0.1.100:6443|' ./kubeconfig

# 연결 확인
kubectl --kubeconfig=./kubeconfig cluster-info
```

#### 멀티 클러스터 (3개)

```bash
# 각 마스터에서 kubeconfig 복사
scp root@k3s-1:/etc/rancher/k3s/k3s.yaml ./k3s-1.yaml
scp root@k3s-2:/etc/rancher/k3s/k3s.yaml ./k3s-2.yaml
scp root@k3s-3:/etc/rancher/k3s/k3s.yaml ./k3s-3.yaml

# 각 파일에서 클러스터/유저 이름과 서버 주소를 고유하게 변경
vi k3s-1.yaml   # cluster: cluster-prod, user: admin-prod, server: https://10.0.1.100:6443
vi k3s-2.yaml   # cluster: cluster-staging, user: admin-staging, server: https://10.0.1.101:6443
vi k3s-3.yaml   # cluster: cluster-dev, user: admin-dev, server: https://10.0.1.102:6443

# 병합
KUBECONFIG=k3s-1.yaml:k3s-2.yaml:k3s-3.yaml kubectl config view --flatten > ./kubeconfig

# 임시 파일 삭제
rm k3s-1.yaml k3s-2.yaml k3s-3.yaml

# 연결 확인
kubectl --kubeconfig=./kubeconfig cluster-info
kubectl --kubeconfig=./kubeconfig config get-contexts
```

---

## 4. 이미지 빌드

```bash
cd /opt/banana-org/admin-dashboard/deploy

bash setup.sh build
```

**빌드 과정:**
1. `npm install` + `npm run build` (React 프론트엔드)
2. `docker build` 백엔드 (`pip install` 포함)
3. `docker build` 프론트엔드 (빌드된 dist/ → nginx)

**소요 시간:** 5~10분 (네트워크/디스크 속도에 따라)

---

## 5. 서비스 시작

```bash
bash setup.sh start
```

출력 예시:
```
[INFO] Admin Dashboard를 시작합니다...
[INFO] 서비스 시작 중...
NAME              STATUS    PORTS
admin-mysql       running   0.0.0.0:3306->3306/tcp
admin-backend     running   0.0.0.0:8000->8000/tcp
admin-frontend    running   0.0.0.0:8080->80/tcp

[INFO] 접속 URL: http://10.0.1.50:8080
[INFO] 초기 계정: admin / admin
```

**첫 로그인 후:**
1. `admin / admin` 으로 로그인
2. 비밀번호 변경 (자동 안내됨)
3. K8s 관리 → 클러스터 목록에 k3s 클러스터 표시 확인

---

## 6. 운영 명령어

```bash
cd /opt/banana-org/admin-dashboard/deploy

# 상태 확인
bash setup.sh status

# 로그 보기 (전체)
bash setup.sh logs

# 특정 서비스 로그
bash setup.sh logs backend
bash setup.sh logs frontend
bash setup.sh logs mysql

# 서비스 중지
bash setup.sh stop

# 서비스 재시작
bash setup.sh restart

# DB 초기화 (모든 데이터 삭제)
bash setup.sh reset-db
```

---

## 7. 업데이트 절차

새 버전 배포 시:

```bash
cd /opt/banana-org

# 소스 업데이트 (git pull 또는 USB로 새 파일 복사)
git pull --recurse-submodules

# .env 태그 업데이트
vi admin-dashboard/deploy/.env
# BACKEND_TAG=v0.2.2
# FRONTEND_TAG=v0.3.3

cd admin-dashboard/deploy

# 재빌드 + 재시작
bash setup.sh build
bash setup.sh restart
```

---

## 8. 트러블슈팅

### npm install 실패
```bash
# npm 레지스트리 설정 (내부 npm registry 사용 시)
npm config set registry http://npm.internal/

# 또는 .npmrc 파일 생성
echo "registry=http://npm.internal/" > ~/.npmrc
```

### pip install 실패
```bash
# pip 인덱스 설정 (내부 PyPI 사용 시)
pip config set global.index-url http://pypi.internal/simple
pip config set global.trusted-host pypi.internal
```

### Docker build 실패 (베이스 이미지 pull 불가)
```bash
# Dockerfile이 프라이빗 레지스트리를 참조하는지 확인
grep FROM banana-deploy/admin-dashboard-backend/Dockerfile
# 출력: FROM 192.168.1.100:5000/python:3.11-slim

# 프라이빗 레지스트리에 이미지가 있는지 확인
curl -X GET http://192.168.1.100:5000/v2/_catalog
```

### MySQL 접속 실패
```bash
# MySQL 로그 확인
docker compose logs mysql

# MySQL 직접 접속
docker exec -it admin-mysql mysql -u admin -p admin_dashboard
```

### 백엔드 시작 실패
```bash
# 백엔드 로그 확인
docker compose logs backend

# 일반적인 원인:
# - DATABASE_URL 오류 → .env 확인
# - kubeconfig 권한 → chmod 600 kubeconfig
```

### K8s 클러스터 연결 안됨
```bash
# 백엔드 컨테이너 안에서 테스트
docker exec -it admin-backend kubectl cluster-info

# 원인: kubeconfig의 server 주소가 컨테이너에서 접근 불가
# 해결: 127.0.0.1 대신 실제 마스터 IP 사용
```

### 대시보드 접속 안됨
```bash
# 컨테이너 상태 확인
docker compose ps

# 방화벽 확인 (Rocky 8)
firewall-cmd --list-ports
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload
```

---

## 9. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  Docker Compose                                      │
│                                                      │
│  ┌──────────┐  :8080   ┌──────────┐  :8000          │
│  │ frontend │ ────────► │ backend  │                 │
│  │ (nginx)  │  /api/   │ (FastAPI)│──► k3s clusters │
│  └──────────┘          └──────────┘  (kubeconfig)   │
│                              │                       │
│                        ┌─────┴─────┐                │
│                        │   mysql   │                │
│                        │  (:3306)  │                │
│                        └───────────┘                │
└─────────────────────────────────────────────────────┘
```

**컴포넌트:**
- **frontend (nginx)**: React SPA + API/WebSocket 프록시
- **backend (FastAPI)**: REST API + WebSocket (SSH, K8s exec, Ansible)
- **mysql**: 사용자/권한/서버/감사로그 저장

**기능:**
- **K8s 클러스터 관리**: 클러스터/노드/네임스페이스/디플로이먼트 조회/관리
- **서버 관리**: SSH 서버 등록, SSH 접속 테스트 (OS 자동감지), 웹 SSH 터미널
- **서버 그룹**: 그룹별 SSH 명령 병렬 실행
- **메트릭 연동**: Prometheus/VictoriaMetrics 연동, 서버 CPU/Mem/Disk 모니터링
- **Ansible**: Playbook/Inventory 관리, 실행 이력, 실시간 로그 스트리밍
- **사용자/권한 관리**: 그룹 기반 권한, 감사 로그

---

## 10. 파일 구조

```
/opt/banana-org/
├── admin-dashboard/
│   ├── backend/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # 환경변수 설정
│   │   ├── routers/             # API endpoints
│   │   ├── models.py            # DB models
│   │   └── requirements.txt     # Python dependencies
│   ├── src/                     # React 프론트엔드
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   ├── package.json             # npm dependencies
│   └── deploy/                  # 배포 스크립트 (여기서 실행)
│       ├── setup.sh             # ← 메인 스크립트
│       ├── docker-compose.yml
│       ├── nginx.conf
│       ├── init.sql
│       ├── .env                 # 환경변수 (생성됨)
│       └── kubeconfig           # k3s config (생성됨)
└── banana-deploy/
    ├── admin-dashboard-backend/
    │   └── Dockerfile           # 백엔드 이미지 빌드용
    └── admin-dashboard-frontend/
        └── Dockerfile           # 프론트엔드 이미지 빌드용
```
