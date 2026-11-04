# Kurspool Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 4 and 5 need the owner and the browser, so run this phase inline.

**Goal:** A deployed, private-by-default app where a listed Google account can log in and an unlisted one cannot, on a database whose access rules are proven by tests.

**Architecture:** Next.js App Router on Vercel, Supabase Postgres and Auth. Row-level security enforces access, so a page bug cannot expose another student's data. One database function, `join_batch_if_allowed`, is the only way into a batch.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, Supabase (`@supabase/ssr`, `@supabase/supabase-js`, CLI), Vitest.

## Global Constraints

- Everything stays free: GitHub Free, Vercel Hobby, Supabase Free, Google Cloud without billing. Stop and ask if anything requests payment details or an upgrade.
- The repo stays private. Secrets, student emails and private batch links never enter Git.
- Student login requests only `openid`, `email` and `profile`, through its own OAuth client.
- Use an EU Supabase region.
- The owner types all passwords and secrets.
- Run tests with the exact file or script named, and never chain a commit after a test command without checking its exit code.

## Decisions from Phase 0

- Item categories: session, recording, feedback, reading, organization, other.
- Items may have no topic.
- The schema does not store grades or `maxPoints`.
- Attachment types: `link`, `driveFile`, `youtubeVideo`, `form`.

## File Structure

- `supabase/migrations/20261104120000_foundation.sql`: schema, helper functions, access rules
- `tests/rls/*.test.ts`: access rule tests against the local database
- `lib/supabase/{client,server,proxy}.ts`: browser, server and session helpers
- `proxy.ts`: session refresh and route protection
- `app/page.tsx`: public home page
- `app/privacy/page.tsx`: public privacy note
- `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/no-access/page.tsx`: login flow
- `app/(dashboard)/dashboard/page.tsx`: protected placeholder showing the batch name

---

### Task 1: Scaffold

**Files:** Next.js and shadcn scaffold, `vitest.config.ts`, `.env.example`

- [ ] **Step 1:** Run `create-next-app` with TypeScript, Tailwind, ESLint, App Router and npm in the repo root.
- [ ] **Step 2:** Run `shadcn init`, and add `button` and `card`.
- [ ] **Step 3:** Install `@supabase/supabase-js`, `@supabase/ssr`, and dev dependencies `supabase` and `vitest`.
- [ ] **Step 4:** Confirm `npm run build` and `npm run lint` both exit 0, then commit.

### Task 2: Schema and access rules

**Files:** the migration, `tests/rls/access.test.ts`

**Interfaces:**
- Produces tables: `batches`, `batch_allowed_emails`, `batch_members`, `quick_links`, `modules`, `topics`, `items`, `item_attachments`, `item_progress`, `personal_tasks`, `user_links`, `sync_credentials`, `sync_runs`
- Produces function: `join_batch_if_allowed() returns uuid`, returning the batch ID, or null when the signed-in user's confirmed email is not listed

- [ ] **Step 1:** Write failing tests that prove:
  - An unlisted user gets null from `join_batch_if_allowed` and reads no batch content.
  - A listed user joins, with the role from the batch list, and reads their batch's modules and items.
  - A listed user cannot read another batch's content.
  - Student A cannot read or write student B's progress, tasks or links.
  - A student cannot insert into `batch_members`, change their role, or write imported content or quick links.
  - A maintainer can edit quick links and the batch list; a student cannot.
  - No signed-in user can read `sync_credentials`, including a maintainer.
  - `sync_runs` is readable by a maintainer but not by a student.
  - Hidden items are not readable by members.
  - `javascript:` URLs are rejected in `quick_links` and `user_links`.
- [ ] **Step 2:** Start the local database and run the tests, expecting failure because the tables don't exist.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Reset the database and run the tests, expecting all to pass. Commit.

### Task 3: Login flow and pages

**Files:** `lib/supabase/*`, `proxy.ts`, the pages listed above, `tests/lib/redirect.test.ts`

**Interfaces:**
- Produces: `safeRedirectPath(value: string | null): string`, which returns only same-site paths and falls back to `/dashboard`

- [ ] **Step 1:** Write failing tests for `safeRedirectPath`, including `//evil.example`, `https://evil.example` and `/\evil.example`.
- [ ] **Step 2:** Implement it and confirm the tests pass.
- [ ] **Step 3:** Implement the Supabase helpers, the proxy, Google sign-in, the callback and the pages. The callback calls `join_batch_if_allowed`; on null it signs the user out and redirects to `/no-access`.
- [ ] **Step 4:** Write the privacy note: what is stored, why, where, and how to request deletion, and that this is an unofficial student tool.
- [ ] **Step 5:** Confirm tests, lint and build all pass. Check `/`, `/privacy` and a redirect from `/dashboard` to `/login` in the browser. Commit and push.

### Task 4: Cloud setup

- [ ] **Step 1:** Create the Supabase project `kurspool` on the Free plan in an EU region. The owner enters the database password.
- [ ] **Step 2:** Apply the migration to it.
- [ ] **Step 3:** Create the Google Cloud project `kurspool-login` with a Web OAuth client using only basic scopes and the Supabase callback URL.
- [ ] **Step 4:** Enable Google in Supabase Auth. The owner enters the client secret.
- [ ] **Step 5:** Create the batch and add the owner's email as maintainer. This data goes in through the Supabase SQL editor, not Git.

### Task 5: Deploy and verify

- [ ] **Step 1:** Import the repo into Vercel on the Hobby plan. The owner enters the Supabase keys as environment variables.
- [ ] **Step 2:** Add the production URL to Supabase's redirect list.
- [ ] **Step 3:** Verify on production: `/` and `/privacy` load without login, `/dashboard` redirects to login, the owner logs in and sees the batch name, and an unlisted Google account lands on `/no-access`.

### Task 6: Publish the sync client (moved from Phase 0)

- [ ] **Step 1:** Fill the `Kurspool Sync` Branding page with the real home page and privacy URLs and the authorized domain.
- [ ] **Step 2:** Recheck the scope labels, then publish, as the owner approved trying on 2026-11-04.
- [ ] **Step 3:** The owner reconnects. Record whether `refresh_token_expires_in` is still reported.
- [ ] **Step 4:** At least 8 days later, run the refresh check from the Phase 0 plan and record the decision.
