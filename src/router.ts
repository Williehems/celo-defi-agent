import { transferCUSD } from "./skills/transfer";
import { getBalance } from "./skills/balance";

export type Action =
  | { type: "transfer"; to: string; amount: string }
  | { type: "balance"; address: string }
  | { type: "swap"; tokenIn: string; tokenOut: string; amount: string }
  | { type: "stake"; amount: string };

export async function routeAction(action: Action) {
  switch (action.type) {
    case "transfer":
      return await transferCUSD(action.to, action.amount);
    case "balance":
      return await getBalance(action.address);
    case "swap":
      return { error: "Swap skill coming soon" };
    case "stake":
      return { error: "Stake skill coming soon" };
    default:
      return { error: "Unknown action" };
  }
}