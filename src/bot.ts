import { processAIMessage } from "./skills/ai";
import TelegramBot from "node-telegram-bot-api";
import { getBalance } from "./skills/balance";
import { transferCUSD } from "./skills/transfer";
import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN as string;
export const bot = new TelegramBot(token, { polling: true });

// Store user wallet addresses in memory
const userWallets: Record<number, string> = {};

// /start
bot.onText(/\/start/, (msg) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: "💰 Check Balance", callback_data: "balance" }],
      [{ text: "💸 Send cUSD", callback_data: "transfer" }],
      [{ text: "🤖 Agent Info", callback_data: "agent" }],
      [{ text: "🔗 Connect Wallet", callback_data: "connect" }],
    ]
  };
  bot.sendMessage(msg.chat.id,
`👋 Welcome to *CeloDefiAgent*!

I'm an autonomous DeFi agent on Celo blockchain.
I can check balances and send cUSD for you.

To get started, connect your wallet or use the menu below:`,
  { parse_mode: "Markdown", reply_markup: keyboard });
});

// Handle inline button presses
bot.on("callback_query", async (query) => {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;

  bot.answerCallbackQuery(query.id);

  if (query.data === "connect") {
    bot.sendMessage(chatId,
`🔗 *Connect Your Wallet*

Send me your Celo wallet address and I'll save it for quick access.

Example:
\`/connect 0x123...\``,
    { parse_mode: "Markdown" });
  }

  if (query.data === "balance") {
    const wallet = userWallets[userId];
    if (!wallet) {
      return bot.sendMessage(chatId,
`❌ No wallet connected.

Use /connect <address> to save your wallet first.`);
    }
    bot.sendMessage(chatId, "⏳ Checking balance...");
    try {
      const result = await getBalance(wallet);
      bot.sendMessage(chatId,
`💰 *Your Balance*

cUSD: *${Number(result.cUSD).toFixed(4)}*
CELO: *${Number(result.CELO).toFixed(4)}*

📍 \`${wallet}\``,
      { parse_mode: "Markdown" });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
    }
  }

  if (query.data === "transfer") {
    bot.sendMessage(chatId,
`💸 *Send cUSD*

Format:
\`/transfer <to_address> <amount>\`

Example:
\`/transfer 0x123... 5\`

⚠️ Make sure the agent wallet has cUSD to send.`,
    { parse_mode: "Markdown" });
  }

  if (query.data === "agent") {
    bot.sendMessage(chatId,
`🤖 *CeloDefiAgent Info*

📍 Address: \`0xdD2a0211de1E64af76491056F433273c3D503B2A\`
⛓ Network: Celo Mainnet
💰 Payment: cUSD
🔧 Skills: balance, transfer, swap, stake

🌐 https://celo-defi-agent-production.up.railway.app`,
    { parse_mode: "Markdown" });
  }
});

// /connect <address>
bot.onText(/\/connect (.+)/, (msg, match) => {
  const address = match?.[1]?.trim();
  if (!address || !address.startsWith("0x")) {
    return bot.sendMessage(msg.chat.id, "❌ Invalid address. Must start with 0x");
  }
  userWallets[msg.from!.id] = address;
  bot.sendMessage(msg.chat.id,
`✅ *Wallet Connected!*

📍 \`${address}\`

Now you can use /balance to check your balance instantly.`,
  { parse_mode: "Markdown" });
});

// /balance (no address needed if wallet connected)
bot.onText(/\/balance$/, async (msg) => {
  const wallet = userWallets[msg.from!.id];
  if (!wallet) {
    return bot.sendMessage(msg.chat.id,
      "❌ No wallet connected.\nUse /connect <address> first.");
  }
  bot.sendMessage(msg.chat.id, "⏳ Checking balance...");
  try {
    const result = await getBalance(wallet);
    bot.sendMessage(msg.chat.id,
`💰 *Your Balance*

cUSD: *${Number(result.cUSD).toFixed(4)}*
CELO: *${Number(result.CELO).toFixed(4)}*`,
    { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${String(e)}`);
  }
});

// /balance <address>
bot.onText(/\/balance (.+)/, async (msg, match) => {
  const address = match?.[1]?.trim();
  if (!address) return;
  bot.sendMessage(msg.chat.id, "⏳ Checking balance...");
  try {
    const result = await getBalance(address);
    bot.sendMessage(msg.chat.id,
`💰 *Balance*

cUSD: *${Number(result.cUSD).toFixed(4)}*
CELO: *${Number(result.CELO).toFixed(4)}*

📍 \`${address}\``,
    { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${String(e)}`);
  }
});

// /transfer <to> <amount>
bot.onText(/\/transfer (.+) (.+)/, async (msg, match) => {
  const to = match?.[1]?.trim();
  const amount = match?.[2]?.trim();
  if (!to || !amount) {
    return bot.sendMessage(msg.chat.id, "❌ Usage: /transfer 0x123... 1.5");
  }
  bot.sendMessage(msg.chat.id, `⏳ Sending ${amount} cUSD...`);
  try {
    const result = await transferCUSD(to, amount);
    bot.sendMessage(msg.chat.id,
`✅ *Transfer Complete!*

Amount: *${amount} cUSD*
To: \`${to}\`
TX: \`${result.hash}\``,
    { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${String(e)}`);
  }
});

// /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
`*CeloDefiAgent Commands*

/connect <address> — Save your wallet
/balance — Check your balance
/balance <address> — Check any address
/transfer <to> <amount> — Send cUSD
/agent — Agent info
/help — Show this menu`,
  { parse_mode: "Markdown" });
});
// AI chat — handle any plain text message
bot.on("message", async (msg) => {
  // Skip commands
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const userWallet = userWallets[userId];

  bot.sendMessage(chatId, "🤖 Thinking...");

  try {
    const result = await processAIMessage(msg.text, userWallet);

    if (result.action === "balance") {
      const address = result.address || userWallet;
      if (!address) {
        return bot.sendMessage(chatId, "❌ No address found. Connect your wallet with /connect <address>");
      }
      const balance = await getBalance(address);
      bot.sendMessage(chatId,
`💰 *Balance*

cUSD: *${Number(balance.cUSD).toFixed(4)}*
CELO: *${Number(balance.CELO).toFixed(4)}*

📍 \`${address}\``,
      { parse_mode: "Markdown" });

    } else if (result.action === "transfer") {
      if (!result.to || !result.amount) {
        return bot.sendMessage(chatId, "❌ Please specify address and amount.\nExample: send 5 cUSD to 0x123...");
      }
      bot.sendMessage(chatId, `⏳ Sending ${result.amount} cUSD...`);
      const tx = await transferCUSD(result.to, result.amount);
      bot.sendMessage(chatId,
`✅ *Transfer Complete!*

Amount: *${result.amount} cUSD*
To: \`${result.to}\`
TX: \`${tx.hash}\``,
      { parse_mode: "Markdown" });

    } else if (result.action === "price") {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd");
      const data = await res.json() as { celo: { usd: number } };
      bot.sendMessage(chatId,
`📈 *CELO Price*

$${data.celo.usd} USD`,
      { parse_mode: "Markdown" });

    } else {
      bot.sendMessage(chatId, result.reply || "I didn't understand that. Try /help");
    }

  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
  }
});

console.log("🤖 Telegram bot started");