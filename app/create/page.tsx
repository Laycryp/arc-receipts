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
  return d.toLocaleString();
}

export default function CreateReceiptPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<number>(2);
  const [reason, setReason] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [destinationCurrency, setDestinationCurrency] = useState("USD");
  const [corridor, setCorridor] = useState("USD-USD");

  const [formError, setFormError] = useState<string | null>(null);
  const [expectedReceiptId, setExpectedReceiptId] = useState<string | null>(
    null
  );
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ARC_USDC_ABI,
    functionName: "allowance",
    args: address ? [address, ARC_RECEIPTS_ADDRESS] : undefined,
    query: {
      enabled: !!address,
    },
  } as any);

  const allowanceValue = (allowance as bigint | undefined) ?? BigInt(0);

  const [lastMyReceipt, setLastMyReceipt] = useState<Receipt | null>(null);
  const [lastMyReceiptLoading, setLastMyReceiptLoading] = useState(false);
  const [lastMyReceiptError, setLastMyReceiptError] = useState<string | null>(
    null
  );

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
          if (!cancelled) {
            setLastMyReceipt(null);
          }
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

          const fromLower = r.from.toLowerCase();
          const toLower = r.to.toLowerCase();

          if (fromLower === addrLower || toLower === addrLower) {
            found = r;
            break;
          }
        }

        if (!cancelled) {
          setLastMyReceipt(found);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setLastMyReceiptError(e?.message ?? "Failed to load last receipt");
        }
      } finally {
        if (!cancelled) {
          setLastMyReceiptLoading(false);
        }
      }
    }

    loadLastMyReceipt();

    return () => {
      cancelled = true;
    };
  }, [publicClient, isConnected, address]);

  const {
    data: payTxHash,
    writeContractAsync: writePayWithReceiptAsync,
    isPending: isPayPending,
    error: payError,
  } = useWriteContract();

  const {
    isLoading: isPayConfirming,
    isSuccess: isPayConfirmed,
  } = useWaitForTransactionReceipt({
    hash: payTxHash,
  });

  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  useEffect(() => {
    if (isPayConfirmed && expectedReceiptId) {
      setIsFormOpen(false);
      router.push(`/receipt/${expectedReceiptId}?tx=${payTxHash}`);

    }
  }, [isPayConfirmed, expectedReceiptId, router]);

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
        setFormError(
          "Please enter a valid recipient address, or leave it empty to send to yourself."
        );
        return;
      }
      toAddress = to as `0x${string}`;
    }

    let usdcAmount: bigint;
    try {
      usdcAmount = parseUsdcAmount(amount);
      if (usdcAmount <= BigInt(0)) {
        throw new Error("Amount must be greater than zero.");
      }
    } catch (err: any) {
      setFormError(err.message || "Invalid amount.");
      return;
    }

    try {
      if (allowanceValue < usdcAmount) {
        const approveHash = await writeApproveAsync({
          address: ARC_USDC_ADDRESS,
          abi: ARC_USDC_ABI,
          functionName: "approve",
          args: [ARC_RECEIPTS_ADDRESS, usdcAmount],
        });

        await publicClient.waitForTransactionReceipt({
          hash: approveHash as `0x${string}`,
        });

        setTimeout(() => {
          refetchAllowance();
        }, 2000);
      }

      const nextId = (await publicClient.readContract({
        address: ARC_RECEIPTS_ADDRESS,
        abi: ARC_RECEIPTS_ABI,
        functionName: "nextReceiptId",
      })) as bigint;

      setExpectedReceiptId(nextId.toString());

      await writePayWithReceiptAsync({
        address: ARC_RECEIPTS_ADDRESS,
        abi: ARC_RECEIPTS_ABI,
        functionName: "payWithReceipt",
        args: [
          toAddress,
          usdcAmount,
          category,
          reason,
          sourceCurrency,
          destinationCurrency,
          corridor,
        ],
      });
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Transaction failed");
    }
  }

  const isPaySubmitting = isPayPending || isPayConfirming;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-slate-50">
            Recent activity
          </h1>
          <p className="text-sm text-slate-400">
            Create new receipt payments on Arc and keep a verifiable history
            for accounting and audits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-400 text-slate-50 shadow-[0_0_18px_rgba(56,189,248,0.6)] border border-sky-300"
        >
          <span className="text-lg leading-none">＋</span>
          <span>NEW RECEIPT PAYMENT</span>
        </button>
      </header>

      {isFormOpen && (
        <div className="bg-[#050814] border border-sky-500/60 rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.35)] p-5 space-y-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                New receipt payment
              </h2>
              <p className="text-xs text-slate-400">
                Fill in the amount and optional metadata. The button will
                approve USDC if needed, then send and create a receipt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-slate-100 text-lg px-2"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Recipient (optional)
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                  placeholder="0x... (leave empty to send to yourself)"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Amount (USDC) *
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                  placeholder="1.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Required. USDC 
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {" "}
                  {allowanceValue
                    ? `${formatUsdc(allowanceValue)} USDC`
                    : ""}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-slate-200">
                Category (optional)
              </label>
              <select
                className="w-full md:w-64 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                value={category}
                onChange={(e) => setCategory(Number(e.target.value))}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1 text-slate-200">
                Note / description (optional)
              </label>
              <input
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                placeholder="Add a note for this payment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Token type from (optional)
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                  value={sourceCurrency}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSourceCurrency(value);
                    setCorridor(`${value}-${destinationCurrency}`);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Token type to (optional)
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
                  value={destinationCurrency}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDestinationCurrency(value);
                    setCorridor(`${sourceCurrency}-${value}`);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-200">
                  Payment route (auto)
                </label>
                <input
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
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

            {payTxHash && (
              <div className="text-xs text-slate-400">
                Tx hash:{" "}
                <a
                  href={`https://testnet.arcscan.app/tx/${payTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  View on ArcScan
                </a>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPaySubmitting || !isConnected}
                className="rounded-full px-5 py-2 bg-sky-500 hover:bg-sky-400 text-sm font-medium text-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(56,189,248,0.6)]"
              >
                {isPaySubmitting
                  ? "Processing..."
                  : "Approve & send with receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] space-y-3">
        <h2 className="text-sm font-semibold text-slate-50">
          Last receipt for this wallet
        </h2>

        {lastMyReceiptLoading ? (
          <div className="py-4 text-sm text-slate-400">
            Loading last receipt...
          </div>
        ) : lastMyReceiptError ? (
          <div className="py-4 text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-md px-3">
            {lastMyReceiptError}
          </div>
        ) : !lastMyReceipt ? (
          <div className="py-4 text-sm text-slate-400">
            No receipts have been created yet for this wallet.
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/80 border border-sky-500/60 shadow-[0_0_20px_rgba(56,189,248,0.5)] px-4 py-3 text-xs text-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">
                  PAYMENT RECEIPT
                </span>
                <span className="text-[11px] text-slate-500">
                  #{lastMyReceipt.id.toString()}
                </span>
              </div>
              <Link href={`/receipt/${lastMyReceipt.id.toString()}`}>
                <span className="text-[11px] px-3 py-1 rounded-full bg-slate-50 text-slate-900 cursor-pointer hover:bg-slate-200">
                  View details
                </span>
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">From</span>
                <span className="text-[11px] text-slate-200 truncate max-w-[160px]">
                  {lastMyReceipt.from}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 px-1">→</span>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500">To</span>
                <span className="text-[11px] text-slate-200 truncate max-w-[160px]">
                  {lastMyReceipt.to}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">
                  Amount (USDC)
                </span>
                <span className="text-sm font-semibold text-slate-50">
                  {formatUsdc(lastMyReceipt.amount)} USDC
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500">Payment route</span>
                <span className="text-[11px] text-slate-200">
                  {lastMyReceipt.corridor}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{formatTimestamp(lastMyReceipt.timestamp)}</span>
              <span>
                {lastMyReceipt.sourceCurrency} →{" "}
                {lastMyReceipt.destinationCurrency}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
