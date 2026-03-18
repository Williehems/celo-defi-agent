# CeloDefiAgent 🤖

An autonomous DeFi agent on Celo blockchain with Telegram interface, ERC-8004 identity, and x402 payment gating.

## Live Demo
- **Telegram:** https://t.me/CeloDefiAgentBot
- **API:** https://celo-defi-agent-production.up.railway.app
- **Agent Identity:** https://celo-defi-agent-production.up.railway.app/.well-known/agent.json

## What it does

CeloDefiAgent is a fully autonomous agent that lives on the internet with its own wallet and economic identity. Users interact via Telegram — no technical knowledge required.

### Features
- 🆕 Create or import a Celo wallet directly in Telegram
- 💰 Check wallet balances (cUSD + CELO)
- 💸 Send cUSD to any address
- 💱 Swap CELO ↔ cUSD via Ubeswap
- 📊 Portfolio tracker with live USD value
- 🔔 Price alerts — get notified when CELO hits your target
- 🤖 AI chat — interact in plain natural language
- 🔑 Secure wallet management with private key reveal

## Architecture
User → Telegram Bot → CeloDefiAgent → Celo Mainnet
↕
HTTP API (x402 payment gate)
↕
ERC-8004 Agent Identity
## Standards

- **ERC-8004** — Agent identity and skill declaration
- **x402** — Pay-per-use HTTP payment protocol
- **Ubeswap V2** — Token swaps on Celo mainnet

## Skills

| Skill | Description | Status |
|-------|-------------|--------|
| balance | Check cUSD & CELO balance | ✅ Live |
| transfer | Send cUSD to any address | ✅ Live |
| swap | Swap CELO ↔ cUSD via Ubeswap | ✅ Live |
| portfolio | Track holdings in USD | ✅ Live |
| price alerts | Notify at target price | ✅ Live |
| AI chat | Natural language interface | ✅ Live |
| stake | Stake CELO for rewards | 🔜 Soon |

## API Endpoints
GET  /                        → Landing page
GET  /health                  → Health check
GET  /.well-known/agent.json  → ERC-8004 agent identity
GET  /balance/:address        → Check any address balance
POST /action                  → Execute action (requires x402 payment)
### x402 Payment
All `/action` calls require 0.1 cUSD payment to agent wallet:
`0xdD2a0211de1E64af76491056F433273c3D503B2A`

### Example Action Request
```bash
curl -X POST https://celo-defi-agent-production.up.railway.app/action \
  -H "Content-Type: application/json" \
  -d '{
    "paymentTx": "0x...",
    "callerAddress": "0x...",
    "action": {
      "type": "balance",
      "address": "0x..."
    }
  }'
Stack
Runtime: Node.js + TypeScript
Blockchain: viem (Celo mainnet)
Server: Express
Bot: Telegram Bot API
AI: Groq (Llama 3.3 70B)
Deployment: Railway
DEX: Ubeswap V2
Run Locally
git clone https://github.com/Williehems/celo-defi-agent
cd celo-defi-agent
npm install
Create .env:
AGENT_PRIVATE_KEY=0x...
AGENT_ADDRESS=0x...
CELO_RPC_URL=https://rpc.ankr.com/celo
TELEGRAM_BOT_TOKEN=...
GROQ_API_KEY=...
PORT=3000
npx tsc --skipLibCheck
node dist/index.js
Hackathon
Built for the Celo AI Agents Hackathon 2026
Track 1: Best Agent on Celo
Track 3: Highest Rank on agentscan
License
MIT