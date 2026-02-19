# Admin Dashboard 설치 가이드 (격리망 환경)

> Rocky Linux 8.6 + k3s 클러스터 + Docker Compose 기반 배포

## 전체 흐름

```
[인터넷 PC (Windows)]                    [격리망 서버 (Rocky 8.6)]
  1. Docker 이미지 빌드/pull     ──USB/SCP──►  3. Docker 이미지 로드
  2. tar 파일로 저장                          4. 설정 (kubeconfig, .env)
                                              5. docker compose up
```

---

## 1. 사전 요구사항

### 격리망 서버

| 항목 | 요구사항 |
|------|----------|
| OS | Rocky Linux 8.6+ |
| Docker | 20.10+ (docker compose v2 포함) |
| 포트 | 8080 (대시보드), 3306 (MySQL, 내부) |
| k3s | 이미 설치되어 있는 클러스터 (1~3개) |
| 디스크 | 최소 5GB (Docker 이미지 + MySQL 데이터) |

### 인터넷 PC (Windows)

| 항목 | 요구사항 |
|------|----------|
| Docker Desktop | 설치됨 |
| 소스코드 | banana-org 저장소 clone |

---

## 2. 인터넷 PC에서 이미지 준비

### 2-1. Docker 이미지 빌드

```powershell
# banana-org 루트 디렉토리에서 실행
cd C:\Users\{user}\code\banana-org

# 백엔드 이미지 빌드
docker build -t admin-dashboard-backend:v0.2.1 -f banana-deploy/admin-dashboard-backend/Dockerfile .

# 프론트엔드 이미지 빌드
docker build -t admin-dashboard-frontend:v0.3.2 -f banana-deploy/admin-dashboard-frontend/Dockerfile .
```

### 2-2. 이미지 저장 (tar)

```powershell
# deploy 폴더로 이동
cd admin-dashboard\deploy

# setup.sh로 한번에 저장 (Git Bash 또는 WSL에서)
bash setup.sh save-images

# 또는 수동으로:
mkdir images
docker save mysql:8.0 -o images/mysql_8.0.tar
docker save admin-dashboard-backend:v0.2.1 -o images/admin-dashboard-backend_v0.2.1.tar
docker save admin-dashboard-frontend:v0.3.2 -o images/admin-dashboard-frontend_v0.3.2.tar
```

### 2-3. 전송할 파일 목록

`deploy/` 폴더 전체를 서버로 복사:

```
deploy/
├── docker-compose.yml
├── nginx.conf
├── init.sql
├── setup.sh
├── .env.example
├── SETUP.md
└── images/
    ├── mysql_8.0.tar              (~200MB)
    ├── admin-dashboard-backend_v0.2.1.tar   (~500MB)
    └── admin-dashboard-frontend_v0.3.2.tar  (~50MB)
```

**전송 방법:**
```powershell
# SCP (네트워크 접근 가능한 경우)
scp -r deploy/ user@서버IP:/opt/admin-dashboard/

# 또는 USB로 복사
```

---

## 3. 격리망 서버 설정

### 3-1. Docker 이미지 로드

```bash
cd /opt/admin-dashboard

# 한번에 로드
bash setup.sh load-images

# 또는 수동으로:
docker load -i images/mysql_8.0.tar
docker load -i images/admin-dashboard-backend_v0.2.1.tar
docker load -i images/admin-dashboard-frontend_v0.3.2.tar

# 확인
docker images | grep -E "admin-dashboard|mysql"
```

### 3-2. 초기 설정

```bash
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
DASHBOARD_PORT=8080          # 대시보드 접속 포트
MYSQL_ROOT_PASSWORD=<변경>   # MySQL root 비밀번호
MYSQL_PASSWORD=<변경>        # MySQL admin 비밀번호
JWT_SECRET=<변경>            # 인증 토큰 시크릿 (아무 랜덤 문자열)

# Git 연동 (앱 배포 기능 사용 시):
GIT_TOKEN=ghp_xxxxxxxxxxxx  # GitHub/GitLab PAT
BANANA_DEPLOY_GIT_URL=https://github.com/your-org/banana-deploy.git
APP_GIT_URLS=app1=https://github.com/your-org/app1.git
```

### 3-4. kubeconfig 설정

k3s 클러스터의 kubeconfig를 가져와서 병합합니다.

#### 단일 클러스터

```bash
# k3s 마스터 노드에서 복사
scp root@k3s-master:/etc/rancher/k3s/k3s.yaml ./kubeconfig

# server 주소를 마스터 실제 IP로 변경
sed -i 's|server: https://127.0.0.1:6443|server: https://10.0.1.100:6443|' ./kubeconfig
```

#### 멀티 클러스터 (3개)

```bash
# 각 마스터에서 kubeconfig 복사
scp root@k3s-master-1:/etc/rancher/k3s/k3s.yaml ./k3s-1.yaml
scp root@k3s-master-2:/etc/rancher/k3s/k3s.yaml ./k3s-2.yaml
scp root@k3s-master-3:/etc/rancher/k3s/k3s.yaml ./k3s-3.yaml

# 각 파일에서 클러스터/유저 이름과 서버 주소를 고유하게 변경
# k3s-1.yaml:
#   cluster: cluster-1, user: user-1, server: https://10.0.1.100:6443
# k3s-2.yaml:
#   cluster: cluster-2, user: user-2, server: https://10.0.1.101:6443
# k3s-3.yaml:
#   cluster: cluster-3, user: user-3, server: https://10.0.1.102:6443
vi k3s-1.yaml k3s-2.yaml k3s-3.yaml

# 병합
KUBECONFIG=k3s-1.yaml:k3s-2.yaml:k3s-3.yaml kubectl config view --flatten > ./kubeconfig

# 임시 파일 삭제
rm k3s-1.yaml k3s-2.yaml k3s-3.yaml

# 연결 확인
kubectl --kubeconfig=./kubeconfig cluster-info
kubectl --kubeconfig=./kubeconfig config get-contexts
```

**k3s kubeconfig 수정 예시** (k3s-1.yaml):
```yaml
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: LS0t...
    server: https://10.0.1.100:6443      # ← 127.0.0.1 → 실제 마스터 IP
  name: cluster-prod                      # ← default → 식별 가능한 이름
contexts:
- context:
    cluster: cluster-prod
    user: admin-prod
  name: cluster-prod
current-context: cluster-prod
users:
- name: admin-prod                        # ← default → 고유 이름
  user:
    client-certificate-data: LS0t...
    client-key-data: LS0t...
```

---

## 4. 서비스 시작

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

## 5. 운영 명령어

```bash
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

# 서비스 재시작 (설정 변경 후)
bash setup.sh stop && bash setup.sh start

# DB 초기화 (모든 데이터 삭제)
bash setup.sh reset-db
```

---

## 6. 업데이트 절차

새 버전 배포 시:

### 인터넷 PC
```powershell
# 소스 업데이트
cd C:\Users\{user}\code\banana-org
git pull --recurse-submodules

# 새 이미지 빌드
docker build -t admin-dashboard-backend:v0.2.2 -f banana-deploy/admin-dashboard-backend/Dockerfile .
docker build -t admin-dashboard-frontend:v0.3.3 -f banana-deploy/admin-dashboard-frontend/Dockerfile .

# tar로 저장
docker save admin-dashboard-backend:v0.2.2 -o backend_v0.2.2.tar
docker save admin-dashboard-frontend:v0.3.3 -o frontend_v0.3.3.tar
```

### 격리망 서버
```bash
# 이미지 로드
docker load -i backend_v0.2.2.tar
docker load -i frontend_v0.3.3.tar

# .env 태그 업데이트
vi .env
# BACKEND_TAG=v0.2.2
# FRONTEND_TAG=v0.3.3

# 재시작
bash setup.sh stop && bash setup.sh start
```

---

## 7. 트러블슈팅

### MySQL 접속 실패
```bash
# MySQL 로그 확인
docker compose logs mysql

# MySQL 컨테이너에 직접 접속
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
docker exec -it admin-backend kubectl config get-contexts

# 원인: kubeconfig의 server 주소가 컨테이너에서 접근 불가
# 해결: 127.0.0.1 대신 실제 마스터 IP 사용
```

### 대시보드 접속 안됨
```bash
# 컨테이너 상태 확인
docker compose ps

# nginx 로그
docker compose logs frontend

# 방화벽 확인 (Rocky 8)
firewall-cmd --list-ports
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload
```

### Git 연동 오류 (앱 배포)
```bash
# .env에서 GIT_TOKEN 확인
# 격리망에서는 내부 GitLab 등을 사용해야 함
# 외부 GitHub 접근 불가 시 앱 배포 기능은 사용 불가 (서버 관리/K8s 기능은 정상 동작)
```

---

## 8. 아키텍처

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
- **frontend (nginx)**: 정적 파일 서빙 + API/WebSocket 리버스 프록시
- **backend (FastAPI)**: REST API + WebSocket (SSH, K8s exec, Ansible)
- **mysql**: 사용자/권한/서버/Ansible 데이터 저장

**기능:**
- K8s 클러스터 관리 (클러스터/노드/네임스페이스/디플로이먼트)
- 서버 관리 (등록/SSH 테스트/웹 SSH 터미널)
- 서버 그룹 관리 (그룹별 SSH 명령 병렬 실행)
- 메트릭 소스 연동 (Prometheus/VictoriaMetrics)
- Ansible 관리 (Playbook/Inventory/실행 이력)
- 사용자/권한 관리 + 감사 로그
