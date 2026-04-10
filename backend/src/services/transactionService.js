const Transaction = require("../models/Transaction");

function toMonthLabel(dateValue) {
  return new Date(dateValue).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function toTransactionDto(doc) {
  return {
    id: doc._id.toString(),
    date: new Date(doc.date).toISOString().slice(0, 10),
    merchant: doc.merchant,
    description: doc.description,
    amount: doc.amount,
    type: doc.type,
    category: doc.category,
    confidence: doc.confidence ?? 0,
    isAnomaly: Boolean(doc.isAnomaly),
    anomalySeverity: doc.anomalySeverity || "normal",
    zScore: doc.zScore ?? 0,
    isRecurring: Boolean(doc.isRecurring),
    month: doc.month || toMonthLabel(doc.date),
  };
}

async function getTransactionsFromDb(query, userId = "demo-user") {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
  const search = String(query.search || "").trim();
  const category = String(query.category || "").trim();
  const type = String(query.type || "").trim().toLowerCase();
  const sortBy = ["date", "amount", "merchant", "category", "type"].includes(query.sortBy) ? query.sortBy : "date";
  const sortOrder = String(query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const filter = { userId };
  if (category) filter.category = category;
  if (type && ["debit", "credit"].includes(type)) filter.type = type;
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(String(query.startDate));
    if (query.endDate) filter.date.$lte = new Date(String(query.endDate));
  }
  if (search) {
    filter.$or = [
      { merchant: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    Transaction.find(filter).sort({ [sortBy]: sortOrder }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Transaction.countDocuments(filter),
  ]);

  return {
    data: rows.map(toTransactionDto),
    total,
    page,
    pageSize,
  };
}

async function getDashboardOverviewFromDb(userId = "demo-user") {
  const rows = await Transaction.find({ userId }).sort({ date: -1 }).lean();
  if (!rows.length) return null;

  const debitRows = rows.filter((t) => t.type === "debit");
  const creditRows = rows.filter((t) => t.type === "credit");

  const totalDebit = debitRows.reduce((sum, t) => sum + t.amount, 0);
  const totalCredit = creditRows.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalCredit - totalDebit;

  const categoryMap = {};
  for (const txn of debitRows) {
    categoryMap[txn.category] = (categoryMap[txn.category] || 0) + txn.amount;
  }

  const topCategories = Object.entries(categoryMap)
    .map(([name, amount]) => ({
      category: name,
      amount,
      percentage: totalDebit > 0 ? Math.round((amount / totalDebit) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const monthMap = {};
  for (const txn of rows) {
    const key = new Date(txn.date).toISOString().slice(0, 7);
    if (!monthMap[key]) {
      monthMap[key] = { income: 0, expenses: 0 };
    }
    if (txn.type === "credit") monthMap[key].income += txn.amount;
    if (txn.type === "debit") monthMap[key].expenses += txn.amount;
  }
  const monthlyOverview = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([ym, value]) => ({
      month: new Date(`${ym}-01T00:00:00.000Z`).toLocaleString("en-US", { month: "short" }),
      income: Number(value.income.toFixed(2)),
      expenses: Number(value.expenses.toFixed(2)),
    }));

  const anomalies = rows
    .filter((t) => t.isAnomaly)
    .slice(0, 5)
    .map((t) => ({
      merchant: t.merchant,
      amount: t.amount,
      date: new Date(t.date).toISOString().slice(0, 10),
      severity: t.anomalySeverity || "normal",
      zScore: t.zScore ?? 0,
    }));

  const recurringMerchants = [...new Set(rows.filter((t) => t.isRecurring).map((t) => t.merchant))].slice(0, 10);

  return {
    summary: {
      healthScore: computeHealthScoreFromRows(rows).score,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      netSavings: Number(netSavings.toFixed(2)),
      transactionCount: rows.length,
    },
    categories: categoryMap,
    transactions: rows.slice(0, 10).map(toTransactionDto),
    categoryBreakdown: topCategories,
    monthlyOverview,
    anomalies,
    recurringMerchants,
    mlInfo: {
      categorization: "db-aggregated",
    },
  };
}

function computeHealthScoreFromRows(rows) {
  if (!rows.length) {
    return {
      score: 50,
      label: "Stable",
      breakdown: {
        spendingStability: 50,
        savingPotential: 50,
        recurringCommitments: 50,
        cashflowPredictability: 50,
      },
    };
  }

  const debit = rows.filter((r) => r.type === "debit").reduce((sum, r) => sum + r.amount, 0);
  const credit = rows.filter((r) => r.type === "credit").reduce((sum, r) => sum + r.amount, 0);
  const savingsRatio = credit > 0 ? Math.max(0, Math.min(1, (credit - debit) / credit)) : 0;

  const anomalyCount = rows.filter((r) => r.isAnomaly).length;
  const anomalyPenalty = Math.min(30, anomalyCount * 5);

  const recurringCount = rows.filter((r) => r.isRecurring).length;
  const recurringHealth = Math.max(20, 80 - recurringCount * 2);

  const spendingStability = Math.max(20, 85 - anomalyPenalty);
  const savingPotential = Math.round(40 + savingsRatio * 60);
  const recurringCommitments = Math.round(recurringHealth);
  const cashflowPredictability = Math.round((spendingStability + recurringCommitments) / 2);

  const score = Math.round(
    spendingStability * 0.3 + savingPotential * 0.35 + recurringCommitments * 0.15 + cashflowPredictability * 0.2
  );

  let label = "Fair";
  if (score >= 80) label = "Excellent";
  else if (score >= 65) label = "Good";
  else if (score >= 50) label = "Stable";

  return {
    score,
    label,
    breakdown: {
      spendingStability,
      savingPotential,
      recurringCommitments,
      cashflowPredictability,
    },
  };
}

async function getHealthScoreFromDb(userId = "demo-user") {
  const rows = await Transaction.find({ userId }).lean();
  if (!rows.length) return null;
  return computeHealthScoreFromRows(rows);
}

async function getAnalyticsFromDb(userId = "demo-user") {
  const rows = await Transaction.find({ userId }).sort({ date: 1 }).lean();
  if (!rows.length) return null;

  function getISOWeek(dateObj) {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  const byWeek = {};
  const byMonth = {};
  const byCategory = {};
  const byMerchant = {};
  const hourBuckets = {};

  for (const t of rows) {
    if (t.type !== "debit") continue;
    const date = new Date(t.date);
    const ym = date.toISOString().slice(0, 7);
    const wk = getISOWeek(date);
    const day = date.toLocaleString("en-US", { weekday: "short" });
    const hour = date.getHours();
    const heatmapKey = `${day}-${hour}`;

    byMonth[ym] = (byMonth[ym] || 0) + t.amount;
    byWeek[wk] = (byWeek[wk] || 0) + t.amount;
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
    hourBuckets[heatmapKey] = (hourBuckets[heatmapKey] || 0) + t.amount;
  }

  const monthlyTrend = Object.entries(byMonth).map(([month, amount]) => ({
    month: new Date(`${month}-01T00:00:00.000Z`).toLocaleString("en-US", { month: "short" }),
    amount: Number(amount.toFixed(2)),
  }));

  const sortedWeeks = Object.keys(byWeek).sort();
  const weeklyTrends = sortedWeeks.slice(-12).map((week) => ({
    week,
    amount: Number(byWeek[week].toFixed(2)),
  }));

  let weekOverWeekChange = 0;
  let trend = "stable";
  if (weeklyTrends.length >= 2) {
    const currentWeekInfo = weeklyTrends[weeklyTrends.length - 1];
    const prevWeekInfo = weeklyTrends[weeklyTrends.length - 2];
    if (prevWeekInfo.amount > 0) {
      weekOverWeekChange = ((currentWeekInfo.amount - prevWeekInfo.amount) / prevWeekInfo.amount) * 100;
    }
    trend = weekOverWeekChange > 5 ? "up" : weekOverWeekChange < -5 ? "down" : "stable";
  }

  const totalDebit = Object.values(byCategory).reduce((sum, val) => sum + val, 0);
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalDebit > 0 ? Math.round((amount / totalDebit) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = Object.entries(byMerchant)
    .map(([merchant, amount]) => ({ merchant, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmap = [];
  let peakDay = "N/A";
  let peakHourStr = "N/A";
  let peakAmount = -1;

  for (const day of DAYS) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const amount = hourBuckets[key] ? Number(hourBuckets[key].toFixed(2)) : 0;
      heatmap.push({ day, hour, amount });
      
      if (amount > peakAmount && amount > 0) {
        peakAmount = amount;
        peakDay = day;
        peakHourStr = `${hour}:00`;
      }
    }
  }

  const peakSpendingHour = peakAmount > 0 ? `${peakDay} ${peakHourStr}` : "N/A";

  return {
    peakSpendingHour,
    weekendVsWeekday: "computed-from-db",
    monthlyTrend,
    categoryBreakdown,
    weeklyTrends,
    trend,
    weekOverWeekChange: Number(weekOverWeekChange.toFixed(2)),
    topMerchants,
    subscriptions: [],
    heatmap,
  };
}

module.exports = {
  getTransactionsFromDb,
  getDashboardOverviewFromDb,
  getHealthScoreFromDb,
  getAnalyticsFromDb,
};
