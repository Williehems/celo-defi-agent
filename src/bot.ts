import TelegramBot from "node-telegram-bot-api";
import { getBalance } from "./skills/balance";
import { transferCUSD } from "./skills/transfer";
import { processAIMessage } from "./skills/ai";
import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN as string;
export const bot = new TelegramBot(token, { polling: true });

// Store user wallets and states
const userWallets: Record<number, string> = {};
const userStates: Record<number, { state: string; data?: any }> = {};

const mainMenu = {
  inline_keyboard: [
    [{ text: "💰 My Balance", callback_data: "balance" }, { text: "📊 Portfolio", callback_data: "portfolio" }],
    [{ text: "💸 Send cUSD", callback_data: "send_cusd" }, { text: "📈 CELO Price", callback_data: "price" }],
    [{ text: "🔗 Connect Wallet", callback_data: "connect" }, { text: "🤖 Agent Info", callback_data: "agent" }],
    [{ text: "💱 Swap Tokens", callback_data: "swap" }, { text: "🔔 Price Alert", callback_data: "alert" }],
    [{ text: "❓ Help", callback_data: "help" }, { text: "🏠 Home", callback_data: "home" }],
  ]
};

// /start
bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || "there";
  bot.sendMessage(msg.chat.id,
`👋 Hey ${name}! Welcome to *CeloDefiAgent*

I'm an autonomous DeFi agent on Celo blockchain.
I can check balances, send cUSD, track portfolios, set price alerts and more.

Tap a button to get started 👇`,
  { parse_mode: "Markdown", reply_markup: mainMenu });
});

// /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
`*CeloDefiAgent — All Commands*

*Wallet*
/connect — Connect your wallet
/balance — Check your balance
/balance <address> — Check any address

*Transfers*
/transfer <to> <amount> — Send cUSD

*Market*
/price — CELO live price

*Portfolio*
/portfolio — View your portfolio

*Agent*
/agent — Agent identity & info
/menu — Show main menu

💬 Or just *chat naturally!*
Example: _"What's the balance of 0x123?"_`,
  { parse_mode: "Markdown", reply_markup: mainMenu });
});

// /menu
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, "Choose an action 👇", { reply_markup: mainMenu });
});

// /price
bot.onText(/\/price/, async (msg) => {
  await sendCeloPrice(msg.chat.id);
});

// /balance (no address)
bot.onText(/\/balance$/, async (msg) => {
  const wallet = userWallets[msg.from!.id];
  if (!wallet) {
    return bot.sendMessage(msg.chat.id,
      "❌ No wallet connected.\nUse /connect <address> first.",
      { reply_markup: { inline_keyboard: [[{ text: "🔗 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  await sendBalance(msg.chat.id, wallet);
});

// /balance <address>
bot.onText(/\/balance (.+)/, async (msg, match) => {
  const address = match?.[1]?.trim();
  if (!address) return;
  await sendBalance(msg.chat.id, address);
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
\`${address}\`

What would you like to do?`,
  { parse_mode: "Markdown", reply_markup: mainMenu });
});

// /transfer
bot.onText(/\/transfer (.+) (.+)/, async (msg, match) => {
  const to = match?.[1]?.trim();
  const amount = match?.[2]?.trim();
  if (!to || !amount) return;
  await sendTransfer(msg.chat.id, to, amount);
});

// /agent
bot.onText(/\/agent/, (msg) => {
  sendAgentInfo(msg.chat.id);
});

// /portfolio
bot.onText(/\/portfolio/, async (msg) => {
  const wallet = userWallets[msg.from!.id];
  if (!wallet) {
    return bot.sendMessage(msg.chat.id, "❌ Connect your wallet first.",
      { reply_markup: { inline_keyboard: [[{ text: "🔗 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  await sendPortfolio(msg.chat.id, wallet);
});

// Handle inline buttons
bot.on("callback_query", async (query) => {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  bot.answerCallbackQuery(query.id);

  if (query.data === "home") {
    bot.sendMessage(chatId, "🏠 Main Menu", { reply_markup: mainMenu });
  }

  if (query.data === "balance") {
    const wallet = userWallets[userId];
    if (!wallet) {
      return bot.sendMessage(chatId,
        "❌ No wallet connected yet.\n\nTap below to connect:",
        { reply_markup: { inline_keyboard: [[{ text: "🔗 Connect Wallet", callback_data: "connect" }]] } }
      );
    }
    await sendBalance(chatId, wallet);
  }

  if (query.data === "portfolio") {
    const wallet = userWallets[userId];
    if (!wallet) {
      return bot.sendMessage(chatId, "❌ Connect your wallet first.",
        { reply_markup: { inline_keyboard: [[{ text: "🔗 Connect Wallet", callback_data: "connect" }]] } }
      );
    }
    await sendPortfolio(chatId, wallet);
  }

  if (query.data === "connect") {
    userStates[userId] = { state: "awaiting_wallet" };
    bot.sendMessage(chatId, "📝 Send me your Celo wallet address (starts with 0x):");
  }

  if (query.data === "send_cusd") {
    userStates[userId] = { state: "awaiting_transfer_address" };
    bot.sendMessage(chatId, "📝 Enter the *recipient's* Celo address:", { parse_mode: "Markdown" });
  }

  if (query.data === "price") {
    await sendCeloPrice(chatId);
  }

  if (query.data === "agent") {
    sendAgentInfo(chatId);
  }

  if (query.data === "swap") {
    bot.sendMessage(chatId,
`💱 *Token Swap*

Coming soon! I'll be able to swap:
• CELO → cUSD
• cUSD → CELO
• Any Ubeswap pair

Stay tuned 🔜`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }

  if (query.data === "alert") {
    userStates[userId] = { state: "awaiting_alert_price" };
    bot.sendMessage(chatId,
`🔔 *Set Price Alert*

Enter the CELO price you want to be alerted at:
Example: \`0.85\``,
    { parse_mode: "Markdown" });
  }

  if (query.data === "help") {
    bot.sendMessage(chatId,
`*CeloDefiAgent — Button Guide*

💰 *My Balance* — Check your connected wallet
📊 *Portfolio* — Full portfolio summary
💸 *Send cUSD* — Transfer cUSD step by step
📈 *CELO Price* — Live price + 24h change
🔗 *Connect Wallet* — Link your Celo address
🤖 *Agent Info* — About this agent
💱 *Swap Tokens* — Swap tokens (coming soon)
🔔 *Price Alert* — Get notified at target price
🏠 *Home* — Back to main menu

💬 You can also just *type naturally!*`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }
});

// Handle state-based text input
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const state = userStates[userId];

  // State: waiting for wallet address
  if (state?.state === "awaiting_wallet") {
    const address = msg.text.trim();
    if (!address.startsWith("0x")) {
      return bot.sendMessage(chatId, "❌ Invalid address. Must start with 0x. Try again:");
    }
    userWallets[userId] = address;
    delete userStates[userId];
    return bot.sendMessage(chatId,
`✅ *Wallet Connected!*
\`${address}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }

  // State: waiting for transfer recipient
  if (state?.state === "awaiting_transfer_address") {
    const address = msg.text.trim();
    if (!address.startsWith("0x")) {
      return bot.sendMessage(chatId, "❌ Invalid address. Must start with 0x. Try again:");
    }
    userStates[userId] = { state: "awaiting_transfer_amount", data: { to: address } };
    return bot.sendMessage(chatId, `💰 How much cUSD do you want to send?`);
  }

  // State: waiting for transfer amount
  if (state?.state === "awaiting_transfer_amount") {
    const amount = msg.text.trim();
    const to = state.data?.to;
    delete userStates[userId];
    await sendTransfer(chatId, to, amount);
    return;
  }

  // State: waiting for alert price
  if (state?.state === "awaiting_alert_price") {
    const targetPrice = parseFloat(msg.text.trim());
    if (isNaN(targetPrice)) {
      return bot.sendMessage(chatId, "❌ Invalid price. Enter a number like 0.85");
    }
    delete userStates[userId];

    bot.sendMessage(chatId,
`✅ *Alert Set!*

I'll notify you when CELO reaches $${targetPrice}
Checking every 60 seconds... 🔔`,
    { parse_mode: "Markdown", reply_markup: mainMenu });

    const interval = setInterval(async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd");
        const data = await res.json() as { celo: { usd: number } };
        const price = data?.celo?.usd;
        if (!price) return;
        if (price >= targetPrice) {
          clearInterval(interval);
          bot.sendMessage(chatId,
`🔔 *Price Alert Triggered!*

CELO has reached *$${price.toFixed(4)}* USD
Your target was $${targetPrice} 🎯`,
          { parse_mode: "Markdown", reply_markup: mainMenu });
        }
      } catch {}
    }, 60000);
    return;
  }

  // Default: AI chat
  bot.sendMessage(chatId, "🤖 Thinking...");
  try {
    const result = await processAIMessage(msg.text, userWallets[userId]);

    if (result.action === "balance") {
      const address = result.address || userWallets[userId];
      if (!address) {
        return bot.sendMessage(chatId, "❌ No address found. Connect your wallet first.",
          { reply_markup: { inline_keyboard: [[{ text: "🔗 Connect Wallet", callback_data: "connect" }]] } }
        );
      }
      await sendBalance(chatId, address);
    } else if (result.action === "transfer") {
      if (!result.to || !result.amount) {
        return bot.sendMessage(chatId, "❌ Please specify address and amount.");
      }
      await sendTransfer(chatId, result.to, result.amount);
    } else if (result.action === "price") {
      await sendCeloPrice(chatId);
    } else {
      bot.sendMessage(chatId, result.reply || "I didn't understand that.",
        { reply_markup: mainMenu });
    }
  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
  }
});

// Helper functions
async function sendBalance(chatId: number, address: string) {
  bot.sendMessage(chatId, "⏳ Checking balance...");
  try {
    const result = await getBalance(address);
    bot.sendMessage(chatId,
`💰 *Balance*

💵 cUSD: *${Number(result.cUSD).toFixed(4)}*
🪙 CELO: *${Number(result.CELO).toFixed(4)}*

📍 \`${address}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
  }
}

async function sendPortfolio(chatId: number, wallet: string) {
  bot.sendMessage(chatId, "⏳ Loading portfolio...");
  try {
    const result = await getBalance(wallet);
    const celoPrice = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd")
      .then(r => r.json()) as { celo: { usd: number } };
    const celoUSD = Number(result.CELO) * (celoPrice?.celo?.usd || 0);
    const totalUSD = Number(result.cUSD) + celoUSD;
    bot.sendMessage(chatId,
`📊 *Portfolio Summary*

💵 cUSD: *${Number(result.cUSD).toFixed(4)}* ($${Number(result.cUSD).toFixed(2)})
🪙 CELO: *${Number(result.CELO).toFixed(4)}* ($${celoUSD.toFixed(2)})

💼 Total: *$${totalUSD.toFixed(2)} USD*

📍 \`${wallet}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
  }
}

async function sendTransfer(chatId: number, to: string, amount: string) {
  bot.sendMessage(chatId, `⏳ Sending ${amount} cUSD...`);
  try {
    const result = await transferCUSD(to, amount);
    bot.sendMessage(chatId,
`✅ *Transfer Complete!*

Amount: *${amount} cUSD*
To: \`${to}\`
TX: \`${result.hash}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ ${String(e)}`);
  }
}

async function sendCeloPrice(chatId: number) {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd&include_24hr_change=true");
    const data = await res.json() as { celo: { usd: number; usd_24h_change: number } };
    const price = data?.celo?.usd;
    const change = data?.celo?.usd_24h_change;
    if (!price) throw new Error("Price unavailable");
    const arrow = change >= 0 ? "📈" : "📉";
    bot.sendMessage(chatId,
`${arrow} *CELO Price*

💵 $${price.toFixed(4)} USD
${change >= 0 ? "+" : ""}${change.toFixed(2)}% (24h)`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Could not fetch price: ${String(e)}`);
  }
}

function sendAgentInfo(chatId: number) {
  bot.sendMessage(chatId,
`🤖 *CeloDefiAgent*

📍 \`0xdD2a0211de1E64af76491056F433273c3D503B2A\`
⛓ Celo Mainnet
💰 Payment: cUSD (x402)
🔧 Skills: balance, transfer, swap, stake
📡 ERC-8004 compliant

🌐 https://celo-defi-agent-production.up.railway.app`,
  { parse_mode: "Markdown", reply_markup: mainMenu });
}

console.log("🤖 Telegram bot started");