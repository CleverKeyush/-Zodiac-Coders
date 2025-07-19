"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import w3m-button to prevent SSR issues
const W3MButton = dynamic(
  () => {
    // Create a wrapper component for w3m-button
    const W3MButtonWrapper = () => {
      useEffect(() => {
        // Ensure w3m-button is available
        if (typeof window !== "undefined") {
          import("@reown/appkit/react");
        }
      }, []);

      return <w3m-button />;
    };

    return Promise.resolve(W3MButtonWrapper);
  },
  {
    ssr: false,
    loading: () => (
      <div className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-900 to-lavender-400 text-black rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
        Connect Wallet
      </div>
    ),
  }
);

export function WalletConnectButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show loading state during hydration
  if (!isMounted) {
    return (
      <div className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-900 to-lavender-400 text-black rounded-lg font-medium text-sm">
        Connect Wallet
      </div>
    );
  }

  // Render the actual AppKit button after mounting
  return <W3MButton />;
}
