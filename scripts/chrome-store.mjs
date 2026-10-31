// Uploads the signed CRX to the Chrome Web Store and submits it for review, published as soon as it is approved
// (build-and-release.md, "Releases"). Run by the publish_release workflow:
//
//   node scripts/chrome-store.mjs <file.crx>
//
// The item takes only CRX files signed with the key of its Verified CRX uploads, so WXT's `wxt submit`, which uploads
// a zip, can't publish it: the CRX goes with the headers of Chrome's guide (developer.chrome.com/docs/webstore/update).
// Reads CHROME_PUBLISHER_ID, CHROME_EXTENSION_ID and CHROME_SERVICE_ACCOUNT_JSON (the key of the service account added in
// the dashboard's Settings, from Google Cloud).
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const UPLOAD_WAIT_MS = 5 * 60_000;

/** @param {string} name */
function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/** @param {string | Buffer} data */
const base64url = (data) => Buffer.from(data).toString('base64url');

/**
 * A short-lived access token for the service account: a JWT signed with its key, exchanged at Google's OAuth server.
 * @param {{ client_email: string, private_key: string }} account
 */
async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Google refused the service account: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

/**
 * A call to the Chrome Web Store API that fails on any answer but 2xx.
 * @param {string} what
 * @param {string} url
 * @param {RequestInit} init
 */
async function call(what, url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${what} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const [crx] = process.argv.slice(2);
if (!crx?.endsWith('.crx')) throw new Error('Usage: node scripts/chrome-store.mjs <file.crx>');

const item = `${API}/v2/publishers/${env('CHROME_PUBLISHER_ID')}/items/${env('CHROME_EXTENSION_ID')}`;
const upload = `${API}/upload/v2/publishers/${env('CHROME_PUBLISHER_ID')}/items/${env('CHROME_EXTENSION_ID')}:upload`;
const token = await accessToken(JSON.parse(env('CHROME_SERVICE_ACCOUNT_JSON')));
const auth = { Authorization: `Bearer ${token}` };

console.log(`Uploading ${basename(crx)}`);
const uploaded = await call('The upload', upload, {
  method: 'POST',
  headers: { ...auth, 'X-Goog-Upload-Protocol': 'raw', 'X-Goog-Upload-File-Name': basename(crx) },
  body: readFileSync(crx),
});
let state = uploaded.uploadState;
for (const end = Date.now() + UPLOAD_WAIT_MS; state === 'IN_PROGRESS' && Date.now() < end; ) {
  await sleep(5000);
  state = (await call('Reading the upload', `${item}:fetchStatus`, { headers: auth })).lastAsyncUploadState;
}
if (state !== 'SUCCEEDED')
  throw new Error(`The Chrome Web Store didn't take the package (${state}): ${JSON.stringify(uploaded)}`);
console.log(`Uploaded version ${uploaded.crxVersion ?? ''}`);

// No publishType: the default publishes the version as soon as the review approves it.
const published = await call('The submission for review', `${item}:publish`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: '{}',
});
for (const warning of published.warningInfo?.warnings ?? []) console.warn(`${warning.reason}: ${warning.description}`);
console.log(`Submitted for review: ${published.state ?? 'pending'}`);
