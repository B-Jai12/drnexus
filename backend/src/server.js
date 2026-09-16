const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { optionalUser } = require("./middleware/optionalUser");
const { initDatabase } = require("./db/supabase");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "20mb" }));

// Automatically attach user without requiring Firebase authentication
app.use(optionalUser);

app.use("/api/dashboard", require("../routes/dashboard"));
app.use("/api/transactions", require("../routes/transactions"));
app.use("/api/recommendations", require("../routes/recommendations"));
app.use("/api/health-score", require("../routes/healthScore"));
app.use("/api/predictions", require("../routes/predictions"));
app.use("/api/analytics", require("../routes/analytics"));
app.use("/api/user", require("../routes/user"));
app.use("/api/upload", require("../routes/upload"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "SpendSense backend", db: "supabase-postgresql" });
});

const port = Number(process.env.PORT || 5000);

// Initialize DB schema on startup
initDatabase()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[backend] listening on http://localhost:${port} with Supabase PostgreSQL`);
    });
  })
  .catch((err) => {
    console.error("[backend] DB init failed:", err);
    app.listen(port, () => {
      console.log(`[backend] listening on http://localhost:${port} (fallback mode)`);
    });
  });