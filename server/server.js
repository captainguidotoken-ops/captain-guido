require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const fetch       = require('node-fetch');
const fs          = require('fs');
const path        = require('path');
const crypto      = require('crypto');

const app    = express();
const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.SERVER_SECRET;
const TOKEN  = process.env.GITHUB_TOKEN;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const REPO_OWNER = 'captainguidotoken-ops';
const REPO_NAME  = 'captain-guido';
const GH_BASE    = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;

const PUBLIC_ORIGIN = 'https://captainguidotoken-ops.github.io';

// ── Trust proxy (Render terminates TLS upstream so X-Forwarded-* are real) ────
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Helmet — strict default headers; CSP set per-route below ──────────────────
app.use(helmet({
  contentSecurityPolicy: false,         // we set CSP manually for the admin page
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// ── JSON body parser with hard cap ────────────────────────────────────────────
app.use(express.json({ limit: '256kb' }));

// ── Rate limits ──────────────────────────────────────────────────────────────
// Auth-protected admin routes: tighter (per-IP) so bruteforcing the secret is slow.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                              // 60 req/min per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
// Public beacon: very generous but still bounded.
const beaconLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,                             // 240 beacons/min per IP — visit + duration
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// ── Constant-time secret check (defeats timing attacks) ──────────────────────
function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function requireSecret(req, res, next) {
  if (!SECRET) return res.status(500).json({ error: 'SERVER_SECRET not configured' });
  if (!timingSafeEq(req.headers['x-secret'] || '', SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Serve admin page — inject server URL + secret so it auto-connects ─────────
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'admin.html');
  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (e) {
    return res.status(500).send('admin.html not found');
  }

  // HTML-encode the secret so any odd characters don't break the script tag
  const safeSecret = String(SECRET || '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;',
  })[c]);
  const safeUrl = String(SERVER_URL || '');

  const inject = `<script>
  localStorage.setItem('cgc_ai_url',    ${JSON.stringify(safeUrl + '/gh')});
  localStorage.setItem('cgc_ai_secret', ${JSON.stringify(safeSecret)});
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
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.send(html);
});

// ── Path-traversal guard for GitHub Contents API proxy ────────────────────────
function safeRepoPath(input) {
  const p = String(input || '').replace(/^\/+/, '');
  // Allow slashes for directories, but block ../, backslashes, null bytes, scheme prefixes.
  if (!p) return null;
  if (p.includes('..')) return null;
  if (p.includes('\\')) return null;
  if (p.includes('\0')) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return null;       // no scheme
  if (!/^[A-Za-z0-9._\-/]+$/.test(p)) return null;           // safe charset only
  return p;
}

// ── GitHub proxy ───────────────────────────────────────────────────────────────
app.get('/gh', authLimiter, requireSecret, async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set on server' });
  const filePath = safeRepoPath(req.query.path);
  if (filePath === null) return res.status(400).json({ error: 'Invalid path' });
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
    res.status(502).json({ error: 'GitHub fetch failed' });
  }
});

app.put('/gh', authLimiter, requireSecret, async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set on server' });
  const filePath = safeRepoPath(req.query.path);
  if (filePath === null) return res.status(400).json({ error: 'Invalid path' });
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
    res.status(502).json({ error: 'GitHub fetch failed' });
  }
});

// ── Anthropic AI proxy ─────────────────────────────────────────────────────────
app.post('/', authLimiter, requireSecret, async (req, res) => {
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
    res.status(502).json({ error: 'Anthropic fetch failed' });
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

function setBeaconCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  PUBLIC_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age',       '86400');
  res.setHeader('Vary', 'Origin');
}

app.options('/beacon', (req, res) => {
  setBeaconCors(res);
  res.sendStatus(204);
});

app.post('/beacon', beaconLimiter, (req, res) => {
  setBeaconCors(res);

  // Origin check — only the public site may post beacons
  const origin = req.headers.origin;
  if (origin && origin !== PUBLIC_ORIGIN) {
    return res.sendStatus(204);          // silently drop, don't leak diagnostics
  }
  res.sendStatus(204);
  if (!TOKEN) return;

  const b = req.body || {};
  _visitBuffer.push({
    ts:  Number(b.ts)  || Date.now(),
    dur: Math.max(0, Math.min(86_400_000, Number(b.dur) || 0)),
    uid: String(b.uid || '').slice(0, 32),
    ref: String(b.ref || '').slice(0, 200),
    dev: b.dev === 'mobile' ? 'mobile' : 'desktop',
  });
  if (_visitBuffer.length >= 20) flushVisits();
  else scheduleFlush();
});

// ── Healthcheck (used by Render) ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Catch-all 404 ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler — never leak stack traces ──────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CGT Admin Server on port ${PORT}`);
  if (!TOKEN)  console.warn('  ⚠  GITHUB_TOKEN not set');
  if (!SECRET) console.warn('  ⚠  SERVER_SECRET not set');
  if (!AI_KEY) console.warn('  ℹ  ANTHROPIC_API_KEY not set (AI chat disabled)');
});
