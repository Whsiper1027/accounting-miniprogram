#!/bin/bash

set -euo pipefail

# 本脚本只负责把仓库内的自动化基础文件安装到用户目录。
# 它不会自动 load launchd，也不会执行危险操作。

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

INSTALL_DIR="${1:-$HOME/bin}"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/whisper-codex"
RUNNER_SOURCE="$REPO_DIR/scripts/codex_runner.sh"
PLIST_SOURCE="$REPO_DIR/launchd/com.whisper.codex.runner.plist.example"
RUNNER_TARGET="$INSTALL_DIR/codex_runner.sh"
PLIST_TARGET="$LAUNCH_AGENTS_DIR/com.whisper.codex.runner.plist"

log() {
  printf '[setup_local] %s\n' "$*"
}

require_file() {
  if [[ ! -f "$1" ]]; then
    log "缺少文件: $1"
    exit 1
  fi
}

require_file "$RUNNER_SOURCE"
require_file "$PLIST_SOURCE"

mkdir -p "$INSTALL_DIR"
mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$LOG_DIR"

cp "$RUNNER_SOURCE" "$RUNNER_TARGET"
chmod +x "$RUNNER_TARGET"

cp "$PLIST_SOURCE" "$PLIST_TARGET"

log "已安装 runner: $RUNNER_TARGET"
log "已创建日志目录: $LOG_DIR"
log "已复制 plist 模板: $PLIST_TARGET"
log ""
log "请手动编辑 plist，并替换以下占位符:"
log "  {{HOME}}        -> $HOME"
log "  {{USER}}        -> ${USER:-your-user}"
log "  {{REPO_DIR}}    -> $REPO_DIR"
log "  {{RUNNER_PATH}} -> $RUNNER_TARGET"
log ""
log "替换完成后，手动执行以下命令加载 launchd:"
log "  launchctl unload \"$PLIST_TARGET\" 2>/dev/null || true"
log "  launchctl load \"$PLIST_TARGET\""
