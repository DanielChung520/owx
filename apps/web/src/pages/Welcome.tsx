import { Button, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Logo } from "@/components/common/Logo";
import { useSystemConfig } from "@/api/systemConfig";
import { useAuthStore } from "@/stores/auth";

/**
 * 歡迎頁（/welcome，獨立全螢幕）
 * - 背景：/background-1.png（cover）
 * - 中央玻璃卡（2x 尺寸）：backdrop-filter blur + var(--kac-welcome-glass-bg)（固定淺色）
 * - Logo 進場動畫：2x → 目前大小縮放（.welcome__logo，keyframes 在 global.css）
 * - 標題：知識資產中心 + Knowledge Assets Center 隔行顯示
 * - 登錄按鈕：已有賬號（user）→ 進入工作台；否則 → 登錄頁
 */
export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: config } = useSystemConfig();

  useEffect(() => {
    if (config?.system_name) document.title = config.system_name;
  }, [config?.system_name]);

  const handleAuth = () => {
    if (user) {
      navigate("/");
    } else {
      navigate("/auth/login");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url('/background-1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
      }}
    >
      <div
        data-testid="welcome-glass-card"
        style={{
          width: 960,
          minHeight: 560,
          padding: "72px 64px",
          borderRadius: 40,
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          background: "var(--kac-welcome-glass-bg)",
          border: "1px solid var(--kac-shell-border)",
          boxShadow: "0 8px 32px var(--kac-shell-shadow)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          textAlign: "center",
        }}
      >
        <div className="welcome__logo">
          <Logo size={144} src="/logo-welcome.png" />
        </div>
        <Space orientation="vertical" size={4} style={{ alignItems: "center" }}>
          <Typography.Title
            level={1}
            className="welcome__subtitle-zh"
            style={{ margin: 0, fontSize: 60 }}
            data-testid="welcome-subtitle-zh"
          >
            {t("welcome.subtitleZh")}
          </Typography.Title>
          <Typography.Title
            level={3}
            style={{
              margin: 0,
              color: "var(--kac-welcome-text-secondary)",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
            data-testid="welcome-subtitle-en"
          >
            {t("welcome.subtitleEn")}
          </Typography.Title>
        </Space>
        <Space size="middle" wrap style={{ justifyContent: "center" }}>
          <Button
            type="primary"
            size="large"
            data-testid="welcome-login"
            onClick={handleAuth}
          >
            {user ? t("welcome.enter") : t("auth.login")}
          </Button>
        </Space>
      </div>
      <Typography.Text
        style={{
          position: "absolute",
          bottom: 16,
          color: "var(--kac-welcome-text-secondary)",
          fontSize: 12,
        }}
      >
        KAC v0.1.0 © 2026
      </Typography.Text>
    </div>
  );
}
