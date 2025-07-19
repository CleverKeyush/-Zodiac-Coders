"use client";

import { wagmiAdapter, adapters, projectId, networks } from "@/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

// Set up queryClient
const queryClient = new QueryClient();

// Set up metadata
const metadata = {
  name: "next-reown-appkit",
  description: "next-reown-appkit",
  url: "https://github.com/0xonerb/next-reown-appkit-ssr", // origin must match your domain & subdomain
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// Create the modal with error handling
export const modal = createAppKit({
  adapters: adapters,
  projectId,
  networks,
  metadata,
  themeMode: "dark",
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
    swaps: false, // Disable Swap functionality
    onramp: false, // Disable Onramp functionality
    send: false, // Disable Send functionality
    history: false, // Disable Activity/History functionality
    email: false, // Disable email login
    socials: [], // Disable all social logins (Google, Discord, etc.)
    emailShowWallets: false, // Don't show wallets in email flow
  },
  themeVariables: {
    "--w3m-accent": "#06b6d4", // Darker turquoise for better visibility
    "--w3m-color-mix": "#06b6d4",
    "--w3m-color-mix-strength": 40, // Increased strength for more prominent colors
    "--w3m-font-family": "inherit",
    "--w3m-border-radius-master": "12px",
    // Only include variables that are allowed by ThemeVariables type
  },
  // Add connection timeout and retry settings
  enableWalletConnect: true,
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: true,
});

// Utility function to clear WalletConnect storage
export const clearWalletConnectStorage = () => {
  if (typeof window !== "undefined") {
    try {
      // Clear WalletConnect related localStorage items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes("walletconnect") ||
            key.includes("wc@2") ||
            key.includes("W3M") ||
            key.includes("reown"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Clear sessionStorage as well
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.includes("walletconnect") ||
            key.includes("wc@2") ||
            key.includes("W3M") ||
            key.includes("reown"))
        ) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

      console.log("🧹 Cleared WalletConnect storage");
    } catch (error) {
      console.error("Failed to clear WalletConnect storage:", error);
    }
  }
};

// Error boundary for WalletConnect errors
const handleWalletConnectError = (error: Error) => {
  console.error("WalletConnect Error:", error);

  if (
    error.message.includes("Proposal expired") ||
    error.message.includes("expired") ||
    error.message.includes("timeout")
  ) {
    console.log("🔄 Handling expired proposal - clearing storage");
    clearWalletConnectStorage();

    // Optionally reload the page after a short delay
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }, 1000);
  }
};

// Set up global error handler for unhandled promise rejections
if (typeof window !== "undefined") {
  // Use setTimeout to ensure this runs after hydration
  setTimeout(() => {
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason?.message?.includes("Proposal expired")) {
        handleWalletConnectError(event.reason);
        event.preventDefault(); // Prevent the error from being logged to console
      }
    });
  }, 0);
}

function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );
  const [isClient, setIsClient] = React.useState(false);

  // Ensure this only runs on the client after hydration
  React.useEffect(() => {
    setIsClient(true);

    const handleError = (error: ErrorEvent) => {
      if (error.message?.includes("Proposal expired")) {
        handleWalletConnectError(new Error(error.message));
      }
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
