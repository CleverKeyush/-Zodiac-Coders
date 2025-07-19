import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import ContextProvider from "@/context";

export const metadata: Metadata = {
  title: "Decentralized KYC Workflow",
  description: "Secure, blockchain-backed KYC verification system",
  other: {
    "permissions-policy": "camera=self, microphone=self",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersData = await headers();
  const cookies = headersData.get("cookie");

  return (
    <html lang="en" className="dark">
      <body
        className="bg-black text-white min-h-screen"
        suppressHydrationWarning={true}
      >
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  );
}
