"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { WagmiConfig } from "wagmi";
import { ReactNode } from "react";
import { arcTestnet } from "./chains";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// إعداد wagmi + RainbowKit
const config = getDefaultConfig({
  appName: "Arc Receipts",
  projectId: "arc-receipts-dev", // لاحقًا حط projectId حقيقي من WalletConnect
  chains: [arcTestnet],
  ssr: true,
});

// React Query client مطلوب من RainbowKit
const queryClient = new QueryClient();

export function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        {/* في v2 ما نمرّر chains هنا، تكفي في config فوق */}
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}
