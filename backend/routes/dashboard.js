const express = require("express");
const { getDashboardOverviewResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const { getDashboardOverviewFromDb } = require("../src/services/transactionService");

const router = express.Router();

router.get("/overview", async (_req, res) => {
  try {
    const userId = _req.userId;
    await connectToDatabase();
    const overview = await getDashboardOverviewFromDb(String(userId));

    if (!overview && process.env.NODE_ENV !== "production") {
      return res.status(200).json(getDashboardOverviewResponse());
    }

    return res.status(200).json(overview);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json(getDashboardOverviewResponse());
    }
    return res.status(500).json({
      error: "Failed to fetch dashboard overview",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
