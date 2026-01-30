const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    uptime: process.uptime(),
  });
});

module.exports = router;
