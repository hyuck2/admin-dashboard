# Admin Dashboard 요구사항서

## 1. 프로젝트 개요

### 1.1 목적
사내 플랫폼 통합 관리 대시보드. UI 어플리케이션 배포/롤백, 사용자 권한 관리, Kubernetes 클러스터 운영, 서버 인프라 관리를 하나의 웹 콘솔에서 수행한다.

### 1.2 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React + TypeScript (Vite) |
| Backend | Python FastAPI |
| Meta DB | MySQL 8.0.x (K8s 위에 배포) |
| 인증 | 자체 로그인 → 추후 사내 AD 연동 |
| 배포 환경 | Kubernetes (banana-deploy 기반) |

### 1.3 공통 UI 구조

- **로그인 페이지**: 인증 후 대시보드 진입
- **왼쪽 사이드바**: 접기/펼치기 가능한 메뉴 네비게이션
- **홈 화면**: 초기에는 비워두고, 각 메뉴 상세 페이지 완성 후 요약 위젯 배치 예정

---

## 2. 인증 & 사용자 관리

### 2.1 로그인

- 최초 기본 계정: `admin` / `admin`
- 로그인 시 JWT 토큰 발급 → 이후 API 호출 시 Bearer 토큰 사용
- 세션 만료 시 재로그인 유도

### 2.2 추후 사내 AD 연동 (Phase 2)

- AD 인증 서버로 redirect → 인증 완료 후 콜백으로 인증 정보 수신
- 수신 정보 중 **사용자 ID**, **부서 정보**만 Meta DB에 저장 (이름 저장 안 함)
- AD에서 받은 ID 기준으로 내부 권한 매핑

### 2.3 Meta DB 스키마 (사용자 관련)

```
users
├── id (PK)
├── user_id (unique, AD의 사번 또는 로그인 ID)
├── department (부서)
├── role (admin / user)
├── created_at
└── updated_at
```

---

## 3. 메뉴 구조

```
사이드바
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

### 4.2 어플리케이션 상태 테이블

테이블 컬럼:

| App 이름 | 환경 | 현재 버전 (banana-deploy yaml) | 실제 K8s 버전 | 동기화 상태 | Replica | 액션 |
|----------|------|------|------|------|------|------|
| app1 | prod | v0.1.0 | v0.1.0 | Synced ✅ | 1/1 | ⋯ |
| app1 | stage | v0.1.0rc1 | v0.1.0rc1 | Synced ✅ | 2/2 | ⋯ |
| app2 | prod | v0.1.0 | - | OutOfSync ❌ | 0/1 | ⋯ |

- **현재 버전**: `banana-deploy/{appname}/image/{env}.yaml`의 `image.tag` 값
- **실제 K8s 버전**: K8s 클러스터의 해당 namespace에 배포된 Deployment의 실제 이미지 태그
- **동기화 상태**: 위 두 값 비교 → `Synced` / `OutOfSync`
- **Replica**: 현재/원하는 replica 수

### 4.3 액션: Rollback

1. 테이블 행의 ⋯ 메뉴 → "Rollback" 클릭
2. 모달 창 표시:
   - 해당 app의 git repo에서 태그 목록 조회 (예: `v0.1.0`, `v0.2.0`, ...)
   - 현재 버전 강조 표시
   - 롤백할 버전 선택
3. "변경하기" 버튼 클릭 시:
   - banana-deploy의 `rollback-helm-deploy.sh {appname}-{env}-{version}` 실행
   - 실행 결과를 모달에 표시
   - 완료 후 테이블 새로고침

### 4.4 액션: Replica 변경

1. 테이블 행의 ⋯ 메뉴 → "Replica" 클릭
2. 모달 창 표시:
   - 현재 Replica 수 표시
   - 변경할 Replica 수 입력
3. "변경하기" 버튼 클릭 시:
   - banana-deploy의 해당 app yaml에서 replica 값 수정
   - 수정 커밋 생성 + 태그 업데이트
   - `helm-deploy.sh {appname} {env}` 실행
   - 완료 후 테이블 새로고침

### 4.5 권한

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

```
groups
├── id (PK)
├── name (그룹명)
├── description
├── created_at
└── updated_at

user_groups (N:M)
├── user_id (FK → users)
└── group_id (FK → groups)

permissions
├── id (PK)
├── type (app_deploy / page_access)
├── target (app1, app2, ... / menu1, menu2, ...)
├── action (read / write)
├── created_at
└── updated_at

group_permissions (N:M)
├── group_id (FK → groups)
└── permission_id (FK → permissions)

user_permissions (N:M, 개별 직접 할당)
├── user_id (FK → users)
└── permission_id (FK → permissions)
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

- 서버 목록에서 각 서버의 온라인/오프라인 상태 표시
- 주기적 헬스체크 (ping 또는 SSH 접속 시도)
- CPU/Memory/Disk 사용률 주기적 수집 및 표시

### 7.5 웹 SSH 터미널

- 서버 목록에서 "SSH 접속" 버튼 클릭
- 웹 브라우저 내 터미널 열림 (xterm.js + WebSocket)
- 등록된 SSH 인증 정보로 자동 접속

### 7.6 Ansible 관리

#### 7.6.1 Inventory 관리
- 서버 그룹/서버 정보를 기반으로 Ansible inventory 자동 생성
- 수동 inventory 파일 편집도 가능

#### 7.6.2 Playbook 관리
- Playbook 목록 조회/등록/수정/삭제
- YAML 에디터로 Playbook 작성
- Playbook을 Meta DB 또는 파일시스템에 저장

#### 7.6.3 실행
- 대상 선택: 그룹별 또는 서버별
- Playbook 선택 후 실행
- 실행 로그 실시간 표시 (WebSocket)
- 실행 이력 저장 및 조회

---

## 8. 비기능 요구사항

### 8.1 보안

- 모든 API는 JWT 인증 필수 (로그인 제외)
- SSH 인증 정보는 DB에 암호화 저장 (AES-256)
- 권한 없는 리소스 접근 시 403 반환
- CORS 설정
- banana-deploy 스크립트 실행 시 입력값 검증 (command injection 방지)

### 8.2 배포

- admin-dashboard도 banana-deploy 기반으로 K8s에 배포
- Frontend: nginx로 빌드된 static 파일 서빙
- Backend: uvicorn으로 FastAPI 실행
- MySQL: K8s StatefulSet으로 배포 (PVC 사용)

### 8.3 에러 핸들링

- K8s API 호출 실패 시 사용자 친화적 메시지 표시
- 스크립트 실행 실패 시 에러 로그 표시
- 네트워크 타임아웃 처리

---

## 9. 확인 필요 & 개선 제안 사항

### ❓ 확인 필요

1. **AD 연동 프로토콜**: LDAP 직접 연결인지, SAML/OIDC 기반 SSO redirect인지?
   - "redirect 해서 인증 정보 넘겨주면"이라고 하셨으니 OIDC(OAuth2) 방식으로 보임. 맞는지?

2. **MySQL 배포 방식**: K8s 위에 MySQL을 띄운다고 하셨는데:
   - 단일 인스턴스? 아니면 replication 구성?
   - PVC 스토리지 크기 기본값?
   - 기존에 사용 중인 MySQL이 있으면 그걸 쓸 건지?

3. **서버 모니터링 수집 방식**:
   - 에이전트 기반 (각 서버에 수집 에이전트 설치)?
   - 에이전트리스 (SSH 접속해서 명령어로 수집)?
   - 기존에 Prometheus/node_exporter 같은 게 있는지?

4. **Ansible 실행 환경**:
   - admin-dashboard 백엔드 Pod에 Ansible 설치해서 실행?
   - 아니면 별도 Ansible 서버가 있고 API로 트리거?

5. **앱 목록 관리**: app1, app2 이외에 앱이 추가될 때:
   - banana-deploy repo 구조를 자동 스캔해서 앱 목록을 만들지?
   - 아니면 admin-dashboard DB에 수동 등록?

### 💡 개선 제안

1. **기본 계정 보안**: admin/admin 최초 로그인 시 비밀번호 변경 강제 권장
2. **감사 로그 (Audit Log)**: 누가 언제 어떤 앱을 롤백했는지, Replica를 몇으로 바꿨는지 등 변경 이력 저장 필요 (특히 메뉴1, 메뉴3에서 중요)
3. **실행 확인 절차**: Rollback, Replica 변경 등 위험한 작업 시 2차 확인 (예: "app1 prod를 v0.1.0으로 롤백합니다. 계속하시겠습니까?")
4. **알림 기능 (Phase 2)**: 배포/롤백 결과, 서버 다운 등을 Slack/이메일로 알림
5. **다크모드**: k8sdashboard에 이미 있었으니 admin-dashboard에도 적용 추천

---

## 10. 개발 로드맵 (안)

### Phase 1: MVP
- 로그인 (자체 인증, admin/admin)
- 사이드바 레이아웃
- 메뉴1: UI Application 상태 조회 + Rollback + Replica 변경
- 메뉴2: 기본 사용자/그룹 권한 관리
- MySQL 배포 및 스키마 구성
- admin-dashboard를 banana-deploy에 추가하여 K8s 배포

### Phase 2: 확장
- AD 연동
- 메뉴3: K8s 클러스터 관리 (k8sdashboard 기능 통합)
- 감사 로그
- 다크모드

### Phase 3: 인프라 관리
- 메뉴4: 서버 관리 (등록, 모니터링, SSH)
- Ansible 통합
- 알림 기능
