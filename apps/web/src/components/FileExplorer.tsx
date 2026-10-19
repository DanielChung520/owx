import { useEffect, useState } from "react";
import { listDirectory, type FileEntry } from "../lib/api";
import { FileIcon } from "./FileIcon";
import { ProjectMenu } from "./ProjectMenu";

function projectLabel(worktree: string): string {
  const parts = worktree.split("/").filter((part) => part !== "");
  return parts[parts.length - 1] ?? worktree;
}

function TreeNode({
  entry,
  root,
  gitFiles,
  onSelect,
  onNodeContext,
}: {
  entry: FileEntry;
  root: string;
  gitFiles: Record<string, string>;
  onSelect: (entry: FileEntry) => void;
  onNodeContext: (entry: FileEntry, x: number, y: number) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState(false);

  const toggle = (): void => {
    if (entry.type !== "directory") {
      onSelect(entry);
      return;
    }
    const next = !open;
    setOpen(next);
    if (next && children === null) {
      void (async () => {
        try {
          setChildren(await listDirectory(entry.path, root));
        } catch {
          setError(true);
        }
      })();
    }
  };

  return (
    <li className="tree-node">
      <button
        type="button"
        className="tree-row"
        onClick={toggle}
        onContextMenu={(event) => {
          event.preventDefault();
          onNodeContext(entry, event.clientX, event.clientY);
        }}
      >
        <span className="tree-caret">
          {entry.type === "directory" ? (open ? "▾" : "▸") : ""}
        </span>
        <FileIcon name={entry.name} type={entry.type} />
        <span
          className={`tree-name${entry.ignored === true ? " ignored" : ""}${
            gitFiles[entry.path] !== undefined ? ` git-${gitFiles[entry.path]}` : ""
          }`}
        >
          {entry.name}
        </span>
      </button>
      {error ? <p className="tree-error">讀取失敗</p> : null}
      {open && children !== null ? (
        <ul className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              root={root}
              gitFiles={gitFiles}
              onSelect={onSelect}
              onNodeContext={onNodeContext}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FileExplorer({
  root,
  projectName,
  reloadKey,
  gitFiles,
  onSelect,
  onNodeContext,
  onOpenProject,
  onNewProject,
  onCloseProject,
}: {
  root: string;
  projectName: string;
  reloadKey: number;
  gitFiles: Record<string, string>;
  onSelect: (entry: FileEntry) => void;
  onNodeContext: (entry: FileEntry, x: number, y: number) => void;
  onOpenProject: () => void;
  onNewProject: () => void;
  onCloseProject: () => void;
}): JSX.Element {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries([]);
    setError(null);
    void (async () => {
      try {
        const list = await listDirectory(".", root);
        if (!cancelled) {
          setEntries(list);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [root, reloadKey]);

  return (
    <div className="explorer">
      <div className="panel-header project-bar">
        <span className="project-name" title={root}>
          {root === ""
            ? "無專案"
            : `${projectName !== "" ? projectName : projectLabel(root)} [${projectLabel(root)}]`}
        </span>
        <ProjectMenu
          onOpen={onOpenProject}
          onNew={onNewProject}
          onClose={onCloseProject}
        />
      </div>
      {error !== null ? <p className="panel-empty">{error}</p> : null}
      <ul className="tree">
        {entries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            root={root}
            gitFiles={gitFiles}
            onSelect={onSelect}
            onNodeContext={onNodeContext}
          />
        ))}
      </ul>
    </div>
  );
}
