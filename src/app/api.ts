const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: "superadmin" | "admin" | "user";
  is_active: boolean;
  date_joined: string;
  storage_used: number;
  storage_total: number;
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  organization: OrganizationSettings | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  storage_quota_bytes: number;
  max_file_size_bytes: number;
  require_two_factor: boolean;
  allow_public_links: boolean;
  allow_self_registration: boolean;
  maintenance_mode: boolean;
  is_active: boolean;
  created_at: string;
  user_count: number;
  admin_count: number;
  storage_used: number | null;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  two_factor_enabled: boolean;
  organization_id: string | null;
  organization_name: string | null;
}

export interface SystemOverview {
  workspaces: number;
  active_workspaces: number;
  suspended_workspaces: number;
  admins: number;
  users: number;
  storage_used: number;
  files: number;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  storage_quota_bytes: number;
  max_file_size_bytes: number;
  require_two_factor: boolean;
  audit_logging: boolean;
  api_access: boolean;
  automatic_backups: boolean;
  email_notifications: boolean;
  maintenance_mode: boolean;
  allow_public_links: boolean;
  allow_self_registration: boolean;
}

export interface ApiFile {
  id: string;
  name: string;
  node_type: "file" | "folder";
  type: "folder" | "image" | "video" | "document" | "archive" | "code" | "pdf";
  size: number;
  mime_type: string;
  modified: string;
  created_at: string;
  owner: string;
  owner_id: string;
  parent: string | null;
  shared: boolean;
  starred: boolean;
  checksum_sha256: string;
  deleted_at: string | null;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  action_label?: string;
  action_type?: string;
  file_name: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  encrypted?: boolean;
}

export interface ShareRequest {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  sender_name: string;
  sender_email: string;
  permission: "view" | "edit" | "share";
  status: "pending" | "accepted" | "ignored" | "revoked";
  responded_at?: string | null;
  created_at: string;
  file_id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  size: number;
  node_type: "file" | "folder";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  from_user: boolean;
  text: string;
  time: string;
  model: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Portal = "user" | "admin" | "system";

export function portalFromPath(pathname = typeof window !== "undefined" ? window.location.pathname : "/user"): Portal {
  if (pathname.startsWith("/system")) return "system";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/user")) return "user";
  return "user";
}

export function portalForRole(role: ApiUser["role"]): Portal {
  if (role === "superadmin") return "system";
  if (role === "admin") return "admin";
  return "user";
}

export function portalHome(portal: Portal) {
  return `/${portal}`;
}

export function portalLabel(portal: Portal) {
  return ({ user: "User", admin: "Admin", system: "Super Admin" } as const)[portal];
}

function tokenKeys(portal: Portal = portalFromPath()) {
  return {
    access: `nexus_${portal}_access`,
    refresh: `nexus_${portal}_refresh`,
  };
}

let refreshPromise: Promise<boolean> | null = null;

export function clearTokens(portal: Portal = portalFromPath()) {
  const keys = tokenKeys(portal);
  localStorage.removeItem(keys.access);
  localStorage.removeItem(keys.refresh);
}

function saveTokens(access: string, refresh?: string, portal: Portal = portalFromPath()) {
  const keys = tokenKeys(portal);
  localStorage.setItem(keys.access, access);
  if (refresh) localStorage.setItem(keys.refresh, refresh);
}

function readAccessToken(portal: Portal = portalFromPath()) {
  return localStorage.getItem(tokenKeys(portal).access);
}

function readRefreshToken(portal: Portal = portalFromPath()) {
  return localStorage.getItem(tokenKeys(portal).refresh);
}

async function parseError(response: Response) {
  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (typeof data.detail === "string") return new ApiError(response.status, data.detail);
  if (typeof data.detail === "object" && data.detail && "detail" in (data.detail as object)) {
    return new ApiError(response.status, String((data.detail as { detail: string }).detail));
  }
  if (typeof data.threat === "string" && data.threat) {
    return new ApiError(
      response.status,
      String(data.detail || `Virus/malware detected (${data.threat}). Upload blocked.`),
    );
  }
  const values = Object.values(data).flat();
  const message = values.map(String).filter(Boolean).join(" ") || `Request failed (${response.status})`;
  return new ApiError(response.status, message);
}

async function performRefresh(portal: Portal = portalFromPath()) {
  const refresh = readRefreshToken(portal);
  if (!refresh) return false;
  const response = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearTokens(portal);
    return false;
  }
  const data = await response.json();
  saveTokens(data.access, data.refresh, portal);
  return true;
}

async function refreshAccessToken(portal: Portal = portalFromPath()) {
  if (!refreshPromise) {
    refreshPromise = performRefresh(portal).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const portal = portalFromPath();
  const headers = new Headers(init.headers);
  const token = readAccessToken(portal);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && (await refreshAccessToken(portal))) {
    return apiRequest<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function authenticateAndRoute(
  data: { access: string; refresh: string; user: ApiUser },
  expectedPortal?: Portal,
) {
  const destination = portalForRole(data.user.role);
  // Always park the session under the role's own portal so /user and /admin never share tokens.
  saveTokens(data.access, data.refresh, destination);
  if (expectedPortal && expectedPortal !== destination) {
    clearTokens(expectedPortal);
    window.location.assign(`${portalHome(destination)}${window.location.search || ""}`);
    return data.user;
  }
  if (portalFromPath() !== destination) {
    window.location.assign(`${portalHome(destination)}${window.location.search || ""}`);
  }
  return data.user;
}

export const authApi = {
  async login(email: string, password: string, otp = "") {
    const data = await apiRequest<{ access: string; refresh: string; user: ApiUser }>(
      "/auth/login/",
      { method: "POST", body: JSON.stringify({ email, password, otp }) },
    );
    return authenticateAndRoute(data, portalFromPath());
  },
  async register(payload: {
    name: string;
    email: string;
    password: string;
    account_type: "organization" | "user";
    organization_name?: string;
    organization_slug?: string;
  }) {
    const data = await apiRequest<{ access: string; refresh: string; user: ApiUser }>(
      "/auth/register/",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return authenticateAndRoute(data, portalFromPath());
  },
  async acceptInvitation(token: string, name: string, password: string) {
    const data = await apiRequest<{ access: string; refresh: string; user: ApiUser }>(
      "/auth/invitations/accept/",
      { method: "POST", body: JSON.stringify({ token, name, password }) },
    );
    return authenticateAndRoute(data, portalFromPath());
  },
  me: () => apiRequest<ApiUser>("/auth/me/"),
  updateProfile: (changes: { name?: string; avatar_url?: string }) =>
    apiRequest<ApiUser>("/auth/me/", { method: "PATCH", body: JSON.stringify(changes) }),
  changePassword: (current_password: string, new_password: string) =>
    apiRequest<void>("/auth/password/", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  setupTwoFactor: (password: string) =>
    apiRequest<{ secret: string; provisioning_uri: string; qr_code: string }>("/auth/2fa/setup/", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  confirmTwoFactor: (otp: string) =>
    apiRequest<{ two_factor_enabled: boolean }>("/auth/2fa/confirm/", {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  disableTwoFactor: (password: string, otp: string) =>
    apiRequest<{ two_factor_enabled: boolean }>("/auth/2fa/disable/", {
      method: "POST",
      body: JSON.stringify({ password, otp }),
    }),
  async logout() {
    const portal = portalFromPath();
    const refresh = readRefreshToken(portal);
    try {
      if (refresh) await apiRequest<void>("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) });
    } finally {
      clearTokens(portal);
    }
  },
};

function pageResults<T>(data: { results?: T[] } | T[]) {
  return Array.isArray(data) ? data : data.results || [];
}

export const fileApi = {
  async list(
    scope: "mine" | "shared" | "trash" | "organization" = "mine",
    options?: { parent?: string | "root" },
  ) {
    const params = new URLSearchParams({ scope });
    if (options?.parent !== undefined) params.set("parent", options.parent);
    return pageResults(await apiRequest<{ results: ApiFile[] }>(`/files/?${params}`));
  },
  get: (id: string) => apiRequest<ApiFile>(`/files/${id}/`),
  async search(query: string) {
    return pageResults(await apiRequest<{ results: ApiFile[] }>(`/files/?search=${encodeURIComponent(query)}`));
  },
  async scan(file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{
      clean: boolean;
      allowed: boolean;
      threat: string;
      engine: string;
      detail: string;
      scanned_bytes: number;
    }>("/files/scan/", { method: "POST", body: form });
  },
  async store(file: File, parent?: string) {
    // Backend still re-scans before write. This only skips the extra client pre-check.
    const form = new FormData();
    form.append("file", file);
    if (parent) form.append("parent", parent);
    return apiRequest<ApiFile & { scan?: { clean: boolean; engine: string; detail?: string } }>(
      "/files/upload/",
      { method: "POST", body: form },
    );
  },
  async upload(file: File, parent?: string) {
    const scan = await this.scan(file);
    if (!scan.clean || !scan.allowed) {
      throw new ApiError(400, scan.detail || `Virus detected (${scan.threat}). Upload blocked.`);
    }
    return this.store(file, parent);
  },
  createFolder: (name: string, parent?: string) =>
    apiRequest<ApiFile>("/files/", { method: "POST", body: JSON.stringify({ name, parent: parent || null }) }),
  update: (id: string, changes: Partial<Pick<ApiFile, "name" | "starred" | "parent">>) =>
    apiRequest<ApiFile>(`/files/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),
  trash: (id: string) => apiRequest<void>(`/files/${id}/`, { method: "DELETE" }),
  restore: (id: string) => apiRequest<ApiFile>(`/files/${id}/restore/?scope=trash`, { method: "POST" }),
  permanentDelete: (id: string) => apiRequest<void>(`/files/${id}/permanent/?scope=trash`, { method: "DELETE" }),
  emptyTrash: () => apiRequest<void>("/files/empty-trash/", { method: "DELETE" }),
  downloadUrl: (id: string) => `${API_URL}/files/${id}/download/`,
  previewUrl: (id: string) => `${API_URL}/files/${id}/preview/`,
  duplicate: (id: string) => apiRequest<ApiFile>(`/files/${id}/duplicate/`, { method: "POST" }),
  invite: (id: string, email: string, permission: "view" | "edit" | "share") =>
    apiRequest<{ email_sent?: boolean; status?: string }>(`/files/${id}/shares/`, {
      method: "POST",
      body: JSON.stringify({ email, permission }),
    }),
  createShareLink: (
    id: string,
    options: { permission: string; expires_at?: string | null; password?: string; email?: string },
  ) =>
    apiRequest<{ url: string; email_sent?: boolean }>(`/files/${id}/share-link/`, {
      method: "POST",
      body: JSON.stringify(options),
    }),
  async shareRequests(status?: "pending" | "accepted" | "ignored" | "revoked", scope: "inbox" | "sent" = "inbox") {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);
    const query = params.toString() ? `?${params}` : "";
    return pageResults(await apiRequest<{ results: ShareRequest[] }>(`/shares/${query}`));
  },
  acceptShare: (id: string) => apiRequest<ShareRequest>(`/shares/${id}/accept/`, { method: "POST" }),
  ignoreShare: (id: string) => apiRequest<ShareRequest>(`/shares/${id}/ignore/`, { method: "POST" }),
  revokeShare: (id: string) => apiRequest<ShareRequest>(`/shares/${id}/revoke/`, { method: "POST" }),
};

export const dashboardApi = {
  get: () => apiRequest<any>("/dashboard/"),
  admin: () => apiRequest<any>("/admin/analytics/"),
  async activity() {
    return pageResults(await apiRequest<{ results: ActivityLog[] }>("/activity/?ordering=-created_at"));
  },
};

export const adminApi = {
  async users() {
    return pageResults(await apiRequest<{ results: ApiUser[] }>("/auth/users/"));
  },
  updateUser: (id: string, changes: { role?: "admin" | "user"; is_active?: boolean }) =>
    apiRequest<ApiUser>(`/auth/users/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),
  invite: (email: string, role: "admin" | "user" = "user") =>
    apiRequest<{ invite_url: string; expires_at: string }>("/auth/invitations/", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  settings: () => apiRequest<OrganizationSettings>("/auth/organization/"),
  updateSettings: (changes: Partial<OrganizationSettings>) =>
    apiRequest<OrganizationSettings>("/auth/organization/", { method: "PATCH", body: JSON.stringify(changes) }),
  clearOrganizationData: (confirmation: string, password: string) =>
    apiRequest<void>("/auth/organization/data/", {
      method: "DELETE",
      body: JSON.stringify({ confirmation, password }),
    }),
};

export const superAdminApi = {
  overview: () => apiRequest<SystemOverview>("/auth/system/overview/"),
  async workspaces() {
    return pageResults(await apiRequest<{ results: Workspace[] }>("/auth/system/workspaces/"));
  },
  createWorkspace: (payload: {
    name: string;
    admin_name?: string;
    admin_email?: string;
    admin_password?: string;
  }) =>
    apiRequest<Workspace>("/auth/system/workspaces/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateWorkspace: (id: string, changes: Partial<Workspace>) =>
    apiRequest<Workspace>(`/auth/system/workspaces/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  deleteWorkspace: (id: string) =>
    apiRequest<void>(`/auth/system/workspaces/${id}/`, { method: "DELETE" }),
  async users(params: { role?: "admin" | "user"; workspace?: string } = {}) {
    const query = new URLSearchParams();
    if (params.role) query.set("role", params.role);
    if (params.workspace) query.set("workspace", params.workspace);
    const suffix = query.toString() ? `?${query}` : "";
    return pageResults(await apiRequest<{ results: SystemUser[] }>(`/auth/system/users/${suffix}`));
  },
  createAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    organization: string;
    role?: "admin" | "user";
  }) =>
    apiRequest<SystemUser>("/auth/system/users/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, changes: { role?: "admin" | "user"; is_active?: boolean; password?: string }) =>
    apiRequest<SystemUser>(`/auth/system/users/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  deleteUser: (id: string) => apiRequest<void>(`/auth/system/users/${id}/`, { method: "DELETE" }),
};

export const chatApi = {
  async conversations() {
    return pageResults(await apiRequest<{ results: Conversation[] }>("/assistant/conversations/"));
  },
  create: () =>
    apiRequest<Conversation>("/assistant/conversations/", {
      method: "POST",
      body: JSON.stringify({ title: "New conversation" }),
    }),
  send: (conversationId: string, message: string) =>
    apiRequest<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
      `/assistant/conversations/${conversationId}/send/`,
      { method: "POST", body: JSON.stringify({ message }) },
    ),
};

export async function authenticatedDownload(id: string, filename: string) {
  const token = readAccessToken();
  const response = await fetch(fileApi.downloadUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function authenticatedPreview(id: string) {
  const token = readAccessToken();
  const response = await fetch(fileApi.previewUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw await parseError(response);
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
