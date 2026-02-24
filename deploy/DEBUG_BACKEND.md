# 백엔드 단독 실행 가이드 (디버깅용)

사내 개발 환경에서 백엔드만 단독으로 실행하여 Swagger로 디버깅하는 방법입니다.

## 전제 조건

- Python 3.11+ 설치
- MySQL 서버 접근 가능 (원격 또는 로컬)
- Git 설치
- (선택) kubectl 설치 (K8s 기능 사용 시)

---

## 방법 1: Python 직접 실행 (추천)

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/banana-org.git
cd banana-org/admin-dashboard/backend
```

### 2. 가상환경 생성 및 의존성 설치

```bash
# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
pip install ansible-core
```

### 3. 환경변수 설정

**.env 파일 생성** (`admin-dashboard/backend/.env`):

```bash
# === 필수 환경변수 ===

# MySQL 연결 정보 (원격 서버)
DATABASE_URL=mysql+pymysql://admin:admin@mysql-server-ip:3306/admin_dashboard?charset=utf8mb4

# JWT 시크릿
JWT_SECRET=banana-admin-secret

# SSH 비밀번호 암호화 키 (선택, 미설정 시 JWT_SECRET에서 자동 파생)
FERNET_KEY=

# === Git 연동 (앱 배포 기능) ===

# GitHub/GitLab Personal Access Token
GIT_TOKEN=ghp_YourTokenHere

# Deploy 저장소 URL
DEPLOY_GIT_URL=https://github.com/your-org/banana-deploy.git

# Deploy 저장소 브랜치
DEPLOY_GIT_BRANCH=master

# === K8s 연동 (K8s 관리 기능) ===

# Kubeconfig 파일 경로
KUBECONFIG=/path/to/your/kubeconfig

# 또는 기본 경로 사용 (~/.kube/config)
# KUBECONFIG_PATH=~/.kube/config
```

**또는 export 명령어로 직접 설정:**

```bash
export DATABASE_URL="mysql+pymysql://admin:password@10.0.1.100:3306/admin_dashboard?charset=utf8mb4"
export JWT_SECRET="banana-admin-secret"
export FERNET_KEY=""
export GIT_TOKEN="ghp_YourTokenHere"
export DEPLOY_GIT_URL="https://github.com/your-org/banana-deploy.git"
export DEPLOY_GIT_BRANCH="master"
export KUBECONFIG="/home/user/.kube/config"
```

### 4. 백엔드 실행

```bash
cd admin-dashboard/backend

# 개발 모드 (자동 리로드)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 또는 프로덕션 모드
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 5. Swagger UI 접속

브라우저에서 다음 URL 접속:

```
http://localhost:8000/docs
```

또는 외부 접속:

```
http://<서버IP>:8000/docs
```

---

## 방법 2: Docker로 백엔드만 실행

### 1. .env 파일 설정

`admin-dashboard/deploy/.env` 파일 편집:

```bash
# MySQL (원격 서버 정보로 변경)
DATABASE_URL=mysql+pymysql://admin:password@remote-mysql-ip:3306/admin_dashboard?charset=utf8mb4

# Git 토큰
GIT_TOKEN=ghp_YourTokenHere
DEPLOY_GIT_URL=https://github.com/your-org/banana-deploy.git
DEPLOY_GIT_BRANCH=master

# Kubeconfig 경로 (호스트 경로)
KUBECONFIG=/path/to/kubeconfig
```

### 2. docker-compose 수정

`admin-dashboard/deploy/docker-compose.yml`에서 backend 서비스만 실행:

```bash
cd admin-dashboard/deploy

# backend 서비스만 빌드 및 실행
docker compose up --build backend
```

또는 MySQL도 함께 실행하려면:

```bash
docker compose up mysql backend
```

### 3. Swagger UI 접속

```
http://localhost:8000/docs
```

---

## Swagger UI 사용법

### 인증 토큰 설정

1. Swagger UI 우측 상단 **Authorize** 버튼 클릭
2. **HTTPBearer (http, Bearer)** 입력란에 다음 토큰 입력:

```
eyJ1c2VySWQiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0=
```

이 토큰은 `{"userId":"admin","exp":9999999999}`를 base64 인코딩한 값으로, 만료되지 않는 admin 토큰입니다.

3. **Authorize** 클릭 → **Close**

### API 테스트

1. 테스트할 엔드포인트 선택 (예: `GET /apps`)
2. **Try it out** 클릭
3. 파라미터 입력 (필요 시)
4. **Execute** 클릭
5. **Response body** 확인

---

## 디버깅 체크리스트

### 1. `/apps` 엔드포인트가 빈 배열 `[]` 반환 시

**원인:** Deploy 저장소 동기화 실패

**확인 방법:**

```bash
# 1. 환경변수 확인
echo $DEPLOY_GIT_URL
echo $GIT_TOKEN
echo $DEPLOY_GIT_BRANCH

# 2. Git 접근 가능 여부 확인
git ls-remote https://${GIT_TOKEN}@github.com/your-org/banana-deploy.git

# 3. 수동으로 clone 시도
cd /tmp
rm -rf banana-deploy
git clone -b master https://${GIT_TOKEN}@github.com/your-org/banana-deploy.git
ls -la banana-deploy/
```

**해결 방법:**
- GIT_TOKEN이 유효한지 확인 (GitHub Settings → Developer settings → Personal access tokens)
- DEPLOY_GIT_URL이 정확한지 확인
- 사내 방화벽에서 GitHub 접근이 차단되었는지 확인
- Deploy 저장소에 `app1/`, `app2/` 등의 디렉토리와 `common.yaml`, `image/*.yaml` 파일이 있는지 확인

### 2. K8s 관련 엔드포인트 에러 시

**확인:**

```bash
# Kubeconfig 파일 존재 확인
ls -la $KUBECONFIG

# K8s 클러스터 접근 확인
kubectl cluster-info
kubectl get nodes
```

**해결:**
- KUBECONFIG 경로가 정확한지 확인
- kubeconfig 파일 권한 확인 (`chmod 600`)
- 클러스터 API 서버에 네트워크 접근 가능한지 확인

### 3. 데이터베이스 연결 에러 시

**확인:**

```bash
# MySQL 접속 테스트
mysql -h <mysql-ip> -P 3306 -u admin -p
# 비밀번호 입력 후
USE admin_dashboard;
SHOW TABLES;
```

**해결:**
- DATABASE_URL의 호스트/포트/계정/비밀번호 확인
- MySQL 서버의 방화벽 설정 확인 (`3306` 포트 오픈)
- MySQL 계정에 원격 접속 권한이 있는지 확인:
  ```sql
  SELECT User, Host FROM mysql.user WHERE User='admin';
  -- Host가 '%' 또는 특정 IP여야 함
  ```

### 4. SSH 서버 관리 기능 테스트 시

**확인:**

```bash
# paramiko 설치 확인
python -c "import paramiko; print(paramiko.__version__)"

# SSH 접속 테스트
ssh -p 22 testuser@target-server-ip
```

### 5. 로그 확인

**Python 직접 실행 시:**
- 터미널에 실시간 로그 출력됨
- `WARNING`, `ERROR` 메시지 확인

**Docker 실행 시:**

```bash
docker logs admin-backend --tail=100 -f
```

특정 키워드로 필터링:

```bash
docker logs admin-backend --tail=200 | grep -i "error\|warning\|git\|deploy"
```

---

## 테스트용 토큰 생성

다른 사용자나 만료 시간을 테스트하려면:

```bash
# Python으로 토큰 생성
python3 -c "
import base64, json
payload = {'userId': 'testuser', 'exp': 9999999999}
token = base64.b64encode(json.dumps(payload).encode()).decode()
print(token)
"
```

---

## 자주 발생하는 문제

### 1. `ModuleNotFoundError: No module named 'XXX'`

**해결:**
```bash
pip install -r requirements.txt
pip install ansible-core
```

### 2. `connection refused` (MySQL)

**원인:** MySQL 서버 미실행 또는 방화벽 차단

**해결:**
- MySQL 서버 실행 확인
- 방화벽에서 3306 포트 오픈
- DATABASE_URL의 호스트/포트 재확인

### 3. `/apps` 빈 배열이지만 Git clone은 성공

**원인:** Deploy 저장소 구조 문제

**확인:**
```bash
ls -la /tmp/banana-deploy/
# 다음 구조여야 함:
# app1/
#   common.yaml
#   image/
#     prod.yaml
#     stage.yaml
# app2/
#   common.yaml
#   image/
#     prod.yaml
```

### 4. Swagger에서 401 Unauthorized

**원인:** Authorization 헤더 미설정

**해결:** Swagger UI 우측 상단 Authorize 버튼으로 토큰 입력

---

## 프로덕션 배포 전 확인사항

1. `.env` 파일을 `.gitignore`에 추가 (비밀번호, 토큰 유출 방지)
2. `GIT_TOKEN`에 최소 권한 부여 (읽기 전용)
3. `JWT_SECRET` 변경 (프로덕션용 랜덤 값)
4. `FERNET_KEY` 생성:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
5. MySQL 계정 비밀번호 변경
6. 사내 보안 정책에 따라 포트 및 접근 제어 설정

---

## 참고

- FastAPI 공식 문서: https://fastapi.tiangolo.com/
- Swagger UI 사용법: https://swagger.io/tools/swagger-ui/
- Admin Dashboard 전체 설정: `admin-dashboard/deploy/SETUP.md`
