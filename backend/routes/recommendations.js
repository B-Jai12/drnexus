const express = require("express");
const { getRecommendationsResponse } = require("../src/fixtures/apiFixtures");
const { connectToDatabase } = require("../src/db/connect");
const UserInsight = require("../src/models/UserInsight");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await connectToDatabase();
    const userId = req.userId;
    const insight = await UserInsight.findOne({ userId }).sort({ importedAt: -1 }).lean();

    if (insight?.recommendations && Array.isArray(insight.recommendations.items)) {
      const items = insight.recommendations.items.map((item) => ({
        id: String(item.id || ""),
        title: String(item.title || ""),
        description: String(item.description || ""),
        category: String(item.category || "insight"),
        priority: item.priority || "medium",
        potentialSavings: Number(item.potential_savings ?? item.potentialSavings ?? 0),
        actionLabel: String(item.action_label ?? item.actionLabel ?? "Apply"),
      }));
      const totalPotentialSavings = items.reduce((sum, item) => sum + Number(item.potentialSavings || 0), 0);

      return res.status(200).json({
        summary: String(insight.recommendations.summary || "AI-generated recommendations"),
        items,
        totalPotentialSavings,
        aiGenerated: Boolean(insight.recommendations.ai_generated ?? insight.recommendations.aiGenerated),
      });
    }

    return res.status(200).json(getRecommendationsResponse());
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch recommendations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
