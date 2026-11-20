import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
// Free AI images (Pollinations.ai community service). Browsers are refused when calling it
// directly, so the server fetches on the user's behalf. Falls back to the turbo model when busy.
app.get('/api/free-image', async (req, res) => {
  const prompt = String(req.query.prompt || '').slice(0, 900);
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  const w = Math.max(64, Math.min(1440, parseInt(req.query.w, 10) || 1024));
  const h = Math.max(64, Math.min(1440, parseInt(req.query.h, 10) || 1024));
  const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 1e9);
  const models = [...new Set([String(req.query.model || 'flux').replace(/[^\w-]/g, ''), 'turbo'])];
  let last = 502;
  for (const model of models) {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&model=${model}&nologo=true`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Artvas/1.0' } });
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.startsWith('image/')) {
        res.type(type).set('Cache-Control', 'private, max-age=3600').send(Buffer.from(await r.arrayBuffer()));
        return;
      }
      last = r.status;
    } catch {
      last = 502;
    }
  }
  res.status(last === 429 || last === 402 ? 429 : 502).json({ error: 'The free AI service is busy' });
});

// ---- Online voices (Microsoft Edge "Read Aloud" neural voices, free) ----
// Chinese, Malay, Tamil, Indonesian, English and many more. Returns MP3 audio plus sentence timings.
const ttsAgent = process.env.HTTPS_PROXY ? new HttpsProxyAgent(process.env.HTTPS_PROXY) : undefined;
const xml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
app.post('/api/tts', express.json({ limit: '64kb' }), async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 5000);
  const voice = String(req.body?.voice || '');
  const rate = Math.max(0.5, Math.min(2, Number(req.body?.rate) || 1));
  if (!text) return res.status(400).json({ error: 'Nothing to say' });
  if (!/^[a-z]{2,3}-[A-Z]{2}(-[a-z]+)?-[A-Za-z]+Neural$/.test(voice)) return res.status(400).json({ error: 'Unknown voice' });
  const tts = new MsEdgeTTS({ agent: ttsAgent, connectionTimeoutMs: 10000, synthesisTimeoutMs: 45000 });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { sentenceBoundaryEnabled: true });
    const pct = Math.round((rate - 1) * 100);
    const { audioStream, metadataStream } = tts.toStream(xml(text), { rate: `${pct >= 0 ? '+' : ''}${pct}%` });
    const audio = [];
    const sentences = [];
    const collect = (stream, onData) =>
      stream
        ? new Promise((resolve, reject) => {
            stream.on('data', onData);
            stream.on('end', resolve);
            stream.on('close', resolve);
            stream.on('error', reject);
          })
        : Promise.resolve();
    await Promise.all([
      collect(audioStream, (c) => audio.push(c)),
      collect(metadataStream, (c) => {
        try {
          for (const m of JSON.parse(c.toString()).Metadata || []) {
            if (m.Type !== 'SentenceBoundary') continue;
            const start = m.Data.Offset / 1e7;
            sentences.push({ text: m.Data.text?.Text || '', start, end: start + m.Data.Duration / 1e7 });
          }
        } catch {}
      }),
    ]);
    const buf = Buffer.concat(audio);
    if (!buf.length) throw new Error('empty');
    res.json({ mime: 'audio/mpeg', audio: buf.toString('base64'), sentences });
  } catch (e) {
    console.error('TTS failed', e?.message || e);
    res.status(502).json({ error: 'The voice service is busy. Try again in a moment.' });
  } finally {
    try {
      tts.close();
    } catch {}
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
    if (!r.ok || !(type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/') || type === 'application/octet-stream' || type === 'binary/octet-stream')) return res.status(415).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 200 * 1024 * 1024) return res.status(413).end();
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
