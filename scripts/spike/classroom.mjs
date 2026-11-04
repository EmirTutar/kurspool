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
