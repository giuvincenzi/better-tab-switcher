import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The sites that exist only in the tests (bts.test, and the pages a test makes: *.test), served over HTTPS by a server
 * of the tests' own, on this machine: the browser loads them as any site, its requests never stopped on their way
 * (Playwright's request interception held every request of every page, the extension's own files too, and one never
 * came on GitHub's Windows machines). The browser is sent to the server by its host rules, and trusts the server's
 * certificate alone (scripts/real-browser.mjs: siteRules).
 */

/** The folder of the test sites' certificate, made once before the tests (makeSiteCertificate). */
const CERTIFICATE = 'E2E_SITE_CERTIFICATE';

/**
 * Once before the tests (global-setup.ts): a certificate for the test sites, made with openssl in a folder of its own
 * (no key kept in the repository), shared with the tests through the environment.
 */
export function makeSiteCertificate() {
  const dir = mkdtempSync(join(tmpdir(), 'test-site-'));
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(dir, 'key.pem'),
        '-out',
        join(dir, 'cert.pem'),
        '-days',
        '30',
        '-subj',
        '/CN=bts.test',
        '-addext',
        'subjectAltName=DNS:*.test',
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  } catch (error) {
    const { stderr } = error as { stderr?: string };
    throw new Error(`openssl didn't make the test sites' certificate (is openssl installed?):\n${stderr ?? error}`);
  }
  process.env[CERTIFICATE] = dir;
}

/** A page a test site answers with: its HTML, and the headers it sends with it. */
export interface SitePage {
  body: string;
  headers?: Record<string, string>;
}

/** How a test site answers: the page for this address (one that waits makes a slow site). */
export type SiteAnswer = (url: URL) => SitePage | Promise<SitePage>;

/** The test sites' server, one for each of Playwright's workers. */
export interface TestSites {
  /** Where the browser is sent for every *.test site, and the certificate it trusts (real-browser.mjs: siteRules). */
  rules: { port: number; certificate: string };
  /** From now until the test ends, `host` (e.g. "form.test") answers with `answer`. */
  serve: (host: string, answer: SiteAnswer) => void;
  /** Forgets the sites a test added: bts.test stays. */
  reset: () => void;
  close: () => Promise<void>;
}

/** bts.test: a page for each path, its title the path's name (https://bts.test/alpha: "alpha"). */
const btsTest: SiteAnswer = (url) => {
  const name = url.pathname.slice(1);
  return { body: `<title>${name}</title><h1>${name}</h1>` };
};

/** Starts the test sites' server on a free port of this machine. */
export async function startTestSites(): Promise<TestSites> {
  const dir = process.env[CERTIFICATE];
  if (!dir) throw new Error(`The test sites' certificate wasn't made (global-setup.ts: makeSiteCertificate).`);
  const cert = readFileSync(join(dir, 'cert.pem'));
  // The hash of the certificate's public key, as Chrome's --ignore-certificate-errors-spki-list takes it.
  const certificate = createHash('sha256')
    .update(new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' }))
    .digest('base64');
  const sites = new Map<string, SiteAnswer>();
  const server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert }, (request, response) => {
    void answer(request, response);
  });
  async function answer(request: IncomingMessage, response: ServerResponse) {
    const host = (request.headers.host ?? '').replace(/:\d+$/, '');
    const site = sites.get(host) ?? (host === 'bts.test' ? btsTest : undefined);
    if (!site) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end(`No test site ${host}.`);
      return;
    }
    const page = await site(new URL(request.url ?? '/', `https://${host}`));
    response.writeHead(200, { 'content-type': 'text/html', ...page.headers }).end(page.body);
  }
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The test sites have no port.');
  return {
    rules: { port: address.port, certificate },
    serve: (host, answer) => void sites.set(host, answer),
    reset: () => sites.clear(),
    close: () =>
      new Promise((closed) => {
        server.closeAllConnections();
        server.close(() => closed());
      }),
  };
}
