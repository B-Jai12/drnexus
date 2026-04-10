const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { requireFirebaseUser } = require("./middleware/requireFirebaseUser");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));

app.use("/api/dashboard", requireFirebaseUser, require("../routes/dashboard"));
app.use("/api/transactions", requireFirebaseUser, require("../routes/transactions"));
app.use("/api/recommendations", requireFirebaseUser, require("../routes/recommendations"));
app.use("/api/health-score", requireFirebaseUser, require("../routes/healthScore"));
app.use("/api/predictions", requireFirebaseUser, require("../routes/predictions"));
app.use("/api/analytics", requireFirebaseUser, require("../routes/analytics"));
app.use("/api/user", requireFirebaseUser, require("../routes/user"));
app.use("/api/upload", requireFirebaseUser, require("../routes/upload"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "SpendSense backend" });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${port}`);
});