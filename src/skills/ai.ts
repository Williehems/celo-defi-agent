import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are CeloDefiAgent, an autonomous DeFi agent running on Celo blockchain.
You help users with DeFi actions on Celo mainnet.

You can perform these actions by responding with a JSON command:
- Check balance: {"action": "balance", "address": "0x..."}
- Send cUSD: {"action": "transfer", "to": "0x...", "amount": "5"}
- Check CELO price: {"action": "price"}
- General question: {"action": "chat", "reply": "your response here"}

Rules:
- If user wants to check a balance, extract the address and return the balance JSON
- If user wants to send cUSD, extract to address and amount
- If user asks about price, return price action
- For general questions, return chat action with a helpful reply
- Always respond with ONLY a valid JSON object, nothing else
- Be concise and helpful
- You know about Celo, cUSD, CELO token, DeFi, and blockchain`;

export async function processAIMessage(
  userMessage: string,
  userWallet?: string
): Promise<{
  action: string;
  address?: string;
  to?: string;
  amount?: string;
  reply?: string;
}> {
  const contextMessage = userWallet
    ? `User's connected wallet: ${userWallet}\n\nUser message: ${userMessage}`
    : `User message: ${userMessage}`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contextMessage },
    ],
    max_tokens: 200,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content || '{"action":"chat","reply":"Sorry, I could not process that."}';
  
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { action: "chat", reply: text };
  }
}