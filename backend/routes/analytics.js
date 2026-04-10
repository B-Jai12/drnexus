const express = require("express");
const { getAnalyticsResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const { getAnalyticsFromDb } = require("../src/services/transactionService");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const userId = _req.userId;
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

module.exports = router;
