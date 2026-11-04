# Kurspool design: course dashboard for Digitale Leute School

Status: approved, 2026-11-04. Kurspool is a working name and easy to change.

## Context

Google Classroom delivers plenty of material but gives no clear overview of what is new, what still needs doing and what is finished. Moodle showed that a structured course page solves this. Kurspool is a Moodle-style dashboard that imports Classroom material daily, gives every student private progress tracking, and puts the course's common links one click away.

It starts as a personal tool, then opens to classmates on Vercel, and later becomes a public GitHub project.

### What your tabs showed

- **Each module is its own Classroom course.** There are six: 0 Start and Completion, 1 Foundations, 2 Product Skills, 3 Software Engineering with AI, 4 Agentic AI Engineering, 5 Career Coaching. The dashboard has to merge them into one batch view.
- **Classroom can't show what's really due.** All 8 open to-do items have no due date, and they mix recordings, feedback forms, sessions and further reading.
- **Titles follow an emoji pattern.** 📹 means recording, ✅ means feedback, 🔗📑🎙️ means further reading, and 👨🏼‍💻 means session. Items can be sorted automatically from this, with an "other" fallback.
- **Links found:** Classroom, Google Calendar, onboarding guide, Abwesenheit melden, Slack, Gather, the Digitale Leute GitHub (github.com/digitale-leute-school) and your personal Miro board.
- **Not fully read:** the onboarding guide's text couldn't be extracted, and I only saw the titles and URLs of Miro, Slack, Gather and Calendar.

### Decisions so far

- Students use **private Gmail** accounts.
- **One shared sync:** a maintainer account imports the course once a day. Students log in with name and email only, and their progress is private.

**The main trade-off:** the app doesn't know what a student turned in on Classroom. "Done" is the student's own mark in Kurspool, and they still submit in Classroom.

## Constraints

- **Everything stays free.** GitHub Free, Vercel Hobby, Supabase Free and Google Cloud without billing. If any step asks for payment details or an upgrade, stop and ask.
- **Private first.** A private GitHub repo under the EmirTutar account, used only by the owner at first. Classmates come later, and open source only after that.
- **Accounts already available:** GitHub (EmirTutar), Vercel (TutarTechs, Hobby), Supabase (TutarTechs, Free, no projects yet).
- **Free-tier limits that matter:** Vercel Hobby crons run once a day at a loose time within the chosen hour. Supabase Free pauses after a week of inactivity; the daily sync should normally prevent this, and step 5 checks it.

## MVP scope

**In**
- **Quick links:** a button bar shared by the batch, plus personal links set in Settings, such as your own Miro board.
- **Dashboard:** "New", "To do", progress per module, and the last successful sync time.
- **Course view:** modules → Classroom topics → items, with attachments and a link back to Classroom.
- **Filters:** by category (session, recording, feedback, reading, other) and by status.
- **Item status:** New, To do, Done or Skipped, plus "mark all as seen" for the backlog when someone joins.
- **Personal tasks:** a student's own to-dos, optionally linked to an item.
- **Access:** only emails on the batch list can get in.
- **Maintainer page:** connect Classroom, run a sync, see sync history, edit quick links and the batch list.

**Out for now:** per-student Classroom connection, turned-in status, writing back to Classroom, embedded Calendar or Miro, notifications, grades, chat, and copying course files.

## Architecture

| Part | Choice | Why |
|---|---|---|
| App | Next.js (React) with TypeScript | Frontend and server routes in one repo, which suits Vercel and forks |
| UI | shadcn/ui and Tailwind | Your choice |
| Database and login | Supabase Postgres and Auth (Google, basic scopes only) | Row-level security keeps progress private |
| Daily import | Vercel Cron calling a protected route | A daily run is all that's needed |
| Tests | Vitest and Playwright, with the local Supabase CLI | Covers logic and key user flows |

**Two separate Google Cloud OAuth clients**
1. **Student login:** only `openid`, `email` and `profile`. Google's test-user list and 7-day limit don't apply to these scopes.
2. **Classroom sync:** read-only Classroom scopes, used only by the maintainer. Its refresh token is encrypted and only server code can read it.

### Data model

- **Batch:** `batches`, `batch_members` (role: student or maintainer), `batch_allowed_emails`, `quick_links`
- **Imported content:** `modules` (one per Classroom course), `topics`, `items`, `item_attachments`
- **Per student:** `item_progress`, `personal_tasks`, `user_links`
- **Sync:** `sync_credentials`, `sync_runs`

An item with no `item_progress` row counts as New.

**Access rules**
- Members can read their own batch's content.
- Students can read and write only their own progress, tasks and links.
- Only the maintainer can edit batch settings.
- Only the server can write imported content or read `sync_credentials`.

### Import flow

1. Cron calls `/api/sync` with `CRON_SECRET`. The maintainer's "Sync now" button runs the same code.
2. The refresh token gets a fresh access token.
3. For each module, it fetches topics, coursework, materials and announcements.
4. Each item is categorized, then saved using its Classroom ID, so re-runs never create duplicates.
5. Items that disappear from Classroom are hidden rather than deleted, so student progress survives.
6. The result is written to `sync_runs`.

**When things go wrong**
- One failed module doesn't stop the others or remove existing data.
- If the token has expired, the sync stops and the maintainer sees a "Reconnect Classroom" banner.
- Students see the last successful sync time, so stale data is obvious.

### Code layout

Each part below can be tested separately:
- `lib/classroom/`: Google API client that returns plain types
- `lib/sync/`: categorizing, and comparing imported data with what's stored
- `app/api/sync/`: the protected route
- `supabase/migrations/`: schema and access rules
- `app/(dashboard)/`: pages
- `components/`: UI

## Behavior rules

- **Leaving New:** opening an item, setting a status, or using "mark all as seen" moves a New item to To do. Done and Skipped are only ever set by the student.
- **Done and Classroom:** marking an item Done never submits anything in Classroom.
- **Module progress:** (Done + Skipped) divided by all visible items in the module. Hidden items do not count.
- **Announcements:** treated like other items, in the "other" category unless a title rule matches.
- **New items after a sync:** they appear as New for every member of the batch.
- **Reappearing items:** if a hidden item returns to Classroom, it becomes visible again with its earlier progress.
- **Batches:** each user belongs to one batch in the MVP. Each batch has one sync credential, owned by its maintainer.
- **Sync schedule:** once a day, plus the maintainer's "Sync now" button.

## Build order

0. **Prove the Classroom connection first (must pass before anything else).** Run a small read-only script with your account. It must confirm:
   - all six modules are listed
   - items and attachments contain usable data
   - which scopes are really needed, and whether the Cloud console labels them sensitive
   - how to keep the sync token alive
1. **Foundation:** repo, Next.js, shadcn, Supabase schema and access rules, Google login, batch list check.
2. **Import:** Classroom client, categorizing, sync route, cron, sync history, maintainer page.
3. **Dashboard and course view:** quick links, New and To do, module pages, filters.
4. **Personal layer:** statuses, progress bars, personal tasks, personal links in Settings.
5. **Use it yourself:** deploy to Vercel and rely on it daily for about a week.
6. **Open to classmates:** get the school's OK, publish a privacy note, add the batch list.
7. **Open source:** README, self-hosting guide, `.env.example`, example seed data, license (default MIT), and a security check of the git history.

## Risks to manage

- **Keeping the sync token alive.** In Testing status, the maintainer would also have to reconnect every 7 days. Publishing the sync client without verification may avoid that, at the cost of a warning screen when connecting. I haven't confirmed this, so step 0 tests it. The fallback is a weekly reconnect, prompted by the banner.
- **School permission.** Showing course data from one account to other students needs Digitale Leute's OK before step 6. It's worth asking early, since they could also help or provide an official link list.
- **Private data in a public repo.** Slack, Gather, onboarding and batch links, plus student emails, live only in the database or an uncommitted seed file, never in Git.
- **Course material.** Kurspool stores titles, descriptions and links, not files. Google still controls who can open Drive files, but imported titles and descriptions are visible to everyone on the batch list.
- **Personal data.** Use an EU Supabase region, collect only name, email and progress, and let students delete their account.
- **Independence.** The public project is described as an unofficial student tool and doesn't use the school's logo unless they approve it.
- **Item sorting.** Emoji patterns can change or be missing, so rules live in one tested place and unknown items go to "other".

## Verification

- **Step 0:** the script lists all six modules and real items from your account.
- **Sync:** running it twice creates no duplicates. A removed item is hidden and its progress is kept. A forced failure in one module leaves the others updated. An invalid token shows the reconnect banner.
- **Privacy:** automated tests confirm that student A can't read student B's progress, tasks or links, that an unlisted email can't get in, and that `sync_credentials` can't be read from the browser.
- **Security:** `/api/sync` rejects calls without the secret, and a scan finds no private links or secrets in the repo.
- **End-to-end (Playwright):** log in → see a new item → mark it Done → module progress goes up → add a Miro link in Settings → the button appears.
- **Real use:** a new Classroom post appears on the deployed dashboard after the next daily sync, and the to-do items match what Classroom shows.
- **Accessibility:** run an audit of the dashboard and course pages.

## Sources

- [Google: Manage app audience (test users, 7-day expiry, basic-scope exception)](https://support.google.com/cloud/answer/15549945?hl=en)
- [Google: OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google: Choose Classroom API scopes](https://developers.google.com/workspace/classroom/guides/auth)
- [Google: OAuth 2.0 scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google: Configure the OAuth consent screen and choose scopes](https://developers.google.com/workspace/guides/configure-oauth-consent)
