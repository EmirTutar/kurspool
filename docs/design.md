# Kurspool design

Status: running in production for the owner, last updated 2026-11-04. Other participants and open source come later.

## Context

Google Classroom delivers plenty of material but gives no clear overview of what is new, what still needs doing and what is finished. Kurspool is a Moodle-style dashboard that imports Classroom material daily, gives every participant private progress tracking, and puts the course's common links one click away.

It was built for the AI Software Engineering Bootcamp at Digitale Leute School, where each module is its own Classroom course. The dashboard merges those courses into one batch view.

**Main trade-off:** one maintainer account imports the course, and participants sign in with name and email only. The app therefore doesn't know what a participant turned in. "Done" is the participant's own mark, and they still submit in Classroom.

## Constraints

- **Everything stays free.** GitHub Free, Vercel Hobby, Supabase Free and Google Cloud without billing.
- **Private first.** The repository stays private until the school has agreed and the git history has been checked.
- **Vercel Hobby:** crons run once a day, at a loose time within the chosen hour.
- **Supabase Free:** projects pause after a week of inactivity. The daily import should normally prevent this.

## Scope

**Included**
- **Navigation and links:** a collapsible sidebar with the app's pages, links shared by the batch, and personal links set in Settings. On phones it opens as a panel.
- **Dashboard:** new and open items grouped by module, due dates, progress per module, personal tasks and the last import time.
- **Course view:** modules → Classroom topics → items, with attachments, clickable links and a link back to Classroom.
- **Filters and search:** filter by category and status, and search titles, descriptions and attachments.
- **Item status:** New, To do, Done or Skipped, set directly in the item's row, plus "mark all as seen" for the backlog when someone joins.
- **Personal tasks:** a participant's own to-dos.
- **Access:** only emails on the batch list can get in.
- **Maintainer page:** connect or disconnect Classroom, run an import, see import history, edit links and the batch list.
- **Account:** participants can delete their own account.
- **Display:** dark mode, and German or English in the signed-in area. The public pages are German only.

**Not included:** a Classroom connection per participant, turned-in status, writing back to Classroom, embedded Calendar or Miro, notifications, grades, chat, and copying course files.

## Architecture

| Part | Choice | Why |
|---|---|---|
| App | Next.js (React) with TypeScript | Frontend and server routes in one repository, which suits Vercel and forks |
| UI | shadcn/ui and Tailwind | Accessible base components that live in the repository |
| Database and login | Supabase Postgres and Auth (Google, basic scopes only) | Row-level security keeps progress private |
| Daily import | Vercel Cron calling a protected route | A daily run is all that's needed |
| Tests | Vitest and Playwright, with the local Supabase CLI | Covers logic, access rules and key user flows |

**Two separate Google Cloud projects**
1. **Participant login:** only `openid`, `email` and `profile`.
2. **Classroom sync:** read-only Classroom scopes, used only by the maintainer. Its refresh token is encrypted and only server code can read it.

### Data model

- **Batch:** `batches`, `batch_members` (role: student or maintainer), `batch_allowed_emails`, `quick_links`
- **Imported content:** `modules` (one per Classroom course), `topics`, `items`, `item_attachments`
- **Per participant:** `item_progress`, `personal_tasks`, `user_links`
- **Sync:** `sync_credentials`, `sync_runs`

An item with no `item_progress` row counts as New.

**Access rules**
- Members can read their own batch's content.
- Participants can read and write only their own progress, tasks and links.
- Only the maintainer can edit batch settings.
- Only the server can write imported content or read `sync_credentials`.

### Import flow

1. Cron calls `/api/sync` with `CRON_SECRET`. The maintainer's import button runs the same code.
2. The refresh token gets a fresh access token.
3. Only Classroom courses in the batch's `classroom_section` are read. For each one, the import fetches topics, coursework, materials and announcements.
4. Each item is categorized, then saved using its Classroom ID, so re-runs never create duplicates.
5. Items that disappear from Classroom are hidden rather than deleted, so participant progress survives.
6. The result is written to `sync_runs`.

**When things go wrong**
- One failed module doesn't stop the others or remove existing data.
- If Google ends access, the import stops and the maintainer sees a prompt to reconnect Classroom.
- The dashboard shows the last import time and warns when it is more than 48 hours old.

### Code layout

- `src/lib/classroom/`: Google API client
- `src/lib/sync/`: categorizing, encryption and the import itself
- `src/app/api/sync/`: the protected route
- `src/app/(dashboard)/`: signed-in pages
- `src/components/`: UI
- `supabase/migrations/`: schema and access rules
- `tests/`: unit, access rule, import and browser tests

## Behavior rules

- **Leaving New:** opening an item, setting a status, or using "mark all as seen" moves a New item to To do. Done and Skipped are only ever set by the participant.
- **Done and Classroom:** marking an item Done never submits anything in Classroom.
- **Categories:** session, recording, feedback, reading, organization and other. Rules in `src/lib/sync/map.ts` derive them from the Classroom title, and anything unknown goes to "other".
- **Titles:** leading symbols are removed for display. The stored title stays unchanged.
- **Module progress:** (Done + Skipped) divided by all visible items in the module. Hidden items do not count.
- **Due dates:** the dashboard lists unfinished items that are overdue or due within two weeks. Overdue items ask the participant to check Classroom, because Kurspool can't see submissions.
- **Announcements:** treated like other items, in the "other" category unless a title rule matches.
- **New items after an import:** they appear as New for every member of the batch.
- **Reappearing items:** if a hidden item returns to Classroom, it becomes visible again with its earlier progress.
- **Batches:** each user belongs to one batch. Each batch has one sync credential, owned by its maintainer.
- **Last maintainer:** a batch's last maintainer can't delete their account.

## Roadmap

**Done:** Classroom connection test, foundation, import, dashboard and course view, personal layer, deployment on Vercel, CI and weekly backups.

**Next**
1. **Use it daily:** rely on it for about a week and confirm that imports keep running.
2. **Open to other participants:** get the school's OK, add a contact address to the privacy page, and fill in the batch list.
3. **Open source:** check the git history for private data, add example seed data, and make the repository public.

## Risks

- **Keeping the sync token alive.** In Testing status, Google ends the refresh token after 7 days. The sync project was published on 2026-11-04, but whether this removes the limit is only confirmed if imports still succeed after 2026-11-12. The fallback is a weekly reconnect, prompted on the maintainer page.
- **School permission.** Showing course data from one account to other participants needs Digitale Leute's OK before other participants join.
- **Private data in a public repository.** Course links and participant emails live only in the database, never in Git.
- **Course material.** Kurspool stores titles, descriptions and links, not files. Google still controls who can open Drive files, but imported titles and descriptions are visible to everyone on the batch list.
- **Personal data.** The database is in an EU region, and Kurspool collects only name, email and progress.
- **Independence.** The project is described as an unofficial tool by a course participant and doesn't use the school's logo unless they approve it.
- **Item sorting.** Classroom titles can change, so the rules live in one tested place.

## Verification

**Covered by automated tests**
- **Import:** re-runs create no duplicates, removed items keep their progress, one failed module leaves the others updated, and an invalid token asks for a reconnect.
- **Privacy:** one participant can't read another's progress, tasks or links, an unlisted email can't get in, and `sync_credentials` can't be read from the browser.
- **Security:** `/api/sync` rejects calls without the secret.
- **Browser flows (Playwright):** the participant and maintainer flows, including account deletion and access limits.

**Still to check by hand**
- Disconnecting Classroom and deleting an account in production
- The phone layout of pages other than the dashboard
- An accessibility audit of the signed-in pages
- Announcements and modules 2 to 5, which have no real data yet
- Restoring a backup

## Sources

- [Google: Manage app audience (test users, 7-day expiry, basic-scope exception)](https://support.google.com/cloud/answer/15549945?hl=en)
- [Google: OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google: Choose Classroom API scopes](https://developers.google.com/workspace/classroom/guides/auth)
- [Google: OAuth 2.0 scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google: Configure the OAuth consent screen and choose scopes](https://developers.google.com/workspace/guides/configure-oauth-consent)
