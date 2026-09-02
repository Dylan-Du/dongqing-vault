import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { NativeBridge } from "../infrastructure/bridge/NativeBridge";
import { BridgeProvider } from "../infrastructure/bridge/BridgeContext";
import { LocalStorageBridge } from "../infrastructure/bridge/LocalStorageBridge";
import { TauriNativeBridge } from "../infrastructure/bridge/TauriNativeBridge";

interface AppProvidersProps extends PropsWithChildren {
  bridge?: NativeBridge;
}

export function AppProviders({ bridge, children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [defaultBridge] = useState<NativeBridge>(() =>
    isTauriRuntime() ? new TauriNativeBridge() : new LocalStorageBridge(),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BridgeProvider bridge={bridge ?? defaultBridge}>{children}</BridgeProvider>
    </QueryClientProvider>
  );
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" &&
    Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
