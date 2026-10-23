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
import { useEffect } from "react";
import { Logo } from "@/components/common/Logo";
import { useAuthStore } from "@/stores/auth";
import { useChangePassword } from "@/api/accounts";

/**
 * 重設密碼頁（/auth/reset，獨立全螢幕）
 * 對應規格 accounts-management.md §10：臨時密碼登入後強制變更
 *
 * - 進入條件：mustChangePassword = true（Login 導向）
 * - 驗證：新密碼 ≥8 + 大寫 + 小寫 + 數字 + 特殊字元（FC-01-007）
 * - 成功：清臨時密碼 + mustChangePassword=false + status=active → 進入工作台
 */
export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const changePassword = useChangePassword();

  // 未登入（或無 mustChangePassword）→ 回登錄頁
  useEffect(() => {
    if (!user) navigate("/auth/login");
  }, [user, navigate]);

  const handleFinish = (v: { newPassword: string; confirm: string }) => {
    if (!user) return;
    if (v.newPassword !== v.confirm) {
      message.error("兩次輸入的密碼不一致");
      return;
    }
    changePassword.mutate(
      { id: user.id, newPassword: v.newPassword },
      {
        onSuccess: () => {
          message.success("密碼已變更，帳號已啟用");
          // 清除 mustChangePassword 標記 + 進入工作台
          useAuthStore.getState().login({ ...user, mustChangePassword: false });
          navigate("/");
        },
        onError: (e) => message.error(`密碼變更失敗：${e.message}`),
      },
    );
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
          data-testid="reset-glass-card"
          style={{
            width: 460,
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
            變更密碼
          </Typography.Title>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 13, textAlign: "center" }}
          >
            您正使用臨時密碼登入，請設定新密碼以啟用帳號。
          </Typography.Text>
          <Form
            layout="vertical"
            style={{ width: "100%" }}
            onFinish={handleFinish}
          >
            <Form.Item
              label="新密碼"
              name="newPassword"
              rules={[
                { required: true },
                { min: 8, message: "密碼長度需 ≥8 字元" },
              ]}
              extra="至少 8 字元，需含大寫、小寫、數字、特殊字元"
            >
              <Input.Password data-testid="reset-new-password" />
            </Form.Item>
            <Form.Item
              label="確認新密碼"
              name="confirm"
              rules={[{ required: true }]}
            >
              <Input.Password data-testid="reset-confirm-password" />
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
                  loading={changePassword.isPending}
                  data-testid="reset-submit"
                >
                  設定新密碼並啟用
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