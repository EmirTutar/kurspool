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
  const pages = { undefined: { items: [{ id: 1 }], nextPageToken: 'b' }, b: {} };
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
