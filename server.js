import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true, app: 'artvas' }));

// ---- AI image relay (Muapi.ai). The user's own API key is passed through per request and never stored here.
const MUAPI = 'https://api.muapi.ai/api/v1';
const okId = (v) => /^[\w.\-]{1,80}$/.test(v || '');
app.get('/api/muapi/ping', (_req, res) => res.json({ ok: true }));
app.post('/api/muapi/generate/:endpoint', express.json({ limit: '2mb' }), async (req, res) => {
  const key = req.get('x-api-key');
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  if (!okId(req.params.endpoint)) return res.status(400).json({ error: 'Bad model' });
  try {
    const r = await fetch(`${MUAPI}/${req.params.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(req.body || {}),
    });
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the AI service' });
  }
});
app.get('/api/muapi/result/:id', async (req, res) => {
  const key = req.get('x-api-key');
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  if (!okId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const r = await fetch(`${MUAPI}/predictions/${req.params.id}/result`, { headers: { 'x-api-key': key } });
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the AI service' });
  }
});
// Fetch a generated image so the editor can use it without cross-origin problems.
app.get('/api/image-proxy', async (req, res) => {
  let url;
  try {
    url = new URL(String(req.query.url || ''));
  } catch {
    return res.status(400).end();
  }
  if (url.protocol !== 'https:') return res.status(400).end();
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return res.status(415).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) return res.status(413).end();
    res.type(type).set('Cache-Control', 'private, max-age=3600').send(buf);
  } catch {
    res.status(502).end();
  }
});
app.use(
  express.static(dist, {
    maxAge: '1y',
    index: false,
    setHeaders(res, file) {
      if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Artvas running on port ${PORT}`));
