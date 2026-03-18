import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS user_wallets (
    user_id BIGINT PRIMARY KEY,
    address TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(console.error);

export async function saveUserWallet(userId: number, address: string, privateKey: string) {
  await pool.query(
    `INSERT INTO user_wallets (user_id, address, private_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
     SET address = $2, private_key = $3`,
    [userId, address, privateKey]
  );
}

export async function getUserWallet(userId: number): Promise<{ address: string; privateKey: string } | null> {
  const result = await pool.query(
    `SELECT address, private_key FROM user_wallets WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return {
    address: result.rows[0].address,
    privateKey: result.rows[0].private_key,
  };
}

export async function deleteUserWallet(userId: number) {
  await pool.query(`DELETE FROM user_wallets WHERE user_id = $1`, [userId]);
}