import { walletClient, publicClient } from "../wallet";
import { parseUnits, formatUnits } from "viem";

// Ubeswap V2 Router on Celo Mainnet
const UBESWAP_ROUTER = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";
const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const CUSD_TOKEN = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const WETH = "0x122013fd7dF1C6F636a5bb8f03108E876548b455";

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

const erc20ABI = [
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
] as const;

export type SwapDirection = "CELO_TO_CUSD" | "CUSD_TO_CELO";

export async function getSwapQuote(
  direction: SwapDirection,
  amountIn: string
): Promise<string> {
  const tokenIn = direction === "CELO_TO_CUSD" ? CELO_TOKEN : CUSD_TOKEN;
  const tokenOut = direction === "CELO_TO_CUSD" ? CUSD_TOKEN : CELO_TOKEN;
  const path = [tokenIn, WETH, tokenOut] as `0x${string}`[];
  const amount = parseUnits(amountIn, 18);

  const amounts = await publicClient.readContract({
    address: UBESWAP_ROUTER,
    abi: routerABI,
    functionName: "getAmountsOut",
    args: [amount, path],
  });

  return formatUnits(amounts[amounts.length - 1], 18);
}

export async function executeSwap(
  direction: SwapDirection,
  amountIn: string,
  slippage: number = 0.5
): Promise<{ hash: string; amountOut: string }> {
  const tokenIn = direction === "CELO_TO_CUSD" ? CELO_TOKEN : CUSD_TOKEN;
  const tokenOut = direction === "CELO_TO_CUSD" ? CUSD_TOKEN : CELO_TOKEN;
  const path = [tokenIn, WETH, tokenOut] as `0x${string}`[];
  const amount = parseUnits(amountIn, 18);

  // Get quote
  const amounts = await publicClient.readContract({
    address: UBESWAP_ROUTER,
    abi: routerABI,
    functionName: "getAmountsOut",
    args: [amount, path],
  });

  const amountOut = amounts[amounts.length - 1];
  const amountOutMin = (amountOut * BigInt(Math.floor((1 - slippage / 100) * 1000))) / 1000n;

  // Approve router to spend tokenIn
  const allowance = await publicClient.readContract({
    address: tokenIn as `0x${string}`,
    abi: erc20ABI,
    functionName: "allowance",
    args: [walletClient.account.address, UBESWAP_ROUTER as `0x${string}`],
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

  // Execute swap
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
  const hash = await walletClient.writeContract({
    address: UBESWAP_ROUTER as `0x${string}`,
    abi: routerABI,
    functionName: "swapExactTokensForTokens",
    args: [amount, amountOutMin, path, walletClient.account.address, deadline],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return {
    hash,
    amountOut: formatUnits(amountOut, 18),
  };
}