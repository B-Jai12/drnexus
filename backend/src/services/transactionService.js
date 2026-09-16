const { query: dbQuery, initDatabase } = require("../db/supabase");

function toMonthLabel(dateValue) {
  return new Date(dateValue).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function toTransactionDto(row) {
  return {
    id: String(row.id),
    date: new Date(row.date).toISOString().slice(0, 10),
    merchant: row.merchant,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    category: row.category,
    confidence: Number(row.confidence ?? 0),
    isAnomaly: Boolean(row.is_anomaly),
    anomalySeverity: row.anomaly_severity || "normal",
    zScore: Number(row.z_score ?? 0),
    isRecurring: Boolean(row.is_recurring),
    month: row.month || toMonthLabel(row.date),
  };
}

async function getTransactionsFromDb(params, userId = "demo-user") {
  await initDatabase();
  const page = Math.max(Number(params.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(params.pageSize || 10), 1), 100);
  const search = String(params.search || "").trim();
  const category = String(params.category || "").trim();
  const type = String(params.type || "").trim().toLowerCase();
  const sortColMap = {
    date: "date",
    amount: "amount",
    merchant: "merchant",
    category: "category",
    type: "type",
  };
  const sortBy = sortColMap[params.sortBy] || "date";
  const sortOrder = String(params.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const conditions = ["user_id = $1"];
  const values = [userId];

  if (category && category !== "all") {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  if (type && ["debit", "credit"].includes(type)) {
    values.push(type);
    conditions.push(`type = $${values.length}`);
  }

  if (params.startDate) {
    values.push(new Date(String(params.startDate)).toISOString());
    conditions.push(`date >= $${values.length}`);
  }

  if (params.endDate) {
    values.push(new Date(String(params.endDate)).toISOString());
    conditions.push(`date <= $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(merchant ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }

  const whereClause = conditions.join(" AND ");

  const countSql = `SELECT COUNT(*)::int as total FROM transactions WHERE ${whereClause}`;
  const countRes = await dbQuery(countSql, values);
  const total = countRes.rows[0]?.total || 0;

  const offset = (page - 1) * pageSize;
  const dataValues = [...values, pageSize, offset];
  const dataSql = `SELECT * FROM transactions WHERE ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`;

  const dataRes = await dbQuery(dataSql, dataValues);

  return {
    data: dataRes.rows.map(toTransactionDto),
    total,
    page,
    pageSize,
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

  const debit = rows.filter((r) => r.type === "debit").reduce((sum, r) => sum + Number(r.amount), 0);
  const credit = rows.filter((r) => r.type === "credit").reduce((sum, r) => sum + Number(r.amount), 0);
  const savingsRatio = credit > 0 ? Math.max(0, Math.min(1, (credit - debit) / credit)) : 0;

  const anomalyCount = rows.filter((r) => r.is_anomaly).length;
  const anomalyPenalty = Math.min(30, anomalyCount * 5);

  const recurringCount = rows.filter((r) => r.is_recurring).length;
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

async function getDashboardOverviewFromDb(userId = "demo-user") {
  await initDatabase();

  // Check if we have user_insights first
  const insightRes = await dbQuery(
    "SELECT * FROM user_insights WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 1",
    [userId]
  );
  const insight = insightRes.rows[0];

  const txRes = await dbQuery(
    "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC",
    [userId]
  );
  const rows = txRes.rows;

  if (!rows.length && !insight) return null;

  if (insight && (!rows.length || (insight.summary && Object.keys(insight.summary).length > 0))) {
    // If insight exists, use its rich parsed ML summary & structures
    return {
      summary: insight.summary || {},
      categories: insight.summary?.categories || {},
      transactions: rows.slice(0, 10).map(toTransactionDto),
      categoryBreakdown: insight.summary?.category_breakdown || insight.category_breakdown || [],
      monthlyOverview: insight.monthly_overview || [],
      forecast: insight.forecast || {},
      anomalies: insight.anomalies || [],
      recurringMerchants: insight.recurring_merchants || [],
      mlInfo: insight.ml_info || { categorization: "supabase-postgresql" },
    };
  }

  const debitRows = rows.filter((t) => t.type === "debit");
  const creditRows = rows.filter((t) => t.type === "credit");

  const totalDebit = debitRows.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCredit = creditRows.reduce((sum, t) => sum + Number(t.amount), 0);
  const netSavings = totalCredit - totalDebit;

  const categoryMap = {};
  for (const txn of debitRows) {
    categoryMap[txn.category] = (categoryMap[txn.category] || 0) + Number(txn.amount);
  }

  const topCategories = Object.entries(categoryMap)
    .map(([name, amount]) => ({
      category: name,
      amount: Number(amount.toFixed(2)),
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
    const amt = Number(txn.amount);
    if (txn.type === "credit") monthMap[key].income += amt;
    if (txn.type === "debit") monthMap[key].expenses += amt;
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
    .filter((t) => t.is_anomaly)
    .slice(0, 5)
    .map((t) => ({
      merchant: t.merchant,
      amount: Number(t.amount),
      date: new Date(t.date).toISOString().slice(0, 10),
      severity: t.anomaly_severity || "normal",
      zScore: Number(t.z_score ?? 0),
    }));

  const recurringMerchants = [...new Set(rows.filter((t) => t.is_recurring).map((t) => t.merchant))].slice(0, 10);

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
      categorization: "supabase-postgresql",
    },
  };
}

async function getHealthScoreFromDb(userId = "demo-user") {
  await initDatabase();
  const txRes = await dbQuery(
    "SELECT * FROM transactions WHERE user_id = $1",
    [userId]
  );
  if (!txRes.rows.length) return null;
  return computeHealthScoreFromRows(txRes.rows);
}

async function getAnalyticsFromDb(userId = "demo-user") {
  await initDatabase();
  const txRes = await dbQuery(
    "SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC",
    [userId]
  );
  const rows = txRes.rows;
  if (!rows.length) return null;

  function getISOWeek(dateObj) {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
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
    const amt = Number(t.amount);

    byMonth[ym] = (byMonth[ym] || 0) + amt;
    byWeek[wk] = (byWeek[wk] || 0) + amt;
    byCategory[t.category] = (byCategory[t.category] || 0) + amt;
    byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + amt;
    hourBuckets[heatmapKey] = (hourBuckets[heatmapKey] || 0) + amt;
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
