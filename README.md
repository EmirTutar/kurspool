# Kurspool

A course dashboard for Google Classroom. Kurspool imports a course's material once a day and shows each participant what is new, what is still open and what is done.

It was built for a bootcamp where every module is its own Classroom course. Kurspool merges those courses into one view. It is an unofficial project by a course participant and is not affiliated with any school.

## Features

- **Daily import** of topics, coursework, materials and announcements across several Classroom courses
- **Private progress:** each participant marks items as to do, done or skipped
- **Dashboard** with new and open items, due dates and progress per module
- **Search** across titles, descriptions and attachments
- **Link bar** with links for the whole batch, plus personal links
- **Personal tasks** for each participant
- **Maintainer page** for the import, import history, links and the list of allowed emails
- **Dark mode**, plus German and English in the signed-in area

**Limits:** Kurspool reads Classroom through one maintainer account, so it can't see what a participant has turned in. "Done" is the participant's own mark. Participants still submit their work in Classroom.

Participants have the role `student` in the code and database.

## Tech stack

Next.js, React, TypeScript, Tailwind CSS and shadcn/ui, with Supabase for the database and login, and Vercel for hosting and the daily job. Tests use Vitest and Playwright.

## Project structure

| Folder | Contents |
|---|---|
| `src/app` | Pages and API routes |
| `src/components` | UI components |
| `src/lib` | Classroom client, import logic and helpers |
| `supabase` | Database migrations and local configuration |
| `tests` | Unit, database access and browser tests |
| `docs` | [Design](docs/design.md) and [Classroom API findings](docs/classroom-api-findings.md) |

## Run it locally

You need Node.js 22 and Docker.

```bash
npm ci
npm run db:start
npx supabase status -o env
```

Create `.env.local` from the values that the last command prints:

| Variable | Value from `supabase status` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` |

Then start the app:

```bash
npm run dev
```

Signing in through the browser and importing from Classroom both need the Google setup below. The tests don't.

## Tests

The local database must be running.

```bash
npm run lint
npm test

npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs all of these on every push to `main` and on every pull request.

## Deploy your own

### 1. Supabase

Create a project, then apply the database schema:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

Under **Authentication > URL Configuration**, set the site URL to your app's address and allow `https://<your-app>/auth/callback`.

### 2. Google Cloud

Use two separate projects, so that signing in never asks participants for access to Classroom.

| Project | Purpose | Scopes | Redirect URI |
|---|---|---|---|
| Login | Participant sign-in | `openid`, `email`, `profile` | `https://<project-ref>.supabase.co/auth/v1/callback` |
| Sync | Daily import | The read-only Classroom scopes in [`client.ts`](src/lib/classroom/client.ts) | `https://<your-app>/api/classroom/callback` |

- **Login project:** enter its client ID and secret in Supabase under **Authentication > Providers > Google**.
- **Sync project:** enable the Classroom API and set the app's status to **In production**. Google expires refresh tokens after 7 days while an app is in Testing.

### 3. Vercel

Import the repository and set these environment variables. The [`.env.example`](.env.example) file lists them too.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Supabase secret key, used only on the server |
| `GOOGLE_SYNC_CLIENT_ID` | Client ID of the sync project |
| `GOOGLE_SYNC_CLIENT_SECRET` | Client secret of the sync project |
| `SYNC_TOKEN_KEY` | Encrypts the stored Google token; 32 random bytes in base64 |
| `CRON_SECRET` | Protects the import route; any long random string |
| `CONTACT_EMAIL` | Optional. Contact address, shown only to accounts on a batch list |

The import runs daily at 04:00 UTC, as set in [`vercel.json`](vercel.json).

### 4. Create your batch

Run this in the Supabase SQL editor. `classroom_section` must match the section name of your Classroom courses, because the import only reads courses in that section.

```sql
with new_batch as (
  insert into public.batches (name, slug, classroom_section)
  values ('My batch', 'my-batch', 'My Classroom section')
  returning id
)
insert into public.batch_allowed_emails (batch_id, email, role)
select id, 'you@example.com', 'maintainer' from new_batch;
```

Sign in with that email, open the maintainer page, connect Classroom and run the first import. You can add participants' emails on the same page.

## Backups

The [backup workflow](.github/workflows/backup.yml) exports the data every Monday and keeps an encrypted copy as a GitHub Actions artifact for 30 days. It needs two repository secrets:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | The session pooler address from **Connect > Direct** in Supabase |
| `BACKUP_PASSPHRASE` | A long password. Backups can't be opened without it |

Backups contain data only. To restore one, apply the migrations first.

## License

[MIT](LICENSE)
