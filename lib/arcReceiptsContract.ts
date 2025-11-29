export const ARC_RECEIPTS_ADDRESS = "0x5d4821a82df5dEBBc518f9f9FFCcA4fA3c06629F";

export const ARC_RECEIPTS_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "address", name: "token", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "string", name: "corridor", type: "string" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "ReceiptCreated",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getReceipt",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "address", name: "token", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          {
            components: [
              { internalType: "uint8", name: "category", type: "uint8" },
              { internalType: "string", name: "reason", type: "string" },
              { internalType: "string", name: "sourceCurrency", type: "string" },
              { internalType: "string", name: "destinationCurrency", type: "string" },
              { internalType: "string", name: "corridor", type: "string" },
            ],
            internalType: "struct ArcMultiTokenReceipts.ReceiptMetadata",
            name: "meta",
            type: "tuple",
          },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct ArcMultiTokenReceipts.Receipt",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextReceiptId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_token", type: "address" },
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
      {
        components: [
          { internalType: "uint8", name: "category", type: "uint8" },
          { internalType: "string", name: "reason", type: "string" },
          { internalType: "string", name: "sourceCurrency", type: "string" },
          { internalType: "string", name: "destinationCurrency", type: "string" },
          { internalType: "string", name: "corridor", type: "string" },
        ],
        internalType: "struct ArcMultiTokenReceipts.ReceiptMetadata",
        name: "_meta",
        type: "tuple",
      },
    ],
    name: "payWithReceipt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;