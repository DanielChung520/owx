import type { ChatMessage, Role } from "./types";

const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

export interface SessionSummary {
  id: string;
  title?: string;
  agent?: string;
  model?: { id?: string; providerID?: string };
}

export interface MessagePart {
  type: string;
  text?: string;
}

export interface MessageEnvelope {
  info: { id: string; role: string };
  parts: MessagePart[];
}

export interface CommandInfo {
  name: string;
  description?: string;
  source?: string;
}

export interface ConfigInfo {
  mcp?: Record<string, unknown>;
  theme?: string;
  [key: string]: unknown;
}

export interface SkillInfo {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export async function listSessions(directory?: string): Promise<SessionSummary[]> {
  const params = new URLSearchParams({ roots: "true" });
  if (directory !== undefined && directory !== "") {
    params.set("directory", directory);
  }
  const res = await fetch(`${baseUrl}/session?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`listSessions failed: ${res.status}`);
  }
  return (await res.json()) as SessionSummary[];
}

export async function listMessages(sessionId: string): Promise<MessageEnvelope[]> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/message`);
  if (!res.ok) {
    throw new Error(`listMessages failed: ${res.status}`);
  }
  return (await res.json()) as MessageEnvelope[];
}

export async function listCommands(): Promise<CommandInfo[]> {
  const res = await fetch(`${baseUrl}/command`);
  if (!res.ok) {
    throw new Error(`listCommands failed: ${res.status}`);
  }
  return (await res.json()) as CommandInfo[];
}

export async function findFiles(query: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/find/file?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`findFiles failed: ${res.status}`);
  }
  return (await res.json()) as string[];
}

export function toChatMessages(envelopes: MessageEnvelope[]): ChatMessage[] {
  return envelopes.map((env) => {
    const text = env.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    const reasoning = env.parts
      .filter((part) => part.type === "reasoning")
      .map((part) => part.text ?? "")
      .join("");
    const role: Role = env.info.role === "user" ? "user" : "assistant";
    return { id: env.info.id, role, text, reasoning };
  });
}

export interface ProviderModel {
  providerID: string;
  id: string;
}

export interface ProviderGroup {
  id: string;
  name?: string;
  models: ProviderModel[];
}

export interface AgentInfo {
  name: string;
  mode?: string;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${baseUrl}/agent`);
  if (!res.ok) {
    throw new Error(`listAgents failed: ${res.status}`);
  }
  return (await res.json()) as AgentInfo[];
}

export async function listProviders(): Promise<ProviderGroup[]> {
  const res = await fetch(`${baseUrl}/config/providers`);
  if (!res.ok) {
    throw new Error(`listProviders failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    providers?: Array<{
      id: string;
      name?: string;
      models?: Record<string, unknown>;
    }>;
  };
  return (data.providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: Object.keys(provider.models ?? {}).map((id) => ({
      providerID: provider.id,
      id,
    })),
  }));
}

export async function setSessionAgent(
  sessionId: string,
  agent: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/session/${sessionId}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent }),
  });
  if (!res.ok) {
    throw new Error(`setSessionAgent failed: ${res.status}`);
  }
}

export async function setSessionModel(
  sessionId: string,
  providerID: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/session/${sessionId}/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: { providerID, id } }),
  });
  if (!res.ok) {
    throw new Error(`setSessionModel failed: ${res.status}`);
  }
}

export async function createSession(directory?: string): Promise<string> {
  const query =
    directory !== undefined && directory !== ""
      ? `?directory=${encodeURIComponent(directory)}`
      : "";
  const res = await fetch(`${baseUrl}/session${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`createSession failed: ${res.status}`);
  }
  const data = (await res.json()) as { id?: string };
  if (data.id === undefined) {
    throw new Error("createSession: response missing id");
  }
  return data.id;
}

export async function runSessionCommand(
  sessionId: string,
  command: string,
  args?: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/command`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, arguments: args ?? "" }),
  });
  if (!res.ok) {
    throw new Error(`runSessionCommand failed: ${res.status}`);
  }
}

export async function sendMessageAsync(
  sessionId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parts: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    throw new Error(`sendMessageAsync failed: ${res.status}`);
  }
}

async function post(sessionId: string, suffix: string): Promise<Response> {
  const res = await fetch(`${baseUrl}/session/${sessionId}${suffix}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`POST ${suffix} failed: ${res.status}`);
  }
  return res;
}

export async function updateSessionTitle(
  sessionId: string,
  title: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/session/${sessionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`updateSessionTitle failed: ${res.status}`);
  }
}

export async function forkSession(sessionId: string): Promise<{ id?: string }> {
  const res = await post(sessionId, "/fork");
  return (await res.json()) as { id?: string };
}

export async function summarizeSession(sessionId: string): Promise<void> {
  await post(sessionId, "/summarize");
}

export async function revertSession(sessionId: string): Promise<void> {
  await post(sessionId, "/revert");
}

export async function unrevertSession(sessionId: string): Promise<void> {
  await post(sessionId, "/unrevert");
}

export async function shareSession(
  sessionId: string,
): Promise<Record<string, unknown>> {
  const res = await post(sessionId, "/share");
  return (await res.json()) as Record<string, unknown>;
}

export async function unshareSession(sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/share`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`unshareSession failed: ${res.status}`);
  }
}

export async function sessionDiff(sessionId: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/diff`);
  if (!res.ok) {
    throw new Error(`sessionDiff failed: ${res.status}`);
  }
  return (await res.json()) as unknown;
}

export async function providerAuth(): Promise<unknown> {
  const res = await fetch(`${baseUrl}/provider/auth`);
  if (!res.ok) {
    throw new Error(`providerAuth failed: ${res.status}`);
  }
  return (await res.json()) as unknown;
}

export async function appInfo(): Promise<{ version?: string }> {
  const res = await fetch(`${baseUrl}/app`);
  if (!res.ok) {
    throw new Error(`appInfo failed: ${res.status}`);
  }
  return (await res.json()) as { version?: string };
}

export async function listConfig(): Promise<ConfigInfo> {
  const res = await fetch(`${baseUrl}/config`);
  if (!res.ok) {
    throw new Error(`listConfig failed: ${res.status}`);
  }
  return (await res.json()) as ConfigInfo;
}

export async function listSkills(): Promise<SkillInfo[]> {
  const res = await fetch(`${baseUrl}/api/skill`);
  if (!res.ok) {
    throw new Error(`listSkills failed: ${res.status}`);
  }
  return (await res.json()) as SkillInfo[];
}

export interface FileEntry {
  name: string;
  path: string;
  absolute: string;
  type: "file" | "directory";
  ignored?: boolean;
}

export interface ProjectSummary {
  id: string;
  worktree: string;
  vcs?: string;
}

export interface DocStatusEntry {
  path: string;
  state: string;
  md5?: string;
  fileSize?: number;
}

function withDirectory(path: string, directory?: string): string {
  const params = new URLSearchParams({ path });
  if (directory !== undefined && directory !== "") {
    params.set("directory", directory);
  }
  return params.toString();
}

export async function listDirectory(
  path: string,
  directory?: string,
): Promise<FileEntry[]> {
  const res = await fetch(`${baseUrl}/file?${withDirectory(path, directory)}`);
  if (!res.ok) {
    throw new Error(`listDirectory failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    name?: string;
    path?: string;
    absolute?: string;
    type?: string;
    ignored?: boolean;
  }>;
  return data
    .filter(
      (entry): entry is { name: string; path: string; absolute: string; type: "file" | "directory"; ignored?: boolean } =>
        entry.name !== undefined &&
        entry.path !== undefined &&
        entry.absolute !== undefined &&
        (entry.type === "file" || entry.type === "directory"),
    )
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      absolute: entry.absolute,
      type: entry.type,
      ignored: entry.ignored,
    }));
}

export async function readFileContent(
  path: string,
  directory?: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/file/content?${withDirectory(path, directory)}`);
  if (!res.ok) {
    throw new Error(`readFileContent failed: ${res.status}`);
  }
  const data = (await res.json()) as { type?: string; content?: string };
  return data.content ?? "";
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${baseUrl}/project`);
  if (!res.ok) {
    throw new Error(`listProjects failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    id?: string;
    worktree?: string;
    vcs?: string;
  }>;
  return data
    .filter(
      (project): project is { id: string; worktree: string; vcs?: string } =>
        project.id !== undefined && project.worktree !== undefined,
    )
    .map((project) => ({
      id: project.id,
      worktree: project.worktree,
      vcs: project.vcs,
    }));
}

export async function currentProject(): Promise<ProjectSummary | null> {
  const res = await fetch(`${baseUrl}/project/current`);
  if (!res.ok) {
    throw new Error(`currentProject failed: ${res.status}`);
  }
  const data = (await res.json()) as { id?: string; worktree?: string; vcs?: string };
  if (data.id === undefined || data.worktree === undefined) {
    return null;
  }
  return { id: data.id, worktree: data.worktree, vcs: data.vcs };
}

export async function listDocStatus(): Promise<DocStatusEntry[]> {
  const res = await fetch(`${baseUrl}/__ow-doc-status`);
  if (!res.ok) {
    throw new Error(`listDocStatus failed: ${res.status}`);
  }
  return (await res.json()) as DocStatusEntry[];
}

const harnessBase = import.meta.env.VITE_OWX_HARNESS_URL ?? "";

export interface NewProjectInput {
  name: string;
  slug: string;
  tags: string[];
}

export interface CreatedProject {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  created: number;
  worktree: string;
}

export async function createProject(
  input: NewProjectInput,
): Promise<CreatedProject> {
  const res = await fetch(`${harnessBase}/rpc/project/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `createProject failed: ${res.status}`);
  }
  return (await res.json()) as CreatedProject;
}

export async function harnessPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${harnessBase}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(data?.error ?? `harness ${endpoint}: ${res.status}`);
  }
  return data as T;
}

export async function fsMkdir(directory: string, path: string): Promise<void> {
  await harnessPost("/rpc/fs/mkdir", { directory, path });
}

export async function fsWrite(
  directory: string,
  path: string,
  content: string,
  overwrite = false,
): Promise<void> {
  await harnessPost("/rpc/fs/write", { directory, path, content, overwrite });
}

export async function importFile(
  directory: string,
  path: string,
  contentBase64: string,
  overwrite = false,
): Promise<void> {
  await harnessPost("/rpc/import/file", { directory, path, contentBase64, overwrite });
}

export async function archiveCreate(
  directory: string,
  path: string,
  format: string,
): Promise<{ archive: string }> {
  return harnessPost<{ archive: string }>("/rpc/archive/create", { directory, path, format });
}

export async function archiveExtract(
  directory: string,
  path: string,
  dest?: string,
): Promise<{ dest: string }> {
  return harnessPost<{ dest: string }>("/rpc/archive/extract", { directory, path, dest });
}

export interface KnowledgeProject {
  slug: string;
  name: string;
  id?: string | null;
  tags?: string[] | null;
  created?: number | null;
  worktree: string;
  dirty?: boolean;
}

export async function listKnowledgeProjects(): Promise<KnowledgeProject[]> {
  const res = await fetch(`${harnessBase}/rpc/knowledge/list`);
  if (!res.ok) {
    throw new Error(`listKnowledgeProjects failed: ${res.status}`);
  }
  const data = (await res.json()) as { projects?: KnowledgeProject[] };
  return data.projects ?? [];
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export async function gitStatus(directory: string): Promise<GitFileStatus[]> {
  const res = await fetch(
    `${harnessBase}/rpc/git/status?directory=${encodeURIComponent(directory)}`,
  );
  if (!res.ok) {
    throw new Error(`gitStatus failed: ${res.status}`);
  }
  const data = (await res.json()) as { files?: GitFileStatus[] };
  return data.files ?? [];
}

export async function gitCommit(
  directory: string,
  message: string,
): Promise<{ committed: boolean }> {
  return harnessPost<{ committed: boolean }>("/rpc/git/commit", {
    directory,
    message,
  });
}

/** 專案中繼資料（`.owx-project.json` 擴充；缺欄由後端補預設）。 */
export interface ProjectProperties {
  id?: string | null;
  name?: string;
  name_en?: string | null;
  slug?: string;
  tags?: string[] | null;
  created?: number | null;
  properties?: string[];
  base_dirs?: {
    sample_ref?: string | null;
    enabled?: boolean;
    dirs?: string[];
  };
  writing_standard?: {
    versioning?: boolean;
    require_title?: boolean;
    require_revision?: boolean;
    require_change_log?: boolean;
    confidentiality_default?: string;
    compliance?: string[];
    submit_checks?: { consistency?: boolean; objectivity?: boolean; audit?: boolean };
  };
  params?: { show_hidden?: boolean; autosave_minutes?: number };
  worktree?: string;
}

/** 規範目錄條目（僅識別資料；NFR-22）。 */
export interface StandardEntry {
  id: string;
  name: string;
  title?: string;
  issuer?: string;
  year?: number;
  required?: boolean;
  license?: string;
  full_text_allowed?: boolean;
  acquisition?: string;
  source_url?: string;
}

export interface StandardCategory {
  id: string;
  name: string;
  required?: boolean;
  standards: StandardEntry[];
}

export interface BaseDirsCatalog {
  base_dirs: Record<string, { sample_ref: string; dirs: string[] }>;
  properties: string[];
}

async function harnessGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${harnessBase}${endpoint}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `harness ${endpoint}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function projectGet(directory: string): Promise<ProjectProperties> {
  return harnessGet<ProjectProperties>(
    `/rpc/project/get?directory=${encodeURIComponent(directory)}`,
  );
}

export async function projectUpdate(
  directory: string,
  patch: ProjectProperties,
): Promise<ProjectProperties> {
  return harnessPost<ProjectProperties>("/rpc/project/update", { directory, patch });
}

export async function projectBaseDirs(): Promise<BaseDirsCatalog> {
  return harnessGet<BaseDirsCatalog>("/rpc/project/base-dirs");
}

export interface AppliedBaseDirs {
  property: string;
  dirs: string[];
  created: string[];
  skipped: string[];
  failed: string[];
}

export async function projectApplyBaseDirs(
  directory: string,
  dirs: string[],
): Promise<AppliedBaseDirs> {
  return harnessPost<AppliedBaseDirs>("/rpc/project/base-dirs/apply", { directory, dirs });
}

export async function standardsList(): Promise<StandardCategory[]> {
  const data = await harnessGet<{ categories?: StandardCategory[] }>("/rpc/standards/list");
  return data.categories ?? [];
}

export async function standardsGet(id: string): Promise<{ id: string; content: string }> {
  return harnessGet<{ id: string; content: string }>(
    `/rpc/standards/get?id=${encodeURIComponent(id)}`,
  );
}

export type ThemeMode = "system" | "light" | "dark";

export interface GlobalSettings {
  systemName: string;
  knowledgeRoot: string | null;
  logo: string | null;
  accent: string | null;
  defaultProviderId: string | null;
  defaultModelId: string | null;
  defaultAgent: string | null;
}

export interface PersonalSettings {
  theme: ThemeMode;
}

export interface Settings {
  global: GlobalSettings;
  personal: PersonalSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  global: {
    systemName: "owx",
    knowledgeRoot: null,
    logo: null,
    accent: null,
    defaultProviderId: null,
    defaultModelId: null,
    defaultAgent: null,
  },
  personal: { theme: "system" },
};

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${harnessBase}/rpc/settings`);
  if (!res.ok) {
    throw new Error(`getSettings failed: ${res.status}`);
  }
  return (await res.json()) as Settings;
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  return harnessPost<Settings>("/rpc/settings", settings);
}

export async function uploadLogo(
  dataBase64: string,
  ext: string,
): Promise<{ logo: string }> {
  return harnessPost<{ logo: string }>("/rpc/settings/logo", { dataBase64, ext });
}

export function logoUrl(logo: string | null): string | null {
  return logo === null
    ? null
    : `${harnessBase}/rpc/settings/logo?v=${encodeURIComponent(logo)}`;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  models: ModelInfo[];
}

export interface ModelsCatalog {
  source: string;
  providers: ModelProvider[];
}

export async function listModels(): Promise<ModelsCatalog> {
  const res = await fetch(`${harnessBase}/rpc/models`);
  if (!res.ok) {
    throw new Error(`listModels failed: ${res.status}`);
  }
  return (await res.json()) as ModelsCatalog;
}

export async function listConnectedProviders(): Promise<string[]> {
  const res = await fetch(`${baseUrl}/provider`);
  if (!res.ok) {
    throw new Error(`listConnectedProviders failed: ${res.status}`);
  }
  const data = (await res.json()) as { connected?: string[] };
  return data.connected ?? [];
}

export async function setProviderApiKey(
  providerID: string,
  key: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/auth/${encodeURIComponent(providerID)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "api", key }),
  });
  if (!res.ok) {
    throw new Error(`setProviderApiKey failed: ${res.status}`);
  }
}

export async function setProviderBaseUrl(
  providerID: string,
  baseURL: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/global/config`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: { [providerID]: { options: { baseURL } } } }),
  });
  if (!res.ok) {
    throw new Error(`setProviderBaseUrl failed: ${res.status}`);
  }
}

export async function removeProviderAuth(providerID: string): Promise<void> {
  const res = await fetch(`${baseUrl}/auth/${encodeURIComponent(providerID)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`removeProviderAuth failed: ${res.status}`);
  }
}
