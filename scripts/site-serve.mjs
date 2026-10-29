// make docs serve=1: builds the website preview (as make docs does) and serves it at http://localhost:8080/ (make docs
// serve=1 port=<n>: another port) until Ctrl+C,
// so the links work as on the real site. Node only: nothing to install.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const port = Number(process.env.PORT ?? 8080);
execFileSync(process.execPath, [join(root, 'scripts/site.mjs'), '--preview'], { stdio: 'inherit' });
const site = join(root, 'site-preview');

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  let file = join(site, decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
  // Only files of the site, never a path out of it.
  if (!file.startsWith(site + sep) && file !== site) {
    response.writeHead(404).end();
    return;
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const body = readFileSync(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
})
  .on('error', (error) => {
    // Another program has the port: say which option picks another one, not Node's error.
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EADDRINUSE') throw error;
    console.error(`Port ${port} is used by another program. Choose another one: make docs serve=1 port=<n>`);
    process.exit(1);
  })
  .listen(port, () => console.log(`Serving ${site} at http://localhost:${port}/ (Ctrl+C to stop)`));
