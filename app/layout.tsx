import type { Metadata } from "next";
import "./globals.css";
import { Web3Providers } from "../lib/wagmi";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "Arc Receipts",
  description: "Smart payment receipts on Arc Testnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50 antialiased">
        <Web3Providers>
          <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 min-h-screen bg-slate-950">
              <div className="max-w-5xl mx-auto px-6 py-8">
                {children}
              </div>
            </main>
          </div>
        </Web3Providers>
      </body>
    </html>
  );
}
