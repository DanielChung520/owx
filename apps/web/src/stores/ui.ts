import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

/** SettingsPanel modal 當前開啟的 tab key（null = 關閉）。
 * 合法值見 pages/SystemSettingsModal.tsx SettingsPanelKey
 * 故意用 string 而非引入 page type，避免 store ↔ page 雙向耦合。 */
export type SettingsPanelKey = string | null;

interface UIState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  locale: string;
  setLocale: (locale: string) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  // 個人化設置 modal（個人資料/主題/語言等集中入口；Header 頭像 menu + Sidebar 都能觸發）
  settingsPanelKey: SettingsPanelKey;
  openSettingsPanel: (key: NonNullable<SettingsPanelKey>) => void;
  closeSettingsPanel: () => void;
  // 我的賬戶 modal（accounts-management.md §13：暱稱/聯絡/頭像 + 變更密碼）
  myAccountOpen: boolean;
  openMyAccount: () => void;
  closeMyAccount: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      locale: "zh-TW",
      setLocale: (locale) => set({ locale }),
      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),
      settingsPanelKey: null,
      openSettingsPanel: (key) => set({ settingsPanelKey: key }),
      closeSettingsPanel: () => set({ settingsPanelKey: null }),
      myAccountOpen: false,
      openMyAccount: () => set({ myAccountOpen: true }),
      closeMyAccount: () => set({ myAccountOpen: false }),
    }),
    { name: "kac.ui" },
  ),
);
