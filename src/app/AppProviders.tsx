import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { NativeBridge } from "../infrastructure/bridge/NativeBridge";
import { BridgeProvider } from "../infrastructure/bridge/BridgeContext";
import { TauriNativeBridge } from "../infrastructure/bridge/TauriNativeBridge";

interface AppProvidersProps extends PropsWithChildren {
  bridge?: NativeBridge;
}

export function AppProviders({ bridge, children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [defaultBridge] = useState(() => new TauriNativeBridge());

  return (
    <QueryClientProvider client={queryClient}>
      <BridgeProvider bridge={bridge ?? defaultBridge}>{children}</BridgeProvider>
    </QueryClientProvider>
  );
}
