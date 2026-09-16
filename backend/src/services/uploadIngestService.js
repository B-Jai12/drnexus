const { query, initDatabase } = require("../db/supabase");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeType(value) {
  const v = String(value || "").toLowerCase();
  return v === "credit" || v === "cr" ? "credit" : "debit";
}

function parseDateFromMl(dateText, monthText) {
  const dateStr = String(dateText || "").trim();
  const monthStr = String(monthText || "").trim();

  // ML may return "YYYY-MM-DD".
  const iso = new Date(dateStr);
  if (!Number.isNaN(iso.getTime())) return iso;

  // ML currently may return "18 Mar" and month "Mar 2026".
  const dayMatch = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3,9})$/);
  const monthMatch = monthStr.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (dayMatch && monthMatch) {
    const [, day, dateMonth] = dayMatch;
    const [, monthName, year] = monthMatch;
    const monthToUse = dateMonth || monthName;
    const dt = new Date(`${monthToUse} ${day}, ${year}`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // Fallback to month first day.
  if (monthMatch) {
    const [, monthName, year] = monthMatch;
    const dt = new Date(`${monthName} 1, ${year}`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  return new Date();
}

function inferSourceName(filename) {
  const name = String(filename || "").toLowerCase();
  if (name.includes("gpay") || name.includes("google")) return "gpay";
  if (name.includes("phonepe")) return "phonepe";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "excel";
  if (name.endsWith(".pdf")) return "pdf";
  return "upload";
}

function mapMlTransaction(txn, defaultSource = "upload") {
  const parsedDate = parseDateFromMl(txn?.date, txn?.month);
  return {
    date: parsedDate,
    merchant: String(txn?.merchant || txn?.description || "Unknown").trim(),
    description: String(txn?.description || txn?.merchant || "Unknown").trim(),
    category: String(txn?.category || "Personal & UPI").trim(),
    type: normalizeType(txn?.type),
    amount: toNumber(txn?.amount, 0),
    confidence: toNumber(txn?.confidence, 0),
    isAnomaly: Boolean(txn?.is_anomaly ?? txn?.isAnomaly),
    anomalySeverity: String(txn?.anomaly_severity || txn?.anomalySeverity || "normal"),
    zScore: toNumber(txn?.z_score ?? txn?.zScore, 0),
    isRecurring: Boolean(txn?.is_recurring ?? txn?.isRecurring),
    month: String(txn?.month || parsedDate.toLocaleString("en-US", { month: "short", year: "numeric" })),
    source: String(txn?.source || defaultSource),
    currency: "INR",
  };
}

async function saveMlTransactionsForUser({ userId = "demo-user", filename, mlPayload, mode = "replace-range" }) {
  await initDatabase();
  const transactions = Array.isArray(mlPayload?.transactions) ? mlPayload.transactions : [];
  if (!transactions.length) {
    return { saved: 0, deleted: 0, dateRange: null };
  }

  const source = inferSourceName(filename);
  const mapped = transactions.map((txn) => ({
    userId,
    ...mapMlTransaction(txn, source),
  }));

  const dates = mapped.map((t) => t.date).filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  let deletedCount = 0;
  let dateRange = null;

  if (dates.length && mode === "replace-range") {
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    dateRange = { from: minDate, to: maxDate };

    const deleteRes = await query(
      "DELETE FROM transactions WHERE user_id = $1 AND date >= $2 AND date <= $3",
      [userId, minDate.toISOString(), maxDate.toISOString()]
    );
    deletedCount = deleteRes.rowCount || 0;
  }

  // Batch insert into PostgreSQL
  let savedCount = 0;
  for (const t of mapped) {
    await query(
      `INSERT INTO transactions (
        user_id, date, merchant, description, category, type, amount,
        confidence, is_anomaly, anomaly_severity, z_score, is_recurring,
        month, source, currency, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      [
        t.userId,
        t.date.toISOString(),
        t.merchant,
        t.description,
        t.category,
        t.type,
        t.amount,
        t.confidence,
        t.isAnomaly,
        t.anomalySeverity,
        t.zScore,
        t.isRecurring,
        t.month,
        t.source,
        t.currency,
      ]
    );
    savedCount++;
  }

  return {
    saved: savedCount,
    deleted: deletedCount,
    dateRange,
  };
}

async function saveMlInsightForUser({ userId = "demo-user", filename, mlPayload }) {
  await initDatabase();
  const summary = mlPayload?.summary || {};
  const monthlyOverview = mlPayload?.monthly_overview || mlPayload?.monthlyOverview || [];
  const forecast = mlPayload?.forecast || {};
  const recommendations = mlPayload?.recommendations || {};
  const anomalies = mlPayload?.anomalies || [];
  const recurringMerchants = mlPayload?.recurring_merchants || mlPayload?.recurringMerchants || [];
  const mlInfo = mlPayload?.ml_info || mlPayload?.mlInfo || {};
  const transactionCount = Number(mlPayload?.transaction_count ?? mlPayload?.summary?.transaction_count ?? 0);

  const res = await query(
    `INSERT INTO user_insights (
      user_id, source_filename, summary, monthly_overview, forecast,
      recommendations, anomalies, recurring_merchants, ml_info, transaction_count,
      imported_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      source_filename = EXCLUDED.source_filename,
      summary = EXCLUDED.summary,
      monthly_overview = EXCLUDED.monthly_overview,
      forecast = EXCLUDED.forecast,
      recommendations = EXCLUDED.recommendations,
      anomalies = EXCLUDED.anomalies,
      recurring_merchants = EXCLUDED.recurring_merchants,
      ml_info = EXCLUDED.ml_info,
      transaction_count = EXCLUDED.transaction_count,
      imported_at = NOW(),
      updated_at = NOW()
    RETURNING *`,
    [
      userId,
      filename || "",
      JSON.stringify(summary),
      JSON.stringify(monthlyOverview),
      JSON.stringify(forecast),
      JSON.stringify(recommendations),
      JSON.stringify(anomalies),
      JSON.stringify(recurringMerchants),
      JSON.stringify(mlInfo),
      transactionCount,
    ]
  );

  return res.rows[0];
}

module.exports = {
  saveMlTransactionsForUser,
  saveMlInsightForUser,
};
