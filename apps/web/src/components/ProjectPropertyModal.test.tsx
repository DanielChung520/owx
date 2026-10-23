import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectPropertyModal, describeApply, parseTags } from "./ProjectPropertyModal";

describe("ProjectPropertyModal", () => {
  it("renders the four nav tabs and a loading state", () => {
    const html = renderToStaticMarkup(
      <ProjectPropertyModal directory="/tmp/know/demo" onClose={() => {}} onSaved={() => {}} />,
    );
    for (const label of ["基本資料", "基礎目錄範例", "文件撰寫規範", "參數"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("載入中");
  });

  it("parseTags trims, drops empties and dedupes", () => {
    expect(parseTags(" finance, research, , finance ")).toEqual(["finance", "research"]);
    expect(parseTags("")).toEqual([]);
  });

  it("describeApply summarises created, skipped and failed dirs", () => {
    expect(
      describeApply({
        property: "研究專案",
        dirs: ["research", "notes", "data"],
        created: ["notes"],
        skipped: ["research"],
        failed: ["data"],
      }),
    ).toBe("已建立：notes；已存在（略過）：research；未建立：data");
    expect(
      describeApply({
        property: "研究專案",
        dirs: ["research"],
        created: [],
        skipped: ["research"],
        failed: [],
      }),
    ).toBe("已存在（略過）：research");
    expect(
      describeApply({ property: "", dirs: [], created: [], skipped: [], failed: [] }),
    ).toBe("沒有需要建立的資料夾。");
  });
});
