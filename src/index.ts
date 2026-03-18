import "./bot"
import "dotenv/config";
import express from "express";
import { agentMetadata } from "./wallet";

const app = express();
app.use(express.json());

app.get("/.well-known/agent.json", (_, res) => {
  res.json(agentMetadata);
});

app.get("/health", (_, res) =>
  res.json({ status: "ok", agent: agentMetadata.name })
);

const PORT = Number(process.env.PORT) || 3000;

app.get("/balance/:address", async (req, res) => {
  try {
    const { getBalance } = await import("./skills/balance");
    const result = await getBalance(req.params.address);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/action", async (req, res) => {
  try {
    const { paymentTx, callerAddress, action } = req.body;
    if (!paymentTx || !callerAddress || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const { verifyX402Payment } = await import("./payment");
    const paid = await verifyX402Payment(paymentTx);
    if (!paid) {
      return res.status(402).json({
        error: "Payment required",
        paymentInfo: {
          token: "cUSD",
          amount: "0.1",
          recipient: process.env.AGENT_ADDRESS,
          network: "celo",
        },
      });
    }
    const { routeAction } = await import("./router");
    const result = await routeAction(action);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught error:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const server = app.listen(PORT, () =>
  console.log(`CeloAgent running on port ${PORT}`)
);

server.on("error", (err) => {
  console.error("Server error:", err);
});