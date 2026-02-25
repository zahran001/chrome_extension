/**
 * Minimal static file server for E2E test fixtures.
 * Serves files from tests/fixtures/ at http://localhost:4321/
 * Used by playwright.config.ts webServer to serve fixture HTML over HTTP
 * (required because Chrome extensions cannot inject content scripts into file:// pages
 * without explicit user permission in chrome://extensions → Allow access to file URLs).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const PORT = 4321;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/selection-page.html' : req.url ?? '/selection-page.html';
  const filePath = path.join(FIXTURES_DIR, urlPath);

  // Security: only serve files within FIXTURES_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(FIXTURES_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = MIME[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Fixtures server running at http://localhost:${PORT}/`);
});
