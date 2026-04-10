const express = require("express");
const { getHealthScoreResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const { getHealthScoreFromDb } = require("../src/services/transactionService");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const userId = _req.userId;
    await connectToDatabase();
    const result = await getHealthScoreFromDb(String(userId));

    if (!result && process.env.NODE_ENV !== "production") {
      return res.status(200).json(getHealthScoreResponse());
    }

    return res.status(200).json(result);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json(getHealthScoreResponse());
    }
    return res.status(500).json({
      error: "Failed to fetch health score",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
