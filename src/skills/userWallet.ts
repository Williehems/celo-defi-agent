import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { celo } from "viem/chains";
import { saveUserWallet, getUserWallet } from "../db";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const UBESWAP_ROUTER = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";
const WETH = "0x122013fd7dF1C6F636a5bb8f03108E876548b455";

const erc20ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const routerABI = [
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

function getUserClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(process.env.CELO_RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(process.env.CELO_RPC_URL),
  });
  return { account, walletClient, publicClient };
}

export async function createUserWallet(userId: number): Promise<{ address: string; privateKey: string }> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  await saveUserWallet(userId, account.address, privateKey);
  return { address: account.address, privateKey };
}

export async function importUserWallet(userId: number, privateKey: string): Promise<{ address: string }> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  await saveUserWallet(userId, account.address, privateKey);
  return { address: account.address };
}

export async function getUserBalance(userId: number) {
  const wallet = await getUserWallet(userId);
  if (!wallet) throw new Error("No wallet found");

  const { publicClient } = getUserClient(wallet.privateKey);

  const celoRaw = await publicClient.getBalance({
    address: wallet.address as `0x${string}`,
  });

  const cUSDRaw = await publicClient.readContract({
    address: CUSD_ADDRESS,
    abi: erc20ABI,
    functionName: "balanceOf",
    args: [wallet.address as `0x${string}`],
  });

  return {
    address: wallet.address,
    CELO: formatUnits(celoRaw, 18),
    cUSD: formatUnits(cUSDRaw, 18),
  };
}

export async function userTransferCUSD(userId: number, to: string, amount: string) {
  const wallet = await getUserWallet(userId);
  if (!wallet) throw new Error("No wallet found");

  const { walletClient, publicClient } = getUserClient(wallet.privateKey);

  const hash = await walletClient.writeContract({
    address: CUSD_ADDRESS,
    abi: erc20ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, parseUnits(amount, 18)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status };
}

export async function userSwap(
  userId: number,
  direction: "CELO_TO_CUSD" | "CUSD_TO_CELO",
  amountIn: string
) {
  const wallet = await getUserWallet(userId);
  if (!wallet) throw new Error("No wallet found");

  const { walletClient, publicClient, account } = getUserClient(wallet.privateKey);

  const tokenIn = direction === "CELO_TO_CUSD" ? CELO_TOKEN : CUSD_ADDRESS;
  const tokenOut = direction === "CELO_TO_CUSD" ? CUSD_ADDRESS : CELO_TOKEN;
  const path = [tokenIn, WETH, tokenOut] as `0x${string}`[];
  const amount = parseUnits(amountIn, 18);

  const amounts = await publicClient.readContract({
    address: UBESWAP_ROUTER,
    abi: routerABI,
    functionName: "getAmountsOut",
    args: [amount, path],
  });

  const amountOut = amounts[amounts.length - 1];
  const amountOutMin = (amountOut * 995n) / 1000n;

  const allowance = await publicClient.readContract({
    address: tokenIn as `0x${string}`,
    abi: erc20ABI,
    functionName: "allowance",
    args: [account.address, UBESWAP_ROUTER as `0x${string}`],
  });

  if (allowance < amount) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn as `0x${string}`,
      abi: erc20ABI,
      functionName: "approve",
      args: [UBESWAP_ROUTER as `0x${string}`, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
  const hash = await walletClient.writeContract({
    address: UBESWAP_ROUTER as `0x${string}`,
    abi: routerABI,
    functionName: "swapExactTokensForTokens",
    args: [amount, amountOutMin, path, account.address, deadline],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return {
    hash,
    amountOut: formatUnits(amountOut, 18),
  };
}