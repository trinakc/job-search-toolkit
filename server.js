/**
 * server.js — Local development server for the Job Search Toolkit
 *
 * WHY THIS EXISTS — THE CORS PROBLEM
 * ───────────────────────────────────
 * The Reed.co.uk API does not send CORS headers in its responses.
 * That means if the browser fetches https://www.reed.co.uk/api/... directly,
 * it gets blocked by the browser's CORS policy before the response is even read.
 *
 * WHAT THIS SERVER DOES ABOUT IT
 * ───────────────────────────────
 * It acts as a same-origin proxy. Instead of the browser calling Reed directly,
 * it calls http://localhost:8000/api/reed/search (same origin — no CORS check).
 * This server receives that request and forwards it server-side to Reed.
 * Server-to-server HTTPS calls are not subject to browser CORS restrictions,
 * so Reed responds normally and we stream the JSON back to the browser.
 *
 * ROUTES
 * ──────
 *   GET /api/reed/search?...  → proxied to https://www.reed.co.uk/api/1.0/search?...
 *   Everything else           → served as a static file from the repo root
 *
 * USAGE
 * ─────
 *   node server.js
 *   Then open: http://localhost:8000/job-search-toolkit.html
 *
 * No npm packages required — uses only Node.js built-ins: http, https, fs, path.
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 8000;

// Maps file extensions to Content-Type headers for static file serving.
// Covers every file type present in this project.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.txt':  'text/plain; charset=utf-8',
  '.bat':  'application/octet-stream',
  '.md':   'text/plain; charset=utf-8',
};

// ─── Request handler ──────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {

  // Parse the incoming URL — we only need pathname and search (query string)
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  // ── Reed API proxy ─────────────────────────────────────────────────────────
  // Requests to /api/reed/search are forwarded to Reed's API server-side.
  // The browser sends Authorization: Basic ... (built in app.js fetchReedJobs),
  // and we pass that header straight through to Reed.
  if (reqUrl.pathname === '/api/reed/search') {
    proxyReedRequest(req, res, reqUrl.search);
    return;
  }

  // ── Static file server ─────────────────────────────────────────────────────
  // Default root to job-search-toolkit.html so opening http://localhost:8000/
  // goes straight to the app without needing the full filename in the URL.
  const relativePath = reqUrl.pathname === '/' ? 'job-search-toolkit.html' : reqUrl.pathname;
  const filePath     = path.join(__dirname, relativePath);

  // Guard against path traversal attacks (e.g. GET /../../../etc/passwd).
  // path.join normalises the path — if it escapes __dirname, deny it.
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        console.error('[static] Error reading file:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    // Tell the browser never to cache files from this dev server.
    // Without this, the browser may serve a stale app.js even after you edit it,
    // and a normal refresh won't pick up the change — only a hard refresh (Ctrl+Shift+R) would.
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
});

// ─── Reed proxy function ──────────────────────────────────────────────────────

/**
 * Forwards a browser request to the Reed.co.uk API and streams the response back.
 *
 * Request flow:
 *   Browser  →  GET http://localhost:8000/api/reed/search?keywords=...  (same-origin, no CORS)
 *   Proxy    →  GET https://www.reed.co.uk/api/1.0/search?keywords=...  (server-to-server, no CORS)
 *   Reed     →  { results: [...] }
 *   Proxy    →  streams JSON back to browser
 *
 * The Authorization header built by fetchReedJobs() in app.js is forwarded
 * as-is, so the API key never needs to be stored separately on the server side.
 *
 * @param {http.IncomingMessage} req         The incoming browser request
 * @param {http.ServerResponse}  res         The response to send back to the browser
 * @param {string}               queryString The raw query string including the leading '?'
 *                                           (e.g. '?keywords=delivery+manager&locationName=Ireland')
 */
function proxyReedRequest(req, res, queryString) {
  const options = {
    hostname: 'www.reed.co.uk',
    port:     443,
    // /api/reed/search → /api/1.0/search on Reed's side, keeping all query params
    path:     `/api/1.0/search${queryString}`,
    method:   'GET',
    headers: {
      // The browser built this in fetchReedJobs: 'Basic ' + btoa(apiKey + ':')
      // Forwarding it unchanged means the API key is authenticated at Reed's end
      'Authorization': req.headers['authorization'] || '',
      'Accept':        'application/json',
      // Identify the request as coming from this proxy so Reed's logs are readable
      'User-Agent':    'job-search-toolkit-local-proxy/1.0',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Collect the full response body before sending it back.
    // Reed's responses are small JSON payloads, so buffering is fine here.
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const body = Buffer.concat(chunks);
      // Pass Reed's HTTP status code through unchanged.
      // fetchReedJobs() checks response.ok (status 200-299) to decide whether to throw.
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(body);
    });
  });

  proxyReq.on('error', err => {
    // This fires for network errors (e.g. Reed is unreachable), not for HTTP 4xx/5xx.
    console.error('[proxy] Reed API request failed:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Proxy error connecting to Reed: ${err.message}` }));
  });

  // We're making a GET request — no body to send, so close the request immediately
  proxyReq.end();
}

// ─── Start server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log('  Job Search Toolkit');
  console.log(`  http://localhost:${PORT}/job-search-toolkit.html`);
  console.log('');
  console.log('  Reed API proxy active at /api/reed/search');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
