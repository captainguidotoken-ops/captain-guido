/**
 * CGC Worker — Cloudflare Worker
 *
 * Routes:
 *   POST /        — AI proxy (Anthropic). Requires X-Secret header.
 *   POST /beacon  — Analytics beacon. Public, IP rate-limited.
 *   OPTIONS *     — CORS preflight.
 *
 * Environment variables (set in Cloudflare Worker → Settings → Variables):
 *   ANTHROPIC_API_KEY  — your Anthropic API key (sk-ant-...)
 *   WORKER_SECRET      — shared secret for the AI proxy
 *   GITHUB_TOKEN       — fine-grained GitHub token, repo: captain-guido, Contents R+W
 */

const REPO_OWNER   = 'captainguidotoken-ops';
const REPO_NAME    = 'captain-guido';
const ANALYTICS_PATH = 'analytics.json';
const GH_API_BASE  = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${ANALYTICS_PATH}`;

// Allowed origins for beacon (add your custom domain here if you have one)
const ALLOWED_ORIGINS = [
  'https://captainguidotoken-ops.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const CORS_PUBLIC = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CORS_PRIVATE = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Secret',
};

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Limits each IP to 1 beacon per 30s. Resets when the Worker instance restarts.
// Good enough to prevent accidental hammering; not a hard security gate.
const _ratemap = new Map();
const RATE_WINDOW_MS = 30_000;
const MAX_PER_WINDOW = 3;

function isRateLimited(ip) {
  const now   = Date.now();
  const entry = _ratemap.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RATE_WINDOW_MS; }
  entry.count++;
  _ratemap.set(ip, entry);
  // Prune old entries every ~500 requests to avoid unbounded growth
  if (_ratemap.size > 500) {
    for (const [k, v] of _ratemap) { if (now > v.reset) _ratemap.delete(k); }
  }
  return entry.count > MAX_PER_WINDOW;
}

// ── GitHub helpers ────────────────────────────────────────────────────────────
function ghHeaders(token) {
  return {
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent':   'CGT-Worker/1.0',
  };
}

async function ghRead(token) {
  const res  = await fetch(GH_API_BASE + '?v=' + Date.now(), { headers: ghHeaders(token) });
  if (res.status === 404) return { sha: null, data: { visits: [], secEvents: [] } };
  if (!res.ok)            throw new Error(`GitHub read failed: ${res.status}`);
  const raw  = await res.json();
  const text = atob(raw.content.replace(/\n/g, ''));
  // Decode UTF-8 from the binary string atob returns
  const dec  = new TextDecoder();
  const bytes = Uint8Array.from(text, c => c.charCodeAt(0));
  const data = JSON.parse(dec.decode(bytes));
  if (!data.visits)    data.visits    = [];
  if (!data.secEvents) data.secEvents = [];
  return { sha: raw.sha, data };
}

async function ghWrite(token, data, sha) {
  const enc     = new TextEncoder();
  const bytes   = enc.encode(JSON.stringify(data, null, 2));
  // base64-encode the UTF-8 bytes
  const b64     = btoa(String.fromCharCode(...bytes));
  const body    = { message: 'chore: visit beacon', content: b64 };
  if (sha) body.sha = sha;
  const res  = await fetch(GH_API_BASE, {
    method:  'PUT',
    headers: ghHeaders(token),
    body:    JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) {
    // SHA conflict — refetch and retry once
    const { sha: freshSha, data: freshData } = await ghRead(token);
    freshData.visits.push(...data.visits.slice(-1));        // re-add just the new visit
    freshData.visits = freshData.visits.slice(-2000);
    await ghWrite(token, freshData, freshSha);
    return;
  }
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`);
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleBeacon(request, env) {
  // Rate limit by IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ ok: false, error: 'rate limited' }), {
      status: 429,
      headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
    });
  }

  if (!env.GITHUB_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'GITHUB_TOKEN not set' }), {
      status: 500,
      headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
    });
  }

  // Reject oversized payloads (max 4KB for a beacon)
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > 4096) {
    return new Response(JSON.stringify({ ok: false, error: 'payload too large' }), {
      status: 413,
      headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
    });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error('too large');
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad json' }), {
      status: 400,
      headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
    });
  }

  // Validate payload — only accept known fields, sanitise strings
  const visit = {
    ts:  typeof payload.ts  === 'number' ? Math.floor(payload.ts)  : Date.now(),
    dur: typeof payload.dur === 'number' ? Math.floor(payload.dur) : 0,
    uid: typeof payload.uid === 'string' ? payload.uid.slice(0, 32) : '',
    ref: typeof payload.ref === 'string' ? payload.ref.slice(0, 200) : '',
    dev: payload.dev === 'mobile' ? 'mobile' : 'desktop',
    country: request.cf?.country || '',
  };

  try {
    const { sha, data } = await ghRead(env.GITHUB_TOKEN);
    data.visits.push(visit);
    if (data.visits.length > 2000) data.visits = data.visits.slice(-2000);
    await ghWrite(env.GITHUB_TOKEN, data, sha);
  } catch (e) {
    // Don't fail noisily — analytics errors should never break the visitor experience
    console.error('beacon write error:', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_PUBLIC, 'Content-Type': 'application/json' },
  });
}

async function handleAI(request, env) {
  const secret = request.headers.get('X-Secret');
  if (!secret || secret !== env.WORKER_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_PRIVATE, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 32768) throw new Error('too large'); // 32KB max for AI requests
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_PRIVATE, 'Content-Type': 'application/json' },
    });
  }

  // Allowlist safe fields — never blindly forward the full body to Anthropic
  const safeBody = {
    model:      typeof body.model      === 'string' ? body.model      : 'claude-sonnet-4-6',
    max_tokens: typeof body.max_tokens === 'number' ? Math.min(body.max_tokens, 2048) : 600,
    system:     typeof body.system     === 'string' ? body.system.slice(0, 8192)      : undefined,
    messages:   Array.isArray(body.messages)        ? body.messages.slice(0, 20)      : [],
  };
  if (safeBody.system === undefined) delete safeBody.system;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify(safeBody),
  });

  const data = await anthropicRes.json();
  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: { ...CORS_PRIVATE, 'Content-Type': 'application/json' },
  });
}

// ── Main fetch handler ────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      const headers = url.pathname === '/beacon' ? CORS_PUBLIC : CORS_PRIVATE;
      return new Response(null, { status: 204, headers });
    }

    if (method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (url.pathname === '/beacon') return handleBeacon(request, env);
    return handleAI(request, env);
  },
};
