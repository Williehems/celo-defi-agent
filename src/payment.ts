import { publicClient } from "./wallet";
import { parseUnits } from "viem";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const PAYMENT_AMOUNT = parseUnits("0.1", 18);

const transferEvent = {
  name: "Transfer",
  type: "event",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

export async function verifyX402Payment(
  txHash: string,
): Promise<boolean> {
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== "success") return false;

    const agentAddress = process.env.AGENT_ADDRESS as `0x${string}`;

    const logs = await publicClient.getLogs({
      address: CUSD_ADDRESS as `0x${string}`,
      event: transferEvent,
      args: { to: agentAddress },
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    return logs.some((log) => (log.args.value ?? 0n) >= PAYMENT_AMOUNT);
  } catch {
    return false;
  }
}