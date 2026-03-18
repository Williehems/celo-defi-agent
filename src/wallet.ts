import fetch from "node-fetch";
(globalThis as any).fetch = fetch;
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";

export const account = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`
);

export const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http(process.env.CELO_RPC_URL),
});

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL),
});

export const agentMetadata = {
  name: "CeloDefiAgent",
  version: "1.0.0",
  address: account.address,
  skills: ["swap", "transfer", "stake", "balance"],
  paymentToken: "cUSD",
};