import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user:
    | {
        id: string;
        email: string;
        displayName: string;
        avatarUrl?: string;
        // mock 階段：登入帳號 === VITE_ADMIN_ACCOUNT 時為 true（Sidebar 系統設置依此過濾）
        // Phase 1 換真實 auth 後改由後端 JWT / role claim 提供
        isAdmin: boolean;
        // 臨時密碼登入 → 強制變更密碼（導向 /auth/reset；規格 accounts-management.md §10）
        mustChangePassword?: boolean;
      }
    | null;
  scope: string;
  login: (user: AuthState['user']) => void;
  logout: () => void;
  setScope: (scope: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      scope: 'default',
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      setScope: (scope) => set({ scope }),
    }),
    { name: 'kac.auth' },
  ),
);