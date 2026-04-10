const overviewSummary = {
  healthScore: 72,
  totalDebit: 46410,
  totalCredit: 52000,
  netSavings: 5590,
  transactionCount: 6,
};

const topCategories = [
  { name: "Food", percentage: 26 },
  { name: "Shopping", percentage: 31 },
  { name: "Travel", percentage: 12 },
  { name: "Subscriptions", percentage: 9 },
];

const dashboardCategories = {
  Food: 12066,
  Shopping: 14387,
  Travel: 5569,
  Subscriptions: 4178,
};

const dashboardTransactions = [
  {
    id: "1",
    date: "2024-03-01",
    merchant: "Swiggy",
    description: "Swiggy Order",
    category: "Food",
    confidence: 0.94,
    type: "debit",
    amount: 450,
    month: "Mar 2024",
    isAnomaly: false,
    anomalySeverity: "normal",
    zScore: 0.2,
    isRecurring: false,
  },
  {
    id: "2",
    date: "2024-03-02",
    merchant: "Salary",
    description: "Salary Credit",
    category: "Income",
    confidence: 1,
    type: "credit",
    amount: 52000,
    month: "Mar 2024",
    isAnomaly: false,
    anomalySeverity: "normal",
    zScore: 0,
    isRecurring: true,
  },
];

const dashboardCategoryBreakdown = topCategories.map((c) => ({
  category: c.name,
  amount: Math.round((overviewSummary.totalDebit * c.percentage) / 100),
  percentage: c.percentage,
}));

const monthlyOverview = [
  { month: "Jan", income: 50000, expenses: 42000 },
  { month: "Feb", income: 51000, expenses: 44500 },
  { month: "Mar", income: 52000, expenses: 46410 },
];

const recommendationsItems = [
  {
    id: "1",
    title: "Food Delivery Overspend",
    description: "Reduce food delivery by 20% to save ₹2,400 next month.",
    category: "spending",
    priority: "high",
    potentialSavings: 2400,
    actionLabel: "Set Limit",
  },
];

const predictionsAlerts = [
  {
    id: "r1",
    severity: "medium",
    title: "Food category risk rising",
    description: "Food spending trend is +28% and needs attention.",
    category: "Food",
    amount: 12066,
  },
];

const predictionsCards = [
  { month: "Next Month Forecast", predicted: 48500, actual: null, confidence: 78 },
  { month: "Top Category Risk", predicted: 13200, actual: null, confidence: 85 },
  { month: "Savings Potential", predicted: 10400, actual: 5590, confidence: 90 },
];

const analyticsMonthlyTrend = [
  { month: "Jan", amount: 42000 },
  { month: "Feb", amount: 44500 },
  { month: "Mar", amount: 46410 },
];

const analyticsWeeklyTrends = [
  { week: "W1 Mar", amount: 11200 },
  { week: "W2 Mar", amount: 9800 },
  { week: "W3 Mar", amount: 12410 },
  { week: "W4 Mar", amount: 13000 },
];

const analyticsTopMerchants = [
  { merchant: "Amazon", amount: 6400 },
  { merchant: "Swiggy", amount: 4200 },
  { merchant: "Uber", amount: 1800 },
];

const analyticsSubscriptions = [
  { name: "Netflix", amount: 649, frequency: "Monthly", category: "Subscriptions", active: true },
  { name: "Spotify", amount: 119, frequency: "Monthly", category: "Subscriptions", active: true },
];

const analyticsHeatmap = [
  { day: "Mon", hour: 6, amount: 120 },
  { day: "Mon", hour: 9, amount: 240 },
  { day: "Tue", hour: 12, amount: 420 },
  { day: "Fri", hour: 18, amount: 780 },
  { day: "Sat", hour: 21, amount: 1100 },
];

function getDashboardOverviewResponse() {
  return {
    summary: overviewSummary,
    categories: dashboardCategories,
    transactions: dashboardTransactions,
    categoryBreakdown: dashboardCategoryBreakdown,
    monthlyOverview: monthlyOverview,
    forecast: {
      predictedExpense: 48500,
      predictedIncome: 53000,
      predictedSavings: 4500,
      confidence: "medium",
      trend: "increasing",
      r2Score: 0.78,
    },
    anomalies: [
      { merchant: "Amazon", amount: 5999, date: "2024-03-03", severity: "medium", zScore: 2.3 },
    ],
    recurringMerchants: ["Netflix", "Spotify"],
    mlInfo: {
      categorization: "TF-IDF + Cosine Similarity",
    },
  };
}

function getTransactionsResponse(page = 1, pageSize = 10) {
  const transactions = [
    {
      id: "1",
      date: "2024-03-01",
      merchant: "Swiggy",
      description: "Swiggy Order",
      amount: 450,
      type: "debit",
      category: "Food",
      confidence: 0.94,
      isAnomaly: false,
      anomalySeverity: "normal",
      zScore: 0.2,
      isRecurring: false,
    },
  ];

  return {
    data: transactions,
    total: 1,
    page,
    pageSize,
  };
}

function getRecommendationsResponse() {
  return {
    summary: "You can reduce discretionary food spend and improve savings.",
    items: recommendationsItems,
    totalPotentialSavings: 2400,
    aiGenerated: true,
  };
}

function getHealthScoreResponse() {
  return {
    score: 72,
    label: "Good",
    breakdown: {
      spendingStability: 80,
      savingPotential: 65,
      recurringCommitments: 70,
      cashflowPredictability: 75,
    },
  };
}

function getPredictionsResponse() {
  return {
    nextMonthEstimate: 48500,
    riskLevel: "medium",
    categoryRisks: [
      { category: "Food", risk: "high", trend: "+28%" },
      { category: "Shopping", risk: "medium", trend: "+12%" },
    ],
    forecast: [
      { month: "Jan", actual: 42000, predicted: 41000, confidence: 84 },
      { month: "Feb", actual: 44500, predicted: 43200, confidence: 82 },
      { month: "Mar", actual: 46410, predicted: 45200, confidence: 81 },
      { month: "Next Month", actual: null, predicted: 48500, confidence: 78 },
    ],
    alerts: predictionsAlerts,
    cards: predictionsCards,
    overallConfidence: 78,
  };
}

function getAnalyticsResponse() {
  return {
    peakSpendingHour: "7PM - 11PM",
    weekendVsWeekday: "2x higher on weekends",
    monthlyTrend: analyticsMonthlyTrend,
    categoryBreakdown: dashboardCategoryBreakdown,
    weeklyTrends: analyticsWeeklyTrends,
    topMerchants: analyticsTopMerchants,
    subscriptions: analyticsSubscriptions,
    heatmap: analyticsHeatmap,
  };
}

function getUserProfileResponse() {
  return {
    id: "user_001",
    name: "User",
    email: "user@example.com",
    currency: "INR",
    memberSince: "2024-01-01",
  };
}

module.exports = {
  getDashboardOverviewResponse,
  getTransactionsResponse,
  getRecommendationsResponse,
  getHealthScoreResponse,
  getPredictionsResponse,
  getAnalyticsResponse,
  getUserProfileResponse,
};
