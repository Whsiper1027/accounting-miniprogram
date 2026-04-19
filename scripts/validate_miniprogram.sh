#!/bin/bash

set -euo pipefail

# 这是当前仓库的最低可用静态校验脚本。
# 目标不是替代微信开发者工具，而是保证 codex-auto 自动拉取后，
# 至少能验证“这是一个结构完整、配置文件可解析、页面入口存在”的原生微信小程序仓库。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

log() {
  printf '[validate_miniprogram] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "缺少命令: $1"
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    log "缺少文件: $1"
    exit 1
  fi
}

cd "$REPO_DIR"

require_cmd python3

log "仓库目录: $REPO_DIR"

# 当前仓库是真实生效的小程序根目录，而不是 miniprogram/ 子目录。
MINIPROGRAM_ROOT="$REPO_DIR"

require_file "$MINIPROGRAM_ROOT/app.json"
require_file "$MINIPROGRAM_ROOT/app.js"
require_file "$MINIPROGRAM_ROOT/app.wxss"
require_file "$MINIPROGRAM_ROOT/project.config.json"
require_file "$MINIPROGRAM_ROOT/sitemap.json"

if [[ -f "$MINIPROGRAM_ROOT/project.private.config.json" ]]; then
  PRIVATE_CONFIG_PRESENT="yes"
else
  PRIVATE_CONFIG_PRESENT="no"
fi

log "校验 JSON 配置文件"
JSON_FILES=(
  "$MINIPROGRAM_ROOT/app.json"
  "$MINIPROGRAM_ROOT/project.config.json"
  "$MINIPROGRAM_ROOT/sitemap.json"
)

if [[ "$PRIVATE_CONFIG_PRESENT" == "yes" ]]; then
  JSON_FILES+=("$MINIPROGRAM_ROOT/project.private.config.json")
fi

while IFS= read -r page_json; do
  JSON_FILES+=("$page_json")
done < <(find "$MINIPROGRAM_ROOT/pages" -type f -name '*.json' | sort)

/usr/bin/python3 - "${JSON_FILES[@]}" <<'PY'
import json
import pathlib
import sys

for raw_path in sys.argv[1:]:
    path = pathlib.Path(raw_path)
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[validate_miniprogram] JSON 解析失败: {path} -> {exc}", file=sys.stderr)
        sys.exit(1)
PY

log "校验 app.json 页面声明与文件是否匹配"
/usr/bin/python3 - <<'PY'
import json
import pathlib
import sys

repo = pathlib.Path.cwd()
app_json = repo / "app.json"

data = json.loads(app_json.read_text(encoding="utf-8"))
pages = data.get("pages")
if not isinstance(pages, list) or not pages:
    print("[validate_miniprogram] app.json 缺少有效的 pages 数组", file=sys.stderr)
    sys.exit(1)

missing = []
for page in pages:
    if not isinstance(page, str) or not page.strip():
        print("[validate_miniprogram] app.json pages 中存在非法项", file=sys.stderr)
        sys.exit(1)
    for suffix in (".js", ".wxml", ".wxss"):
        page_file = repo / f"{page}{suffix}"
        if not page_file.exists():
            missing.append(str(page_file.relative_to(repo)))

tab_bar = data.get("tabBar", {})
for item in tab_bar.get("list", []):
    page_path = item.get("pagePath")
    if not isinstance(page_path, str) or not page_path.strip():
        print("[validate_miniprogram] tabBar.list 中存在非法 pagePath", file=sys.stderr)
        sys.exit(1)
    if page_path not in pages:
        print(f"[validate_miniprogram] tabBar pagePath 未在 app.json pages 中注册: {page_path}", file=sys.stderr)
        sys.exit(1)

if missing:
    print("[validate_miniprogram] 缺少页面文件:", file=sys.stderr)
    for item in missing:
        print(f"  - {item}", file=sys.stderr)
    sys.exit(1)
PY

log "校验 pages/ 下基础页面文件是否存在"
PAGE_COUNT="$(find "$MINIPROGRAM_ROOT/pages" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
if [[ "$PAGE_COUNT" -eq 0 ]]; then
  log "pages/ 目录下没有页面子目录"
  exit 1
fi

log "校验通过"
