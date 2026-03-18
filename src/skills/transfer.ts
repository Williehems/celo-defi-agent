import { walletClient, publicClient } from "../wallet";
import { parseUnits } from "viem";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const transferABI = [
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
] as const;

export async function transferCUSD(to: string, amount: string) {
  const hash = await walletClient.writeContract({
    address: CUSD_ADDRESS,
    abi: transferABI,
    functionName: "transfer",
    args: [to as `0x${string}`, parseUnits(amount, 18)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status };
}