# Admin Dashboard 요구사항서

## 1. 프로젝트 개요

### 1.1 목적
사내 플랫폼 통합 관리 대시보드. UI 어플리케이션 배포/롤백, 사용자 권한 관리, Kubernetes 클러스터 운영, 서버 인프라 관리를 하나의 웹 콘솔에서 수행한다.

### 1.2 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React + TypeScript (Vite) |
| Backend | Python FastAPI |
| Meta DB | MySQL 8.0.x 단일 인스턴스 (K8s, hostPath 볼륨 + 노드 고정) |
| 인증 | 자체 로그인 (추후 AD 연동 가능하도록 인증 레이어 분리 설계) |
| 서버 모니터링 | Prometheus + node_exporter (운영), Mock API (개발) |
| Ansible | 백엔드 Pod에 Ansible 설치하여 직접 실행 |
| 배포 환경 | Kubernetes (banana-deploy 기반) |

### 1.3 공통 UI 구조

- **로그인 페이지**: 인증 후 대시보드 진입
- **왼쪽 사이드바**: 접기/펼치기 가능한 메뉴 네비게이션
- **홈 화면**: 초기에는 비워두고, 각 메뉴 상세 페이지 완성 후 요약 위젯 배치 예정
- **다크모드**: 라이트/다크 테마 토글 지원

### 1.4 개발 환경 제약

현재 개발 환경(로컬 노트북)에는 실제 서버가 없으므로:
- **서버 관리(메뉴4)**: Mock 서버 데이터로 개발 (로컬 환경을 가상의 서버로 등록)
- **Prometheus**: 개발 환경에 없으므로 Mock API로 메트릭 데이터 제공
- **앱 목록**: banana-deploy repo 디렉토리 구조 자동 스캔으로 앱 목록 생성

---

## 2. 인증 & 사용자 관리

### 2.1 로그인

- 최초 기본 계정: `admin` / `admin`
- **최초 로그인 시 비밀번호 변경 강제** (password_changed 플래그 관리)
- 로그인 시 JWT 토큰 발급 → 이후 API 호출 시 Bearer 토큰 사용
- 세션 만료 시 재로그인 유도

### 2.2 인증 레이어 분리 설계

추후 AD 연동 등 외부 인증을 붙일 수 있도록 인증 로직을 추상화한다:

```
AuthProvider (interface)
├── LocalAuthProvider      ← 현재 사용 (DB 기반 자체 인증)
└── (향후) ADAuthProvider  ← AD/OIDC 연동 시 구현
```

- Backend에서 `AuthProvider` 인터페이스를 정의하고, 설정값으로 어떤 Provider를 사용할지 선택
- 현재는 `LocalAuthProvider`만 구현

### 2.3 Meta DB 스키마 (사용자 관련)

```sql
users
├── id              INT AUTO_INCREMENT (PK)
├── user_id         VARCHAR(50) UNIQUE NOT NULL  -- 로그인 ID
├── password_hash   VARCHAR(255) NOT NULL        -- bcrypt 해시
├── password_changed TINYINT DEFAULT 0           -- 최초 비밀번호 변경 여부
├── department      VARCHAR(100)                 -- 부서
├── role            ENUM('admin','user') DEFAULT 'user'
├── is_active       TINYINT DEFAULT 1
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP
```

---

## 3. 메뉴 구조

```
사이드바 (접기/펼치기 가능)
├── 홈 (대시보드)
├── 메뉴1: UI Application 관리
├── 메뉴2: 사용자 & 권한 관리
├── 메뉴3: Kubernetes 클러스터 관리
└── 메뉴4: 서버 관리
```

---

## 4. 메뉴1: UI Application 관리

### 4.1 개요

banana-org의 app1, app2 등 banana-deploy 기반으로 배포되는 UI 어플리케이션의 현재 상태를 조회하고, 버전 롤백/Replica 변경을 수행한다.

### 4.2 앱 목록 자동 감지

- banana-deploy repo의 디렉토리 구조를 스캔하여 앱 목록 자동 생성
- 스캔 기준: `banana-deploy/{appname}/common.yaml` 이 존재하는 디렉토리 = 하나의 앱
- `banana-deploy/{appname}/image/` 하위의 yaml 파일명(`.yaml` 제외) = 환경 목록 (prod, stage 등)
- 새로운 앱이 banana-deploy에 추가되면 자동으로 테이블에 반영

### 4.3 어플리케이션 상태 테이블

테이블 컬럼:

| App 이름 | 환경 | 현재 버전 (banana-deploy yaml) | 실제 K8s 버전 | 동기화 상태 | Replica | 액션 |
|----------|------|------|------|------|------|------|
| app1 | prod | v0.1.0 | v0.1.0 | Synced | 1/1 | ⋯ |
| app1 | stage | v0.1.0rc1 | v0.1.0rc1 | Synced | 2/2 | ⋯ |
| app2 | prod | v0.1.0 | - | OutOfSync | 0/1 | ⋯ |

- **현재 버전**: `banana-deploy/{appname}/image/{env}.yaml`의 `image.tag` 값
- **실제 K8s 버전**: K8s 클러스터의 `{appname}-{env}` namespace에 배포된 Deployment의 실제 이미지 태그
- **동기화 상태**: 위 두 값 비교 → `Synced` / `OutOfSync`
- **Replica**: 현재/원하는 replica 수

### 4.4 액션: Rollback

1. 테이블 행의 ⋯ 메뉴 → "Rollback" 클릭
2. **2차 확인 모달** 표시:
   - 해당 app의 git repo에서 태그 목록 조회 (예: `v0.1.0`, `v0.2.0`, ...)
   - 현재 버전 강조 표시
   - 롤백할 버전 선택
3. "변경하기" 버튼 클릭 시 최종 확인:
   - "app1 prod를 v0.1.0으로 롤백합니다. 계속하시겠습니까?"
4. 확인 후:
   - banana-deploy의 `rollback-helm-deploy.sh {appname}-{env}-{version}` 실행
   - 실행 결과를 모달에 표시
   - **감사 로그 기록** (누가, 언제, 어떤 앱을, 어떤 버전으로 롤백했는지)
   - 완료 후 테이블 새로고침

### 4.5 액션: Replica 변경

1. 테이블 행의 ⋯ 메뉴 → "Replica" 클릭
2. **2차 확인 모달** 표시:
   - 현재 Replica 수 표시
   - 변경할 Replica 수 입력
3. "변경하기" 버튼 클릭 시 최종 확인:
   - "app1 prod의 Replica를 1 → 3으로 변경합니다. 계속하시겠습니까?"
4. 확인 후:
   - banana-deploy의 해당 app yaml에서 replica 값 수정
   - 수정 커밋 생성 + 태그 업데이트
   - `helm-deploy.sh {appname} {env}` 실행
   - **감사 로그 기록**
   - 완료 후 테이블 새로고침

### 4.6 권한

- **조회**: 모든 로그인 사용자 가능
- **변경(Rollback/Replica)**: 메뉴2에서 앱별로 권한 부여된 사용자만 가능
- 권한 없는 사용자에게는 액션 버튼 비활성화 또는 숨김

---

## 5. 메뉴2: 사용자 & 권한 관리

### 5.1 개요

사용자별/그룹별로 어떤 기능을 사용할 수 있는지 관리한다.

### 5.2 권한 모델

#### 5.2.1 권한 종류

| 권한 대상 | 설명 | 예시 |
|----------|------|------|
| 앱 배포 권한 | 특정 앱의 버전 변경(롤백/Replica) 가능 여부 | user_A → app1 변경 가능 |
| 페이지 접근 권한 | 특정 메뉴/페이지 접근 가능 여부 | user_B → 메뉴4 접근 불가 |

#### 5.2.2 그룹 기반 권한

- 사용자 그룹을 생성하고, 그룹에 권한을 할당
- 사용자를 그룹에 소속시키면 해당 그룹의 권한을 상속
- 개별 사용자에게 직접 권한을 부여하는 것도 가능 (그룹 권한 + 개별 권한 = 최종 권한)

### 5.3 UI 구성

#### 사용자 관리 탭
- 사용자 목록 테이블 (ID, 부서, 소속 그룹, 역할)
- 사용자 상세: 소속 그룹, 개별 권한 확인/수정

#### 그룹 관리 탭
- 그룹 목록, 그룹 생성/수정/삭제
- 그룹에 권한 할당 (앱 배포 권한, 페이지 접근 권한)
- 그룹 소속 사용자 관리

### 5.4 Meta DB 스키마 (권한 관련)

```sql
groups
├── id              INT AUTO_INCREMENT (PK)
├── name            VARCHAR(100) UNIQUE NOT NULL
├── description     TEXT
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

user_groups (N:M)
├── user_id         INT (FK → users.id)
└── group_id        INT (FK → groups.id)
    PK(user_id, group_id)

permissions
├── id              INT AUTO_INCREMENT (PK)
├── type            ENUM('app_deploy','page_access')
├── target          VARCHAR(100) NOT NULL  -- app1, menu1 등
├── action          ENUM('read','write')
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

group_permissions (N:M)
├── group_id        INT (FK → groups.id)
└── permission_id   INT (FK → permissions.id)
    PK(group_id, permission_id)

user_permissions (N:M, 개별 직접 할당)
├── user_id         INT (FK → users.id)
└── permission_id   INT (FK → permissions.id)
    PK(user_id, permission_id)
```

---

## 6. 메뉴3: Kubernetes 클러스터 관리

### 6.1 개요

기존 [k8sdashboard](https://github.com/hyuck2kim/k8sdashboard) 프로젝트의 K8s 클러스터 관리 흐름을 참고하되, admin-dashboard의 일부 메뉴로 통합한다. 기존의 코딩 스타일이나 웹 구성은 따르지 않고, 흐름과 기능만 참고한다.

### 6.2 k8sdashboard에서 가져올 핵심 기능

#### 6.2.1 클러스터 관리
- kubeconfig 기반 멀티 클러스터 관리
- 클러스터별 상태 개요 (노드 수, CPU/Memory 사용률)
- 클러스터 헬스 체크

#### 6.2.2 노드 관리
- 노드 목록 및 리소스 사용 현황 (CPU, Memory, Disk)
- 노드별 Taint, Label 정보
- 노드별 상위 리소스 사용 Deployment

#### 6.2.3 Namespace & Deployment 관리
- Namespace 목록 및 리소스 사용량
- Namespace 클릭 → 해당 Namespace의 Deployment 목록
- Deployment 스케일링, 재시작, Describe, 로그 조회

#### 6.2.4 리소스 CRUD
- Namespace, Deployment, Service, ConfigMap, Secret 등 주요 K8s 리소스의 조회/생성/수정/삭제
- YAML 에디터 제공

### 6.3 k8sdashboard 대비 변경/개선 사항

- 독립 앱이 아닌 admin-dashboard의 메뉴3으로 통합
- 인증/권한은 admin-dashboard의 통합 인증 사용 (메뉴2 연동)
- 다크모드 등 테마는 admin-dashboard 전체 설정 따름
- **변경 작업 시 감사 로그 기록** (Deployment 스케일링, 리소스 삭제 등)
- **위험 작업 시 2차 확인 모달** (삭제, 스케일링 등)

---

## 7. 메뉴4: 서버 관리

### 7.1 개요

물리/가상 서버를 그룹별로 관리하고, 상태 모니터링, SSH 접속, Ansible 자동화를 제공한다.

### 7.2 서버 그루핑

- 서버 그룹 생성/수정/삭제 (예: "Web서버", "DB서버", "개발서버")
- 그룹별 서버 목록 조회
- 트리 뷰 또는 탭 형태로 그룹 네비게이션

### 7.3 서버 등록 & 정보

신규 서버 추가 시 입력 항목:

| 필드 | 설명 |
|------|------|
| 호스트명 | 서버 이름 |
| IP | 접속 IP |
| SSH 포트 | 기본 22 |
| SSH 인증 정보 | 비밀번호 또는 SSH 키 |
| 소속 그룹 | 서버 그룹 선택 |
| 메모 | 용도 등 자유 기술 |

서버별 스펙 및 사용률 표시:

| 항목 | 설명 |
|------|------|
| CPU | 코어 수 + 현재 사용률 (%) |
| Memory | 전체 용량(GB) + 사용률 (%) |
| Disk | 전체 용량(GB) + 사용률 (%) |

### 7.4 서버 상태 모니터링

- Prometheus + node_exporter에서 메트릭 수집
- 서버 목록에서 각 서버의 온라인/오프라인 상태 표시
- CPU/Memory/Disk 사용률 주기적 표시
- **개발 환경**: Prometheus가 없으므로 Mock API로 가짜 메트릭 제공
  - MockPrometheusProvider: 랜덤 범위의 CPU/Memory/Disk 사용률 생성
  - 로컬 노트북을 가상 서버로 등록하여 UI 개발 가능

```
MetricsProvider (interface)
├── PrometheusProvider      ← 운영 환경 (실제 Prometheus 쿼리)
└── MockPrometheusProvider  ← 개발 환경 (가짜 메트릭 데이터)
```

### 7.5 웹 SSH 터미널

- 서버 목록에서 "SSH 접속" 버튼 클릭
- 웹 브라우저 내 터미널 열림 (xterm.js + WebSocket)
- 등록된 SSH 인증 정보로 자동 접속
- **개발 환경**: localhost SSH로 테스트

### 7.6 Ansible 관리

Ansible은 백엔드 Pod(컨테이너)에 설치하여 직접 실행한다.

#### 7.6.1 Inventory 관리
- 서버 그룹/서버 정보를 기반으로 Ansible inventory 자동 생성
- 수동 inventory 파일 편집도 가능

#### 7.6.2 Playbook 관리
- Playbook 목록 조회/등록/수정/삭제
- YAML 에디터로 Playbook 작성
- Playbook을 파일시스템에 저장 (PV 마운트) + 메타정보는 DB

#### 7.6.3 실행
- 대상 선택: 그룹별 또는 서버별
- Playbook 선택 후 실행
- **2차 확인**: "Web서버 그룹 3대에 playbook-nginx-install.yml을 실행합니다. 계속하시겠습니까?"
- 실행 로그 실시간 표시 (WebSocket)
- 실행 이력 저장 및 조회 (**감사 로그 연동**)

### 7.7 Meta DB 스키마 (서버 관련)

```sql
server_groups
├── id              INT AUTO_INCREMENT (PK)
├── name            VARCHAR(100) UNIQUE NOT NULL
├── description     TEXT
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

servers
├── id              INT AUTO_INCREMENT (PK)
├── hostname        VARCHAR(255) NOT NULL
├── ip              VARCHAR(45) NOT NULL
├── ssh_port        INT DEFAULT 22
├── ssh_credential  TEXT           -- 암호화 저장 (AES-256)
├── ssh_auth_type   ENUM('password','key') DEFAULT 'password'
├── group_id        INT (FK → server_groups.id)
├── cpu_cores       INT            -- 코어 수
├── memory_gb       DECIMAL(10,2)  -- 전체 메모리(GB)
├── disk_gb         DECIMAL(10,2)  -- 전체 디스크(GB)
├── memo            TEXT
├── is_active       TINYINT DEFAULT 1
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

ansible_playbooks
├── id              INT AUTO_INCREMENT (PK)
├── name            VARCHAR(255) NOT NULL
├── description     TEXT
├── file_path       VARCHAR(500) NOT NULL  -- 파일시스템 경로
├── created_by      INT (FK → users.id)
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
└── updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

ansible_executions
├── id              INT AUTO_INCREMENT (PK)
├── playbook_id     INT (FK → ansible_playbooks.id)
├── target_type     ENUM('group','server')
├── target_id       INT            -- group_id 또는 server_id
├── status          ENUM('running','success','failed','cancelled')
├── log             LONGTEXT       -- 실행 로그
├── executed_by     INT (FK → users.id)
├── started_at      DATETIME
└── finished_at     DATETIME
```

---

## 8. 감사 로그 (Audit Log)

### 8.1 개요

누가, 언제, 무엇을 변경했는지 모든 중요 변경 작업을 기록한다.

### 8.2 기록 대상

| 메뉴 | 기록 항목 |
|------|----------|
| 메뉴1 | 앱 Rollback, Replica 변경 |
| 메뉴2 | 사용자 생성/수정/삭제, 그룹 변경, 권한 변경 |
| 메뉴3 | Deployment 스케일링/재시작, 리소스 생성/수정/삭제 |
| 메뉴4 | 서버 등록/삭제, Ansible 실행 |

### 8.3 Meta DB 스키마

```sql
audit_logs
├── id              BIGINT AUTO_INCREMENT (PK)
├── user_id         INT (FK → users.id)
├── action          VARCHAR(50) NOT NULL   -- rollback, scale, create, delete, ansible_run 등
├── menu            VARCHAR(20) NOT NULL   -- menu1, menu2, menu3, menu4
├── target_type     VARCHAR(50)            -- app, user, group, deployment, server, playbook 등
├── target_name     VARCHAR(255)           -- app1, user_A 등
├── detail          JSON                   -- 변경 상세 (이전 값, 이후 값 등)
├── result          ENUM('success','failed')
├── ip_address      VARCHAR(45)
├── created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    INDEX(user_id), INDEX(menu), INDEX(created_at)
```

### 8.4 UI

- 감사 로그 조회 페이지 (admin 전용, 또는 별도 메뉴)
- 필터: 기간, 사용자, 메뉴, 액션 타입
- 테이블 + 페이지네이션

---

## 9. 비기능 요구사항

### 9.1 보안

- 모든 API는 JWT 인증 필수 (로그인 제외)
- 비밀번호는 bcrypt 해시로 저장
- SSH 인증 정보는 DB에 암호화 저장 (AES-256)
- 권한 없는 리소스 접근 시 403 반환
- CORS 설정
- banana-deploy 스크립트 실행 시 입력값 검증 (command injection 방지)
- 위험 작업 시 2차 확인 모달 필수

### 9.2 배포

- admin-dashboard도 banana-deploy 기반으로 K8s에 배포
- Frontend: nginx로 빌드된 static 파일 서빙
- Backend: uvicorn으로 FastAPI 실행 (Ansible 포함)
- MySQL 8.0.x: K8s Deployment + hostPath 볼륨 (nodeSelector로 특정 노드 고정)

### 9.3 다크모드

- CSS 변수 기반 라이트/다크 테마
- 사용자 설정 localStorage 저장
- 헤더 또는 사이드바에 토글 버튼

### 9.4 에러 핸들링

- K8s API 호출 실패 시 사용자 친화적 메시지 표시
- 스크립트 실행 실패 시 에러 로그 표시
- 네트워크 타임아웃 처리

---

## 10. 개발 로드맵

### Phase 1: MVP
- 로그인 (자체 인증, admin/admin, 최초 비밀번호 변경 강제)
- 사이드바 레이아웃 + 다크모드
- 메뉴1: UI Application 상태 조회 + Rollback + Replica 변경
- 메뉴2: 기본 사용자/그룹 권한 관리
- 감사 로그 (기본)
- 2차 확인 모달 (위험 작업)
- MySQL 배포 (hostPath + 노드 고정) 및 스키마 구성
- admin-dashboard를 banana-deploy에 추가하여 K8s 배포

### Phase 2: K8s 관리
- 메뉴3: K8s 클러스터 관리 (k8sdashboard 기능 통합)
- 감사 로그 확장 (메뉴3 작업 기록)

### Phase 3: 인프라 관리
- 메뉴4: 서버 관리 (등록, Prometheus 모니터링, 웹 SSH)
- Ansible 통합 (Pod 내 실행)
- Mock 환경 → 실서버 전환

### Phase 4 (향후)
- AD/OIDC 외부 인증 연동
- 알림 기능 (Slack/이메일)
- 홈 대시보드 요약 위젯
