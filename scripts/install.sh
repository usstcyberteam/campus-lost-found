#!/usr/bin/env bash
# 校园寻物局一键安装（Linux / macOS / Git Bash）：安装前后端依赖、生成本地配置、建库并导入校园地图。
# 用法：bash scripts/install.sh [--demo] [--dev] [--start] [--no-mirror]
#   --demo       额外生成 60 条演示帖子（AI 地点推荐与热力图需要历史数据）
#   --dev        同时安装 pytest、ruff 等开发依赖
#   --start      安装完成后直接启动后端（后台）和前端（前台），Ctrl+C 一起退出
#   --no-mirror  不走华为云开源镜像站，直接连 PyPI / npm 官方源（海外网络用）
# 端口可用环境变量改：BACKEND_PORT（默认 8000）、FRONTEND_PORT（默认 5173）
set -euo pipefail
# Git Bash 下 Python 默认按 GBK 输出，中文提示会乱码
export PYTHONUTF8=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PIP_INDEX="https://repo.huaweicloud.com/repository/pypi/simple"
NPM_REGISTRY="https://repo.huaweicloud.com/repository/npm/"

DEMO=0
DEV=0
START=0
MIRROR=1
for arg in "$@"; do
  case "$arg" in
    --demo) DEMO=1 ;;
    --dev) DEV=1 ;;
    --start) START=1 ;;
    --no-mirror) MIRROR=0 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$1"; }
fail() { echo "安装中止：$1" >&2; exit 1; }

step "检查运行环境"
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 &&
    "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
[ -n "$PYTHON" ] || fail "需要 Python 3.11 及以上（Debian/Ubuntu 另需 python3-venv）"
echo "Python $("$PYTHON" -c 'import platform; print(platform.python_version())')"

command -v node >/dev/null 2>&1 || fail "需要 Node.js 18 及以上：https://nodejs.org/"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 版本过低（$(node --version)），需要 18 及以上"
echo "Node.js $(node --version)"

PIP_MIRROR=()
NPM_MIRROR=()
if [ "$MIRROR" -eq 1 ]; then
  PIP_MIRROR=(-i "$PIP_INDEX")
  NPM_MIRROR=(--registry "$NPM_REGISTRY")
  echo "依赖下载走华为云开源镜像站（加 --no-mirror 可改回官方源）"
fi

step "安装后端依赖（backend/.venv）"
[ -d "$BACKEND/.venv" ] || "$PYTHON" -m venv "$BACKEND/.venv"
# Git Bash 下虚拟环境的解释器在 Scripts/，Linux / macOS 在 bin/
if [ -x "$BACKEND/.venv/bin/python" ]; then
  VENV_PY="$BACKEND/.venv/bin/python"
else
  VENV_PY="$BACKEND/.venv/Scripts/python.exe"
fi
REQUIREMENTS="requirements.txt"
[ "$DEV" -eq 1 ] && REQUIREMENTS="requirements-dev.txt"
"$VENV_PY" -m pip install --disable-pip-version-check -r "$BACKEND/$REQUIREMENTS" ${PIP_MIRROR[@]+"${PIP_MIRROR[@]}"}

step "生成本地配置（已有的 .env 原样保留，不打印密钥）"
"$VENV_PY" "$ROOT/scripts/configure_local.py"

step "建表并导入管理员、图层与校园建筑"
(
  cd "$BACKEND"
  "$VENV_PY" -m alembic upgrade head
  "$VENV_PY" seed.py
  if [ "$DEMO" -eq 1 ]; then
    "$VENV_PY" -m scripts.seed_demo
  fi
)

step "安装前端依赖（frontend/node_modules）"
(cd "$FRONTEND" && npm ci --no-audit --no-fund ${NPM_MIRROR[@]+"${NPM_MIRROR[@]}"})

echo
echo "安装完成。"
echo "管理员账号 admin，初始密码见 backend/.env 里的 ADMIN_PASSWORD；学生账号在注册页自行注册。"
echo "AI 助手默认走规则模式；接入大模型请在 backend/.env 填写 MODEL_BASE_URL、MODEL_NAME、MODEL_API_KEY 并设 MODEL_DISABLED=false。"

if [ "$START" -eq 0 ]; then
  echo
  echo "启动方法（各开一个终端）："
  echo "  后端：cd backend && $VENV_PY -m uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT"
  echo "  前端：cd frontend && API_PROXY_TARGET=http://127.0.0.1:$BACKEND_PORT npm run dev -- --port $FRONTEND_PORT"
  echo "然后打开 http://localhost:$FRONTEND_PORT ；也可以重新运行本脚本并加 --start 自动启动。"
  exit 0
fi

step "启动后端和前端（Ctrl+C 一起退出）"
(cd "$BACKEND" && exec "$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT") &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM
echo "后端已在后台启动（端口 $BACKEND_PORT），前端启动后打开 http://localhost:$FRONTEND_PORT"
cd "$FRONTEND"
API_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" npm run dev -- --port "$FRONTEND_PORT"
