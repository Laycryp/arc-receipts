import { Abi } from "viem";

export const ARC_RECEIPTS_ADDRESS =
  "0xC45862084da60048624CAA1647D141bB9342307a" as const;

export const ARC_RECEIPTS_ABI: Abi = [
  {
    type: "function",
    name: "payWithReceipt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "category", type: "uint8" },
      { name: "reason", type: "string" },
      { name: "sourceCurrency", type: "string" },
      { name: "destinationCurrency", type: "string" },
      { name: "corridor", type: "string" },
    ],
    // نقدر نترك الـ output كما هو، حتى لو ما نستخدمه في الواجهة
    outputs: [{ name: "receiptId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "category", type: "uint8" },
          { name: "reason", type: "string" },
          { name: "sourceCurrency", type: "string" },
          { name: "destinationCurrency", type: "string" },
          { name: "corridor", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "nextReceiptId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // 👇 دالة ترجع IDs الخاصة بالمحفظة المتصلة
  {
    type: "function",
    name: "getMyReceiptIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  // 👇 دالة ترجع كل الإيصالات (struct[]) للمحفظة المتصلة
  {
    type: "function",
    name: "getMyReceipts",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "category", type: "uint8" },
          { name: "reason", type: "string" },
          { name: "sourceCurrency", type: "string" },
          { name: "destinationCurrency", type: "string" },
          { name: "corridor", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
];
