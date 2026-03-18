import "dotenv/config";
import express from "express";
import { agentMetadata } from "./wallet";
import "./bot";

const app = express();
app.use(express.json());

// Landing page
app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CeloDefiAgent</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #e8e8e8;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 48px;
      border-bottom: 1px solid #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fff;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #555;
    }
    .dot {
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
    }
    main {
      flex: 1;
      padding: 96px 48px;
      max-width: 680px;
    }
    h1 {
      font-size: 48px;
      font-weight: 400;
      line-height: 1.15;
      color: #fff;
      margin-bottom: 24px;
      letter-spacing: -0.02em;
    }
    h1 span { color: #555; }
    p.tagline {
      font-size: 16px;
      color: #666;
      line-height: 1.7;
      margin-bottom: 56px;
      max-width: 480px;
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 0;
      border-top: 1px solid #1a1a1a;
    }
    .link-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 0;
      border-bottom: 1px solid #1a1a1a;
      text-decoration: none;
      color: #e8e8e8;
      transition: color 0.15s;
    }
    .link-item:hover { color: #fff; }
    .link-item:hover .arrow { color: #fff; }
    .link-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .link-label {
      font-size: 15px;
      font-weight: 400;
    }
    .link-desc {
      font-size: 13px;
      color: #444;
      margin-top: 2px;
    }
    .arrow {
      color: #333;
      font-size: 18px;
      transition: color 0.15s;
    }
    .skills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 56px;
    }
    .skill {
      padding: 6px 14px;
      border: 1px solid #1e1e1e;
      border-radius: 2px;
      font-size: 12px;
      color: #555;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    footer {
      padding: 32px 48px;
      border-top: 1px solid #1a1a1a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    footer span { font-size: 12px; color: #333; }
    .address {
      font-size: 12px;
      color: #333;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">CeloDefiAgent</div>
    <div class="status">
      <div class="dot"></div>
      <span>Live on Celo Mainnet</span>
    </div>
  </header>

  <main>
    <h1>Autonomous DeFi<br/><span>on Celo.</span></h1>
    <p class="tagline">
      An AI agent with its own wallet, identity, and economic agency.
      Executes DeFi actions on-chain — accessible via Telegram or HTTP.
    </p>

    <div class="skills">
      <div class="skill">Balance</div>
      <div class="skill">Transfer</div>
      <div class="skill">Swap</div>
      <div class="skill">Portfolio</div>
      <div class="skill">Price Alerts</div>
      <div class="skill">AI Chat</div>
      <div class="skill">ERC-8004</div>
      <div class="skill">x402</div>
    </div>

    <div class="links">
      <a class="link-item" href="https://t.me/CeloDefiAgentBot" target="_blank">
        <div class="link-left">
          <div>
            <div class="link-label">Telegram Bot</div>
            <div class="link-desc">Interact with the agent directly</div>
          </div>
        </div>
        <span class="arrow">→</span>
      </a>
      <a class="link-item" href="/.well-known/agent.json">
        <div class="link-left">
          <div>
            <div class="link-label">Agent Identity</div>
            <div class="link-desc">ERC-8004 machine-readable profile</div>
          </div>
        </div>
        <span class="arrow">→</span>
      </a>
      <a class="link-item" href="/health">
        <div class="link-left">
          <div>
            <div class="link-label">Health Check</div>
            <div class="link-desc">API status and uptime</div>
          </div>
        </div>
        <span class="arrow">→</span>
      </a>
      <a class="link-item" href="https://github.com/Williehems/celo-defi-agent" target="_blank">
        <div class="link-left">
          <div>
            <div class="link-label">Source Code</div>
            <div class="link-desc">Open source on GitHub</div>
          </div>
        </div>
        <span class="arrow">→</span>
      </a>
    </div>
  </main>

  <footer>
    <span>Built for Celo AI Agents Hackathon 2026</span>
    <span class="address">0xdD2a0211de1E64af76491056F433273c3D503B2A</span>
  </footer>
</body>
</html>`);
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