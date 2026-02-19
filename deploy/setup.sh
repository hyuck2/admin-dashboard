#!/bin/bash
# ============================================================
# Admin Dashboard Setup Script
# 사용법: bash setup.sh [command]
#
# Commands:
#   save-images   - (인터넷 PC) Docker 이미지를 tar로 저장
#   load-images   - (서버) tar 파일에서 Docker 이미지 로드
#   init          - (서버) 초기 설정 (.env, kubeconfig)
#   start         - (서버) 서비스 시작
#   stop          - (서버) 서비스 중지
#   status        - (서버) 서비스 상태 확인
#   logs          - (서버) 로그 확인
#   reset-db      - (서버) DB 초기화 (데이터 삭제)
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

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
# save-images: 인터넷 가능한 PC에서 실행
# ============================================================
cmd_save_images() {
    info "Docker 이미지를 tar 파일로 저장합니다..."
    info "필요한 이미지를 pull 합니다..."

    # 베이스 이미지 pull
    docker pull mysql:8.0
    docker pull python:3.11-slim
    docker pull nginx:alpine
    docker pull node:22-alpine

    # 이미지 목록
    IMAGES=(
        "mysql:8.0"
        "admin-dashboard-backend:${BACKEND_TAG}"
        "admin-dashboard-frontend:${FRONTEND_TAG}"
    )

    SAVE_DIR="./images"
    mkdir -p "$SAVE_DIR"

    for img in "${IMAGES[@]}"; do
        filename=$(echo "$img" | tr '/:' '_').tar
        info "Saving $img -> $SAVE_DIR/$filename"
        docker save "$img" -o "$SAVE_DIR/$filename"
    done

    info "저장 완료! $SAVE_DIR/ 폴더를 서버로 복사하세요."
    ls -lh "$SAVE_DIR/"
}

# ============================================================
# load-images: 격리망 서버에서 실행
# ============================================================
cmd_load_images() {
    IMAGES_DIR="${1:-./images}"
    if [ ! -d "$IMAGES_DIR" ]; then
        error "이미지 디렉토리를 찾을 수 없습니다: $IMAGES_DIR"
    fi

    info "Docker 이미지를 로드합니다..."
    for tar in "$IMAGES_DIR"/*.tar; do
        info "Loading: $(basename $tar)"
        docker load -i "$tar"
    done

    info "로드 완료!"
    docker images | grep -E "admin-dashboard|mysql"
}

# ============================================================
# init: 초기 설정
# ============================================================
cmd_init() {
    info "Admin Dashboard 초기 설정을 시작합니다..."

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
        echo "  # 각 k3s 마스터 노드에서 복사:"
        echo "  scp user@k3s-master-1:/etc/rancher/k3s/k3s.yaml ./k3s-cluster1.yaml"
        echo "  scp user@k3s-master-2:/etc/rancher/k3s/k3s.yaml ./k3s-cluster2.yaml"
        echo "  scp user@k3s-master-3:/etc/rancher/k3s/k3s.yaml ./k3s-cluster3.yaml"
        echo ""
        echo "  # 각 파일에서 server 주소와 클러스터/유저 이름 수정 후:"
        echo "  KUBECONFIG=k3s-cluster1.yaml:k3s-cluster2.yaml:k3s-cluster3.yaml \\"
        echo "    kubectl config view --flatten > ./kubeconfig"
        echo ""
        echo "  # 또는 단일 클러스터라면:"
        echo "  cp /etc/rancher/k3s/k3s.yaml ./kubeconfig"
        echo "  # server: https://127.0.0.1:6443 → 실제 마스터 IP로 변경"
        echo ""
    else
        info "kubeconfig 파일이 존재합니다."
        kubectl --kubeconfig=./kubeconfig cluster-info 2>/dev/null && info "클러스터 연결 확인 완료" || warn "클러스터 연결 실패 - kubeconfig를 확인하세요"
    fi

    echo ""
    info "초기 설정 완료. 다음 단계:"
    echo "  1. vi .env              # 환경변수 수정"
    echo "  2. kubeconfig 파일 준비  # k3s kubeconfig 병합"
    echo "  3. bash setup.sh start  # 서비스 시작"
}

# ============================================================
# start: 서비스 시작
# ============================================================
cmd_start() {
    # 사전 검사
    [ ! -f .env ] && error ".env 파일이 없습니다. 먼저 'bash setup.sh init' 을 실행하세요."
    [ ! -f ./kubeconfig ] && warn "kubeconfig 파일이 없습니다. K8s 관리 기능이 동작하지 않습니다."

    info "Admin Dashboard를 시작합니다..."
    docker compose up -d

    info "서비스 시작 중... (MySQL 초기화에 30초 정도 소요될 수 있습니다)"
    sleep 5

    # 상태 확인
    cmd_status

    # .env에서 포트 읽기
    source .env 2>/dev/null
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
    info "서비스를 중지합니다..."
    docker compose down
    info "중지 완료"
}

# ============================================================
# status: 서비스 상태
# ============================================================
cmd_status() {
    docker compose ps
}

# ============================================================
# logs: 로그 확인
# ============================================================
cmd_logs() {
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
    warn "MySQL 데이터를 완전히 삭제하고 재초기화합니다."
    read -p "계속하시겠습니까? (y/N): " confirm
    [ "$confirm" != "y" ] && echo "취소" && exit 0

    docker compose down
    docker volume rm "$(basename $SCRIPT_DIR)_mysql_data" 2>/dev/null || true
    docker compose up -d
    info "DB 초기화 완료. 서비스가 시작됩니다."
}

# ============================================================
# Main
# ============================================================
case "${1:-help}" in
    save-images) cmd_save_images ;;
    load-images) cmd_load_images "$2" ;;
    init)        cmd_init ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    status)      cmd_status ;;
    logs)        cmd_logs "$2" ;;
    reset-db)    cmd_reset_db ;;
    help|*)
        echo "Admin Dashboard Setup Script"
        echo ""
        echo "Usage: bash setup.sh <command>"
        echo ""
        echo "Commands (인터넷 PC):"
        echo "  save-images           Docker 이미지를 tar로 저장"
        echo ""
        echo "Commands (서버):"
        echo "  load-images [dir]     tar 파일에서 Docker 이미지 로드"
        echo "  init                  초기 설정 (.env, kubeconfig 가이드)"
        echo "  start                 서비스 시작"
        echo "  stop                  서비스 중지"
        echo "  status                서비스 상태 확인"
        echo "  logs [service]        로그 확인 (service: mysql|backend|frontend)"
        echo "  reset-db              DB 초기화 (데이터 삭제 후 재생성)"
        ;;
esac
