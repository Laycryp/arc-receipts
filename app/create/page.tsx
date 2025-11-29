"use client";

import Link from "next/link";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import {
  ARC_RECEIPTS_ADDRESS,
  ARC_RECEIPTS_ABI,
} from "../../lib/arcReceiptsContract";
import { ARC_USDC_ADDRESS, ARC_USDC_ABI } from "../../lib/usdcToken";

// ============================================================================
// العقد الجديد للروتر (Deployed Router)
const ARC_FX_ROUTER_ADDRESS = "0xAe6147ce9Fc4624B01C79EEeFd7315294CFEE755";
// ============================================================================

const SUPPORTED_TARGET_TOKENS = [
  { 
    symbol: "EURC", 
    name: "Euro Coin", 
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" 
  },
];

const ARC_FX_ROUTER_ABI = [
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "category", type: "uint8" },
      { name: "reason", type: "string" },
      { name: "sourceCurrency", type: "string" },
      { name: "destinationCurrency", type: "string" },
      { name: "corridor", type: "string" },
    ],
    name: "swapAndPay",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const categories = [
  { label: "Salary", value: 0 },
  { label: "Invoice", value: 1 },
  { label: "Donation", value: 2 },
  { label: "Subscription", value: 3 },
  { label: "Test Purchase", value: 4 },
  { label: "Loan repayment", value: 5 },
  { label: "Other", value: 6 },
];

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
  token?: string; 
};

function parseAmountToBigInt(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const wholeBig = BigInt(whole || "0");
  const fracPadded = (frac + "000000").slice(0, 6);
  const fracBig = BigInt(fracPadded || "0");
  const DECIMALS = BigInt("1000000");
  return wholeBig * DECIMALS + fracBig;
}

function parseUsdcAmount(input: string): bigint {
  const value = input.trim();
  if (!value) {
    throw new Error("Amount is required.");
  }
  if (!/^\d+(\.\d{0,6})?$/.test(value)) {
    throw new Error("Invalid USDC amount format (max 6 decimals).");
  }
  return parseAmountToBigInt(value);
}

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

export default function CreateReceiptPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [paymentMode, setPaymentMode] = useState<"direct" | "swap">("direct");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(""); 
  const [category, setCategory] = useState<number>(2);
  const [reason, setReason] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [destinationCurrency, setDestinationCurrency] = useState("USD");
  const [corridor, setCorridor] = useState("USD-USD");
  const [targetTokenAddress, setTargetTokenAddress] = useState(SUPPORTED_TARGET_TOKENS[0].address);

  const [formError, setFormError] = useState<string | null>(null);
  const [expectedReceiptId, setExpectedReceiptId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    data: allowanceDirect,
    refetch: refetchAllowanceDirect,
  } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ARC_USDC_ABI,
    functionName: "allowance",
    args: address ? [address, ARC_RECEIPTS_ADDRESS] : undefined,
    query: { enabled: !!address },
  } as any);

  const {
    data: allowanceRouter,
    refetch: refetchAllowanceRouter,
  } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ARC_USDC_ABI,
    functionName: "allowance",
    args: address ? [address, ARC_FX_ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address && paymentMode === "swap" },
  } as any);

  const allowanceValue = 
    paymentMode === "swap" 
      ? ((allowanceRouter as bigint | undefined) ?? BigInt(0))
      : ((allowanceDirect as bigint | undefined) ?? BigInt(0));

  // --- Last Receipt Logic ---
  const [lastMyReceipt, setLastMyReceipt] = useState<Receipt | null>(null);
  const [lastMyReceiptLoading, setLastMyReceiptLoading] = useState(false);
  const [lastMyReceiptError, setLastMyReceiptError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient || !isConnected || !address) {
      setLastMyReceipt(null);
      setLastMyReceiptError(null);
      return;
    }
    const client = publicClient;
    const currentAddress = address;
    let cancelled = false;

    async function loadLastMyReceipt() {
      setLastMyReceiptLoading(true);
      setLastMyReceiptError(null);
      try {
        const nextId = (await client.readContract({
          address: ARC_RECEIPTS_ADDRESS,
          abi: ARC_RECEIPTS_ABI,
          functionName: "nextReceiptId",
          args: [],
        })) as bigint;

        if (nextId <= BigInt(1)) {
          if (!cancelled) setLastMyReceipt(null);
          setLastMyReceiptLoading(false);
          return;
        }

        const lastExistingId = nextId - BigInt(1);
        const lastId = Number(lastExistingId);
        const maxToFetch = 50;
        const startId = Math.max(1, lastId - maxToFetch + 1);
        const addrLower = currentAddress.toLowerCase();
        let found: Receipt | null = null;

        for (let id = lastId; id >= startId; id--) {
          const data: any = await client.readContract({
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
            amount: data.amount ?? data[4], 
            token: data.token ?? data[3],    
            category: categoryVal,
            reason: meta.reason ?? meta[1],
            sourceCurrency: meta.sourceCurrency ?? meta[2],
            destinationCurrency: meta.destinationCurrency ?? meta[3],
            corridor: meta.corridor ?? meta[4],
            timestamp: data.timestamp ?? data[6],
          };

          const fromLower = r.from.toLowerCase();
          const toLower = r.to.toLowerCase();
          if (fromLower === addrLower || toLower === addrLower) {
            found = r;
            break;
          }
        }
        if (!cancelled) setLastMyReceipt(found);
      } catch (e: any) {
        console.error("Error loading receipt:", e);
        if (!cancelled) setLastMyReceiptError(e?.message ?? "Failed to load last receipt");
      } finally {
        if (!cancelled) setLastMyReceiptLoading(false);
      }
    }
    loadLastMyReceipt();
    return () => { cancelled = true; };
  }, [publicClient, isConnected, address]);
  // -------------------------------------

  const {
    data: payTxHash,
    writeContractAsync: writePayAsync,
    isPending: isPayPending,
    error: payError,
  } = useWriteContract();

  const {
    isLoading: isPayConfirming,
    isSuccess: isPayConfirmed,
  } = useWaitForTransactionReceipt({ hash: payTxHash });

  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  useEffect(() => {
    if (isPayConfirmed && expectedReceiptId) {
      setIsFormOpen(false);
      router.push(`/receipt/${expectedReceiptId}?tx=${payTxHash}`);
    }
  }, [isPayConfirmed, expectedReceiptId, router, payTxHash]);

  useEffect(() => {
    setCorridor(`${sourceCurrency}-${destinationCurrency}`);
  }, [sourceCurrency, destinationCurrency]);

  useEffect(() => {
    if (paymentMode === "swap") {
        setSourceCurrency("USDC");
        const token = SUPPORTED_TARGET_TOKENS.find(t => t.address === targetTokenAddress);
        setDestinationCurrency(token ? token.symbol : "EURC");
    } else {
        setSourceCurrency("USD");
        setDestinationCurrency("USD");
    }
  }, [paymentMode, targetTokenAddress]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isConnected || !address) {
      setFormError("Please connect your wallet first.");
      return;
    }
    if (!publicClient) {
      setFormError("Public client is not ready.");
      return;
    }

    let toAddress: `0x${string}` = address;
    if (to) {
      if (!to.startsWith("0x") || to.length !== 42) {
        setFormError("Please enter a valid recipient address.");
        return;
      }
      toAddress = to as `0x${string}`;
    }

    let usdcAmount: bigint;
    try {
      usdcAmount = parseUsdcAmount(amount);
      if (usdcAmount <= BigInt(0)) throw new Error("Amount must be > 0.");
    } catch (err: any) {
      setFormError(err.message || "Invalid amount.");
      return;
    }

    if (paymentMode === "swap") {
      if (!ARC_FX_ROUTER_ADDRESS) {
        setFormError("Router address not configured.");
        return;
      }
      if (!targetTokenAddress || !targetTokenAddress.startsWith("0x")) {
        setFormError("Please select a target token.");
        return;
      }
    }

    try {
      const spender = paymentMode === "swap" ? ARC_FX_ROUTER_ADDRESS : ARC_RECEIPTS_ADDRESS;
      
      if (allowanceValue < usdcAmount) {
        const approveHash = await writeApproveAsync({
          address: ARC_USDC_ADDRESS,
          abi: ARC_USDC_ABI,
          functionName: "approve",
          args: [spender, usdcAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
        
        if (paymentMode === "swap") refetchAllowanceRouter();
        else refetchAllowanceDirect();
      }

      const nextId = (await publicClient.readContract({
        address: ARC_RECEIPTS_ADDRESS,
        abi: ARC_RECEIPTS_ABI,
        functionName: "nextReceiptId",
      })) as bigint;
      setExpectedReceiptId(nextId.toString());

      if (paymentMode === "direct") {
        await writePayAsync({
          address: ARC_RECEIPTS_ADDRESS,
          abi: ARC_RECEIPTS_ABI,
          functionName: "payWithReceipt",
          args: [
            ARC_USDC_ADDRESS, 
            toAddress,
            usdcAmount,
            {
                category: category,
                reason: reason,
                sourceCurrency: sourceCurrency,
                destinationCurrency: destinationCurrency,
                corridor: corridor
            }
          ],
        });
      } else {
        await writePayAsync({
          address: ARC_FX_ROUTER_ADDRESS,
          abi: ARC_FX_ROUTER_ABI,
          functionName: "swapAndPay",
          args: [
            ARC_USDC_ADDRESS,      
            targetTokenAddress as `0x${string}`,
            usdcAmount,            
            BigInt(0),             
            toAddress,             
            category, 
            reason,
            sourceCurrency,
            destinationCurrency,
            corridor
          ],
        });
      }

    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Transaction failed");
    }
  }

  const isPaySubmitting = isPayPending || isPayConfirming;

  // إعداد العرض للبطاقة
  let cardContent = null;
  if (lastMyReceipt) {
    const isSent = address && lastMyReceipt.from.toLowerCase() === address.toLowerCase();
    const isSwap = lastMyReceipt.sourceCurrency !== lastMyReceipt.destinationCurrency;

    cardContent = (
      <Link href={`/receipt/${lastMyReceipt.id.toString()}`}>
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1021] to-[#060914] border border-slate-800 hover:border-sky-500/40 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(14,165,233,0.15)] cursor-pointer">
          {/* Status Line */}
          <div className={`absolute top-0 left-0 w-1 h-full ${isSent ? 'bg-rose-500/50' : 'bg-emerald-500/50'}`} />
          
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Receipt ID</span>
                  <span className="text-lg font-mono text-slate-200">#{lastMyReceipt.id.toString()}</span>
              </div>
              <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${isSent ? 'bg-rose-950/30 border-rose-500/20 text-rose-200' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'}`}>
                  {isSent ? 'Sent Out' : 'Received'}
              </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 group-hover:bg-slate-900 transition-colors">
                  <div className="text-[10px] text-slate-500 mb-1">Total Amount</div>
                  <div className="text-base font-semibold text-white">{formatUsdc(lastMyReceipt.amount)} <span className="text-xs font-normal text-slate-400">USDC</span></div>
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
                  <span className="text-slate-300 font-mono">{lastMyReceipt.corridor}</span>
              </div>
              <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Date</span>
                  <span className="text-slate-300">{formatTimestamp(lastMyReceipt.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-slate-50">
            Recent activity
          </h1>
          <p className="text-sm text-slate-400">
            Create new receipt payments on Arc and keep a verifiable history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-400 text-slate-50 shadow-[0_0_18px_rgba(56,189,248,0.6)] border border-sky-300"
        >
          <span className="text-lg leading-none">＋</span>
          <span>NEW PAYMENT</span>
        </button>
      </header>

      {isFormOpen && (
        <div className="bg-[#050814] border border-sky-500/60 rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.35)] p-5 space-y-4 relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">New Payment</h2>
              <p className="text-xs text-slate-400">Select payment method below</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-slate-100 text-lg px-2"
            >
              ✕
            </button>
          </div>

          {/* Payment Mode Toggles */}
          <div className="flex bg-slate-900 rounded-lg p-1 mb-4 border border-slate-800">
            <button
              type="button"
              onClick={() => setPaymentMode("direct")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                paymentMode === "direct"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Direct Pay (USDC)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("swap")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                paymentMode === "swap"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              FX Swap & Pay
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Recipient (optional)
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  placeholder="0x... (leave empty for self)"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Amount (USDC) *
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  placeholder="1.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Allowance: {allowanceValue ? `${formatUsdc(allowanceValue)} USDC` : "0"}
                </p>
              </div>
            </div>

            {paymentMode === "swap" && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                <label className="block text-sm mb-1 text-purple-200">
                  Receive Currency (Swap to) *
                </label>
                <select
                  className="w-full rounded-md bg-slate-950 border border-purple-500/50 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  value={targetTokenAddress}
                  onChange={(e) => setTargetTokenAddress(e.target.value)}
                >
                  {SUPPORTED_TARGET_TOKENS.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-purple-300/70 mt-1">
                  Router will swap USDC → {SUPPORTED_TARGET_TOKENS.find(t=>t.address===targetTokenAddress)?.symbol} and send to recipient.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm mb-1 text-slate-200">Category</label>
              <select
                className="w-full md:w-64 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                value={category}
                onChange={(e) => setCategory(Number(e.target.value))}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1 text-slate-200">Note</label>
              <input
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                placeholder="Payment description"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1 text-slate-200">Token type from</label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                  value={sourceCurrency}
                  onChange={(e) => setSourceCurrency(e.target.value)}
                  readOnly={paymentMode === "swap"} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-200">Token type to</label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                  value={destinationCurrency}
                  onChange={(e) => setDestinationCurrency(e.target.value)}
                  readOnly={paymentMode === "swap"} 
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-200">Route (Auto)</label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 opacity-60 cursor-not-allowed"
                  value={corridor}
                  readOnly
                />
              </div>
            </div>

            {formError && (
              <div className="text-sm text-red-200 border border-red-500/50 bg-red-950/40 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
            {payError && !formError && (
              <div className="text-sm text-red-200 border border-red-500/50 bg-red-950/40 rounded-md px-3 py-2">
                {payError.message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPaySubmitting || !isConnected}
                className={`rounded-full px-6 py-2 text-sm font-medium text-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(56,189,248,0.4)] ${
                  paymentMode === "swap" 
                    ? "bg-purple-600 hover:bg-purple-500 border border-purple-400" 
                    : "bg-sky-500 hover:bg-sky-400 border border-sky-300"
                }`}
              >
                {isPaySubmitting
                  ? "Processing..."
                  : paymentMode === "swap"
                  ? "Approve & Swap & Pay"
                  : "Approve & Pay"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Last Receipt Display (Updated UI) --- */}
      <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] space-y-3">
        <h2 className="text-sm font-semibold text-slate-50">
          Last receipt for this wallet
        </h2>
        {lastMyReceiptLoading ? (
          <div className="py-4 text-sm text-slate-400">Loading last receipt...</div>
        ) : lastMyReceiptError ? (
          <div className="py-4 text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-md px-3">
            {lastMyReceiptError}
          </div>
        ) : !lastMyReceipt ? (
          <div className="py-4 text-sm text-slate-400">No receipts have been created yet.</div>
        ) : (
          cardContent
        )}
      </div>
    </section>
  );
}
