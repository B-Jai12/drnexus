const express = require("express");
const { getUserProfileResponse } = require("../src/fixtures/apiFixtures");

const router = express.Router();

router.get("/profile", async (_req, res) => {
  try {
    return res.status(200).json(getUserProfileResponse());
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch user profile",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

module.exports = router;
