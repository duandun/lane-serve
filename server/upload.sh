#!/usr/bin/env bash
set -euo pipefail

# 用法: ./upload.sh [user@host]
# 可用环境变量覆盖: REMOTE_DIR=/opt/lane-serve/server ./upload.sh
HOST="${1:-root@59.110.25.186}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lane-serve/server}"

cd "$(dirname "$0")"

if [[ ! -f package.json ]]; then
  echo "请在 server 项目目录下运行（找不到 package.json）" >&2
  exit 1
fi

echo "上传到 $HOST:$REMOTE_DIR ..."
COPYFILE_DISABLE=1 tar czf - \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.idea' \
  --exclude='.DS_Store' \
  . | ssh "$HOST" "mkdir -p '$REMOTE_DIR' && tar xzf - -C '$REMOTE_DIR'"

echo "完成。服务器上首次部署："
echo "  ssh $HOST 'cd $REMOTE_DIR && npm ci && pm2 delete lane-serve-api 2>/dev/null; pm2 start src/server.js --name lane-serve-api && pm2 save'"
