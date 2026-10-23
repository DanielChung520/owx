// owx licensing policy (AGENTS.md §2): only MIT / Apache-2.0 / BSD code may enter
// deliverables. `mermaid` depends on `elkjs` (EPL-2.0) for its OPTIONAL "elk"
// layout, so pnpm.overrides installs this MIT placeholder instead of the real
// package. Mermaid's default dagre layout never loads this module; only diagrams
// that explicitly request `layout: elk` reach it and fail with the message below.

export const ELK_UNAVAILABLE_MESSAGE =
  "ELK layout 未提供：elkjs 為 EPL-2.0，與 owx 授權政策（僅 MIT/Apache/BSD）不相容；請改用預設 dagre layout。";

export default class ElkUnavailable {
  constructor() {
    throw new Error(ELK_UNAVAILABLE_MESSAGE);
  }
}
