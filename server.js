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
