"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import Link from "next/link";
import {
  ARC_RECEIPTS_ADDRESS,
  ARC_RECEIPTS_ABI,
} from "../../lib/arcReceiptsContract";

import AnalyticsDashboard from "../components/AnalyticsDashboard";

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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Receipt = {
  id: bigint;
  from: string;
  to: string;
  token: string;
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

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

        const latest = Number(nextId);
        if (latest <= 1) {
          if (!cancelled) setReceipts([]);
          setIsLoading(false);
          return;
        }

        const maxToFetch = 50;
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

          const meta = data.meta || data[5];
          const categoryVal = typeof meta.category !== 'undefined' ? Number(meta.category) : Number(meta[0]);

          const r: Receipt = {
            id: data.id ?? data[0],
            from: data.from ?? data[1],
            to: data.to ?? data[2],
            token: data.token ?? data[3],
            amount: data.amount ?? data[4],
            category: categoryVal,
            reason: meta.reason ?? meta[1],
            sourceCurrency: meta.sourceCurrency ?? meta[2],
            destinationCurrency: meta.destinationCurrency ?? meta[3],
            corridor: meta.corridor ?? meta[4],
            timestamp: data.timestamp ?? data[6],
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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [mode, fromDate, toDate]);

  const fromTs = fromDate ? new Date(fromDate).getTime() / 1000 : null;
  const toTs = toDate ? new Date(toDate).getTime() / 1000 + 24 * 60 * 60 : null;
  const addrLower = address?.toLowerCase();

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

  const filtered = myReceipts.filter((r) => {
    if (!addrLower) return true;
    const fromLower = r.from.toLowerCase();
    const toLower = r.to.toLowerCase();
    if (mode === "sent" && fromLower !== addrLower) return false;
    if (mode === "received" && toLower !== addrLower) return false;
    return true;
  });

  const galleryItems = filtered.slice(0, 6);
  
  // ✅ Pagination Logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  return (
    <section className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight">History</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-lg leading-relaxed">
            Your private ledger of verified payments. View all transactions where your wallet was the sender or recipient.
          </p>
        </div>
      </header>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#050814] border border-slate-800 border-dashed rounded-3xl">
          <div className="text-slate-500 mb-2">Connect Wallet</div>
          <p className="text-sm text-slate-600">Please connect your wallet to view your history.</p>
        </div>
      ) : (
        <>
          {/* FILTERS BAR */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-slate-900/40 border border-slate-800/60 p-2 rounded-2xl backdrop-blur-sm mb-6">
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {(["all", "sent", "received"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    mode === m
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {m === "all" ? "All Receipts" : m === "sent" ? "Sent" : "Received"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-800 w-full lg:w-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">From</span>
                <input
                  type="date"
                  className="bg-transparent text-xs text-slate-200 focus:outline-none w-full lg:w-auto"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-800 w-full lg:w-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">To</span>
                <input
                  type="date"
                  className="bg-transparent text-xs text-slate-200 focus:outline-none w-full lg:w-auto"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {!isLoading && !fetchError && myReceipts.length > 0 && (
             <AnalyticsDashboard receipts={myReceipts} currentAddress={address} />
          )}

          {/* GALLERY GRID */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Cards</h2>
             </div>

            {isLoading ? (
               <div className="py-12 text-center">
                 <div className="inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                 <p className="text-xs text-slate-500">Syncing with Arc Testnet...</p>
               </div>
            ) : fetchError ? (
              <div className="p-4 text-sm text-red-300 bg-red-950/20 border border-red-500/30 rounded-xl">
                {fetchError}
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl">
                <p className="text-sm text-slate-500">No receipts found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {galleryItems.map((r) => {
                   const isSent = addrLower && r.from.toLowerCase() === addrLower;
                   const isSwap = r.sourceCurrency !== r.destinationCurrency;
                   
                   return (
                    <Link key={r.id.toString()} href={`/receipt/${r.id.toString()}`}>
                      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1021] to-[#060914] border border-slate-800 hover:border-sky-500/40 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(14,165,233,0.15)] cursor-pointer">
                        <div className={`absolute top-0 left-0 w-1 h-full ${isSent ? 'bg-rose-500/50' : 'bg-emerald-500/50'}`} />
                        
                        <div className="p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Receipt ID</span>
                                <span className="text-lg font-mono text-slate-200">#{r.id.toString()}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${isSent ? 'bg-rose-950/30 border-rose-500/20 text-rose-200' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'}`}>
                                {isSent ? 'Sent Out' : 'Received'}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                             <div className="flex-1 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 group-hover:bg-slate-900 transition-colors">
                                <div className="text-[10px] text-slate-500 mb-1">Total Amount</div>
                                <div className="text-base font-semibold text-white">{formatUsdc(r.amount)} <span className="text-xs font-normal text-slate-400">USDC</span></div>
                             </div>
                             {isSwap && (
                                 <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-purple-900/10 border border-purple-500/20 text-purple-300">
                                     <span className="text-[9px] font-bold">FX</span>
                                     <span className="text-[9px]">Swap</span>
                                 </div>
                             )}
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-800/50">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Route</span>
                                <span className="text-slate-300 font-mono">{r.corridor}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Date</span>
                                <span className="text-slate-300">{formatTimestamp(r.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* TABLE VIEW (PAGINATED) */}
          <div className="bg-[#050814] border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-6">
             <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/20">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Transaction Log</h2>
             </div>
             
             {filtered.length > 0 && (
                <div>
                    {/* الجدول يعرض 5 صفوف فقط */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Route</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Counterparty</th>
                                    <th className="px-6 py-4">Time</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {currentRows.map((r) => {
                                    const isSent = addrLower && r.from.toLowerCase() === addrLower;
                                    const counterparty = isSent ? r.to : r.from;
                                    
                                    return (
                                        <tr key={r.id.toString()} className="hover:bg-slate-900/40 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-500">#{r.id.toString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${isSent ? 'text-rose-300 bg-rose-950/30' : 'text-emerald-300 bg-emerald-950/30'}`}>
                                                    {isSent ? 'OUT' : 'IN'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-100">{formatUsdc(r.amount)}</td>
                                            <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{r.corridor}</td>
                                            <td className="px-6 py-4 text-slate-400">{categoryLabels[r.category] ?? 'Other'}</td>
                                            <td className="px-6 py-4 font-mono text-slate-500 truncate max-w-[100px]">{counterparty.substring(0,6)}...{counterparty.substring(38)}</td>
                                            <td className="px-6 py-4 text-slate-500">{new Date(Number(r.timestamp) * 1000).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/receipt/${r.id.toString()}`} className="text-sky-400 hover:text-sky-300 hover:underline">
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ✅ شريط التنقل (Pagination Bar) */}
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-950/50 border-t border-slate-800">
                        <span className="text-xs text-slate-500">
                            Page <span className="text-slate-300 font-semibold">{currentPage}</span> of <span className="text-slate-300 font-semibold">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
             )}
          </div>
        </>
      )}
    </section>
  );
}
