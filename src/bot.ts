import TelegramBot from "node-telegram-bot-api";
import { getBalance } from "./skills/balance";
import { transferCUSD } from "./skills/transfer";
import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN as string;
export const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
`👋 Welcome to *CeloDefiAgent*!

I'm an autonomous DeFi agent running on Celo blockchain.

*Commands:*
/balance <address> — Check cUSD & CELO balance
/transfer <to> <amount> — Send cUSD
/agent — View agent identity
/help — Show commands

⚡ Powered by Celo`, { parse_mode: "Markdown" });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
`*CeloDefiAgent Commands:*

/balance <address>
→ Check cUSD & CELO balance of any address

/transfer <to\_address> <amount>
→ Send cUSD to any address

/agent
→ View agent identity & skills

*Agent Wallet:*
\`0xdD2a0211de1E64af76491056F433273c3D503B2A\``, { parse_mode: "Markdown" });
});

bot.onText(/\/agent/, (msg) => {
  bot.sendMessage(msg.chat.id,
`*CeloDefiAgent Identity*

🤖 Name: CeloDefiAgent
📍 Address: \`0xdD2a0211de1E64af76491056F433273c3D503B2A\`
⛓ Network: Celo Mainnet
💰 Payment Token: cUSD
🔧 Skills: balance, transfer, swap, stake

🌐 Endpoint: https://celo-defi-agent-production.up.railway.app`, { parse_mode: "Markdown" });
});

bot.onText(/\/balance (.+)/, async (msg, match) => {
  const address = match?.[1]?.trim();
  if (!address) {
    return bot.sendMessage(msg.chat.id, "❌ Please provide an address\nUsage: /balance 0x123...");
  }

  bot.sendMessage(msg.chat.id, "⏳ Checking balance...");

  try {
    const result = await getBalance(address);
    bot.sendMessage(msg.chat.id,
`💰 *Balance for*
\`${result.address}\`

cUSD: *${result.cUSD}*
CELO: *${result.CELO}*`, { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${String(e)}`);
  }
});

bot.onText(/\/transfer (.+) (.+)/, async (msg, match) => {
  const to = match?.[1]?.trim();
  const amount = match?.[2]?.trim();

  if (!to || !amount) {
    return bot.sendMessage(msg.chat.id, "❌ Usage: /transfer 0x123... 1.5");
  }

  bot.sendMessage(msg.chat.id, `⏳ Sending ${amount} cUSD to ${to}...`);

  try {
    const result = await transferCUSD(to, amount);
    bot.sendMessage(msg.chat.id,
`✅ *Transfer Complete!*

Amount: *${amount} cUSD*
To: \`${to}\`
TX: \`${result.hash}\`
Status: ${result.status}`, { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${String(e)}`);
  }
});

console.log("🤖 Telegram bot started");