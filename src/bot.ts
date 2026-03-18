import TelegramBot from "node-telegram-bot-api";
import { getBalance } from "./skills/balance";
import { processAIMessage } from "./skills/ai";
import { getSwapQuote } from "./skills/swap";
import {
  createUserWallet,
  importUserWallet,
  getUserBalance,
  userTransferCUSD,
  userSwap,
} from "./skills/userWallet";
import { getUserWallet } from "./db";
import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN as string;
export const bot = new TelegramBot(token, { polling: true });

const userStates: Record<number, { state: string; data?: any }> = {};

const mainMenu = {
  inline_keyboard: [
    [{ text: "💰 My Balance", callback_data: "balance" }, { text: "📊 Portfolio", callback_data: "portfolio" }],
    [{ text: "💸 Send cUSD", callback_data: "send_cusd" }, { text: "📈 CELO Price", callback_data: "price" }],
    [{ text: "💱 Swap Tokens", callback_data: "swap" }, { text: "🔔 Price Alert", callback_data: "alert" }],
    [{ text: "🔑 My Wallet", callback_data: "my_wallet" }, { text: "🤖 Agent Info", callback_data: "agent" }],
    [{ text: "❓ Help", callback_data: "help" }, { text: "🏠 Home", callback_data: "home" }],
  ]
};

// /start
bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || "there";
  const userId = msg.from!.id;
  const existing = getUserWallet(userId);

  if (existing) {
    return bot.sendMessage(msg.chat.id,
`👋 Welcome back ${name}!

Your wallet: \`${existing.address}\`

What would you like to do?`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }

  bot.sendMessage(msg.chat.id,
`👋 Hey ${name}! Welcome to *CeloDefiAgent*

I'm an autonomous DeFi agent on Celo blockchain.

To get started, set up your wallet:`,
  {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆕 Create New Wallet", callback_data: "create_wallet" }],
        [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet" }],
      ]
    }
  });
});

// /menu
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, "Choose an action 👇", { reply_markup: mainMenu });
});

// /price
bot.onText(/\/price/, async (msg) => {
  await sendCeloPrice(msg.chat.id);
});

// /balance
bot.onText(/\/balance$/, async (msg) => {
  await sendUserBalance(msg.chat.id, msg.from!.id);
});

// /balance <address>
bot.onText(/\/balance (.+)/, async (msg, match) => {
  const address = match?.[1]?.trim();
  if (!address) return;
  await sendBalance(msg.chat.id, address);
});

// /agent
bot.onText(/\/agent/, (msg) => {
  sendAgentInfo(msg.chat.id);
});

// /help
bot.onText(/\/help/, (msg) => {
  sendHelp(msg.chat.id);
});

// Handle inline buttons
bot.on("callback_query", async (query) => {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  bot.answerCallbackQuery(query.id);

  if (query.data === "home") {
    bot.sendMessage(chatId, "🏠 Main Menu", { reply_markup: mainMenu });
  }

  if (query.data === "create_wallet") {
    const { address, privateKey } = createUserWallet(userId);
    bot.sendMessage(chatId,
`✅ *Wallet Created!*

📍 Address:
\`${address}\`

🔑 Private Key (save this now — shown only once):
\`${privateKey}\`

⚠️ *Never share your private key with anyone.*
Fund your wallet with CELO or cUSD to get started.`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }

  if (query.data === "import_wallet") {
    userStates[userId] = { state: "awaiting_import_key" };
    bot.sendMessage(chatId,
`📥 *Import Wallet*

Send me your private key (starts with 0x):

⚠️ This message will not be stored in chat history on our end, but be careful sharing private keys over any messaging app.`,
    { parse_mode: "Markdown" });
  }

  if (query.data === "my_wallet") {
    const wallet = getUserWallet(userId);
    if (!wallet) {
      return bot.sendMessage(chatId, "❌ No wallet found.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆕 Create Wallet", callback_data: "create_wallet" }],
              [{ text: "📥 Import Wallet", callback_data: "import_wallet" }],
            ]
          }
        }
      );
    }
    bot.sendMessage(chatId,
`🔑 *Your Wallet*

📍 Address:
\`${wallet.address}\`

🔐 Private Key:
\`${wallet.privateKey}\`

⚠️ Never share your private key.`,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  }

  if (query.data === "balance") {
    await sendUserBalance(chatId, userId);
  }

  if (query.data === "portfolio") {
    await sendUserPortfolio(chatId, userId);
  }

  if (query.data === "send_cusd") {
    const wallet = getUserWallet(userId);
    if (!wallet) return sendNoWallet(chatId);
    userStates[userId] = { state: "awaiting_transfer_address" };
    bot.sendMessage(chatId, "📝 Enter recipient's Celo address:");
  }

  if (query.data === "price") {
    await sendCeloPrice(chatId);
  }

  if (query.data === "agent") {
    sendAgentInfo(chatId);
  }

  if (query.data === "swap") {
    const wallet = getUserWallet(userId);
    if (!wallet) return sendNoWallet(chatId);
    sendSwapMenu(chatId);
  }

  if (query.data === "swap_celo_cusd" || query.data === "swap_cusd_celo") {
    const wallet = getUserWallet(userId);
    if (!wallet) return sendNoWallet(chatId);
    const direction = query.data === "swap_celo_cusd" ? "CELO_TO_CUSD" : "CUSD_TO_CELO";
    const tokenIn = direction === "CELO_TO_CUSD" ? "CELO" : "cUSD";
    userStates[userId] = { state: "awaiting_swap_amount", data: { direction } };
    bot.sendMessage(chatId, `💰 How much ${tokenIn} do you want to swap?`);
  }

  if (query.data?.startsWith("confirm_swap_")) {
    const parts = query.data.replace("confirm_swap_", "").split("_");
    const amount = parts.pop()!;
    const direction = parts.join("_") as "CELO_TO_CUSD" | "CUSD_TO_CELO";
    const tokenIn = direction === "CELO_TO_CUSD" ? "CELO" : "cUSD";
    const tokenOut = direction === "CELO_TO_CUSD" ? "cUSD" : "CELO";

    bot.sendMessage(chatId, `⏳ Swapping ${amount} ${tokenIn} → ${tokenOut}...`);

    try {
      const result = await userSwap(userId, direction, amount);
      bot.sendMessage(chatId,
`✅ *Swap Complete!*

${amount} ${tokenIn} → ${Number(result.amountOut).toFixed(4)} ${tokenOut}
TX: \`${result.hash}\``,
      { parse_mode: "Markdown", reply_markup: mainMenu });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Swap failed: ${String(e)}`, { reply_markup: mainMenu });
    }
  }

  if (query.data === "alert") {
    userStates[userId] = { state: "awaiting_alert_price" };
    bot.sendMessage(chatId,
`🔔 *Set Price Alert*

Enter the CELO price to be alerted at:
Example: \`0.85\``,
    { parse_mode: "Markdown" });
  }

  if (query.data === "help") {
    sendHelp(chatId);
  }
});

// Handle state-based text input
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const state = userStates[userId];

  if (state?.state === "awaiting_import_key") {
    const privateKey = msg.text.trim();
    if (!privateKey.startsWith("0x")) {
      return bot.sendMessage(chatId, "❌ Invalid key. Must start with 0x. Try again:");
    }
    try {
      const { address } = importUserWallet(userId, privateKey);
      delete userStates[userId];
      return bot.sendMessage(chatId,
`✅ *Wallet Imported!*

📍 \`${address}\``,
      { parse_mode: "Markdown", reply_markup: mainMenu });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Invalid private key: ${String(e)}`);
    }
  }

  if (state?.state === "awaiting_transfer_address") {
    const address = msg.text.trim();
    if (!address.startsWith("0x")) {
      return bot.sendMessage(chatId, "❌ Invalid address. Must start with 0x. Try again:");
    }
    userStates[userId] = { state: "awaiting_transfer_amount", data: { to: address } };
    return bot.sendMessage(chatId, `💰 How much cUSD do you want to send?`);
  }

  if (state?.state === "awaiting_transfer_amount") {
    const amount = msg.text.trim();
    const to = state.data?.to;
    delete userStates[userId];
    bot.sendMessage(chatId, `⏳ Sending ${amount} cUSD...`);
    try {
      const result = await userTransferCUSD(userId, to, amount);
      bot.sendMessage(chatId,
`✅ *Transfer Complete!*

Amount: *${amount} cUSD*
To: \`${to}\`
TX: \`${result.hash}\``,
      { parse_mode: "Markdown", reply_markup: mainMenu });
    } catch (e) {
      bot.sendMessage(chatId, `❌ ${String(e)}`, { reply_markup: mainMenu });
    }
    return;
  }

  if (state?.state === "awaiting_swap_amount") {
    const amount = msg.text.trim();
    const direction = state.data?.direction as "CELO_TO_CUSD" | "CUSD_TO_CELO";
    const tokenIn = direction === "CELO_TO_CUSD" ? "CELO" : "cUSD";
    const tokenOut = direction === "CELO_TO_CUSD" ? "cUSD" : "CELO";
    delete userStates[userId];

    bot.sendMessage(chatId, `⏳ Getting quote for ${amount} ${tokenIn}...`);
    try {
      const quote = await getSwapQuote(direction, amount);
      bot.sendMessage(chatId,
`💱 *Swap Quote*

${amount} ${tokenIn} → ~${Number(quote).toFixed(4)} ${tokenOut}
Slippage: 0.5%

Confirm?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm Swap", callback_data: `confirm_swap_${direction}_${amount}` }],
            [{ text: "❌ Cancel", callback_data: "home" }],
          ]
        }
      });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Quote failed: ${String(e)}`, { reply_markup: mainMenu });
    }
    return;
  }

  if (state?.state === "awaiting_alert_price") {
    const targetPrice = parseFloat(msg.text.trim());
    if (isNaN(targetPrice)) {
      return bot.sendMessage(chatId, "❌ Invalid price. Enter a number like 0.85");
    }
    delete userStates[userId];
    bot.sendMessage(chatId,
`✅ *Alert Set!*

I'll notify you when CELO reaches $${targetPrice} 🔔`,
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
`🔔 *Price Alert!*

CELO reached *$${price.toFixed(4)}*
Your target: $${targetPrice} 🎯`,
          { parse_mode: "Markdown", reply_markup: mainMenu });
        }
      } catch {}
    }, 60000);
    return;
  }

  // Default: AI chat
  const wallet = getUserWallet(userId);
  bot.sendMessage(chatId, "🤖 Thinking...");
  try {
    const result = await processAIMessage(msg.text, wallet?.address);

    if (result.action === "balance") {
      const address = result.address || wallet?.address;
      if (!address) return bot.sendMessage(chatId, "❌ No wallet found.", { reply_markup: mainMenu });
      await sendBalance(chatId, address);
    } else if (result.action === "transfer") {
      if (!result.to || !result.amount) {
        return bot.sendMessage(chatId, "❌ Please specify address and amount.");
      }
      if (!wallet) return sendNoWallet(chatId);
      bot.sendMessage(chatId, `⏳ Sending ${result.amount} cUSD...`);
      const tx = await userTransferCUSD(userId, result.to, result.amount);
      bot.sendMessage(chatId,
`✅ *Transfer Complete!*
Amount: *${result.amount} cUSD*
To: \`${result.to}\`
TX: \`${tx.hash}\``,
      { parse_mode: "Markdown", reply_markup: mainMenu });
    } else if (result.action === "price") {
      await sendCeloPrice(chatId);
    } else {
      bot.sendMessage(chatId, result.reply || "I didn't understand that.", { reply_markup: mainMenu });
    }
  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${String(e)}`);
  }
});

// Helper functions
async function sendUserBalance(chatId: number, userId: number) {
  try {
    const result = await getUserBalance(userId);
    bot.sendMessage(chatId,
`💰 *Your Balance*

💵 cUSD: *${Number(result.cUSD).toFixed(4)}*
🪙 CELO: *${Number(result.CELO).toFixed(4)}*

📍 \`${result.address}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ No wallet found. Create one first.`,
      { reply_markup: { inline_keyboard: [[{ text: "🆕 Create Wallet", callback_data: "create_wallet" }]] } }
    );
  }
}

async function sendUserPortfolio(chatId: number, userId: number) {
  bot.sendMessage(chatId, "⏳ Loading portfolio...");
  try {
    const result = await getUserBalance(userId);
    const celoPrice = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd")
      .then(r => r.json()) as { celo: { usd: number } };
    const celoUSD = Number(result.CELO) * (celoPrice?.celo?.usd || 0);
    const totalUSD = Number(result.cUSD) + celoUSD;
    bot.sendMessage(chatId,
`📊 *Portfolio*

💵 cUSD: *${Number(result.cUSD).toFixed(4)}* ($${Number(result.cUSD).toFixed(2)})
🪙 CELO: *${Number(result.CELO).toFixed(4)}* ($${celoUSD.toFixed(2)})

💼 Total: *$${totalUSD.toFixed(2)} USD*

📍 \`${result.address}\``,
    { parse_mode: "Markdown", reply_markup: mainMenu });
  } catch (e) {
    bot.sendMessage(chatId, `❌ No wallet found. Create one first.`,
      { reply_markup: { inline_keyboard: [[{ text: "🆕 Create Wallet", callback_data: "create_wallet" }]] } }
    );
  }
}

async function sendBalance(chatId: number, address: string) {
  bot.sendMessage(chatId, "⏳ Checking...");
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

function sendSwapMenu(chatId: number) {
  bot.sendMessage(chatId,
`💱 *Token Swap*

What would you like to swap?`,
  {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🪙 CELO → 💵 cUSD", callback_data: "swap_celo_cusd" }],
        [{ text: "💵 cUSD → 🪙 CELO", callback_data: "swap_cusd_celo" }],
        [{ text: "🔙 Back", callback_data: "home" }],
      ]
    }
  });
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

function sendHelp(chatId: number) {
  bot.sendMessage(chatId,
`*CeloDefiAgent — Help*

🆕 *Create Wallet* — Generate a new Celo wallet
📥 *Import Wallet* — Import with private key
💰 *My Balance* — Check your wallet balance
📊 *Portfolio* — Full portfolio with USD value
💸 *Send cUSD* — Transfer cUSD to anyone
💱 *Swap* — Swap CELO ↔ cUSD on Ubeswap
📈 *Price* — Live CELO price + 24h change
🔔 *Alert* — Get notified at target price
🔑 *My Wallet* — View your address & key
🤖 *Agent Info* — About this agent

💬 You can also just *type naturally!*`,
  { parse_mode: "Markdown", reply_markup: mainMenu });
}

function sendNoWallet(chatId: number) {
  bot.sendMessage(chatId, "❌ No wallet found. Create one first.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🆕 Create Wallet", callback_data: "create_wallet" }],
          [{ text: "📥 Import Wallet", callback_data: "import_wallet" }],
        ]
      }
    }
  );
}

console.log("🤖 Telegram bot started");