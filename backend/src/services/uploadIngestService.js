const Transaction = require("../models/Transaction");
const UserInsight = require("../models/UserInsight");

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
    category: String(txn?.category || "Misc").trim(),
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

async function saveMlTransactionsForUser({ userId, filename, mlPayload, mode = "replace-range" }) {
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

    const deleteResult = await Transaction.deleteMany({
      userId,
      date: { $gte: minDate, $lte: maxDate },
    });
    deletedCount = deleteResult.deletedCount || 0;
  }

  const insertResult = await Transaction.insertMany(mapped);
  return {
    saved: insertResult.length,
    deleted: deletedCount,
    dateRange,
  };
}

module.exports = {
  saveMlTransactionsForUser,
};

async function saveMlInsightForUser({ userId, filename, mlPayload }) {
  const update = {
    sourceFilename: filename || "",
    summary: mlPayload?.summary || {},
    monthlyOverview: mlPayload?.monthly_overview || mlPayload?.monthlyOverview || [],
    forecast: mlPayload?.forecast || {},
    recommendations: mlPayload?.recommendations || {},
    anomalies: mlPayload?.anomalies || [],
    recurringMerchants: mlPayload?.recurring_merchants || mlPayload?.recurringMerchants || [],
    mlInfo: mlPayload?.ml_info || mlPayload?.mlInfo || {},
    transactionCount: Number(mlPayload?.transaction_count ?? mlPayload?.summary?.transaction_count ?? 0),
    importedAt: new Date(),
  };

  return UserInsight.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true }
  ).lean();
}

module.exports.saveMlInsightForUser = saveMlInsightForUser;
