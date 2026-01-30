const ENV = require("../config/env");

module.exports = (err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(ENV.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
