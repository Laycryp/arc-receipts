"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import Link from "next/link";
import {
  ARC_RECEIPTS_ADDRESS,
  ARC_RECEIPTS_ABI,
} from "../../lib/arcReceiptsContract";

const categoryLabels: Record<number, string> = {
  0: "Salary",
  1: "Invoice",
  2: "Donation",
  3: "Subscription",
  4: "Test Purchase",
  5: "Loan repayment",
  6: "Other",
};

function formatUsdc(amount: bigint): string {
  const DECIMALS = BigInt("1000000");
  const whole = amount / DECIMALS;
  const frac = amount % DECIMALS;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) * 1000;
  const d = new Date(ms);
  return d.toLocaleString();
}

type Receipt = {
  id: bigint;
  from: string;
  to: string;
  amount: bigint;
  category: number;
  reason: string;
  sourceCurrency: string;
  destinationCurrency: string;
  corridor: string;
  timestamp: bigint;
};

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [mode, setMode] = useState<"all" | "sent" | "received">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!publicClient || !isConnected || !address) {
      setReceipts([]);
      setFetchError(null);
      return;
    }

    let cancelled = false;

    async function loadReceipts() {
      // ✅ حارس إضافي لـ TypeScript داخل الدالة نفسها
      if (!publicClient) return;

      setIsLoading(true);
      setFetchError(null);

      try {
        const nextId = (await publicClient.readContract({
          address: ARC_RECEIPTS_ADDRESS,
          abi: ARC_RECEIPTS_ABI,
          functionName: "nextReceiptId",
          args: [],
        })) as bigint;

        const latest = Number(nextId); // id القادم
        if (latest === 0 || latest === 1) {
          if (!cancelled) setReceipts([]);
          setIsLoading(false);
          return;
        }

        const maxToFetch = 50; // حد أعلى من الإيصالات
        const lastExistingId = latest - 1;
        const startId = Math.max(1, lastExistingId - maxToFetch + 1);

        const recs: Receipt[] = [];

        for (let id = lastExistingId; id >= startId; id--) {
          const data: any = await publicClient.readContract({
            address: ARC_RECEIPTS_ADDRESS,
            abi: ARC_RECEIPTS_ABI,
            functionName: "getReceipt",
            args: [BigInt(id)],
          });

          const r: Receipt = {
            id: data.id ?? data[0] ?? BigInt(id),
            from: data.from ?? data[1],
            to: data.to ?? data[2],
            amount: data.amount ?? data[3],
            category: Number(data.category ?? data[4]),
            reason: data.reason ?? data[5],
            sourceCurrency: data.sourceCurrency ?? data[6],
            destinationCurrency: data.destinationCurrency ?? data[7],
            corridor: data.corridor ?? data[8],
            timestamp: data.timestamp ?? data[9],
          };

          recs.push(r);
        }

        recs.sort((a, b) => Number(b.id - a.id));

        if (!cancelled) {
          setReceipts(recs);
          setFetchError(null);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setFetchError(e?.message ?? "Failed to load receipts");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadReceipts();

    return () => {
      cancelled = true;
    };
  }, [publicClient, isConnected, address]);

  // فلترة بالتاريخ
  const fromTs = fromDate ? new Date(fromDate).getTime() / 1000 : null;
  const toTs = toDate ? new Date(toDate).getTime() / 1000 + 24 * 60 * 60 : null;

  const addrLower = address?.toLowerCase();

  // 1) دائماً نأخذ الإيصالات التي المحفظة طرف فيها (خصوصية الداب)
  const myReceipts = receipts.filter((r) => {
    if (!addrLower) return false;
    const fromLower = r.from.toLowerCase();
    const toLower = r.to.toLowerCase();
    if (fromLower !== addrLower && toLower !== addrLower) return false;

    const ts = Number(r.timestamp);
    if (fromTs && ts < fromTs) return false;
    if (toTs && ts > toTs) return false;

    return true;
  });

  // 2) نطبق الفلتر (all / sent / received) فوقها
  const filtered = myReceipts.filter((r) => {
    if (!addrLower) return true;
    const fromLower = r.from.toLowerCase();
    const toLower = r.to.toLowerCase();

    if (mode === "sent" && fromLower !== addrLower) return false;
    if (mode === "received" && toLower !== addrLower) return false;

    return true;
  });

  const galleryItems = filtered.slice(0, 6);
  const recentRows = filtered;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-slate-50">History</h1>
          <p className="text-sm text-slate-400">
            Private history of receipts where your connected wallet is sender or
            receiver.
          </p>
        </div>
      </header>

      {!isConnected ? (
        <div className="bg-[#050814] border border-slate-800 rounded-2xl p-6 text-sm text-slate-400">
          Connect your wallet to view your receipts.
        </div>
      ) : (
        <>
          {/* FILTERS */}
          <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] text-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("all")}
                  className={[
                    "px-3 py-1 rounded-full border",
                    mode === "all"
                      ? "bg-sky-500/15 border-sky-400 text-sky-100"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900",
                  ].join(" ")}
                >
                  All (my receipts)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("sent")}
                  className={[
                    "px-3 py-1 rounded-full border",
                    mode === "sent"
                      ? "bg-sky-500/15 border-sky-400 text-sky-100"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900",
                  ].join(" ")}
                >
                  Sent by me
                </button>
                <button
                  type="button"
                  onClick={() => setMode("received")}
                  className={[
                    "px-3 py-1 rounded-full border",
                    mode === "received"
                      ? "bg-sky-500/15 border-sky-400 text-sky-100"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900",
                  ].join(" ")}
                >
                  Received by me
                </button>
              </div>

              <div className="flex gap-3 text-xs items-center">
                <div className="flex flex-col">
                  <label className="mb-1 text-slate-400">From date</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-slate-400">To date</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              The dApp only displays receipts where your wallet is involved.
              Other users&apos; receipts are hidden from this view.
            </p>
          </div>

          {/* RECEIPTS GALLERY */}
          <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] space-y-3">
            <h2 className="text-sm font-semibold text-slate-50">
              RECEIPTS GALLERY (last 6)
            </h2>

            {isLoading ? (
              <div className="py-6 text-sm text-slate-400">
                Loading receipts...
              </div>
            ) : fetchError ? (
              <div className="py-6 text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-md px-3">
                {fetchError}
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="py-6 text-sm text-slate-400">
                No receipts to display for this wallet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                {galleryItems.map((r) => (
                  <Link key={r.id.toString()} href={`/receipt/${r.id.toString()}`}>
                    <div className="relative rounded-xl bg-slate-900/80 border border-sky-500/60 shadow-[0_0_20px_rgba(56,189,248,0.5)] px-3 py-3 text-xs text-slate-100 hover:-translate-y-[1px] hover:shadow-[0_0_26px_rgba(56,189,248,0.8)] transition-transform duration-150 cursor-pointer">
                      <div className="flex items-center justify_between mb-2">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">
                            PAYMENT RECEIPT
                          </span>
                          <span className="text-[11px] text-slate-500">
                            #{r.id.toString()}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-600 text-slate-300">
                          {categoryLabels[r.category] ??
                            `Category #${r.category}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mb-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">
                            From
                          </span>
                          <span className="text-[11px] text-slate-200 truncate max-w-[120px]">
                            {r.from}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 px-1">→</div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500">To</span>
                          <span className="text-[11px] text-slate-200 truncate max-w-[120px]">
                            {r.to}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">
                            Amount (USDC)
                          </span>
                          <span className="text-sm font-semibold text-slate-50">
                            {formatUsdc(r.amount)} USDC
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500">
                            Payment route
                          </span>
                          <span className="text-[11px] text-slate-200">
                            {r.corridor}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{formatTimestamp(r.timestamp)}</span>
                        <span>
                          {r.sourceCurrency} → {r.destinationCurrency}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* RECENT ACTIVITY TABLE */}
          <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                RECENT ACTIVITY
              </h2>
            </div>

            {isLoading ? (
              <div className="py-6 text-sm text-slate-400">
                Loading receipts from chain...
              </div>
            ) : fetchError ? (
              <div className="py-6 text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-md px-3">
                {fetchError}
              </div>
            ) : recentRows.length === 0 ? (
              <div className="py-6 text-sm text-slate-400">
                No receipts found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left text-slate-200">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 pr-4 font-normal">Receipt</th>
                      <th className="py-2 px-4 font-normal">Type</th>
                      <th className="py-2 px-4 font-normal">Category</th>
                      <th className="py-2 px-4 font-normal">Amount</th>
                      <th className="py-2 px-4 font-normal">From</th>
                      <th className="py-2 px-4 font-normal">To</th>
                      <th className="py-2 px-4 font-normal">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.map((r) => {
                      const isSent =
                        addrLower && r.from.toLowerCase() === addrLower;
                      const typeLabel = isSent ? "Sent" : "Received";

                      return (
                        <tr
                          key={r.id.toString()}
                          className="border-b border-slate-800/60 hover:bg-slate-900/50 cursor-pointer"
                          onClick={() => {
                            window.location.href = `/receipt/${r.id.toString()}`;
                          }}
                        >
                          <td className="py-2 pr-4 text-slate-300">
                            #{r.id.toString()}
                          </td>
                          <td className="py-2 px-4">
                            <span
                              className={[
                                "px-2 py-0.5 rounded-full text-[11px] border",
                                isSent
                                  ? "bg-emerald-900/40 border-emerald-500/60 text-emerald-100"
                                  : "bg-sky-900/40 border-sky-500/60 text-sky-100",
                              ].join(" ")}
                            >
                              {typeLabel}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-slate-300">
                            {categoryLabels[r.category] ??
                              `Category #${r.category}`}
                          </td>
                          <td className="py-2 px-4 text-slate-100 font-medium">
                            {formatUsdc(r.amount)} USDC
                          </td>
                          <td className="py-2 px-4 text-slate-400 truncate max-w-[120px]">
                            {r.from}
                          </td>
                          <td className="py-2 px-4 text-slate-400 truncate max-w-[120px]">
                            {r.to}
                          </td>
                          <td className="py-2 px-4 text-slate-400">
                            {formatTimestamp(r.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
