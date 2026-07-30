# NexusStorage — System Usage Guide

This guide explains **how to use** NexusStorage day to day. For setup details (env, PostgreSQL, Docker), see the root [README.md](../README.md). For class/object design, see [CLASS_VS_OBJECT.md](CLASS_VS_OBJECT.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## What the system is

NexusStorage is a **multi-tenant cloud storage SaaS**:

- Organizations (workspaces) isolate users and files
- Members upload, organize, share, and trash files
- Admins manage users, quotas, and analytics
- Super admins manage every workspace
- Side panel: **Friends chat** (human DMs) and **AI Chat** (metadata assistant)

## Start the apps

### Frontend (Vite)

From the project root:

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**.

### Backend (Django)

With the project virtualenv (recommended on Windows CMD):

```bat
run-backend.bat
```

Or from `backend` with the venv activated and `USE_SQLITE=true` in `.env` for local smoke tests:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py runserver
```

API base: **http://localhost:8000/api**.

Frontend expects `VITE_API_URL=http://localhost:8000/api` (see `.env.example`).

## Portals and roles (strict lock)

| Portal URL | Role allowed | Purpose |
|------------|--------------|---------|
| `/user` | `user` | Files, sharing, trash, friends + AI chat |
| `/admin` | `admin` | Workspace analytics, users, settings + same storage tools |
| `/system` | `superadmin` | All workspaces and administrators |

Landing page `/` lets you pick a portal. **You cannot sign in with the wrong role on a portal** (for example, an admin account on `/user` is rejected; use `/admin` instead). Each portal stores its own JWT keys so sessions stay isolated.

### Default system super admin

Created on migrate (change after first login):

| Field | Default |
|-------|---------|
| Email | `superadmin@nexusstorage.local` |
| Password | `SuperAdmin@12345` |

Override with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env` before first migrate.

## First-time workspace setup

1. Open **http://localhost:5173/admin**
2. Choose **New organization? Create as admin**
3. Create the workspace — the first account becomes the **organization administrator**
4. In **Settings**, copy the **organization slug**
5. Teammates open `/user`, join with that slug (if self-registration is on), or accept an **invite link** from **Users → Invite**

## Main flows

### Sign in

1. Open the matching portal for your role
2. Enter email and password
3. If 2FA is enabled, enter the authenticator code
4. Wrong portal → error message; no session is created on that portal

### Upload files

- Use **New Upload** in the sidebar, **Upload** in My Files, drag-and-drop on Dashboard / Files, or drop anywhere in the shell
- Files are virus-scanned, then stored
- If **storage allocation is full**, uploads are blocked and a modal explains the quota
- Progress meters appear in the sidebar, Profile, Dashboard, and (for admins) Analytics / Settings

### Folders and organize

- **New folder**, open folders via breadcrumbs
- Rename, move, star, duplicate, download, and share from the file menu
- Forms use **modals** (not browser `alert` / `prompt`)

### Trash

- Delete moves items to **Trash** (confirmation first)
- **Restore** brings items back to My Files (confirmation)
- **Delete forever** or **Empty trash** permanently removes data (confirmation)

### Sharing

- Share by email (grant) or create a secure link (optional expiry / password / email)
- Recipients see shares under **Shared**; accept pending requests before download/preview

### Friends chat (human)

1. Open the chat panel → **Friends**
2. **Find people** in your organization → **Add**
3. Open a thread to message (polls for new messages)
4. **Clear for me** / **Delete for me** only affect *your* view; the other user keeps their history

### AI Chat

1. Chat panel → **AI**
2. **+** starts a new thread titled **AI Chat** (title updates from the first question)
3. Switch chats from the title dropdown
4. Clear or delete applies to that AI conversation only

### Admin portal extras

- **Analytics** — org storage bar, activity, growth charts
- **Users** — invite, suspend / activate members
- **Settings** — org name, storage limit, max file size, 2FA requirement, self-registration, danger zone

### System (super admin) extras

- **Workspaces** — create, suspend, delete organizations
- **Administrators** — create admins, promote/demote, reset passwords across tenants

## Security notes users should know

- Passwords are hashed; share-link passwords are hashed
- Public share tokens are stored as hashes
- Uploads get checksums and antivirus checks before storage
- Suspending a workspace blocks its members from storage APIs

## Related documentation

- [Class vs object (OOP primer)](CLASS_VS_OBJECT.md)
- [Backend & frontend structure](ARCHITECTURE.md)
- [Chapter 3 — Analysis & Design](report/CHAPTER_3_SYSTEM_ANALYSIS_AND_DESIGN.md)
- [Chapter 4 — Implementation & Testing](report/CHAPTER_4_IMPLEMENTATION_AND_TESTING.md)
- [Root README — configure, email, AI providers](../README.md)
