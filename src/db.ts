import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "wallets.json");

interface WalletStore {
  [userId: string]: {
    address: string;
    privateKey: string;
    createdAt: string;
  };
}

function readDB(): WalletStore {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch {}
  return {};
}

function writeDB(data: WalletStore) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function saveUserWallet(userId: number, address: string, privateKey: string) {
  const db = readDB();
  db[userId.toString()] = {
    address,
    privateKey,
    createdAt: new Date().toISOString(),
  };
  writeDB(db);
}

export function getUserWallet(userId: number): { address: string; privateKey: string } | null {
  const db = readDB();
  const entry = db[userId.toString()];
  if (!entry) return null;
  return { address: entry.address, privateKey: entry.privateKey };
}

export function deleteUserWallet(userId: number) {
  const db = readDB();
  delete db[userId.toString()];
  writeDB(db);
}