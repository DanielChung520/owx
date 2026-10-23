/**
 * 賬號管理（fetch 後端 API + localStorage cache + mock fallback）
 * 對應 F-10-064 / accounts-management.md §4
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GlobalRole = "super_admin" | "admin" | "developer" | "analyst" | "viewer";
export type ScopeRole = "owner" | "editor" | "contributor" | "viewer";
export type ScopeId = string;

export interface ScopeMembership {
  scopeId: ScopeId;
  scopeName: string;
  scopeRole: ScopeRole;
  joinedAt: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  locale: "zh-TW" | "zh-CN" | "en" | "ja";
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  globalRole: GlobalRole;
  scopeMemberships: ScopeMembership[];
  preferences: UserPreferences;
  createdAt: string;
  lastActiveAt?: string;
  invitedBy?: string;
  status: "active" | "pending" | "disabled";
  /** 臨時密碼（後端不序列化回傳；僅登入比對用） */
  tempPassword?: string;
  /** 強制變更密碼（重設密碼/邀請後 = true；規格 §10.2） */
  mustChangePassword: boolean;
}

const ACCOUNTS_URL = "/api/admin/accounts";
const STORAGE_KEY = "kac.accounts";

function loadCache(): Account[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Account[]) : null;
  } catch {
    return null;
  }
}

function saveCache(accs: Account[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accs));
  } catch {
    /* quota 超過或 SSR — 忽略 */
  }
}

function mockAccounts(): Account[] {
  const now = new Date().toISOString();
  return [
    {
      id: "u_001", email: "admin", displayName: "admin", isActive: true,
      globalRole: "admin",
      scopeMemberships: [{ scopeId: "s_default", scopeName: "Default Workspace", scopeRole: "owner", joinedAt: "2026-09-01T00:00:00Z" }],
      preferences: { theme: "system", locale: "zh-TW", sidebarCollapsed: false, notificationsEnabled: true },
      createdAt: "2026-09-01T00:00:00Z", lastActiveAt: now, status: "active",
      mustChangePassword: false,
    },
    {
      id: "u_002", email: "developer@kac.aiconn.ai", displayName: "Daniel Chung", isActive: true,
      globalRole: "developer",
      scopeMemberships: [{ scopeId: "s_default", scopeName: "Default Workspace", scopeRole: "editor", joinedAt: "2026-09-05T00:00:00Z" }],
      preferences: { theme: "dark", locale: "zh-TW", sidebarCollapsed: false, notificationsEnabled: true },
      createdAt: "2026-09-05T00:00:00Z", lastActiveAt: now, status: "active",
      mustChangePassword: false,
    },
    {
      id: "u_003", email: "analyst@kac.aiconn.ai", displayName: "Data Analyst", isActive: true,
      globalRole: "analyst",
      scopeMemberships: [{ scopeId: "s_default", scopeName: "Default Workspace", scopeRole: "contributor", joinedAt: "2026-09-08T00:00:00Z" }],
      preferences: { theme: "light", locale: "en", sidebarCollapsed: true, notificationsEnabled: false },
      createdAt: "2026-09-08T00:00:00Z", lastActiveAt: now, status: "active",
      mustChangePassword: false,
    },
    {
      id: "u_004", email: "viewer@example.com", displayName: "Viewer User", isActive: false,
      globalRole: "viewer", scopeMemberships: [],
      preferences: { theme: "system", locale: "ja", sidebarCollapsed: false, notificationsEnabled: true },
      createdAt: "2026-09-10T00:00:00Z", invitedBy: "u_001", status: "pending", mustChangePassword: true,
    },
  ];
}

async function fetchAccounts(): Promise<Account[]> {
  try {
    const res = await fetch(ACCOUNTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Account[];
    saveCache(data);
    return data;
  } catch (e) {
    console.warn(`[accounts] 後端不可達，fallback: ${e}`);
    const cached = loadCache();
    if (cached) return cached;
    const mock = mockAccounts();
    saveCache(mock);
    return mock;
  }
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 60_000,
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
async function deleteJson(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${url} failed: ${res.status}`);
}

export function useInviteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; globalRole: GlobalRole }) =>
      postJson<Account>(ACCOUNTS_URL, {
        email: input.email,
        displayName: input.email.split("@")[0],
        globalRole: input.globalRole,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useToggleAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      patchJson<Account>(`${ACCOUNTS_URL}/${encodeURIComponent(input.id)}`, { isActive: input.isActive }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const previous = qc.getQueryData<Account[]>(["accounts"]);
      qc.setQueryData<Account[]>(["accounts"], (old) =>
        (old ?? []).map((a) =>
          a.id === input.id ? { ...a, isActive: input.isActive, status: input.isActive ? "active" : "disabled" } : a,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(["accounts"], ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useChangeAccountRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; globalRole: GlobalRole }) =>
      patchJson<Account>(`${ACCOUNTS_URL}/${encodeURIComponent(input.id)}`, { globalRole: input.globalRole }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const previous = qc.getQueryData<Account[]>(["accounts"]);
      qc.setQueryData<Account[]>(["accounts"], (old) =>
        (old ?? []).map((a) => a.id === input.id ? { ...a, globalRole: input.globalRole } : a),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(["accounts"], ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useEditAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Partial<Pick<Account, "displayName" | "avatarUrl">> }) =>
      patchJson<Account>(`${ACCOUNTS_URL}/${encodeURIComponent(input.id)}`, input.patch),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const previous = qc.getQueryData<Account[]>(["accounts"]);
      qc.setQueryData<Account[]>(["accounts"], (old) =>
        (old ?? []).map((a) => a.id === input.id ? { ...a, ...input.patch } : a),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(["accounts"], ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${ACCOUNTS_URL}/${encodeURIComponent(id)}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const previous = qc.getQueryData<Account[]>(["accounts"]);
      qc.setQueryData<Account[]>(["accounts"], (old) => (old ?? []).filter((a) => a.id !== id));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(["accounts"], ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 後端產生 8 字臨時密碼 + mustChangePassword=true（規格 §10.3）
      const res = await fetch(
        `${ACCOUNTS_URL}/${encodeURIComponent(id)}/reset-password`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`reset-password failed: ${res.status}`);
      return res.json() as Promise<{
        id: string;
        tempPassword: string;
        mustChangePassword: boolean;
      }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

/** 用戶設定新密碼（首次登入強制變更；規格 §10.3）
 * - 驗證：≥8 + 複雜度（後端也驗一次）
 * - 成功 → 清臨時密碼 + mustChangePassword=false + status=active */
export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; newPassword: string }) => {
      const res = await fetch(
        `${ACCOUNTS_URL}/${encodeURIComponent(input.id)}/change-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ newPassword: input.newPassword }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { reason?: string }).reason ?? `change-password failed: ${res.status}`,
        );
      }
      return res.json() as Promise<Account>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export const GLOBAL_ROLES: { value: GlobalRole; label: string; description: string }[] = [
  { value: "super_admin", label: "super_admin", description: "全部權限 + 管理其他 admin + KAC platform settings" },
  { value: "admin", label: "admin", description: "管理使用者 + 全域 config" },
  { value: "developer", label: "developer", description: "開發工具（log / metrics）+ ontology editor" },
  { value: "analyst", label: "analyst", description: "看 analytics + audit log + ontology contributor" },
  { value: "viewer", label: "viewer", description: "看自己 profile + 唯讀內容" },
];

export const SCOPE_ROLES: { value: ScopeRole; label: string; description: string }[] = [
  { value: "owner", label: "owner", description: "scope 全部 + 成員管理 + 刪除 scope" },
  { value: "editor", label: "editor", description: "編輯 ontology + 文件" },
  { value: "contributor", label: "contributor", description: "建議 ontology（待審核）" },
  { value: "viewer", label: "viewer", description: "唯讀" },
];
