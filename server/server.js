require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');

const app    = express();
const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.SERVER_SECRET;
const TOKEN  = process.env.GITHUB_TOKEN;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const REPO_OWNER = 'captainguidotoken-ops';
const REPO_NAME  = 'captain-guido';
const GH_BASE    = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;

app.use(express.json({ limit: '2mb' }));

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return res.status(500).json({ error: 'SERVER_SECRET not configured' });
  if (req.headers['x-secret'] !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Serve admin page — inject server URL + secret so it auto-connects ─────────
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'admin.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const inject = `<script>
  localStorage.setItem('cgc_ai_url',    '${SERVER_URL}/gh');
  localStorage.setItem('cgc_ai_secret', '${SECRET}');
</script>`;
  html = html.replace('</head>', inject + '\n</head>');

  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; '));

  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(html);
});

// ── GitHub proxy ───────────────────────────────────────────────────────────────
app.get('/gh', requireSecret, async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set on server' });
  const filePath = req.query.path || '';
  try {
    const r = await fetch(GH_BASE + filePath + '?v=' + Date.now(), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CGT-Admin-Server/1.0',
      },
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/gh', requireSecret, async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set on server' });
  const filePath = req.query.path || '';
  try {
    const r = await fetch(GH_BASE + filePath, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CGT-Admin-Server/1.0',
      },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Anthropic AI proxy ─────────────────────────────────────────────────────────
app.post('/', requireSecret, async (req, res) => {
  if (!AI_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AI_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Visit beacon — open endpoint, no auth, called by the public site ───────────
// Buffers visits in memory and flushes to analytics.json every 20 visits or 5 min.
const _visitBuffer = [];
let _flushTimer    = null;

async function flushVisits() {
  clearTimeout(_flushTimer);
  _flushTimer = null;
  if (!_visitBuffer.length || !TOKEN) return;
  const batch = _visitBuffer.splice(0);
  try {
    const ghHeaders = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CGT-Admin-Server/1.0',
    };
    const getRes = await fetch(GH_BASE + 'analytics.json', { headers: ghHeaders });
    let analytics = { visits: [] };
    let sha;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      try {
        analytics = JSON.parse(Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString());
      } catch (e) {}
    }
    if (!Array.isArray(analytics.visits)) analytics.visits = [];
    analytics.visits.push(...batch);
    if (analytics.visits.length > 1000) analytics.visits = analytics.visits.slice(-1000);

    const content = Buffer.from(JSON.stringify(analytics, null, 2)).toString('base64');
    const body = { message: `chore: log ${batch.length} visit(s)`, content };
    if (sha) body.sha = sha;

    await fetch(GH_BASE + 'analytics.json', {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Put batch back and retry in 1 minute
    _visitBuffer.unshift(...batch);
    _flushTimer = setTimeout(flushVisits, 60 * 1000);
  }
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(flushVisits, 5 * 60 * 1000);
}

app.options('/beacon', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://captainguidotoken-ops.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/beacon', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://captainguidotoken-ops.github.io');
  res.sendStatus(204);
  if (!TOKEN) return;
  _visitBuffer.push({
    ts:  Number(req.body.ts)  || Date.now(),
    dur: Number(req.body.dur) || 0,
    uid: String(req.body.uid || '').slice(0, 32),
    ref: String(req.body.ref || '').slice(0, 200),
    dev: req.body.dev === 'mobile' ? 'mobile' : 'desktop',
  });
  if (_visitBuffer.length >= 20) flushVisits();
  else scheduleFlush();
});

app.listen(PORT, () => {
  console.log(`CGT Admin Server on port ${PORT}`);
  if (!TOKEN)  console.warn('  ⚠  GITHUB_TOKEN not set');
  if (!SECRET) console.warn('  ⚠  SERVER_SECRET not set');
  if (!AI_KEY) console.warn('  ℹ  ANTHROPIC_API_KEY not set (AI chat disabled)');
});
