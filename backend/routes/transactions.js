const express = require("express");
const { getTransactionsResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const { getTransactionsFromDb } = require("../src/services/transactionService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    await connectToDatabase();
    const dbResponse = await getTransactionsFromDb(req.query, String(userId));

    if (dbResponse.total === 0 && process.env.NODE_ENV !== "production") {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 10);
      return res.status(200).json(getTransactionsResponse(page, pageSize));
    }

    return res.status(200).json(dbResponse);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 10);
      return res.status(200).json(getTransactionsResponse(page, pageSize));
    }
    return res.status(500).json({
      error: "Failed to fetch transactions",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
