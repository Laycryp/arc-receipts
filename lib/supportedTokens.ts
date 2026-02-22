export type TokenConfig = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  icon?: string; 
};

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000", // عنوان USDC الحقيقي على Arc
    decimals: 6,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // عنوان EURC الحقيقي على Arc
    decimals: 6,
  },
  JPYC: {
    symbol: "JPYC",
    name: "Japanese Yen Coin",
    // تأكد من وضع عنوان الين الذي أنشأته في Remix هنا
    address: "0x1111111111111111111111111111111111111111", 
    decimals: 18,
  },
  BRLA: {
    symbol: "BRLA",
    name: "Brazilian Real Token",
    // تأكد من وضع عنوان الريال الذي أنشأته في Remix هنا
    address: "0x2222222222222222222222222222222222222222", 
    decimals: 18,
  }
};