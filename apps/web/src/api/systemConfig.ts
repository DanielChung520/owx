import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** 系統參數（對應後端 system_config.rs：/.system/config.json） */
export interface SystemConfig {
  system_name: string;
  logo: string;
}

const CONFIG_URL = "/api/v1/system/config";

async function fetchConfig(): Promise<SystemConfig> {
  const res = await fetch(CONFIG_URL);
  if (!res.ok)
    throw new Error(`GET /api/v1/system/config failed: ${res.status}`);
  return res.json();
}

/** 讀取系統參數（後端未啟動時 retry:false，由呼叫端 fallback 預設值） */
export function useSystemConfig() {
  return useQuery({
    queryKey: ["system-config"],
    queryFn: fetchConfig,
    retry: false,
  });
}

/** 保存系統參數（PUT → 後端寫入 .system/config.json） */
export function useSaveSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: SystemConfig) => {
      const res = await fetch(CONFIG_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok)
        throw new Error(`PUT /api/v1/system/config failed: ${res.status}`);
      return res.json() as Promise<SystemConfig>;
    },
    onSuccess: (cfg) => qc.setQueryData(["system-config"], cfg),
  });
}
