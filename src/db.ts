import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "users.db"));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_wallets (
    user_id INTEGER PRIMARY KEY,
    address TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function saveUserWallet(userId: number, address: string, privateKey: string) {
  db.prepare(`
    INSERT OR REPLACE INTO user_wallets (user_id, address, private_key)
    VALUES (?, ?, ?)
  `).run(userId, address, privateKey);
}

export function getUserWallet(userId: number): { address: string; privateKey: string } | null {
  const row = db.prepare(`
    SELECT address, private_key FROM user_wallets WHERE user_id = ?
  `).get(userId) as { address: string; private_key: string } | undefined;

  if (!row) return null;
  return { address: row.address, privateKey: row.private_key };
}

export function deleteUserWallet(userId: number) {
  db.prepare(`DELETE FROM user_wallets WHERE user_id = ?`).run(userId);
}