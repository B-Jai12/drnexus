import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://postgres.wjakoiqeosqseplpqghl:j%40ideep_2007@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

// Global pool to prevent connection leaks across serverless function re-executions
declare global {
  // eslint-disable-next-line no-var
  var __supabasePool: Pool | undefined;
}

export const pool =
  global.__supabasePool ||
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__supabasePool = pool;
}

let initPromise: Promise<void> | null = null;

export async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'demo-user',
          date TIMESTAMPTZ NOT NULL,
          merchant TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          type TEXT NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          confidence NUMERIC(5, 4) DEFAULT 0,
          is_anomaly BOOLEAN DEFAULT false,
          anomaly_severity TEXT DEFAULT 'normal',
          z_score NUMERIC(8, 2) DEFAULT 0,
          is_recurring BOOLEAN DEFAULT false,
          month TEXT,
          source TEXT DEFAULT 'upload',
          currency TEXT DEFAULT 'INR',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);

        CREATE TABLE IF NOT EXISTS user_insights (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          source_filename TEXT DEFAULT '',
          summary JSONB DEFAULT '{}'::jsonb,
          monthly_overview JSONB DEFAULT '[]'::jsonb,
          forecast JSONB DEFAULT '{}'::jsonb,
          recommendations JSONB DEFAULT '{}'::jsonb,
          anomalies JSONB DEFAULT '[]'::jsonb,
          recurring_merchants JSONB DEFAULT '[]'::jsonb,
          ml_info JSONB DEFAULT '{}'::jsonb,
          transaction_count INTEGER DEFAULT 0,
          imported_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_insights_user_imported ON user_insights(user_id, imported_at DESC);

        ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;
      `);
    } catch (err) {
      console.warn("[frontend-db] initDatabase warning:", err);
    }
  })();

  return initPromise;
}

export async function query(text: string, params?: any[]) {
  await initDatabase();
  return pool.query(text, params);
}
