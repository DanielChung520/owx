import {
  Button,
  ConfigProvider,
  Form,
  Input,
  Space,
  Typography,
  message,
  theme,
} from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/common/Logo";
import { useAuthStore } from "@/stores/auth";

/**
 * 登錄頁（/auth/login，獨立全螢幕）
 * - 與歡迎頁同背景：/background-1.png（cover）
 * - 中央毛玻璃卡：backdrop-filter blur + var(--kac-welcome-glass-bg)（固定淺色），水平垂直置中
 * - 表單元件固定淺色（ConfigProvider defaultAlgorithm，不隨系統主題）
 * - 測試期帳密 admin/admin123（Phase 1 真實 auth 後移除）
 * - 登錄成功 → 進入工作台（/）
 */

// mock 登入憑證（測試期專用，Phase 1 換真實 auth）
// 密碼驗證走後端 /api/auth/login（admin123 / 臨時密碼 / 變更後密碼）
const ADMIN_ACCOUNT = import.meta.env.VITE_ADMIN_ACCOUNT || "admin";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleFinish = async (v: { email: string; password: string }) => {
    try {
      // 後端驗證（規格 accounts-management.md §10.3）：回傳 user + mustChangePassword
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: v.email, password: v.password }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          user: {
            id: string;
            email: string;
            displayName: string;
            globalRole: string;
            status: string;
          };
          mustChangePassword: boolean;
        };

        const username = v.email.split("@")[0] || v.email;
        const isAdmin = username === ADMIN_ACCOUNT;
        login({
          id: data.user.id,
          email: v.email,
          displayName: username,
          isAdmin,
          mustChangePassword: data.mustChangePassword,
        });

        if (data.mustChangePassword) {
          navigate("/auth/reset");
        } else {
          navigate("/");
        }
        return;
      }
    } catch {
      // fall through to mock
    }

    // 開發用測試帳號
    if ((v.email === "admin" || v.email === "admin@owx.local") && v.password === "admin123") {
      login({
        id: "admin",
        email: v.email.includes("@") ? v.email : "admin@owx.local",
        displayName: "admin",
        isAdmin: true,
        mustChangePassword: false,
      });
      navigate("/");
      return;
    }
    message.error(t("auth.invalidCredentials"));
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url('/background-1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
      }}
    >
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <div
          data-testid="login-glass-card"
          style={{
            width: 420,
            padding: "48px 40px",
            borderRadius: 32,
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            background: "var(--kac-welcome-glass-bg)",
            border: "1px solid var(--kac-shell-border)",
            boxShadow: "0 8px 32px var(--kac-shell-shadow)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Logo size={56} onClick={() => navigate("/welcome")} />
          <Typography.Title
            level={3}
            style={{ margin: 0, color: "var(--kac-welcome-text)" }}
          >
            {t("auth.login")}
          </Typography.Title>
          <Form
            layout="vertical"
            style={{ width: "100%" }}
            onFinish={handleFinish}
          >
            <Form.Item
              label={t("auth.username")}
              name="email"
              rules={[{ required: true }]}
            >
              <Input placeholder="admin" data-testid="login-email" />
            </Form.Item>
            <Form.Item
              label={t("auth.password")}
              name="password"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password data-testid="login-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space
                orientation="vertical"
                style={{ width: "100%" }}
                size="small"
              >
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  data-testid="login-submit"
                >
                  {t("auth.submit")}
                </Button>
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 12, textAlign: "center" }}
                >
                  {t("auth.loginHint")}
                </Typography.Text>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </ConfigProvider>
    </div>
  );
}
