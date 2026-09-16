const express = require("express");
const { getAnalyticsResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const { getAnalyticsFromDb } = require("../src/services/transactionService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.userId || "demo-user";
    await connectToDatabase();
    const result = await getAnalyticsFromDb(String(userId));

    if (!result && process.env.NODE_ENV !== "production") {
      return res.status(200).json(getAnalyticsResponse());
    }

    return res.status(200).json(result);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json(getAnalyticsResponse());
    }
    return res.status(500).json({
      error: "Failed to fetch analytics",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/merchants", async (req, res) => {
  try {
    const userId = req.userId || "demo-user";
    await connectToDatabase();
    const result = await getAnalyticsFromDb(String(userId));
    return res.status(200).json(result?.topMerchants || getAnalyticsResponse().topMerchants);
  } catch (error) {
    return res.status(200).json(getAnalyticsResponse().topMerchants);
  }
});

router.get("/weekly-trends", async (req, res) => {
  try {
    const userId = req.userId || "demo-user";
    await connectToDatabase();
    const result = await getAnalyticsFromDb(String(userId));
    return res.status(200).json(result?.weeklyTrends || getAnalyticsResponse().weeklyTrends);
  } catch (error) {
    return res.status(200).json(getAnalyticsResponse().weeklyTrends);
  }
});

router.get("/heatmap", async (req, res) => {
  try {
    const userId = req.userId || "demo-user";
    await connectToDatabase();
    const result = await getAnalyticsFromDb(String(userId));
    return res.status(200).json(result?.heatmap || getAnalyticsResponse().heatmap);
  } catch (error) {
    return res.status(200).json(getAnalyticsResponse().heatmap);
  }
});

module.exports = router;
