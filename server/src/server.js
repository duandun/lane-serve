import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());

// The agent connects from its own origin (Vite/Electron), so pairing needs CORS.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://59.110.25.186').replace(/\/+$/, '');
const PHONE_CODE_TTL_MS = 2 * 60 * 60 * 1000;
const phoneCodes = new Map();

function issuePhoneCode() {
  const now = Date.now();
  for (const [code, expiresAt] of phoneCodes) {
    if (expiresAt <= now) phoneCodes.delete(code);
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = String(randomInt(100000, 1000000));
    if (!phoneCodes.has(code)) {
      phoneCodes.set(code, now + PHONE_CODE_TTL_MS);
      return code;
    }
  }
  throw new Error('no free phone code');
}

function isValidPhoneCode(code) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  const expiresAt = phoneCodes.get(code);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    phoneCodes.delete(code);
    return false;
  }
  return true;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Pair a phone: issue one six-digit code and return the URL/QR the phone scans.
app.post('/api/agent/pair', async (_req, res) => {
  try {
    const code = issuePhoneCode();
    const url = `${PUBLIC_BASE_URL}/broadcast?code=${encodeURIComponent(code)}`;
    const qr = await QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
    res.json({ code, url, qr });
  } catch (error) {
    console.error('pair failed', error);
    res.status(500).json({ error: '生成连接码失败' });
  }
});

const server = createServer(app);
const io = new Server(server);

app.post('/api/broadcast', (req, res) => {
  const msg = typeof req.body?.msg === 'string' ? req.body.msg.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!msg) return res.status(400).json({ error: 'msg 不能为空' });
  if (msg.length > 500) return res.status(400).json({ error: 'msg 不能超过 500 字符' });
  if (!isValidPhoneCode(code)) {
    return res.status(400).json({ error: '连接码无效或已过期，请重新扫码' });
  }
  io.emit('chat message', { id: 'api', msg, code });
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

  socket.on('chat message', (payload) => {
    const data = typeof payload === 'string' ? { msg: payload } : payload ?? {};
    const msg = typeof data.msg === 'string' ? data.msg.trim() : '';
    const code = typeof data.code === 'string' ? data.code.trim() : '';
    if (!msg || !isValidPhoneCode(code)) return;
    io.emit('chat message', { id: socket.id, msg: msg.slice(0, 500), code });
  });
});

const port = process.env.PORT || 6060;
server.listen(port, () => {
  console.log(`lane-serve-server listening on http://localhost:${port}`);
});
