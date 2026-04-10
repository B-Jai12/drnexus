const mongoose = require("mongoose");

const userInsightSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sourceFilename: { type: String, default: "" },
    summary: { type: Object, default: {} },
    monthlyOverview: { type: Array, default: [] },
    forecast: { type: Object, default: {} },
    recommendations: { type: Object, default: {} },
    anomalies: { type: Array, default: [] },
    recurringMerchants: { type: Array, default: [] },
    mlInfo: { type: Object, default: {} },
    transactionCount: { type: Number, default: 0 },
    importedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

userInsightSchema.index({ userId: 1, importedAt: -1 });

module.exports = mongoose.models.UserInsight || mongoose.model("UserInsight", userInsightSchema);
