#!/bin/bash

set -euo pipefail

# Codex 自动拉取执行器
# 用法:
#   codex_runner.sh /absolute/path/to/repo
#
# 设计目标:
# - 只跟踪 origin/codex-auto
# - 检测到新 commit 才拉取和验证
# - 只执行固定白名单命令
# - 任何一步失败都返回非 0
# - 尽量兼容 macOS 的 launchd PATH 不完整问题

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

BRANCH_NAME="codex-auto"
REMOTE_NAME="${CODEX_REMOTE_NAME:-origin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_LOG_DIR="${HOME}/Library/Logs/whisper-codex"
LOG_DIR="${CODEX_LOG_DIR:-$DEFAULT_LOG_DIR}"

usage() {
  cat <<'EOF'
Usage: codex_runner.sh /absolute/path/to/repo
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少命令: $1"
  fi
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

REPO_DIR="$1"
if [[ ! -d "$REPO_DIR" ]]; then
  fail "仓库目录不存在: $REPO_DIR"
fi

mkdir -p "$LOG_DIR"

require_cmd git
require_cmd bash

STATE_NAME="$(basename "$REPO_DIR")"
STATE_FILE="${LOG_DIR}/${STATE_NAME}.last_commit"

VALIDATION_COMMANDS=(
  "bash scripts/validate_miniprogram.sh"
)

cd "$REPO_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "不是有效 Git 仓库: $REPO_DIR"
fi

WORKTREE_STATUS="$(git status --porcelain)"
if [[ -n "$WORKTREE_STATUS" ]]; then
  fail "工作区不干净，已停止自动拉取，请先处理本地修改"
fi

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  fail "未配置 Git remote '${REMOTE_NAME}'。请先执行 git remote add ${REMOTE_NAME} <repo-url>"
fi

log "获取 ${REMOTE_NAME}/${BRANCH_NAME} 最新信息"
git fetch --quiet "$REMOTE_NAME" "$BRANCH_NAME"

REMOTE_REF="refs/remotes/${REMOTE_NAME}/${BRANCH_NAME}"
if ! git show-ref --verify --quiet "$REMOTE_REF"; then
  fail "远端分支不存在: ${REMOTE_NAME}/${BRANCH_NAME}"
fi

LATEST_REMOTE_COMMIT="$(git rev-parse "$REMOTE_REF")"
LOCAL_BRANCH_COMMIT="$(git rev-parse --verify "refs/heads/${BRANCH_NAME}" 2>/dev/null || true)"
LAST_PROCESSED_COMMIT="$(cat "$STATE_FILE" 2>/dev/null || true)"

if [[ "$LATEST_REMOTE_COMMIT" == "$LOCAL_BRANCH_COMMIT" && "$LATEST_REMOTE_COMMIT" == "$LAST_PROCESSED_COMMIT" ]]; then
  log "没有新 commit，跳过执行"
  exit 0
fi

CURRENT_BRANCH="$(git branch --show-current)"
log "当前分支: ${CURRENT_BRANCH:-detached}"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  git checkout "$BRANCH_NAME" >/dev/null
else
  log "本地不存在 ${BRANCH_NAME}，创建跟踪分支"
  git checkout -b "$BRANCH_NAME" --track "${REMOTE_NAME}/${BRANCH_NAME}" >/dev/null
fi

log "快进到 ${REMOTE_NAME}/${BRANCH_NAME}"
git merge --ff-only "$REMOTE_REF" >/dev/null

for cmd in "${VALIDATION_COMMANDS[@]}"; do
  log "执行验证命令: $cmd"
  case "$cmd" in
    "bash scripts/validate_miniprogram.sh")
      bash scripts/validate_miniprogram.sh
      ;;
    *)
      fail "发现未授权的验证命令: $cmd"
      ;;
  esac
done

printf '%s\n' "$LATEST_REMOTE_COMMIT" > "$STATE_FILE"
log "处理完成，记录 commit: $LATEST_REMOTE_COMMIT"
