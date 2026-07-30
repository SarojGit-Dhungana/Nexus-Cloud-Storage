# Chapter 4: Implementation and Testing

**System:** NexusStorage — Multi-tenant Cloud Storage SaaS  
**Related:** [CHAPTER_3](CHAPTER_3_SYSTEM_ANALYSIS_AND_DESIGN.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [SYSTEM_USAGE.md](../SYSTEM_USAGE.md)

---

## 9.1. Implementation

Implementation realizes the Chapter 3 design as running software: React portals on the client and Django REST modules on the server, with PostgreSQL (or SQLite) metadata and local/S3 object bytes.

### 9.1.1. Tools Used

#### CASE / modelling & documentation tools

| Tool | Purpose in this project |
|------|-------------------------|
| **Mermaid** (in Markdown) | Use case, class, object, state, sequence, activity, component, deployment diagrams |
| **Markdown / Cursor docs** | Report chapters under `docs/report/`, architecture reference |
| **Git** | Version control |
| **Docker Compose** (optional) | PostgreSQL + Gunicorn API stack |

#### Programming languages & frameworks

| Layer | Language / framework | Version (project) |
|-------|----------------------|-------------------|
| Frontend | **TypeScript**, **React 18** | Vite 6 app |
| UI | Tailwind CSS 4, Radix/shadcn-style primitives, Lucide icons | — |
| Data fetching | **TanStack React Query** | ^5 |
| Routing | **React Router 7** | portal routes |
| Backend | **Python 3**, **Django 5.2** | REST via **Django REST Framework** |
| Auth | **SimpleJWT** (access + rotating refresh) | — |
| Storage API | **django-storages** (S3) | when `STORAGE_BACKEND=s3` |
| AI | HTTP clients to Ollama / Groq (optional) | `AssistantService` |

#### Database & storage platforms

| Concern | Platform |
|---------|----------|
| Relational metadata | **PostgreSQL** (production/dev); **SQLite** (`USE_SQLITE=true` for local tests) |
| File bytes | **Local filesystem** (`backend/media`) or **S3-compatible** (Cloudflare R2, Backblaze B2, Supabase Storage, MinIO) |
| Secrets / config | `.env` via python-dotenv / Django settings |

#### Build, run & test tools

| Tool | Use |
|------|-----|
| **npm** / Vite | `npm run dev`, `npm run build` |
| **venv** + pip | `backend/requirements.txt` |
| **Django test runner** | `manage.py test` (APITestCase) |
| **run-backend.bat** / `npm run backend` | Windows-friendly API start |

---

### 9.1.2. Implementation Details of Modules

Modules map to Django apps and frontend feature areas. Class catalogs are in [ARCHITECTURE.md](../ARCHITECTURE.md).

#### A. Accounts module (`backend/accounts`)

| Element | Implementation |
|---------|----------------|
| **Classes** | `Organization`, `User` (+ `UserManager`), `Invitation` |
| **Serializers** | `RegisterSerializer`, `LoginSerializer` (portal check), profile/password/invite/workspace/system serializers |
| **Views** | `RegisterView`, `LoginView`, `MeView`, 2FA views, org settings, user admin, system workspace/user APIs |
| **Permissions** | `IsActiveTenantUser`, `IsOrganizationAdmin`, `IsSuperAdmin` |
| **Algorithms** | Portal↔role lock; Fernet-encrypted TOTP secret; invite token hashing |
| **Frontend** | `AuthScreen`, `ProfileView`, `TwoFactorDialog`, `UserManagement`, `SystemSettings`, `WorkspacesView`, `AdministratorsView`; `authApi`, `adminApi`, `superAdminApi` |

**Key method behaviour — login portal lock**

```text
LoginSerializer.validate:
  authenticate credentials
  if totp_enabled: verify code
  if portal_for_role(user.role) != requested portal: raise ValidationError
  return user / tokens
```

#### B. Storage module (`backend/storage`)

| Element | Implementation |
|---------|----------------|
| **Classes** | `FileNode`, `ShareGrant`, `ShareLink`, `ActivityLog` |
| **ViewSet** | `FileNodeViewSet` — CRUD, upload, download, preview, trash, restore, duplicate, share |
| **Other views** | `ShareGrantViewSet`, `PublicShareView`, `DashboardView`, `AdminAnalyticsView`, `ActivityListView` |
| **Services** | `ActivityLogger`; `ScanResult` + scanners in `antivirus.py` |
| **Permission** | `CanAccessNode` |
| **Frontend** | `FilesView`, `TrashView`, `SharedView`, `ShareDialog`, `DashboardView`, `AdminAnalytics`, `StorageMeter`; `fileApi`, `dashboardApi` |

**Key procedure — upload (`FileNodeViewSet.upload`)**

1. `FileUploadSerializer` validates file + size.  
2. Antivirus scan (reject EICAR / blocked types / ClamAV hits).  
3. `transaction.atomic` + `Organization.objects.select_for_update()`.  
4. Sum non-trashed `size_bytes`; compare to `storage_quota_bytes`.  
5. `FileNode.checksum(uploaded)` → SHA-256.  
6. Persist `content` to storage backend; save model; log activity.

**Key procedure — soft delete / restore**

- `perform_destroy`: set `deleted_at`, recurse descendants.  
- `restore` action: clear trash flags.  
- `permanent_delete` / `empty_trash`: delete storage object then DB rows.

#### C. Assistant module (`backend/assistant`)

| Element | Implementation |
|---------|----------------|
| **Classes** | `Conversation`, `ChatMessage` |
| **ViewSet** | `ConversationViewSet` (+ send prompt action) |
| **Service** | `AssistantService` — provider switch: Ollama / Groq / disabled fallback |
| **Frontend** | `AiChatPane` in `ChatPanel.tsx`; `chatApi` |

**Algorithm — send prompt**

```text
create user ChatMessage
reply ← AssistantService.generate(context from user/org metadata + history)
create assistant ChatMessage
return conversation payload
```

Tenant rule: queryset filtered by `request.user` so conversations are never cross-user.

#### D. Messaging module (`backend/messaging`)

| Element | Implementation |
|---------|----------------|
| **Classes** | `Friendship`, `DirectMessage` |
| **Views** | Friend list/search/add, messages GET/POST, remove friend |
| **Frontend** | `FriendsChatPane`; `messagingApi`; ~2s polling timer |

**Algorithm — list messages for me**

```text
load Friendship for (me, peer)
if hidden_for_me: treat as no conversation (until new activity policy)
cutoff ← cleared_at_for_me
return DirectMessages where created_at > cutoff (and participants match)
```

#### E. Frontend shell module (`src/app`)

| Element | Implementation |
|---------|----------------|
| **Entry** | `App.tsx` routes `/`, `/user/*`, `/admin/*`, `/system/*` |
| **Shell** | `AppContent` → `AuthScreen` or `AuthenticatedShell` |
| **Session** | `localStorage` keys `nexus_{portal}_access|refresh` |
| **Errors** | Classes `ApiError`, `PortalMismatchError` |
| **Helpers** | `form-modals.tsx` (`useConfirm`, `useFormPrompt`, quota meters) |

#### F. Config module (`backend/config`)

| Element | Role |
|---------|------|
| `settings.py` | DB, CORS, JWT, `STORAGE_BACKEND`, email, AI env |
| `urls.py` | Mount `/api/auth`, `/api`, `/api/assistant`, `/api/messaging` |
| `mailer.py` | Invite/share email helper + `EmailDeliveryError` |

---

## 9.2. Testing

Testing verifies modules (unit/API level) and end-to-end flows (system level). Automated coverage today is concentrated in `backend/storage/tests.py` (`StorageApiTests`); messaging/frontend CI are planned expansions.

### 9.2.1. Test Cases for Unit Testing

Unit / API tests exercise a single capability with controlled fixtures (organization + users). Run:

```powershell
$env:USE_SQLITE="true"
cd backend
..\.venv\Scripts\python manage.py test
```

#### Accounts & auth

| ID | Test case | Input | Expected | Status |
|----|-----------|-------|----------|--------|
| UT-A01 | Register new organization | `account_type=organization` | 201; user role `admin`; tokens returned | Covered |
| UT-A02 | Self-register into org | slug of existing org | 201; role `user`; can list files | Covered |
| UT-A03 | Invite create + accept | admin invite email | Hashed one-time token; accept creates user | Covered |
| UT-A04 | TOTP required at login | enabled 2FA, wrong/missing OTP | Login rejected until valid code | Covered |
| UT-A05 | TOTP secret encrypted | after enroll | Secret not stored plaintext | Covered |
| UT-A06 | Portal mismatch | admin credentials on `portal=user` | Error; no usable user-portal session | Manual / to automate |
| UT-A07 | Non-admin blocked from analytics | member GET analytics | 403 | Covered |
| UT-A08 | Workspace admin cannot escalate to superadmin | promote self | Rejected | Covered |

#### Storage

| ID | Test case | Input | Expected | Status |
|----|-----------|-------|----------|--------|
| UT-S01 | Upload + checksum | text file | 201; 64-char SHA-256 | Covered |
| UT-S02 | List / trash / restore | delete then restore | Trash count 1 then restored | Covered |
| UT-S03 | Share grant lifecycle | share → accept → preview → revoke | Shared visible then gone | Covered |
| UT-S04 | Public share password | wrong/right `X-Share-Password` | 401 then 200 | Covered |
| UT-S05 | Token not stored raw | create share-link | DB hash ≠ raw token | Covered |
| UT-S06 | Reject EICAR | EICAR payload | Upload rejected | Covered |
| UT-S07 | Quota exceeded | file larger than remaining quota | 413 | To add |
| UT-S08 | Restore over quota | trash large file, fill quota, restore | Blocked after fix A1 | To add |

#### Assistant

| ID | Test case | Input | Expected | Status |
|----|-----------|-------|----------|--------|
| UT-AI01 | Persistent conversation | create + send | 2 messages saved | Covered |
| UT-AI02 | Tenant isolation | other user GET conversation | 404 | Covered |

#### Messaging (planned dedicated suite)

| ID | Test case | Input | Expected | Status |
|----|-----------|-------|----------|--------|
| UT-M01 | Add friend same org | valid user id | Friendship created | Planned |
| UT-M02 | Reject cross-org friend | other org user | Error | Planned |
| UT-M03 | Send DM | text body | 201; listed on GET | Planned |
| UT-M04 | Clear for me | clear action | Cleared user sees empty; peer still has history | Planned |
| UT-M05 | Delete for me | hide friendship | Hidden for actor only | Planned |

#### Frontend unit (planned Vitest)

| ID | Test case | Expected | Status |
|----|-----------|----------|--------|
| UT-F01 | `portalForRole` mapping | user→user, admin→admin, superadmin→system | Planned |
| UT-F02 | `isStorageFull` / `wouldExceedStorage` | boundary true/false | Planned |
| UT-F03 | Token keys per portal | isolated localStorage keys | Planned |

---

### 9.2.2. Test Cases for System Testing

System tests validate **complete user journeys** across UI + API (+ storage). They may be manual checklists or future E2E automation.

| ID | Scenario | Steps | Expected result |
|----|----------|-------|-----------------|
| ST-01 | Admin creates workspace | Open `/admin` → register organization | Admin lands in shell; slug available in Settings |
| ST-02 | User joins & uploads | `/user` register with slug → upload file | File in My Files; checksum present via API |
| ST-03 | Quota full UX | Fill allocation → try upload | Modal blocks; API 413 if forced |
| ST-04 | Trash round-trip | Delete → Trash → Restore → permanent delete | Confirmations; correct scopes |
| ST-05 | Email share | Owner shares → member accepts → preview/download | Member sees under Shared |
| ST-06 | Secure link | Create password link → open public API with password | Download works; wrong password fails |
| ST-07 | Portal lock | Admin tries `/user` login | Rejected; `/admin` works |
| ST-08 | Friends sticky clear | A messages B → A clears → B refreshes | B still has messages |
| ST-09 | AI chat | New AI chat → ask storage question → reload | History persists; titled appropriately |
| ST-10 | Super admin | Login `/system` → create workspace → create admin | New org operable on `/admin` |
| ST-11 | Suspend workspace | Super admin suspends org → member uses API | Storage APIs blocked |
| ST-12 | 2FA end-to-end | Enroll in Profile → logout → login with OTP | Access only with valid code |
| ST-13 | S3 backend smoke | Set `STORAGE_BACKEND=s3` (R2) → upload/download/delete | Object appears/removed in bucket |
| ST-14 | Cross-portal isolation | Login user + admin in two tabs | Separate tokens; no session bleed |

**Build verification (release gate):**

```powershell
cd backend
..\.venv\Scripts\python manage.py test
cd ..
npm run build
```

---

## 9.3. Result Analysis

### 9.3.1. Implementation results

| Objective | Result |
|-----------|--------|
| Multi-tenant cloud storage | Achieved — org-scoped users and files |
| Role-based portals | Achieved — `/user`, `/admin`, `/system` with JWT isolation |
| Secure sharing | Achieved — grants + hashed public links + AV on upload |
| Collaboration | Achieved — friends DMs + AI conversations |
| Cloud object storage ready | Achieved at config level — `STORAGE_BACKEND=s3` |
| Academic OOP documentation | Achieved — Chapters 3–4 + architecture docs |

### 9.3.2. Testing results (current)

| Area | Outcome |
|------|---------|
| Automated API tests in `StorageApiTests` | Pass under SQLite for covered cases (auth, upload, trash, share, AV, 2FA, assistant isolation, superadmin) |
| Messaging automated tests | Not yet present — risk tracked in remaining work plan |
| Frontend automated tests | Not yet present — build (`npm run build`) used as compile gate |
| CI pipeline | Not yet in repo — recommended GitHub Actions |

### 9.3.3. Observations & gaps

**Strengths**

- Clear separation of apps and portals matches analysis actors.  
- Security basics (hashing, tenant filters, AV, 2FA) are implemented and partially tested.  
- Soft delete reduces accidental data loss.

**Limitations observed**

- Restore path should re-validate quota (correctness gap).  
- Downloads proxy through Django even when S3 signed URLs are configured.  
- Chat uses polling, not websockets.  
- Some org settings toggles are UI-only (backups/API keys/digests).  
- Public share recipient UX is API-oriented (frontend page planned).

### 9.3.4. Conclusion

Chapter 4 shows NexusStorage was implemented with a modern free/open stack and modular OOP design matching Chapter 3. Unit/API testing validates core storage and auth behaviours; system test cases define full acceptance journeys. Remaining work focuses on broader automated coverage, quota algorithm hardening, and production object-storage cutover (e.g. Cloudflare R2)—without changing the fundamental architecture.

---

## Document map for the report

| Report section | File |
|----------------|------|
| Ch. 3 Analysis & Design | [CHAPTER_3_SYSTEM_ANALYSIS_AND_DESIGN.md](CHAPTER_3_SYSTEM_ANALYSIS_AND_DESIGN.md) |
| Ch. 4 Implementation & Testing | This file |
| Usage guide | [../SYSTEM_USAGE.md](../SYSTEM_USAGE.md) |
| Full class / UI inventory | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| Class vs object primer | [../CLASS_VS_OBJECT.md](../CLASS_VS_OBJECT.md) |
| Future fixes & cloud storage | [../REMAINING_WORK_PLAN.md](../REMAINING_WORK_PLAN.md) |
