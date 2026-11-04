import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildAuthUrl, fetchAllPages, summarizeCourse, checkGate } from './classroom.mjs';

const OUT = new URL('../.spike/', import.meta.url);
const TOKEN_FILE = new URL('token.json', OUT);
const REPORT_FILE = new URL('report.json', OUT);
const REDIRECT_URI = 'http://localhost:53682/callback';
const API = 'https://classroom.googleapis.com/v1';
const { GOOGLE_SYNC_CLIENT_ID: clientId, GOOGLE_SYNC_CLIENT_SECRET: clientSecret } = process.env;

if (!clientId || !clientSecret) {
  console.error('Missing client ID or secret. Run: node --env-file=.env.spike scripts/spike/run.mjs');
  process.exit(1);
}

async function requestToken(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${body.error}`);
  return body;
}

function waitForCode(state) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/plain' });
      res.end(ok ? 'Connected. You can close this tab.' : 'Connection failed. See the terminal.');
      server.close();
      if (ok) resolve(url.searchParams.get('code'));
      else reject(new Error(`Authorization failed: ${url.searchParams.get('error') ?? 'state mismatch'}`));
    });
    server.listen(53682, 'localhost');
  });
}

async function connect() {
  const state = randomBytes(16).toString('hex');
  console.log('Open this URL and approve access:\n');
  console.log(buildAuthUrl({ clientId, redirectUri: REDIRECT_URI, state }));
  const code = await waitForCode(state);
  const token = await requestToken({ code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
  await writeFile(TOKEN_FILE, JSON.stringify({ ...token, obtained_at: new Date().toISOString() }, null, 2));
  console.log(`\nRefresh token received: ${Boolean(token.refresh_token)}`);
  console.log(`refresh_token_expires_in: ${token.refresh_token_expires_in ?? 'not reported'}`);
  return token;
}

async function refresh() {
  const saved = JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
  const token = await requestToken({ refresh_token: saved.refresh_token, grant_type: 'refresh_token' });
  const age = (Date.now() - new Date(saved.obtained_at)) / 86_400_000;
  console.log(`Refresh worked. Token age: ${age.toFixed(1)} days.`);
  return token;
}

async function list(accessToken, path, key, query = {}) {
  return fetchAllPages(async (pageToken) => {
    const url = new URL(`${API}/${path}`);
    url.search = new URLSearchParams({ pageSize: '100', ...query, ...(pageToken ? { pageToken } : {}) }).toString();
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`${path.split('/').pop()}: ${res.status}`);
    return res.json();
  }, key);
}

async function readCourse(accessToken, course) {
  const errors = [];
  const safe = (name, key) =>
    list(accessToken, `courses/${course.id}/${name}`, key).catch((err) => {
      errors.push(err.message);
      return [];
    });
  const [topics, courseWork, materials, announcements] = await Promise.all([
    safe('topics', 'topic'),
    safe('courseWork', 'courseWork'),
    safe('courseWorkMaterials', 'courseWorkMaterial'),
    safe('announcements', 'announcements'),
  ]);
  return { course, topics, courseWork, materials, announcements, errors };
}

await mkdir(OUT, { recursive: true });
const token = process.argv.includes('--refresh-check') ? await refresh() : await connect();
const courses = await list(token.access_token, 'courses', 'courses', { studentId: 'me', courseStates: 'ACTIVE' });
const raw = await Promise.all(courses.map((course) => readCourse(token.access_token, course)));
const summaries = raw.map(summarizeCourse);
await writeFile(REPORT_FILE, JSON.stringify({ raw, summaries }, null, 2));

for (const s of summaries) {
  console.log(`\n${s.name}`, s.counts, s.attachments, `due dates: ${s.withDueDate}`, s.errors);
}
const gate = checkGate(summaries);
console.log(`\nGate: ${gate.passed ? 'PASSED' : 'FAILED'}`, gate.reasons);
process.exit(gate.passed ? 0 : 1);
