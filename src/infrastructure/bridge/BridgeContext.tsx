import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import type { NativeBridge } from "./NativeBridge";

const NativeBridgeContext = createContext<NativeBridge | null>(null);

interface BridgeProviderProps {
  bridge: NativeBridge;
  children?: ReactNode;
}

export function BridgeProvider({ bridge, children }: BridgeProviderProps) {
  return (
    <NativeBridgeContext.Provider value={bridge}>
      {children}
    </NativeBridgeContext.Provider>
  );
}

export function useNativeBridge(): NativeBridge {
  const bridge = useContext(NativeBridgeContext);
  if (!bridge) {
    throw new Error("useNativeBridge must be used within BridgeProvider");
  }

  return bridge;
}

/**
 * Returns the bridge when the caller is rendered inside AppProviders.
 * This keeps small isolated previews/tests renderable without requiring a
 * provider while production code can continue to use useNativeBridge for a
 * strict dependency check.
 */
export function useOptionalNativeBridge(): NativeBridge | null {
  return useContext(NativeBridgeContext);
}

export type BridgeProviderChildren = PropsWithChildren<{
  bridge: NativeBridge;
}>;
