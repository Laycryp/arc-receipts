"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";

const navItems = [
  { href: "/create", label: "Send" },
  { href: "/history", label: "History" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    // ✅ التعديل هنا: أضفنا h-screen sticky top-0 لجعلها ثابتة بطول الشاشة
    <aside className="w-64 bg-[#050814] border-r border-slate-800 px-4 py-5 flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* TOP: logo + name + connect */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-3xl bg-[#050814] border border-sky-500/60 shadow-[0_0_20px_rgba(56,189,248,0.35)] overflow-hidden flex items-center justify-center">
            <Image
              src="/arc-logo.png"
              alt="Arc Receipts logo"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight text-slate-50">
              Arc Receipts
            </span>
            <span className="text-[11px] text-slate-500">Arc Testnet</span>
          </div>
        </div>

        <div className="ml-2">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>

      {/* NAV */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/create" && pathname === "/");

          return (
            <Link key={item.href} href={item.href}>
              <button
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border",
                  active
                    ? "bg-[#0b1220] border-sky-500/70 text-sky-100 shadow-[0_0_15px_rgba(56,189,248,0.35)]"
                    : "bg-transparent border-transparent text-slate-400 hover:bg-slate-900 hover:border-slate-700 hover:text-slate-100",
                ].join(" ")}
              >
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                <span>{item.label}</span>
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 text-[11px] text-slate-600">
        Economic OS · Arc Network
      </div>
    </aside>
  );
}
