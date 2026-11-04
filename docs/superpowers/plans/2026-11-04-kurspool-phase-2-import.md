# Kurspool Phase 2: Daily Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Task 4 needs the owner and the browser, so run this phase inline.

**Goal:** Classroom content for the batch is imported once a day, safely and repeatably, and the maintainer can connect, run and monitor it.

**Architecture:** A Classroom client returns plain data. Pure mapping functions turn it into rows. `runSync` compares it with the database using an injected source, so tests use a fake Classroom against the real local database. Cron and the "Sync now" button share `executeBatchSync`.

**Tech Stack:** Next.js route handlers and server actions, Supabase service role, Vercel Cron, Node `crypto` (AES-256-GCM), Vitest.

## Global Constraints

- Everything stays free: one Vercel Hobby cron, once a day.
- Read-only towards Classroom. No grades, `maxPoints` or files are stored.
- Refresh tokens are stored only encrypted, and never logged or sent to the browser.
- A failed or incomplete read must never hide or delete existing items.
- Secrets are entered by the owner.

## File Structure

- `supabase/migrations/20261104130000_sync_settings.sql`: `batches.classroom_section`, module uniqueness per batch
- `lib/classroom/client.ts`: OAuth helpers and API reads
- `lib/sync/map.ts`: categorizing and row mapping
- `lib/sync/crypto.ts`: token encryption
- `lib/sync/run.ts`: compares and writes one batch's data
- `lib/sync/execute.ts`: loads credentials, refreshes the token, calls `runSync`
- `lib/supabase/admin.ts`: server-only service role client
- `app/api/sync/route.ts`: cron entry, protected by `CRON_SECRET`
- `app/api/classroom/connect/route.ts`, `app/api/classroom/callback/route.ts`: maintainer connection
- `app/(dashboard)/maintainer/`: status page and "Sync now"
- `vercel.json`: daily cron
- Tests: `tests/lib/map.test.ts`, `tests/lib/crypto.test.ts`, `tests/lib/classroom-client.test.ts`, `tests/sync/run.test.ts`

---

### Task 1: Mapping and encryption

- [ ] Write failing tests for categories, module position, due dates, row mapping, attachments, unsafe URLs, and encryption round trip and tampering.
- [ ] Implement `lib/sync/map.ts` and `lib/sync/crypto.ts`. Run the tests, and commit.

### Task 2: Sync engine

- [ ] Write failing tests against the local database with a fake source: first import, re-run without duplicates, removed item hidden with progress kept, returned item visible with progress, one failed module leaves others updated and hides nothing in the failed one, only the batch's section is imported, no matching course fails without hiding anything, a run already in progress is skipped.
- [ ] Add the migration and implement `lib/sync/run.ts`. Run the tests, and commit.

### Task 3: Connection, cron and maintainer page

- [ ] Write failing tests for the Classroom client: pagination, HTTP errors, `invalid_grant` raising `ReconnectRequiredError`.
- [ ] Implement the client, `execute.ts`, the routes, the maintainer page and `vercel.json`.
- [ ] Confirm tests, lint and build pass. Commit and push.

### Task 4: Production

- [ ] Apply the migration in Supabase and set the batch's section.
- [ ] Add the production redirect URI to the `Kurspool Sync` client.
- [ ] The owner adds the environment variables in Vercel.
- [ ] Deploy. The owner connects Classroom on `/maintainer` and runs "Sync now".
- [ ] Verify item counts match the Phase 0 report for that day, and that `/api/sync` rejects calls without the secret.
