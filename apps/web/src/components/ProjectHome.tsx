import type { KnowledgeProject } from "../lib/api";

export function ProjectHome({
  projects,
  currentRoot,
  onOpen,
  onNew,
}: {
  projects: readonly KnowledgeProject[];
  currentRoot: string;
  onOpen: (worktree: string) => void;
  onNew: () => void;
}): JSX.Element {
  return (
    <div className="project-home">
      <header className="home-header">
        <span className="brand">owx</span>
        <h1 className="home-title">專案</h1>
        <button type="button" className="btn-primary" onClick={onNew}>
          + 新增專案
        </button>
      </header>
      {projects.length === 0 ? (
        <p className="home-empty">尚無專案。建立第一個文件專案（將建於 ~/knowledge）。</p>
      ) : (
        <ul className="project-grid">
          {projects.map((project) => {
            const tags = project.tags ?? [];
            return (
              <li key={project.slug}>
                <button
                  type="button"
                  className={`project-card${project.worktree === currentRoot ? " current" : ""}${
                    project.dirty === true ? " dirty" : ""
                  }`}
                  onClick={() => onOpen(project.worktree)}
                >
                  <span className="card-name">{project.name}</span>
                  {tags.length > 0 ? (
                    <span className="card-tags">
                      {tags.map((tag) => (
                        <span key={tag} className="card-tag">
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
