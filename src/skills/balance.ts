import { publicClient } from "../wallet";
import { formatUnits } from "viem";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const balanceABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function getBalance(address: string) {
  const cUSDRaw = await publicClient.readContract({
    address: CUSD_ADDRESS,
    abi: balanceABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  const celoRaw = await publicClient.getBalance({
    address: address as `0x${string}`,
  });

  return {
    address,
    cUSD: formatUnits(cUSDRaw, 18),
    CELO: formatUnits(celoRaw, 18),
  };
}