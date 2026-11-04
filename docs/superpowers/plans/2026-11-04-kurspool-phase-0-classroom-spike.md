# Kurspool Phase 0: Classroom Connection Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 3 to 5 need the owner and the browser, so run this phase inline.

**Goal:** Prove, with the owner's real account, that the Classroom API returns all six modules with usable items, and find out how to keep the sync token alive.

**Architecture:** A small read-only Node script with no dependencies. It runs the Google OAuth flow on localhost, reads Classroom, and writes a raw report to a gitignored folder. Its code is thrown away or reused in `lib/classroom/` later; the findings document is what lasts.

**Tech Stack:** Node 22 (built-in `fetch`, `node:http`, `node:test`), Google Classroom API v1, Google OAuth 2.0.

## Global Constraints

- Everything stays free: no billing account on Google Cloud, and stop and ask if anything requests payment details or an upgrade.
- The GitHub repo is private, under the `EmirTutar` account.
- Read-only: use only `.readonly` Classroom scopes and GET requests.
- Use a new Google Cloud project. Do not change `tutartechs-flow` or any other existing project.
- The owner types all passwords and secrets and grants the Google consent personally.
- Secrets and raw Classroom data stay in `.env.spike` and `scripts/.spike/`, which are gitignored. Findings committed to Git contain no course URLs, student names or tokens.

## File Structure

- `scripts/spike/classroom.mjs`: pure helpers (auth URL, pagination, summary, gate check)
- `scripts/spike/classroom.test.mjs`: tests for the helpers
- `scripts/spike/run.mjs`: OAuth flow, API calls and report writing
- `.env.spike`: client ID and secret (gitignored, created by the owner)
- `scripts/.spike/`: token and raw report (gitignored)
- `docs/superpowers/specs/2026-11-04-classroom-spike-findings.md`: results and decisions

---

### Task 1: Private GitHub repo

**Files:** none

**Interfaces:**
- Produces: remote `origin` at `https://github.com/EmirTutar/kurspool.git`

- [ ] **Step 1:** Create the private repo `kurspool` at https://github.com/new with no README, license or gitignore.
- [ ] **Step 2:** Connect and push.

```bash
git remote add origin https://github.com/EmirTutar/kurspool.git
git push -u origin main
```

Expected: `main` is pushed, and the GitHub page shows the "Private" label. If Git asks for a login, the owner completes it.

### Task 2: Pure Classroom helpers

**Files:**
- Create: `scripts/spike/classroom.mjs`
- Test: `scripts/spike/classroom.test.mjs`

**Interfaces:**
- Produces:
  - `SCOPES: string[]`
  - `buildAuthUrl({ clientId, redirectUri, state }): string`
  - `fetchAllPages(fetchPage: (pageToken?) => Promise<object>, key: string): Promise<object[]>`
  - `summarizeCourse({ course, topics, courseWork, materials, announcements, errors }): object`
  - `checkGate(summaries: object[]): { passed: boolean, reasons: string[] }`

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPES, buildAuthUrl, fetchAllPages, summarizeCourse, checkGate } from './classroom.mjs';

test('buildAuthUrl requests offline access with read-only scopes', () => {
  const url = new URL(buildAuthUrl({ clientId: 'id', redirectUri: 'http://localhost:53682/callback', state: 's' }));
  assert.equal(url.searchParams.get('client_id'), 'id');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('state'), 's');
  assert.equal(url.searchParams.get('scope'), SCOPES.join(' '));
  assert.ok(SCOPES.every((s) => s.endsWith('.readonly')));
});

test('fetchAllPages follows nextPageToken and tolerates empty pages', async () => {
  const pages = { undefined: { items: [{ id: 1 }], nextPageToken: 'b' }, b: {} , };
  const seen = [];
  const all = await fetchAllPages(async (token) => { seen.push(token); return pages[token]; }, 'items');
  assert.deepEqual(all, [{ id: 1 }]);
  assert.deepEqual(seen, [undefined, 'b']);
});

test('summarizeCourse counts items, attachments and due dates', () => {
  const summary = summarizeCourse({
    course: { id: '1', name: '0. Start' },
    topics: [{ topicId: 't' }],
    courseWork: [
      { title: 'a', dueDate: { year: 2026 }, materials: [{ link: {} }, { driveFile: {} }] },
      { title: 'b', topicId: 't' },
    ],
    materials: [{ title: 'c', materials: [{ youtubeVideo: {} }] }],
    announcements: [{ text: 'd', materials: [{ form: {} }] }],
    errors: [],
  });
  assert.equal(summary.name, '0. Start');
  assert.deepEqual(summary.counts, { topics: 1, courseWork: 2, materials: 1, announcements: 1 });
  assert.deepEqual(summary.attachments, { link: 1, driveFile: 1, youtubeVideo: 1, form: 1 });
  assert.equal(summary.withDueDate, 1);
  assert.equal(summary.withTopic, 1);
  assert.deepEqual(summary.titles, ['a', 'b', 'c']);
});

test('checkGate needs six modules, items, attachments and no errors', () => {
  const good = { name: 'm', counts: { topics: 0, courseWork: 1, materials: 0, announcements: 0 }, attachments: { link: 1 }, errors: [] };
  assert.equal(checkGate(Array(6).fill(good)).passed, true);

  const few = checkGate(Array(5).fill(good));
  assert.equal(few.passed, false);
  assert.match(few.reasons[0], /5 courses/);

  const empty = { ...good, counts: { topics: 0, courseWork: 0, materials: 0, announcements: 0 }, attachments: {} };
  assert.equal(checkGate(Array(6).fill(empty)).passed, false);

  const failed = { ...good, errors: ['courseWork: 403'] };
  assert.equal(checkGate(Array(6).fill(failed)).passed, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/spike/classroom.test.mjs`
Expected: FAIL because `classroom.mjs` does not exist.

- [ ] **Step 3: Write the implementation**

```js
const BASE = 'https://www.googleapis.com/auth/classroom';

export const SCOPES = [
  `${BASE}.courses.readonly`,
  `${BASE}.coursework.me.readonly`,
  `${BASE}.courseworkmaterials.readonly`,
  `${BASE}.announcements.readonly`,
  `${BASE}.topics.readonly`,
];

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES.join(' '),
    state,
  }).toString();
  return url.toString();
}

export async function fetchAllPages(fetchPage, key) {
  const all = [];
  let token;
  do {
    const page = await fetchPage(token);
    all.push(...(page[key] ?? []));
    token = page.nextPageToken;
  } while (token);
  return all;
}

export function summarizeCourse({ course, topics, courseWork, materials, announcements, errors }) {
  const attachments = {};
  for (const item of [...courseWork, ...materials, ...announcements]) {
    for (const material of item.materials ?? []) {
      for (const type of Object.keys(material)) {
        attachments[type] = (attachments[type] ?? 0) + 1;
      }
    }
  }
  return {
    name: course.name,
    counts: {
      topics: topics.length,
      courseWork: courseWork.length,
      materials: materials.length,
      announcements: announcements.length,
    },
    attachments,
    withDueDate: courseWork.filter((item) => item.dueDate).length,
    withTopic: [...courseWork, ...materials].filter((item) => item.topicId).length,
    titles: [...courseWork, ...materials].map((item) => item.title),
    errors,
  };
}

export function checkGate(summaries) {
  const reasons = [];
  if (summaries.length < 6) reasons.push(`Expected 6 modules, found ${summaries.length} courses`);
  const items = summaries.reduce((n, s) => n + s.counts.courseWork + s.counts.materials + s.counts.announcements, 0);
  if (items === 0) reasons.push('No items found in any module');
  if (!summaries.some((s) => Object.keys(s.attachments).length > 0)) reasons.push('No attachments found');
  for (const s of summaries) {
    if (s.errors.length) reasons.push(`${s.name}: ${s.errors.join(', ')}`);
  }
  return { passed: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/spike/classroom.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike/classroom.mjs scripts/spike/classroom.test.mjs
git commit -m "feat: add Classroom spike helpers"
```

### Task 3: Runner script

**Files:**
- Create: `scripts/spike/run.mjs`

**Interfaces:**
- Consumes: everything Task 2 produces
- Produces:
  - `scripts/.spike/token.json`: Google's token response plus `obtained_at`
  - `scripts/.spike/report.json`: raw items and summaries
  - Terminal output: per-module counts and the gate result, with no URLs or tokens

- [ ] **Step 1: Write the runner**

```js
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
```

- [ ] **Step 2: Check it fails clearly without secrets**

Run: `node scripts/spike/run.mjs`
Expected: `Missing client ID or secret...` and exit code 1.

- [ ] **Step 3: Commit**

```bash
git add scripts/spike/run.mjs
git commit -m "feat: add Classroom spike runner"
```

### Task 4: Google Cloud setup

**Files:**
- Create: `.env.spike` (by the owner, never committed)

- [ ] **Step 1:** Create a new Google Cloud project named `kurspool-sync` with no billing account.
- [ ] **Step 2:** Enable the Google Classroom API in that project.
- [ ] **Step 3:** Configure the OAuth consent screen: app name `Kurspool Sync`, audience External, status Testing, the five scopes from `SCOPES`, and the owner's Classroom Gmail address as a test user. Record whether the console marks each scope sensitive or restricted.
- [ ] **Step 4:** Create an OAuth client of type Web application with the redirect URI `http://localhost:53682/callback`.
- [ ] **Step 5:** The owner creates `.env.spike` in the repo root and pastes in the values. They should not be shown in chat.

```
GOOGLE_SYNC_CLIENT_ID=
GOOGLE_SYNC_CLIENT_SECRET=
```

- [ ] **Step 6:** Verify that the file is ignored.

Run: `git check-ignore .env.spike`
Expected: prints `.env.spike`.

### Task 5: Run the test and record findings

**Files:**
- Create: `docs/superpowers/specs/2026-11-04-classroom-spike-findings.md`

- [ ] **Step 1:** Run `node --env-file=.env.spike scripts/spike/run.mjs`. The owner opens the printed URL with their Classroom account and approves access.
Expected: `Gate: PASSED`, and six modules listed with counts.
- [ ] **Step 2:** If the gate fails, stop and report the reasons to the owner. Do not start Phase 1.
- [ ] **Step 3:** Compare item titles from `scripts/.spike/report.json` with the spec's emoji rules, and note any title that would land in "other".
- [ ] **Step 4:** Compare with the Classroom to-do tab: are the 8 open items present, and which API collection does each come from?
- [ ] **Step 5:** Write the findings: scopes and their console labels, data fields available per collection, whether topics are used, the share of items with due dates, attachment types, category rule results, and the value of `refresh_token_expires_in`. Include no URLs, names of people or tokens.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-11-04-classroom-spike-findings.md
git commit -m "docs: record Classroom spike findings"
git push
```

### Task 6: Decide how to keep the token alive

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-classroom-spike-findings.md`

- [ ] **Step 1:** Ask the owner before publishing the `Kurspool Sync` client from Testing to In production without verification. It stays limited to the owner's own use, and the owner will see an unverified app warning while connecting.
- [ ] **Step 2:** If approved, publish, then repeat Task 5 Step 1 and record whether `refresh_token_expires_in` is still reported.
- [ ] **Step 3:** At least 8 days later, run `node --env-file=.env.spike scripts/spike/run.mjs --refresh-check`.
Expected if publishing avoids the limit: `Refresh worked` with an age above 7 days. Otherwise, use the weekly reconnect banner from the spec. This check does not block Phase 1.
- [ ] **Step 4:** Record the decision in the findings file, commit and push.

```bash
git add docs/superpowers/specs/2026-11-04-classroom-spike-findings.md
git commit -m "docs: record sync token decision"
git push
```

---

## After Phase 0

Each later phase gets its own plan, written from the real data in the findings file. They follow the spec's build order: 1 Foundation, 2 Import, 3 Dashboard and course view, 4 Personal layer, 5 Own use, 6 Classmates, 7 Open source.
