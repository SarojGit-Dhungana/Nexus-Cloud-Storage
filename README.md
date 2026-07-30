# NexusStorage

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

For local API smoke tests only, set `USE_SQLITE=true`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for stack, quotas, and security notes. Do not commit `.env` or API keys.
