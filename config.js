export const APP_CONFIG = {
  // Replace with the wallet address that should receive payment.
  merchantWallet: "0xd08c6432FbD2c066e2a2B5B2b1546F5a05e0B8e2",

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
