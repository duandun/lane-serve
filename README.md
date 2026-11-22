# lane-serve

前后端完全分离的两个项目：

- `server/` — Express 5 + Socket.IO，纯 API 和实时服务，监听 6060
- `web/` — TanStack Start（SPA 模式）+ React，构建产物由 nginx 直接托管

两者没有共享代码或依赖；接口约定为：

- `GET /health` → `{ status: 'ok' }`
- `POST /api/broadcast`，body `{ "msg": "..." }` → 广播 Socket.IO 事件 `chat message`，payload `{ id, msg }`
- Socket.IO 事件 `welcome`（连接时）、`chat message`（聊天/广播）

## 本地开发

```bash
# 终端 1
cd server && npm ci && npm run dev     # http://localhost:6060

# 终端 2
cd web && npm ci && npm run dev        # http://localhost:3000
```

前端开发服务器会把 `/api` 和 `/socket.io`（含 WebSocket）代理到 6060，所以浏览器只访问 3000 即可。

## 构建

```bash
cd web && npm run build                # 输出 web/dist/client（含 _shell.html）
```

## 部署

```bash
./server/upload.sh                     # 上传源码到 /opt/lane-serve/server
./web/upload.sh                        # 上传源码到 /opt/lane-serve/web
```

服务器上：

```bash
cd /opt/lane-serve/server && npm ci
pm2 start src/server.js --name lane-serve-api && pm2 save

cd /opt/lane-serve/web && npm ci && npm run build
```

nginx 关键配置：

```nginx
root /opt/lane-serve/web/dist/client;

location /api/       { proxy_pass http://127.0.0.1:6060; }
location /socket.io/ {
    proxy_pass http://127.0.0.1:6060;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
location /           { try_files $uri /_shell.html; }
```

页面外壳 `_shell.html` 不要长缓存；`/assets/` 可加 `expires 1y` + `immutable`。
