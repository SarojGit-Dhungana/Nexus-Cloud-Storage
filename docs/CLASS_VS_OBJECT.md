# Class vs Object — NexusStorage Primer

This note explains **class** vs **object** using **this** codebase, not abstract textbook-only examples.

## One-sentence definitions

| Term | Meaning |
|------|---------|
| **Class** (or type / interface) | The **blueprint**: fields and behavior shared by many things |
| **Object** (instance) | One **concrete** thing built from that blueprint: a DB row, a value in memory, or one UI render |

## Backend (Python / Django) — real classes

Django models are Python **classes**. Each saved row is an **object**.

```python
# Class = blueprint (accounts/models.py)
class User(AbstractUser):
    organization = models.ForeignKey(Organization, ...)
    role = models.CharField(...)
```

| Class | Example object |
|-------|----------------|
| `User` | Row for `superadmin@nexusstorage.local` |
| `Organization` | Workspace named `"Acme"` with slug `acme` |
| `FileNode` | Folder `"Documents"` or file `"budget.xlsx"` |
| `Conversation` | Alice’s AI thread titled `"AI Chat"` |
| `Friendship` | Link between Alice’s user id and Bob’s user id |

Creating an object:

```python
# Object = one instance
alice = User.objects.get(email="alice@acme.com")  # one User object
node = FileNode.objects.create(name="report.pdf", owner=alice, organization=alice.organization)
```

`FileNode` is still the class; `node` is one object. `alice` is one `User` object.

### Views and services are classes too

| Class | What an “object” means at runtime |
|-------|-----------------------------------|
| `FileNodeViewSet` | Django/DRF instantiates a view object per request |
| `AssistantService` | Code constructs a service object to call AI providers |
| `LoginSerializer` | Serializer object validates one login payload |
| `IsOrganizationAdmin` | Permission class; DRF uses it as a check blueprint |

So: **models** map cleanly to “table row = object”; **views/serializers** are classes whose objects live for a request.

## Frontend (TypeScript / React) — mostly types + functions

React UI is **not** built as OOP model classes. Patterns here:

| Blueprint style | Example | Object / instance |
|-----------------|---------|-------------------|
| `interface ApiUser` | Shape of `/auth/me` JSON | One parsed user in memory after login |
| `interface FileItem` | Shape for a file card | One `{ id, name: "report.pdf", … }` in state |
| `type Portal` | `"user" \| "admin" \| "system"` | Current portal `"admin"` |
| Function component `FilesView` | UI blueprint | One mounted tree when that view is active |
| Object literal `fileApi` | API client singleton | The single `fileApi` object used app-wide |

True **classes** on the frontend are rare and used for errors:

- `class ApiError extends Error`
- `class PortalMismatchError extends Error`

Example parallel:

```ts
// Blueprint (type)
interface FileItem { id: string; name: string; /* ... */ }

// Object (one value)
const card: FileItem = { id: "42", name: "report.pdf", /* ... */ };
```

The **file card on screen** is React turning that object into DOM; the **type** never “runs” by itself.

## Relation table: how objects point to objects

Foreign keys are links from one object to another.

| From object | Field | To object |
|-------------|-------|-----------|
| `FileNode` | `organization` | `Organization` |
| `FileNode` | `owner` | `User` |
| `FileNode` | `parent` | another `FileNode` (folder) |
| `ShareGrant` | `node` | `FileNode` |
| `ShareGrant` | `grantee` (or similar) | `User` |
| `Conversation` | `owner` | `User` |
| `ChatMessage` | `conversation` | `Conversation` |
| `DirectMessage` | sender / friendship | `User` / `Friendship` |

Story in plain language:

1. **Organization** object Acme exists.
2. **User** object Alice belongs to Acme.
3. **FileNode** object `report.pdf` belongs to Alice **and** Acme.
4. Frontend receives JSON shaped like `ApiFile` / maps to `FileItem`, then `FilesView` displays that one file.

Tenant safety: APIs load only objects whose `organization` matches the logged-in user’s organization.

## Side-by-side map

| Layer | Blueprint | Concrete object |
|-------|-----------|-----------------|
| DB | `class User` | Row `id=7`, email Alice |
| API JSON | `interface ApiUser` | `{ id: "7", email: "alice@…", role: "user" }` |
| UI state | `interface UserProfile` | Profile shown in sidebar |
| UI | `function Sidebar(...)` | Sidebar React elements for this session |
| AI | `class Conversation` | One chat thread row |
| Friends | `class Friendship` | Alice↔Bob row with Alice’s `cleared_at` |

## Where to look in the repo

| Topic | Doc / path |
|-------|------------|
| Backend + frontend structure | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How to run and use the product | [SYSTEM_USAGE.md](SYSTEM_USAGE.md) |
| Model source | `backend/*/models.py` |
| API types & clients | `src/app/api.ts` |
| Live shell | `src/app/components/AppContent.tsx` |

## Quick quiz

1. Is `User` a class or an object? → **Class** (blueprint).
2. Is `superadmin@nexusstorage.local` after migrate a class or an object? → **Object** (one `User` instance).
3. Is `interface ApiFile` an object? → **No** — it is a TypeScript blueprint erased at compile time.
4. Is `authApi.login(...)` calling a class? → **No** — `authApi` is a singleton **object** with methods.
5. Is `ConversationViewSet` a class? → **Yes** — DRF creates a view **object** per request from that class.
