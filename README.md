
# NexusStorage

NexusStorage is a multi-tenant cloud storage SaaS application. It includes the original React/Vite interface and a Django REST backend with PostgreSQL, JWT authentication, role-based access, file/folder management, secure sharing, analytics, audit logs, organization settings, and persistent AI conversations.

## Architecture

- Frontend: React 18, Vite, TanStack Query
- API: Django 5.2 and Django REST Framework
- Database: PostgreSQL (SQLite can be enabled only for local validation/tests)
- Authentication: short-lived JWT access tokens and rotating refresh tokens; Django password hashing
- File storage: local development storage or any private S3-compatible service
- AI: account-metadata-grounded assistant using local Ollama, Groq, or a deterministic no-key fallback
- SaaS isolation: every user and file belongs to an organization; API querysets enforce tenant boundaries

## Documentation

- [System usage](docs/SYSTEM_USAGE.md) — portals, how to run, and main product flows
- [Backend & frontend structure](docs/ARCHITECTURE.md) — class inventory, API clients, and UI modules
- [Class vs object](docs/CLASS_VS_OBJECT.md) — OOP primer with NexusStorage examples
- [Remaining work plan](docs/REMAINING_WORK_PLAN.md) — fixes, features, algorithms, testing, free cloud storage (R2/S3)
- **Report chapters:** [Chapter 3 — Analysis & Design](docs/report/CHAPTER_3_SYSTEM_ANALYSIS_AND_DESIGN.md) · [Chapter 4 — Implementation & Testing](docs/report/CHAPTER_4_IMPLEMENTATION_AND_TESTING.md)

## 1. Configure

Copy `.env.example` to `.env`, then replace `DJANGO_SECRET_KEY` and database credentials.

Cloudflare R2 is a good S3-compatible free-tier option:

```env
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=...
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
```

Keep the bucket private. Downloads pass through authenticated Django endpoints and S3 URLs are signed.

## 2. Start PostgreSQL and the API

Docker is the simplest PostgreSQL setup:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Without Docker, install PostgreSQL, create the database from `.env`, then run:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py runserver
```

The API runs at `http://localhost:8000/api`.

For a temporary local smoke test only, set `USE_SQLITE=true`.

## 3. Start the frontend

In a second terminal:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` and pick a portal:

| Path | Who |
| --- | --- |
| `/user` | Regular members |
| `/admin` | Workspace administrators |
| `/system` | System super administrator |

Each portal keeps its own JWT session, so a user tab on `/user` and an admin tab on `/admin` do not overwrite each other. Signing in with the wrong role redirects you to the matching portal. The first registered user in a new organization is its administrator (create that from `/admin`). Administrators invite teammates from **Users**; invite links land on `/user/?invite=…`, are hashed in the database, expire after seven days, and place the accepted user in the same organization.

## 4. Enable AI

The no-key metadata assistant works with `AI_PROVIDER=disabled`.

For a private, free local model, install Ollama and run:

```powershell
ollama pull llama3.2:3b
ollama serve
```

Then configure:

```env
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
```

For Groq's free developer tier, use its OpenAI-compatible endpoint and API key. File contents are not sent to the model; the assistant receives only authorized metadata such as names, sizes, owners, and timestamps.

## 5. Email notifications

Invitations and share notifications are sent through Django's email backend. By default (`EMAIL_BACKEND=...console...`) messages are printed to the API server log, so you can develop without an SMTP account. For real delivery via Gmail, create an [App Password](https://myaccount.google.com/apppasswords) and set:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=NexusStorage <you@gmail.com>
```

## Super admin

Running migrations creates a system super administrator that sits above every workspace:

| Field | Default |
| --- | --- |
| Email | `superadmin@nexusstorage.local` |
| Password | `SuperAdmin@12345` |

Override the defaults with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env` before the first migration, and change the password after signing in. To reset it later:

```powershell
cd backend
..\.venv\Scripts\python manage.py ensure_superadmin --reset-password
```

The super admin owns no files and belongs to no workspace. Signing in opens **Workspaces**, where they can create, reconfigure, suspend, or delete organizations, and **Administrators**, where they can create admins, promote or demote accounts, suspend users, and reset passwords across every tenant. Workspace admins cannot grant super admin access, and the system endpoints (`/api/auth/system/...`) reject anyone who is not a super admin.

## Security model

- Passwords and share-link passwords are one-way hashed by Django.
- Public share tokens are stored only as SHA-256 hashes.
- TOTP (Google Authenticator) two-factor authentication is enforced when enabled; its verification secret is encrypted at rest and enrolled via QR code.
- Uploaded files receive SHA-256 integrity checksums and are virus-scanned before storage (`ANTIVIRUS_MODE=heuristic` by default; set `clamav` to use `clamscan` when installed). Infected uploads are rejected and never saved.
- Ordinary names, dates, sizes, and relationships are not hashed because the application must query and display them.
- TLS plus PostgreSQL/storage encryption-at-rest should be enabled in deployment.
- Private tenant data is filtered by organization and object permissions.
- Role escalation is one-way: only a super admin can grant admin rights, and no workspace-level endpoint can create a super admin.
- Suspending a workspace immediately blocks its members from every storage API.
- Destructive file deletion first moves items to trash.

Do not commit `.env`, database dumps, local media, or API keys.

## Verification

```powershell
$env:USE_SQLITE="true"
cd backend
..\.venv\Scripts\python manage.py test
cd ..
npm run build
```
  