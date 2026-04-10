const express = require("express");
const path = require("path");
const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");

const { connectToDatabase } = require("../src/db/connect");
const { saveMlTransactionsForUser, saveMlInsightForUser } = require("../src/services/uploadIngestService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExt = [".pdf", ".csv", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, CSV and Excel files are allowed"), false);
    }
  },
});

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, "");

router.post("/process-statement", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required (field: file)." });
    }

    const userId = req.userId;
    const mode = req.body?.mode || "replace-range";

    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname || "statement.pdf");

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/process-statement`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000,
    });

    let persist = { saved: 0, deleted: 0, dateRange: null };
    try {
      await connectToDatabase();
      persist = await saveMlTransactionsForUser({
        userId,
        filename: req.file.originalname,
        mlPayload: mlResponse.data,
        mode,
      });
      await saveMlInsightForUser({
        userId,
        filename: req.file.originalname,
        mlPayload: mlResponse.data,
      });
    } catch (dbErr) {
      console.warn("[upload] MongoDB save skipped (DB not available):", dbErr?.message || dbErr);
    }

    return res.status(200).json({
      success: true,
      userId,
      filename: req.file.originalname,
      transactionCount: mlResponse.data?.transaction_count ?? persist.saved,
      persisted: {
        mode,
        saved: persist.saved,
        deletedInRange: persist.deleted,
        dateRange: persist.dateRange
          ? {
              from: persist.dateRange.from.toISOString(),
              to: persist.dateRange.to.toISOString(),
            }
          : null,
      },
      ml: mlResponse.data,
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Upload processing failed";

    return res.status(status).json({
      error: "Upload processing failed",
      message: detail,
    });
  }
});

router.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    // Forward the status check to ML service
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/upload/status/${jobId}`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      error: "Could not check job status" 
    });
  }
});

module.exports = router;
