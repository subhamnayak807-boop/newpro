export const APP_CONFIG = {
  // Replace with the wallet address that should receive payment.
  merchantWallet: "0x44d071d0de1f5fa315bd00b8750f86d75822b7c4",

  // BNB Smart Chain Mainnet
  chainIdHex: "0x38",
  chainName: "BNB Smart Chain",
  rpcUrls: ["https://bsc-dataseed.binance.org/"],
  blockExplorerUrls: ["https://bscscan.com"],
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },

  // USDT BEP20 contract on BSC mainnet
  usdtContract: "0x55d398326f99059fF775485246999027B3197955",
  usdtDecimals: 18,
  amountToPay: "0.1",
};
