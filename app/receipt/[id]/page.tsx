"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useReadContract, usePublicClient, useAccount } from "wagmi"; // ✅ Added useAccount
import { parseAbiItem } from "viem";
import html2canvas from "html2canvas";
import {
  ARC_RECEIPTS_ADDRESS,
  ARC_RECEIPTS_ABI,
} from "../../../lib/arcReceiptsContract";

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
  return d.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const receiptId = id ? BigInt(id) : BigInt(0);

  // ✅ 1. Get Connected Wallet
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [txHash, setTxHash] = useState<string | null>(searchParams.get("tx"));
  const [isFetchingHash, setIsFetchingHash] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error } = useReadContract({
    address: ARC_RECEIPTS_ADDRESS,
    abi: ARC_RECEIPTS_ABI,
    functionName: "getReceipt",
    args: [receiptId],
    query: {
      enabled: !!id,
    },
  } as any);

  useEffect(() => {
    if (txHash || !receiptId || !publicClient) return;

    async function fetchTxHashFromLogs() {
      if (!publicClient) return;

      setIsFetchingHash(true);
      try {
        const logs = await publicClient.getLogs({
          address: ARC_RECEIPTS_ADDRESS,
          event: parseAbiItem(
            "event ReceiptCreated(uint256 indexed id, address indexed from, address indexed to, address token, uint256 amount, string corridor, uint256 timestamp)"
          ),
          args: {
            id: receiptId
          },
          fromBlock: 'earliest'
        });

        if (logs.length > 0) {
          setTxHash(logs[0].transactionHash);
        }
      } catch (err) {
        console.error("Failed to fetch tx hash from logs", err);
      } finally {
        setIsFetchingHash(false);
      }
    }

    fetchTxHashFromLogs();
  }, [receiptId, txHash, publicClient]);

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#0F1423",
        scale: 2,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `ArcReceipt-#${id}.png`;
      link.click();
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!id) return <div className="p-10 text-center text-slate-500">Invalid receipt ID</div>;
  if (isLoading) return <div className="p-10 text-center text-sky-500 animate-pulse">Verifying receipt on-chain...</div>;
  if (error || !data) return <div className="p-10 text-center text-red-400">Receipt not found.</div>;

  const rawData = data as any;
  const meta = rawData.meta || rawData[5];

  const receipt = {
    id: rawData.id ?? rawData[0],
    from: rawData.from ?? rawData[1],
    to: rawData.to ?? rawData[2],
    amount: rawData.amount ?? rawData[4],
    token: rawData.token ?? rawData[3],
    category: typeof meta.category !== 'undefined' ? Number(meta.category) : Number(meta[0]),
    reason: meta.reason ?? meta[1],
    sourceCurrency: meta.sourceCurrency ?? meta[2],
    destinationCurrency: meta.destinationCurrency ?? meta[3],
    corridor: meta.corridor ?? meta[4],
    timestamp: rawData.timestamp ?? rawData[6],
  };

  // ✅ 2. Security Check: Is the viewer a participant?
  // We check if wallet is connected AND if it matches 'from' OR 'to'
  const isParticipant = connectedAddress && (
    receipt.from.toLowerCase() === connectedAddress.toLowerCase() ||
    receipt.to.toLowerCase() === connectedAddress.toLowerCase()
  );

  // If not a participant, show Access Denied Screen
  if (!isParticipant) {
    return (
      <section className="max-w-lg mx-auto py-20 px-4 text-center">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Private Receipt</h2>
          <p className="text-sm text-slate-400 mb-6">
            This receipt is private. Only the <strong>Sender</strong> or <strong>Recipient</strong> can view the details.
          </p>
          {!connectedAddress ? (
            <div className="text-xs text-sky-400 animate-pulse">Please connect your wallet to verify ownership.</div>
          ) : (
            <div className="text-xs text-red-400 bg-red-950/20 py-2 px-4 rounded border border-red-900/30">
              Access Denied: Your wallet is not a party to this transaction.
            </div>
          )}
        </div>
      </section>
    );
  }

  // --- If Participant, show content below ---

  const explorerLink = txHash
    ? `https://testnet.arcscan.app/tx/${txHash}`
    : `https://testnet.arcscan.app/address/${ARC_RECEIPTS_ADDRESS}`;

  const linkLabel = (txHash || isFetchingHash) ? "View Transaction" : "View Contract";

  return (
    <section className="max-w-3xl mx-auto py-8">

      {/* Header Actions */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold text-white mb-1">Payment Receipt</h1>
          <p className="text-slate-400 text-sm">Official immutable record on Arc Testnet</p>
        </div>

        <button
          onClick={handleDownloadImage}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
          {isDownloading ? (
            <span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          )}
          {isDownloading ? "Generating..." : "Download Image"}
        </button>
      </div>

      {/* Main Receipt Card (Ref attached here) */}
      <div ref={receiptRef} className="relative bg-[#0F1423] border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
        <div className="h-2 w-full bg-gradient-to-r from-sky-500 via-purple-500 to-sky-500"></div>

        <div className="p-8 space-y-8">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800 border-dashed">
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Receipt ID</span>
              <div className="text-3xl font-mono text-white">#{receipt.id.toString()}</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="px-3 py-1 rounded-full bg-sky-900/30 border border-sky-500/30 text-sky-200 text-xs font-medium">
                {categoryLabels[receipt.category] || "Payment"}
              </span>
              <span className="text-xs text-slate-500 mt-2">{formatTimestamp(receipt.timestamp)}</span>
            </div>
          </div>

          <div className="text-center py-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
            <span className="block text-slate-400 text-xs uppercase tracking-wider mb-1">Total Amount Paid</span>
            <div className="text-4xl font-bold text-white tracking-tight">
              {formatUsdc(receipt.amount)} <span className="text-lg text-slate-500 font-normal">USDC</span>
            </div>
            {receipt.sourceCurrency !== receipt.destinationCurrency && (
              <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-300 border border-purple-500/20">
                FX Swap: {receipt.sourceCurrency} ➔ {receipt.destinationCurrency}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">From (Sender)</span>
                <div className="font-mono text-xs text-slate-300 break-all">{receipt.from}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/30 border border-slate-800">
                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">To (Recipient)</span>
                <div className="font-mono text-xs text-slate-300 break-all">{receipt.to}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Payment Route</span>
                <div className="text-sm text-slate-200 font-mono border-b border-slate-800 pb-1">{receipt.corridor}</div>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Description / Note</span>
                <div className="text-sm text-slate-300 italic">"{receipt.reason || 'No description provided'}"</div>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 opacity-40">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Arc Receipts • Verifiable On-Chain</span>
          </div>

        </div>
      </div>

      <div className="mt-4 bg-[#0A0D18] p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a
          href={explorerLink}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${txHash ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
        >
          {isFetchingHash && !txHash ? (
            <span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></span>
          ) : null}
          <span>{linkLabel}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>

        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="text-xs text-slate-500 hover:text-sky-400 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
          Copy Receipt Link
        </button>
      </div>

      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/20 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Verified On-Chain
        </div>
      </div>
    </section>
  );
}
