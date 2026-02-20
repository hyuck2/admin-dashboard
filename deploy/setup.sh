#!/bin/bash
# ============================================================
# Admin Dashboard Setup Script (Air-gapped Rocky 8.6)
# 사용법: bash setup.sh [command]
#
# Commands:
#   build         - Docker 이미지 빌드 (소스코드에서)
#   init          - 초기 설정 (.env, kubeconfig)
#   start         - 서비스 시작
#   stop          - 서비스 중지
#   restart       - 서비스 재시작
#   status        - 서비스 상태 확인
#   logs          - 로그 확인
#   reset-db      - DB 초기화 (데이터 삭제)
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# .env 로드
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

BACKEND_TAG="${BACKEND_TAG:-v0.2.1}"
FRONTEND_TAG="${FRONTEND_TAG:-v0.3.2}"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# build: Docker 이미지 빌드
# ============================================================
cmd_build() {
    info "Docker 이미지를 빌드합니다..."

    cd "$SCRIPT_DIR"

    # docker compose build 사용 (Dockerfile 경로는 docker-compose.yml에 정의됨)
    info "Docker Compose로 이미지 빌드 중..."
    docker compose build

    info "빌드 완료!"
    docker images | grep admin-dashboard
}

# ============================================================
# init: 초기 설정
# ============================================================
cmd_init() {
    info "Admin Dashboard 초기 설정을 시작합니다..."

    cd "$SCRIPT_DIR"

    # .env 파일 생성
    if [ ! -f .env ]; then
        cp .env.example .env
        info ".env 파일이 생성되었습니다. 설정을 수정하세요:"
        info "  vi $SCRIPT_DIR/.env"
    else
        warn ".env 파일이 이미 존재합니다. 건너뜁니다."
    fi

    # kubeconfig 설정
    if [ ! -f ./kubeconfig ]; then
        warn "kubeconfig 파일이 없습니다."
        echo ""
        echo "k3s 클러스터의 kubeconfig를 가져와서 병합하세요:"
        echo ""
        echo "  # 단일 클러스터:"
        echo "  cp /etc/rancher/k3s/k3s.yaml ./kubeconfig"
        echo "  # server: https://127.0.0.1:6443 → 실제 마스터 IP로 변경"
        echo "  sed -i 's|127.0.0.1:6443|10.0.1.100:6443|' ./kubeconfig"
        echo ""
        echo "  # 멀티 클러스터 (3개):"
        echo "  scp root@k3s-1:/etc/rancher/k3s/k3s.yaml ./k3s-1.yaml"
        echo "  scp root@k3s-2:/etc/rancher/k3s/k3s.yaml ./k3s-2.yaml"
        echo "  scp root@k3s-3:/etc/rancher/k3s/k3s.yaml ./k3s-3.yaml"
        echo "  # 각 파일에서 cluster/user 이름 + server IP 수정 후:"
        echo "  KUBECONFIG=k3s-1.yaml:k3s-2.yaml:k3s-3.yaml kubectl config view --flatten > ./kubeconfig"
        echo ""
    else
        info "kubeconfig 파일이 존재합니다."
        kubectl --kubeconfig=./kubeconfig cluster-info 2>/dev/null && \
            info "클러스터 연결 확인 완료" || \
            warn "클러스터 연결 실패 - kubeconfig를 확인하세요"
    fi

    echo ""
    info "초기 설정 완료. 다음 단계:"
    echo "  1. vi .env                     # 환경변수 수정"
    echo "  2. kubeconfig 파일 준비         # k3s kubeconfig 병합"
    echo "  3. bash setup.sh build          # Docker 이미지 빌드"
    echo "  4. bash setup.sh start          # 서비스 시작"
}

# ============================================================
# start: 서비스 시작
# ============================================================
cmd_start() {
    cd "$SCRIPT_DIR"

    # 사전 검사
    [ ! -f .env ] && error ".env 파일이 없습니다. 먼저 'bash setup.sh init' 을 실행하세요."
    [ ! -f ./kubeconfig ] && warn "kubeconfig 파일이 없습니다. K8s 관리 기능이 동작하지 않습니다."

    # 이미지 확인
    source .env 2>/dev/null
    if ! docker images | grep -q "admin-dashboard-backend.*${BACKEND_TAG}"; then
        error "백엔드 이미지가 없습니다. 먼저 'bash setup.sh build' 를 실행하세요."
    fi
    if ! docker images | grep -q "admin-dashboard-frontend.*${FRONTEND_TAG}"; then
        error "프론트엔드 이미지가 없습니다. 먼저 'bash setup.sh build' 를 실행하세요."
    fi

    info "Admin Dashboard를 시작합니다..."
    docker compose up -d

    info "서비스 시작 중... (MySQL 초기화에 30초 정도 소요될 수 있습니다)"
    sleep 5

    # 상태 확인
    cmd_status

    # .env에서 포트 읽기
    PORT="${DASHBOARD_PORT:-80}"
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

    echo ""
    info "접속 URL: http://${SERVER_IP}:${PORT}"
    info "초기 계정: admin / admin"
}

# ============================================================
# stop: 서비스 중지
# ============================================================
cmd_stop() {
    cd "$SCRIPT_DIR"
    info "서비스를 중지합니다..."
    docker compose down
    info "중지 완료"
}

# ============================================================
# restart: 서비스 재시작
# ============================================================
cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

# ============================================================
# status: 서비스 상태
# ============================================================
cmd_status() {
    cd "$SCRIPT_DIR"
    docker compose ps
}

# ============================================================
# logs: 로그 확인
# ============================================================
cmd_logs() {
    cd "$SCRIPT_DIR"
    SERVICE="${1:-}"
    if [ -n "$SERVICE" ]; then
        docker compose logs -f --tail=100 "$SERVICE"
    else
        docker compose logs -f --tail=50
    fi
}

# ============================================================
# reset-db: DB 초기화
# ============================================================
cmd_reset_db() {
    cd "$SCRIPT_DIR"
    warn "MySQL 데이터를 완전히 삭제하고 재초기화합니다."
    read -p "계속하시겠습니까? (y/N): " confirm
    [ "$confirm" != "y" ] && echo "취소" && exit 0

    docker compose down
    docker volume rm "$(basename $(dirname $SCRIPT_DIR))_mysql_data" 2>/dev/null || true
    docker compose up -d
    info "DB 초기화 완료. 서비스가 시작됩니다."
}

# ============================================================
# Main
# ============================================================
case "${1:-help}" in
    build)       cmd_build ;;
    init)        cmd_init ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    restart)     cmd_restart ;;
    status)      cmd_status ;;
    logs)        cmd_logs "$2" ;;
    reset-db)    cmd_reset_db ;;
    help|*)
        echo "Admin Dashboard Setup Script"
        echo ""
        echo "Usage: bash setup.sh <command>"
        echo ""
        echo "Commands:"
        echo "  build                 소스에서 Docker 이미지 빌드"
        echo "  init                  초기 설정 (.env, kubeconfig 가이드)"
        echo "  start                 서비스 시작"
        echo "  stop                  서비스 중지"
        echo "  restart               서비스 재시작"
        echo "  status                서비스 상태 확인"
        echo "  logs [service]        로그 확인 (service: mysql|backend|frontend)"
        echo "  reset-db              DB 초기화 (데이터 삭제 후 재생성)"
        echo ""
        echo "설치 순서:"
        echo "  1. bash setup.sh init      # .env, kubeconfig 설정"
        echo "  2. bash setup.sh build     # 이미지 빌드"
        echo "  3. bash setup.sh start     # 서비스 시작"
        ;;
esac
