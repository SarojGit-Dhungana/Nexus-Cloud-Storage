# Cloud Based Storage System

Multi-tenant cloud storage SaaS: React/Vite frontend + Django REST backend (PostgreSQL, JWT, roles, files, sharing, friends chat, AI assistant).

**Full architecture documentation:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
(features, classes/objects, relationships, tools, OOP, model flow, system flows)

**Algorithms used in the system:** [docs/ALGORITHMS.md](docs/ALGORITHMS.md)  
(malware scan, SHA-256, TOTP, TF-IDF summarizer, and what each is responsible for)

## Quick start

1. Copy `.env.example` to `.env` and set secrets / database values.
2. Start the API:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py runserver
```

Or with Docker: `docker compose up --build`.

API: `http://localhost:8000/api`

3. Start the frontend (second terminal):

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` and pick a portal:

| Path | Who |
| --- | --- |
| `/user` | Members |
| `/admin` | Workspace administrators |
| `/system` | System super administrator |

Default super admin (change after login): `superadmin@nexusstorage.local` / `SuperAdmin@12345`

## Object storage (boto3)

Files can live on S3-compatible cloud storage via **boto3** + **django-storages**.

1. Install deps (includes `boto3`): `pip install -r backend/requirements.txt`
2. In `.env` set:

```env
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=...
AWS_S3_ENDPOINT_URL=          # optional: R2 / MinIO / Supabase endpoint
AWS_S3_REGION_NAME=auto
```

3. Restart the API. Uploads and downloads then go through S3 instead of local `MEDIA_ROOT`.

For local disk only, set `STORAGE_BACKEND=local`.

For local API smoke tests only, set `USE_SQLITE=true`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for stack, quotas, and security notes. Do not commit `.env` or API keys.
