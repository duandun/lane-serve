#!/usr/bin/env bash
set -euo pipefail

# 用法: ./upload.sh [user@host]
# 可用环境变量覆盖: REMOTE_DIR=/opt/lane-serve/web ./upload.sh
HOST="${1:-root@59.110.25.186}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lane-serve/web}"

cd "$(dirname "$0")"

if [[ ! -f package.json ]]; then
  echo "请在 web 项目目录下运行（找不到 package.json）" >&2
  exit 1
fi

echo "上传到 $HOST:$REMOTE_DIR ..."
COPYFILE_DISABLE=1 tar czf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.tanstack' \
  --exclude='./.git' \
  --exclude='./.idea' \
  --exclude='.DS_Store' \
  . | ssh "$HOST" "mkdir -p '$REMOTE_DIR' && tar xzf - -C '$REMOTE_DIR'"

echo "完成。服务器上构建（nginx 的 root 需要指向 dist/client）："
echo "  ssh $HOST 'cd $REMOTE_DIR && npm ci && npm run build'"
