const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, default: "demo-user" },
    date: { type: Date, required: true, index: true },
    merchant: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, enum: ["debit", "credit"], index: true },
    amount: { type: Number, required: true, min: 0 },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    isAnomaly: { type: Boolean, default: false },
    anomalySeverity: { type: String, enum: ["low", "medium", "high", "normal"], default: "normal" },
    zScore: { type: Number, default: 0 },
    isRecurring: { type: Boolean, default: false },
    month: { type: String, trim: true },
    source: { type: String, trim: true, default: "seed" },
    currency: { type: String, trim: true, default: "INR" },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1, category: 1, type: 1 });

module.exports = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
