import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());
app.set('trust proxy', true);

// Simple in-memory fixed-window limiter; enough to stop casual floods.
const rateBuckets = new Map();

function allow(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

function clientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 60_000).unref();

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
app.post('/api/agent/pair', async (req, res) => {
  if (!allow(`pair:${clientIP(req)}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  try {
    const code = issuePhoneCode();
    const url = `${PUBLIC_BASE_URL}/phone?code=${encodeURIComponent(code)}`;
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
  if (!allow(`broadcast:${code}`, 20, 10 * 1000) || !allow(`broadcast-ip:${clientIP(req)}`, 60, 60 * 1000)) {
    return res.status(429).json({ error: '发送过于频繁，请稍后再试' });
  }
  io.to(code).emit('chat message', { id: 'api', msg, code });
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

  socket.on('phone join', (payload) => {
    const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
    if (!isValidPhoneCode(code) || !allow(`join:${socket.id}`, 10, 60 * 1000)) return;
    if (socket.data.phoneCode) socket.leave(socket.data.phoneCode);
    socket.data.phoneCode = code;
    socket.join(code);
  });

  socket.on('agent messages', (payload) => {
    const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
    if (!isValidPhoneCode(code) || !allow(`agent-msg:${socket.id}`, 60, 10 * 1000)) return;
    const list = Array.isArray(payload?.messages) ? payload.messages.slice(-100) : [];
    const messages = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const role = item.role;
      const text = typeof item.text === 'string' ? item.text.slice(0, 4000).trim() : '';
      if (!text || !['user', 'assistant', 'system', 'change'].includes(role)) continue;
      messages.push({ role, text });
    }
    io.to(code).emit('agent messages', { messages, working: payload?.working === true });
  });

  socket.on('agent sync', (payload) => {
    const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
    if (!isValidPhoneCode(code) || !allow(`agent-sync:${socket.id}`, 20, 10 * 1000)) return;
    io.to(code).emit('agent sync', { code });
  });

  socket.on('chat message', (payload) => {
    const msg = typeof payload?.msg === 'string' ? payload.msg.trim() : '';
    const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
    if (!msg || !isValidPhoneCode(code)) return;
    if (!allow(`msg:${socket.id}`, 20, 10 * 1000) || !allow(`msg-code:${code}`, 30, 10 * 1000)) return;
    // Senders also join their code room so they see their own broadcast.
    if (socket.data.phoneCode && socket.data.phoneCode !== code) socket.leave(socket.data.phoneCode);
    socket.data.phoneCode = code;
    socket.join(code);
    io.to(code).emit('chat message', { id: socket.id, msg: msg.slice(0, 500), code });
  });
});

const port = process.env.PORT || 6060;
server.listen(port, () => {
  console.log(`lane-serve-server listening on http://localhost:${port}`);
});
