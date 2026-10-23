import { useUIStore } from "@/stores/ui";
import { useSystemConfig } from "@/api/systemConfig";

interface LogoProps {
  size?: number;
  onClick?: () => void;
  /** 指定圖片來源（預設 config.logo 或 /logo-small.png） */
  src?: string;
  /** 顯示系統名稱文字於 logo 右側（Header 用；歡迎頁大 logo 不顯示） */
  showText?: boolean;
}

export function Logo({ size = 28, onClick, src, showText }: LogoProps) {
  const themeMode = useUIStore((s) => s.theme);
  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const { data: config } = useSystemConfig();
  const systemName = config?.system_name || "KAC";
  const logoSrc = src || config?.logo || "/logo-small.png";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      data-testid="app-logo"
    >
      <img
        src={logoSrc}
        alt={systemName}
        width={size}
        height={size}
        style={{
          objectFit: "contain",
          borderRadius: 6,
          filter: isDark ? "none" : "none",
        }}
      />
      {showText && (
        <span style={{ fontWeight: 600, fontSize: 15, color: "inherit" }}>
          {systemName}
        </span>
      )}
    </span>
  );
}
