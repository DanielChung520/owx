import { useEffect, useMemo, useReducer, useState } from "react";
import { ActivityBar, type SidePanel } from "./components/ActivityBar";
import { DocumentOutline } from "./components/DocumentOutline";
import { DocumentPreview } from "./components/DocumentPreview";
import { FileExplorer } from "./components/FileExplorer";
import { DocEditor } from "./components/DocEditor";
import { FileIcon } from "./components/FileIcon";
import { Header } from "./components/Header";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { NewProjectModal } from "./components/NewProjectModal";
import { NodeMenu, type NodeMenuItem } from "./components/NodeMenu";
import { ProjectHome } from "./components/ProjectHome";
import { ProjectPropertyModal } from "./components/ProjectPropertyModal";
import { Resizer } from "./components/Resizer";
import { SettingsMenu, type SettingsItem } from "./components/SettingsMenu";
import { SettingsModal, type SettingsTab } from "./components/SettingsModal";
import { StandardsModal } from "./components/StandardsModal";
import {
  ACCOUNT_MAINTENANCE_ITEMS,
  FEATURE_MAINTENANCE_ITEMS,
  PlaceholderModal,
} from "./components/PlaceholderModal";
import {
  CHAT_DEFAULT,
  CHAT_MAX,
  CHAT_MIN,
  SIDE_DEFAULT,
  SIDE_MAX,
  SIDE_MIN,
  clamp,
} from "./lib/layout";
import {
  DEFAULT_SETTINGS,
  appInfo,
  archiveCreate,
  archiveExtract,
  createProject,
  createSession,
  currentProject,
  fsMkdir,
  fsWrite,
  findFiles,
  getSettings,
  gitCommit,
  gitStatus,
  harnessPost,
  importFile,
  listAgents,
  listDocStatus,
  listKnowledgeProjects,
  listMessages,
  listProviders,
  listSessions,
  listSkills,
  logoUrl,
  projectGet,
  readFileContent,
  runSessionCommand,
  saveSettings,
  sendMessageAsync,
  setSessionAgent,
  setSessionModel,
  toChatMessages,
  type CreatedProject,
  type FileEntry,
  type KnowledgeProject,
  type NewProjectInput,
  type ProviderGroup,
  type SessionSummary,
  type Settings,
} from "./lib/api";
import { runBuiltinCommand, type CommandDialogPayload } from "./lib/command-actions";
import type { PaletteCommand } from "./lib/commands";
import { chatReducer, initialChatState } from "./lib/chat";
import { baseName, isArchive, isMarkdown, joinPath } from "./lib/files";
import { parseOutline } from "./lib/outline";
import { useSessionStream } from "./lib/useSessionStream";

const DEFAULT_PROJECT = import.meta.env.VITE_OWX_PROJECT_DIR ?? "";

const HELP_TEXT =
  "指令：輸入框打「/」開指令面板；「@」引用檔案。\n活動列：Explorer／Outline／Knowledge Graph；底部 Settings。\n（更完整說明尚未實作。）";

const ABOUT_TEXT =
  "owx — 專門做「文件開發」的配套 AI agent chat。\n以文件為一等公民，agent 與人共編文件，並以標準為紀律。\n（第一階段）";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizePath(path: string): string {
  return path.startsWith("./") ? path.slice(2) : path;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function applySettings(settings: Settings): void {
  const el = document.documentElement;
  if (settings.personal.theme === "system") {
    delete el.dataset.theme;
  } else {
    el.dataset.theme = settings.personal.theme;
  }
  if (settings.global.accent !== null && settings.global.accent !== "") {
    el.style.setProperty("--accent", settings.global.accent);
  } else {
    el.style.removeProperty("--accent");
  }
  document.title = settings.global.systemName !== "" ? settings.global.systemName : "owx";
}

export function App(): JSX.Element {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CommandDialogPayload | null>(null);

  const [activeView, setActiveView] = useState<SidePanel>("explorer");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [docCollapsed, setDocCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(SIDE_DEFAULT);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [projects, setProjects] = useState<KnowledgeProject[]>([]);
  const [projectRoot, setProjectRoot] = useState<string>(DEFAULT_PROJECT);
  const [openDocs, setOpenDocs] = useState<{ path: string; content: string }[]>([]);
  const [activeDocPath, setActiveDocPath] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});
  const [homeMode, setHomeMode] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [standardsOpen, setStandardsOpen] = useState(false);
  const [nodeMenu, setNodeMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [projectShowHidden, setProjectShowHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [gitFiles, setGitFiles] = useState<Record<string, string>>({});
  const [settingsMenu, setSettingsMenu] = useState<{ left: number; bottom: number } | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [placeholder, setPlaceholder] = useState<{
    title: string;
    items: readonly string[];
  } | null>(null);
  const [docMenu, setDocMenu] = useState<{ x: number; y: number } | null>(null);

  useSessionStream(activeId, dispatch);

  const refreshSessions = async (): Promise<void> => {
    setSessions(await listSessions(projectRoot));
  };

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAgents();
        const primary = list
          .filter((item) => item.mode === "primary")
          .map((item) => item.name);
        setAgents(primary.length > 0 ? primary : list.map((item) => item.name));
      } catch (cause) {
        setError(describe(cause));
      }
      try {
        setProviders(await listProviders());
      } catch (cause) {
        setError(describe(cause));
      }
      try {
        setProjects(await listKnowledgeProjects());
      } catch (cause) {
        setError(describe(cause));
      }
      if (DEFAULT_PROJECT === "") {
        try {
          const current = await currentProject();
          if (current !== null) {
            setProjectRoot(current.worktree);
          }
        } catch {
          // 無目前專案時維持空根，由使用者以專案選單切換。
        }
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await getSettings();
        setSettings(loaded);
        applySettings(loaded);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listDocStatus();
        if (cancelled) {
          return;
        }
        const map: Record<string, string> = {};
        for (const entry of list) {
          map[normalizePath(entry.path)] = entry.state;
        }
        setDocStatus(map);
      } catch {
        if (!cancelled) {
          setDocStatus({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await gitStatus(projectRoot);
        if (cancelled) {
          return;
        }
        const map: Record<string, string> = {};
        for (const file of list) {
          map[file.path] = file.status;
        }
        setGitFiles(map);
      } catch {
        if (!cancelled) {
          setGitFiles({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectRoot, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    if (projectRoot === "") {
      setProjectShowHidden(false);
      return;
    }
    void (async () => {
      try {
        const meta = await projectGet(projectRoot);
        if (!cancelled) {
          setProjectShowHidden(meta.params?.show_hidden === true);
        }
      } catch {
        if (!cancelled) {
          setProjectShowHidden(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectRoot, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listSessions(projectRoot);
        if (!cancelled) {
          setSessions(list);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(describe(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeDoc = openDocs.find((item) => item.path === activeDocPath) ?? null;
  const outline = useMemo(
    () => (activeDoc === null ? [] : parseOutline(activeDoc.content)),
    [activeDoc],
  );

  const openFile = (entry: FileEntry): void => {
    setEditing(false);
    setActiveDocPath(entry.path);
    void (async () => {
      try {
        const content = await readFileContent(entry.path, projectRoot);
        setOpenDocs((prev) =>
          prev.some((item) => item.path === entry.path)
            ? prev.map((item) =>
                item.path === entry.path ? { path: entry.path, content } : item,
              )
            : [...prev, { path: entry.path, content }],
        );
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const updateDocContent = (path: string, content: string): void => {
    setOpenDocs((prev) =>
      prev.map((item) => (item.path === path ? { path, content } : item)),
    );
  };

  const closeDoc = (path: string): void => {
    const next = openDocs.filter((item) => item.path !== path);
    setOpenDocs(next);
    if (activeDocPath === path) {
      setActiveDocPath(next[next.length - 1]?.path ?? null);
    }
  };

  const closeAllDocs = (): void => {
    setOpenDocs([]);
    setActiveDocPath(null);
  };

  const scrollToHeading = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openProject = (worktree: string): void => {
    setProjectRoot(worktree);
    closeAllDocs();
    setActiveId(null);
    dispatch({ type: "clear" });
    setHomeMode(false);
  };

  const closeProject = (): void => {
    setProjectRoot("");
    closeAllDocs();
    setActiveId(null);
    dispatch({ type: "clear" });
    setHomeMode(true);
  };

  const handleCreateProject = async (
    input: NewProjectInput,
  ): Promise<CreatedProject> => {
    const created = await createProject(input);
    setShowNewProject(false);
    setProjects(await listKnowledgeProjects().catch(() => projects));
    setProjectRoot(created.worktree);
    closeAllDocs();
    setHomeMode(false);
    try {
      const sessionId = await createSession(created.worktree);
      setActiveId(sessionId);
      applySessionDefaults(sessionId);
      await runSessionCommand(sessionId, "init");
      setNotice("專案已建立，並已執行 /init");
    } catch {
      setNotice("專案已建立；/init 未執行（可稍後手動）");
    }
    return created;
  };

  const refreshTree = (): void => setReloadKey((value) => value + 1);

  const noticeOrError = (cause: unknown): void => {
    const message = cause instanceof Error ? cause.message : String(cause);
    setNotice(message === "not_configured" ? "此功能尚未設置（佔位）" : message);
  };

  const createFolder = (entry: FileEntry): void => {
    const name = window.prompt("資料夾名稱");
    if (name === null || name.trim() === "") {
      return;
    }
    void (async () => {
      try {
        await fsMkdir(projectRoot, joinPath(entry.path, name.trim()));
        refreshTree();
        setNotice("已建立資料夾");
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const createDoc = (entry: FileEntry): void => {
    const name = window.prompt("文件名稱（預設 .md）", "untitled.md");
    if (name === null || name.trim() === "") {
      return;
    }
    const trimmed = name.trim();
    const fileName = trimmed.includes(".") ? trimmed : `${trimmed}.md`;
    void (async () => {
      try {
        await fsWrite(projectRoot, joinPath(entry.path, fileName), `# ${fileName.replace(/\.md$/i, "")}\n`);
        refreshTree();
        setNotice("已建立文檔");
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const importInto = (entry: FileEntry): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file === undefined) {
        return;
      }
      void (async () => {
        try {
          const base64 = arrayBufferToBase64(await file.arrayBuffer());
          await importFile(projectRoot, joinPath(entry.path, file.name), base64);
          refreshTree();
          setNotice(`已匯入 ${file.name}`);
        } catch (cause) {
          noticeOrError(cause);
        }
      })();
    };
    input.click();
  };

  const copyPath = (entry: FileEntry, absolute: boolean): void => {
    const value = absolute ? entry.absolute : entry.path;
    void navigator.clipboard.writeText(value).then(
      () => setNotice(`已複製：${value}`),
      () => setNotice("複製失敗"),
    );
  };

  const packageNode = (entry: FileEntry): void => {
    const format = window.prompt("格式（zip / tar.gz / tar）", "zip");
    if (format === null || format.trim() === "") {
      return;
    }
    void (async () => {
      try {
        const result = await archiveCreate(
          projectRoot,
          entry.path.replace(/\/$/, ""),
          format.trim(),
        );
        refreshTree();
        setNotice(`已打包：${result.archive}`);
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const unpackNode = (entry: FileEntry): void => {
    void (async () => {
      try {
        const result = await archiveExtract(projectRoot, entry.path);
        refreshTree();
        setNotice(`已解封裝：${result.dest}`);
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const placeholderOp = (
    label: string,
    endpoint: string,
    body: Record<string, unknown>,
  ): void => {
    void (async () => {
      try {
        await harnessPost(endpoint, { directory: projectRoot, ...body });
        setNotice(`${label} 完成`);
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const nodeMenuGroups = (entry: FileEntry): NodeMenuItem[][] => {
    const create: NodeMenuItem[] = [];
    if (entry.type === "directory") {
      create.push({ label: "建立資料夾", onSelect: () => createFolder(entry) });
      create.push({ label: "建立文檔", onSelect: () => createDoc(entry) });
    }
    const io: NodeMenuItem[] = [];
    if (entry.type === "directory") {
      io.push({ label: "匯入檔案", onSelect: () => importInto(entry) });
    }
    io.push({
      label: "匯出",
      onSelect: () => placeholderOp("匯出", "/rpc/export/filer", { path: entry.path }),
    });
    const pack: NodeMenuItem[] = [{ label: "打包", onSelect: () => packageNode(entry) }];
    if (entry.type === "file" && isArchive(entry.path)) {
      pack.push({ label: "解封裝", onSelect: () => unpackNode(entry) });
    }
    pack.push({
      label: "轉換格式",
      onSelect: () => placeholderOp("轉換", "/rpc/convert", { path: entry.path, to: "pdf" }),
    });
    pack.push({
      label: "分享",
      onSelect: () => placeholderOp("分享", "/rpc/share", { paths: [entry.path] }),
    });
    const paths: NodeMenuItem[] = [
      { label: "複製相對路徑", onSelect: () => copyPath(entry, false) },
      { label: "複製絕對路徑", onSelect: () => copyPath(entry, true) },
    ];
    return [create, io, pack, paths].filter((group) => group.length > 0);
  };

  const checkVersion = (): void => {
    void (async () => {
      try {
        const info = await appInfo();
        setDialog({ title: "檢查版本", body: JSON.stringify(info, null, 2) });
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const commitAll = (): void => {
    const message = window.prompt("提交訊息", "update documents");
    if (message === null || message.trim() === "") {
      return;
    }
    void (async () => {
      try {
        const result = await gitCommit(projectRoot, message.trim());
        setNotice(result.committed === true ? "已提交所有變更" : "沒有需要提交的變更");
        refreshTree();
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const search = (): void => {
    const query = window.prompt("搜尋檔名");
    if (query === null || query.trim() === "") {
      return;
    }
    void (async () => {
      try {
        const files = await findFiles(query.trim());
        setDialog({
          title: `搜尋：${query.trim()}`,
          body: files.length > 0 ? files.join("\n") : "（無結果）",
        });
      } catch (cause) {
        noticeOrError(cause);
      }
    })();
  };

  const openSettings = (tab: SettingsTab): void => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const settingsItems: SettingsItem[] = [
    {
      key: "S",
      label: "系統設置",
      onSelect: () => openSettings("general"),
    },
    {
      key: "D",
      label: "標準規範",
      onSelect: () => setStandardsOpen(true),
    },
    {
      key: "F",
      label: "功能維護",
      onSelect: () => setPlaceholder({ title: "功能維護", items: FEATURE_MAINTENANCE_ITEMS }),
    },
    {
      key: "A",
      label: "賬號維護",
      onSelect: () => setPlaceholder({ title: "賬號維護", items: ACCOUNT_MAINTENANCE_ITEMS }),
    },
    {
      key: "K",
      label: "技能",
      onSelect: () => {
        void (async () => {
          try {
            const skills = await listSkills();
            setDialog({ title: "技能", body: JSON.stringify(skills, null, 2) });
          } catch (cause) {
            noticeOrError(cause);
          }
        })();
      },
    },
    {
      key: "R",
      label: "權限管理",
      onSelect: () => setDialog({ title: "權限管理", body: "尚未實作（佔位）。" }),
    },
    { key: "C", label: "檢查版本", onSelect: checkVersion },
    {
      key: "H",
      label: "幫助",
      onSelect: () => setDialog({ title: "幫助", body: HELP_TEXT }),
    },
    {
      key: "O",
      label: "關於",
      onSelect: () => setDialog({ title: "關於 owx", body: ABOUT_TEXT }),
    },
  ];

  const selectSession = (id: string): void => {
    if (id === "") {
      setActiveId(null);
      dispatch({ type: "clear" });
      return;
    }
    setActiveId(id);
    void (async () => {
      try {
        const envelopes = await listMessages(id);
        dispatch({ type: "hydrate", messages: toChatMessages(envelopes) });
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const applySessionDefaults = (id: string): void => {
    const { defaultProviderId, defaultModelId, defaultAgent } = settings.global;
    if (defaultProviderId !== null && defaultModelId !== null) {
      void setSessionModel(id, defaultProviderId, defaultModelId).catch(() => {});
    }
    if (defaultAgent !== null) {
      void setSessionAgent(id, defaultAgent).catch(() => {});
    }
  };

  const newSession = (): void => {
    void (async () => {
      try {
        const id =     await createSession(projectRoot);
        setActiveId(id);
        applySessionDefaults(id);
        dispatch({ type: "clear" });
        await refreshSessions();
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const handleSend = (text: string): void => {
    void (async () => {
      try {
        let id = activeId;
        if (id === null) {
          id =     await createSession(projectRoot);
          setActiveId(id);
          applySessionDefaults(id);
        }
        await sendMessageAsync(id, text);
        await refreshSessions();
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const changeAgent = (name: string): void => {
    if (activeId === null) {
      return;
    }
    void (async () => {
      try {
        await setSessionAgent(activeId, name);
        await refreshSessions();
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const changeModel = (providerID: string, id: string): void => {
    if (activeId === null) {
      return;
    }
    void (async () => {
      try {
        await setSessionModel(activeId, providerID, id);
        await refreshSessions();
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const toggleTheme = (): void => {
    const el = document.documentElement;
    const isDark =
      el.dataset.theme !== undefined
        ? el.dataset.theme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next: Settings = {
      ...settings,
      personal: { theme: isDark ? "light" : "dark" },
    };
    applySettings(next);
    setSettings(next);
    void saveSettings(next).catch(() => {});
  };

  const darkTheme =
    settings.personal.theme === "dark" ||
    (settings.personal.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const focusSelector = (selector: string): void => {
    document.querySelector<HTMLElement>(selector)?.focus();
  };

  const selectPanel = (panel: SidePanel): void => {
    if (panel === activeView && !leftCollapsed) {
      setLeftCollapsed(true);
      return;
    }
    setActiveView(panel);
    setLeftCollapsed(false);
  };

  const toggleChat = (): void => {
    if (chatCollapsed) {
      setChatCollapsed(false);
      return;
    }
    setChatCollapsed(true);
    setDocCollapsed(false);
  };

  const toggleDoc = (): void => {
    if (docCollapsed) {
      setDocCollapsed(false);
      return;
    }
    setDocCollapsed(true);
    setChatCollapsed(false);
  };

  const runCommand = (command: PaletteCommand): void => {
    void (async () => {
      try {
        await runBuiltinCommand(command.id, {
          activeSessionId: activeId,
          newSession: async () => {
            const id =     await createSession(projectRoot);
            setActiveId(id);
            dispatch({ type: "clear" });
            return id;
          },
          refreshSessions,
          setNotice,
          openDialog: (payload) => setDialog(payload),
          toggleTheme,
          focus: focusSelector,
          goHome: () => {
            setActiveId(null);
            dispatch({ type: "clear" });
          },
          getMessages: () => state.messages,
        });
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const active = sessions.find((session) => session.id === activeId) ?? null;
  const modelValue =
    active?.model !== undefined && active.model.id !== undefined
      ? `${active.model.providerID ?? ""}/${active.model.id}`
      : undefined;
  const docState = activeDoc === null ? undefined : docStatus[normalizePath(activeDoc.path)];
  const editingDoc = editing && activeDoc !== null ? activeDoc : null;

  const newProjectModal = showNewProject ? (
    <NewProjectModal
      onCancel={() => setShowNewProject(false)}
      onCreate={handleCreateProject}
    />
  ) : null;

  const propertyModal =
    showProjectSettings && projectRoot !== "" ? (
      <ProjectPropertyModal
        directory={projectRoot}
        onClose={() => setShowProjectSettings(false)}
        onSaved={(notice) => {
          setNotice(notice);
          setReloadKey((key) => key + 1);
        }}
      />
    ) : null;

  if (homeMode) {
    return (
      <div className="project-home-wrap">
        <ProjectHome
          projects={projects}
          currentRoot={projectRoot}
          systemName={settings.global.systemName}
          logoSrc={logoUrl(settings.global.logo)}
          onOpen={openProject}
          onNew={() => setShowNewProject(true)}
        />
        {newProjectModal}
      </div>
    );
  }

  return (
    <div className="app">
      <ActivityBar
        active={activeView}
        collapsed={leftCollapsed}
        dark={darkTheme}
        onSelect={selectPanel}
        onProfile={() => openSettings("appearance")}
        onTheme={toggleTheme}
        onSettingsMenu={(anchor) =>
          setSettingsMenu({
            left: anchor.right + 6,
            bottom: window.innerHeight - anchor.bottom + 4,
          })
        }
      />
      {!leftCollapsed ? (
        <aside className="side-panel" style={{ width: leftWidth }} aria-label="側欄">
          {activeView === "explorer" ? (
          <FileExplorer
            root={projectRoot}
            projectName={
              projects.find((project) => project.worktree === projectRoot)?.name ?? ""
            }
            reloadKey={reloadKey}
            showHidden={projectShowHidden}
            gitFiles={gitFiles}
            onSelect={openFile}
            onNodeContext={(entry, x, y) => setNodeMenu({ entry, x, y })}
            onOpenProject={() => setHomeMode(true)}
            onNewProject={() => setShowNewProject(true)}
            onCloseProject={closeProject}
            onPropertySettings={() => setShowProjectSettings(true)}
          />
        ) : activeView === "outline" ? (
          <div className="outline-panel">
            <div className="panel-header">
              <span className="panel-title">大綱</span>
            </div>
            <DocumentOutline items={outline} onSelect={scrollToHeading} />
          </div>
        ) : (
          <div className="placeholder-panel">
            <div className="panel-header">
              <span className="panel-title">知識圖譜</span>
            </div>
            <p className="panel-empty">Knowledge Graph 尚未實作（佔位）。</p>
          </div>
        )}
        </aside>
      ) : null}
      {!leftCollapsed && !docCollapsed ? (
        <Resizer
          label="調整側欄寬度"
          onResize={(delta) =>
            setLeftWidth((width) => clamp(width + delta, SIDE_MIN, SIDE_MAX))
          }
        />
      ) : null}
      {!docCollapsed ? (
        <section className="doc-region" aria-label="文件預覽">
          <div className="doc-tabs" role="tablist">
            {openDocs.length === 0 ? (
              <span className="doc-tabs-empty">未開啟文件</span>
            ) : (
              openDocs.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  role="tab"
                  aria-selected={item.path === activeDocPath}
                  className={`doc-tab${item.path === activeDocPath ? " active" : ""}`}
                  onClick={() => {
                    setActiveDocPath(item.path);
                    setEditing(false);
                  }}
                >
                  <FileIcon name={baseName(item.path)} type="file" />
                  <span className="doc-tab-name">{baseName(item.path)}</span>
                  <span
                    className="doc-tab-close"
                    role="button"
                    aria-label={`關閉 ${baseName(item.path)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeDoc(item.path);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))
            )}
            <div className="doc-tabs-actions">
              {docState !== undefined ? (
                <span className="doc-badge">{docState}</span>
              ) : null}
              {activeDoc !== null && isMarkdown(activeDoc.path) && editingDoc === null ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="編輯"
                  title="編輯"
                  onClick={() => setEditing(true)}
                >
                  編輯
                </button>
              ) : null}
              <button
                type="button"
                className="icon-btn"
                aria-haspopup="menu"
                aria-label="文件選單"
                title="文件選單"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDocMenu({ x: rect.right - 160, y: rect.bottom + 4 });
                }}
              >
                ⋯
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={chatCollapsed ? "顯示 Chat" : "隱藏 Chat"}
                title={chatCollapsed ? "顯示 Chat" : "隱藏 Chat"}
                onClick={toggleChat}
              >
                {chatCollapsed ? "«" : "»"}
              </button>
            </div>
          </div>
          {editingDoc !== null ? (
            <DocEditor
              path={editingDoc.path}
              initial={editingDoc.content}
              onSave={async (content) => {
                await fsWrite(projectRoot, editingDoc.path, content, true);
                updateDocContent(editingDoc.path, content);
                setEditing(false);
                refreshTree();
                setNotice("已儲存");
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <DocumentPreview path={activeDoc?.path ?? null} content={activeDoc?.content ?? null} />
          )}
        </section>
      ) : null}
      {!docCollapsed && !chatCollapsed ? (
        <Resizer
          label="調整 Chat 寬度"
          onResize={(delta) =>
            setChatWidth((width) => clamp(width - delta, CHAT_MIN, CHAT_MAX))
          }
        />
      ) : null}
      {!chatCollapsed ? (
        <section
          className="chat-region"
          style={docCollapsed ? { flex: "1 1 0" } : { width: chatWidth }}
          aria-label="opencode agent 聊天"
        >
          <Header
            status={state.status}
            agent={active?.agent}
            model={modelValue}
            agents={agents}
            providers={providers}
            sessions={sessions}
            activeId={activeId}
            docCollapsed={docCollapsed}
            onAgent={changeAgent}
            onModel={changeModel}
            onSelectSession={selectSession}
            onNewSession={newSession}
            onToggleDoc={toggleDoc}
          />
          {error !== null ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {notice !== null ? (
            <p className="notice" role="status">
              {notice}
            </p>
          ) : null}
          <MessageList messages={state.messages} busy={state.busy} />
          <MessageInput
            disabled={state.status !== "live"}
            onSend={handleSend}
            onCommand={runCommand}
          />
        </section>
      ) : null}
      {newProjectModal}
      {propertyModal}
      {docMenu !== null ? (
        <NodeMenu
          x={docMenu.x}
          y={docMenu.y}
          groups={[
            [
              { label: "關閉全部文件", onSelect: closeAllDocs },
              { label: "文件全部提交", onSelect: commitAll },
              { label: "搜尋", onSelect: search },
            ],
          ]}
          onClose={() => setDocMenu(null)}
        />
      ) : null}
      {settingsMenu !== null ? (
        <SettingsMenu
          left={settingsMenu.left}
          bottom={settingsMenu.bottom}
          items={settingsItems}
          onClose={() => setSettingsMenu(null)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          providers={providers}
          agents={agents}
          initialParamTab={settingsTab}
          onSave={async (next) => {
            const saved = await saveSettings(next);
            setSettings(saved);
            applySettings(saved);
            setNotice("已儲存設定");
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {standardsOpen ? <StandardsModal onClose={() => setStandardsOpen(false)} /> : null}
      {placeholder !== null ? (
        <PlaceholderModal
          title={placeholder.title}
          items={placeholder.items}
          onClose={() => setPlaceholder(null)}
        />
      ) : null}
      {nodeMenu !== null ? (
        <NodeMenu
          x={nodeMenu.x}
          y={nodeMenu.y}
          groups={nodeMenuGroups(nodeMenu.entry)}
          onClose={() => setNodeMenu(null)}
        />
      ) : null}
      {dialog !== null ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setDialog(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialog.title}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="modal-title">{dialog.title}</h2>
            <pre className="modal-body">{dialog.body}</pre>
            <button
              type="button"
              className="modal-close"
              onClick={() => setDialog(null)}
            >
              關閉
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
