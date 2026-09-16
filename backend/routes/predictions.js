const express = require("express");
const { getPredictionsResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase, query } = require("../src/db/connect");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await connectToDatabase();
    const userId = req.userId || "demo-user";
    const result = await query(
      "SELECT * FROM user_insights WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 1",
      [userId]
    );
    const insight = result.rows[0];

    if (insight?.forecast && Object.keys(insight.forecast).length > 0) {
      const monthlyOverview = Array.isArray(insight?.monthly_overview)
        ? insight.monthly_overview
        : Array.isArray(insight?.monthlyOverview)
        ? insight.monthlyOverview
        : [];
      const forecast = monthlyOverview.map((m) => ({
        month: m.month,
        actual: Number(m.expenses || 0),
        predicted: Number(m.expenses || 0),
        confidence: 80,
      }));

      forecast.push({
        month: "Next Month",
        actual: null,
        predicted: Number(insight.forecast.predicted_expense || 0),
        confidence: insight.forecast.confidence === "high" ? 90 : insight.forecast.confidence === "medium" ? 75 : 60,
      });

      return res.status(200).json({
        nextMonthEstimate: Number(insight.forecast.predicted_expense || 0),
        riskLevel: insight.forecast.confidence || "medium",
        categoryRisks: [],
        forecast,
        alerts: Array.isArray(insight.anomalies)
          ? insight.anomalies.map((a, idx) => ({
              id: `a-${idx + 1}`,
              severity: a.severity || "medium",
              title: `${a.merchant || "Merchant"} unusual transaction`,
              description: `Detected anomalous spend of ₹${Number(a.amount || 0).toLocaleString()}.`,
              category: "Anomaly",
              amount: Number(a.amount || 0),
            }))
          : [],
        cards: [
          {
            month: "Next Month Forecast",
            predicted: Number(insight.forecast.predicted_expense || 0),
            actual: null,
            confidence: insight.forecast.confidence === "high" ? 90 : insight.forecast.confidence === "medium" ? 75 : 60,
          },
          {
            month: "Predicted Income",
            predicted: Number(insight.forecast.predicted_income || 0),
            actual: null,
            confidence: 70,
          },
          {
            month: "Predicted Savings",
            predicted: Number(insight.forecast.predicted_savings || 0),
            actual: null,
            confidence: 70,
          },
        ],
        overall_confidence: insight.forecast.confidence === "high" ? 90 : insight.forecast.confidence === "medium" ? 75 : 60,
      });
    }

    return res.status(200).json(getPredictionsResponse());
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch predictions",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
