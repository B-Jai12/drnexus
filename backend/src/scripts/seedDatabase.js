require("dotenv").config();

const { connectToDatabase } = require("../db/connect");
const Transaction = require("../models/Transaction");

function monthLabel(date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function buildSeedData() {
  const base = [
    ["2026-01-02", "Salary", "Monthly Salary Credit", "Income", "credit", 78000, false, "normal", 0, true],
    ["2026-01-03", "Rent", "Apartment Rent", "Housing", "debit", 22000, false, "normal", 0.1, true],
    ["2026-01-05", "BigBasket", "Groceries", "Food", "debit", 2450, false, "normal", 0.2, false],
    ["2026-01-08", "Swiggy", "Dinner Order", "Food", "debit", 680, false, "normal", 0.1, false],
    ["2026-01-09", "Uber", "Office commute", "Travel", "debit", 420, false, "normal", 0.1, false],
    ["2026-01-15", "Amazon", "Electronics purchase", "Shopping", "debit", 7499, true, "medium", 2.2, false],
    ["2026-01-20", "Netflix", "Subscription", "Subscriptions", "debit", 649, false, "normal", 0, true],
    ["2026-02-02", "Salary", "Monthly Salary Credit", "Income", "credit", 78000, false, "normal", 0, true],
    ["2026-02-03", "Rent", "Apartment Rent", "Housing", "debit", 22000, false, "normal", 0.1, true],
    ["2026-02-05", "Blinkit", "Groceries", "Food", "debit", 1930, false, "normal", 0.2, false],
    ["2026-02-07", "Zomato", "Weekend order", "Food", "debit", 850, false, "normal", 0.3, false],
    ["2026-02-09", "IRCTC", "Train booking", "Travel", "debit", 1380, false, "normal", 0.2, false],
    ["2026-02-16", "Myntra", "Clothing order", "Shopping", "debit", 2999, false, "normal", 0.4, false],
    ["2026-02-20", "Spotify", "Subscription", "Subscriptions", "debit", 119, false, "normal", 0, true],
    ["2026-03-02", "Salary", "Monthly Salary Credit", "Income", "credit", 79000, false, "normal", 0, true],
    ["2026-03-03", "Rent", "Apartment Rent", "Housing", "debit", 22000, false, "normal", 0.1, true],
    ["2026-03-06", "Swiggy", "Lunch order", "Food", "debit", 420, false, "normal", 0.2, false],
    ["2026-03-08", "Amazon", "Home appliance", "Shopping", "debit", 11999, true, "high", 2.9, false],
    ["2026-03-11", "Ola", "Ride to airport", "Travel", "debit", 820, false, "normal", 0.2, false],
    ["2026-03-18", "Netflix", "Subscription", "Subscriptions", "debit", 649, false, "normal", 0, true],
  ];

  return base.map(([d, merchant, description, category, type, amount, isAnomaly, anomalySeverity, zScore, isRecurring]) => {
    const date = new Date(`${d}T10:00:00.000Z`);
    return {
      userId: "demo-user",
      date,
      merchant,
      description,
      category,
      type,
      amount,
      confidence: type === "credit" ? 1 : 0.92,
      isAnomaly,
      anomalySeverity,
      zScore,
      isRecurring,
      month: monthLabel(date),
      source: "seed",
      currency: "INR",
    };
  });
}

async function run() {
  await connectToDatabase();

  const seedData = buildSeedData();
  await Transaction.deleteMany({});
  await Transaction.insertMany(seedData);

  // eslint-disable-next-line no-console
  console.log(`[seed] inserted ${seedData.length} transactions`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed:", error.message);
  process.exit(1);
});
