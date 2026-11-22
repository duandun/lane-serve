import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = createServer(app);
const io = new Server(server);

app.post('/api/broadcast', (req, res) => {
  const msg = typeof req.body?.msg === 'string' ? req.body.msg.trim() : '';
  if (!msg) return res.status(400).json({ error: 'msg 不能为空' });
  if (msg.length > 500) return res.status(400).json({ error: 'msg 不能超过 500 字符' });
  io.emit('chat message', { id: 'api', msg });
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  const { address, headers } = socket.handshake;
  const who = `ip=${address}${headers['x-forwarded-for'] ? ` xff=${headers['x-forwarded-for']}` : ''} origin=${headers.origin ?? '-'} ua="${headers['user-agent'] ?? '-'}"`;
  console.log(`connected ${socket.id} ${who}`);

  socket.emit('welcome', { id: socket.id });

  socket.on('disconnect', (reason) => {
    console.log(`disconnected ${socket.id} ${who} reason=${reason}`);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { id: socket.id, msg: String(msg).slice(0, 500) });
  });
});

const port = process.env.PORT || 6060;
server.listen(port, () => {
  console.log(`lane-serve-server listening on http://localhost:${port}`);
});
