import "dotenv/config";
import express from "express";
import { agentMetadata } from "./wallet";
import "./bot";

const app = express();
app.use(express.json());

// Landing page
app.get("/", (_, res) => {
  res.send(`
    <html>
      <head><title>CeloDefiAgent</title></head>
      <body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
        <h1>🤖 CeloDefiAgent</h1>
        <p>Autonomous DeFi Agent on Celo Mainnet</p>
        <p><a href="https://t.me/CeloDefiAgentBot" style="color:#FCFF52">💬 Try on Telegram</a></p>
        <p><a href="/.well-known/agent.json" style="color:#FCFF52">📡 Agent Identity (ERC-8004)</a></p>
        <p><a href="/health" style="color:#FCFF52">❤️ Health Check</a></p>
        <hr style="border-color:#333;margin:40px 0"/>
        <p style="color:#666">Built for Celo AI Agents Hackathon 2026</p>
      </body>
    </html>
  `);
});

// ERC-8004 agent identity
app.get("/.well-known/agent.json", (_, res) => {
  res.json(agentMetadata);
});

// Health check
app.get("/health", (_, res) =>
  res.json({ status: "ok", agent: agentMetadata.name })
);

// Free balance check
app.get("/balance/:address", async (req, res) => {
  try {
    const { getBalance } = await import("./skills/balance");
    const result = await getBalance(req.params.address);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Main action endpoint with x402 payment gate
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

// Keep-alive ping every 14 minutes
setInterval(async () => {
  try {
    await fetch("https://celo-defi-agent-production.up.railway.app/health");
    console.log("Keep-alive ping sent");
  } catch {}
}, 14 * 60 * 1000);

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () =>
  console.log(`CeloAgent running on port ${PORT}`)
);

server.on("error", (err) => {
  console.error("Server error:", err);
});