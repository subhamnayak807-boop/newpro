import { APP_CONFIG } from "./config.js";

const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const payBtn = document.getElementById("payBtn");
const walletStatus = document.getElementById("walletStatus");
const message = document.getElementById("message");
const statusBox = document.querySelector(".status-box");

let provider;
let signer;
let userAddress;

const DISCONNECT_FLAG = "walletDisconnectedByUser";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainIdToNumber(chainId) {
  if (typeof chainId === "string" && chainId.startsWith("0x")) {
    return parseInt(chainId, 16);
  }
  return Number(chainId);
}

function resetUiToDisconnected(clearMessage = false) {
  provider = undefined;
  signer = undefined;
  userAddress = undefined;

  walletStatus.textContent = "Not connected";
  statusBox.classList.remove("connected");
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  payBtn.disabled = true;

  if (clearMessage) {
    setMessage("");
  }
}

function markConnectedUi() {
  statusBox.classList.add("connected");
  connectBtn.disabled = true;
  disconnectBtn.disabled = false;
}

function parseRpcError(error) {
  const rawMessage = error?.data?.message || error?.reason || error?.message || "Payment failed.";
  const revertData = error?.data?.data || error?.error?.data;

  if (typeof revertData === "string" && revertData.startsWith("0x08c379a0")) {
    try {
      const encodedReason = `0x${revertData.slice(10)}`;
      const [reason] = ethers.utils.defaultAbiCoder.decode(["string"], encodedReason);
      return reason;
    } catch (_) {
      return rawMessage;
    }
  }

  return rawMessage;
}

async function isOnBscNetwork() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  return chainIdToNumber(chainId) === chainIdToNumber(APP_CONFIG.chainIdHex);
}

async function ensureBscNetwork() {
  if (await isOnBscNetwork()) return true;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: APP_CONFIG.chainIdHex }],
    });
    return true;
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: APP_CONFIG.chainIdHex,
            chainName: APP_CONFIG.chainName,
            rpcUrls: APP_CONFIG.rpcUrls,
            blockExplorerUrls: APP_CONFIG.blockExplorerUrls,
            nativeCurrency: APP_CONFIG.nativeCurrency,
          },
        ],
      });
      return true;
    }

    if (await isOnBscNetwork()) return true;
    return false;
  }
}

async function checkUsdtBalance(address) {
  const usdt = new ethers.Contract(APP_CONFIG.usdtContract, ERC20_ABI, provider);
  const required = ethers.utils.parseUnits(APP_CONFIG.amountToPay, APP_CONFIG.usdtDecimals);
  const balance = await usdt.balanceOf(address);

  return {
    hasEnough: balance.gte(required),
    formattedBalance: ethers.utils.formatUnits(balance, APP_CONFIG.usdtDecimals),
  };
}

async function applyConnectedState(address) {
  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  userAddress = address;

  walletStatus.textContent = `Connected: ${shortenAddress(address)}`;
  markConnectedUi();

  const { hasEnough, formattedBalance } = await checkUsdtBalance(address);
  payBtn.disabled = !hasEnough;

  if (hasEnough) {
    setMessage(`Wallet connected. Balance: ${formattedBalance} USDT. You can now pay 0.1 USDT.`, "success");
  } else {
    setMessage(
      `Insufficient USDT balance. You have ${formattedBalance} USDT but need ${APP_CONFIG.amountToPay} USDT.`,
      "error"
    );
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    setMessage(
      "No EVM wallet detected. Open this dApp in Trust Wallet browser or install Trust Wallet extension.",
      "error"
    );
    return;
  }

  if (
    !APP_CONFIG.merchantWallet ||
    APP_CONFIG.merchantWallet === "0x0000000000000000000000000000000000000000"
  ) {
    setMessage("Set merchantWallet in config.js before taking payments.", "error");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const networkOk = await ensureBscNetwork();
    if (!networkOk) {
      setMessage("Please switch Trust Wallet network to BNB Smart Chain and try again.", "error");
      return;
    }

    const account = accounts?.[0];
    if (!account) {
      throw new Error("No wallet account found.");
    }

    sessionStorage.removeItem(DISCONNECT_FLAG);
    await applyConnectedState(account);
  } catch (error) {
    resetUiToDisconnected();
    setMessage(parseRpcError(error) || "Failed to connect wallet.", "error");
  }
}

function disconnectWallet() {
  sessionStorage.setItem(DISCONNECT_FLAG, "1");
  resetUiToDisconnected();
  setMessage("Wallet disconnected from this session.", "success");
}

async function restoreConnectionIfPossible() {
  if (!window.ethereum) return;
  if (sessionStorage.getItem(DISCONNECT_FLAG) === "1") return;

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (!accounts?.length) return;

    const networkOk = await ensureBscNetwork();
    if (!networkOk) return;

    await applyConnectedState(accounts[0]);
  } catch (error) {
    resetUiToDisconnected();
    setMessage(parseRpcError(error) || "Could not restore wallet session.", "error");
  }
}

async function payUsdt() {
  if (!signer) {
    setMessage("Connect wallet first.", "error");
    return;
  }

  try {
    payBtn.disabled = true;
    setMessage("Sending transaction... Please confirm in wallet.");

    const from = userAddress || (await signer.getAddress());
    const { hasEnough, formattedBalance } = await checkUsdtBalance(from);
    if (!hasEnough) {
      throw new Error(
        `Insufficient USDT balance. You have ${formattedBalance} USDT but need ${APP_CONFIG.amountToPay} USDT.`
      );
    }

    const amount = ethers.utils.parseUnits(APP_CONFIG.amountToPay, APP_CONFIG.usdtDecimals);
    const iface = new ethers.utils.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("transfer", [APP_CONFIG.merchantWallet, amount]);

    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: APP_CONFIG.usdtContract,
          data,
          value: "0x0",
        },
      ],
    });

    setMessage(`Transaction sent: ${txHash}. Waiting for confirmation...`);

    const receipt = await provider.waitForTransaction(txHash, 1, 120000);
    if (!receipt || receipt.status !== 1) {
      throw new Error("Transaction failed or was not confirmed.");
    }

    setMessage("Payment confirmed. Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "./thankyou.html";
    }, 700);
  } catch (error) {
    const text = parseRpcError(error) || "Payment failed. Please confirm Trust Wallet is on BSC and try again.";
    setMessage(text, "error");

    if (userAddress) {
      try {
        const { hasEnough } = await checkUsdtBalance(userAddress);
        payBtn.disabled = !hasEnough;
      } catch (_) {
        payBtn.disabled = false;
      }
    } else {
      payBtn.disabled = true;
    }
  }
}

resetUiToDisconnected(true);
connectBtn.addEventListener("click", connectWallet);
disconnectBtn.addEventListener("click", disconnectWallet);
payBtn.addEventListener("click", payUsdt);
restoreConnectionIfPossible();

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
      return;
    }
    window.location.reload();
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}
