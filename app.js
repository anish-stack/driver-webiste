const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const corsConfig = require("./config/cors");
const ENV = require("./config/env");
const globalErrorHandler = require("./middlewares/error.middleware");
const notFound = require("./middlewares/notFound.middleware");

const healthRoutes = require("./routes/health.route");
const ThemeRoutes = require("./routes/Theme.routes");
const PackagesRoutes = require("./routes/Package.routes");
const WebsiteRoutes = require("./routes/website.route");




const app = express();

/* -------------------- Security -------------------- */
app.use(helmet());
app.use(corsConfig);

/* -------------------- Rate Limiting -------------------- */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);


/* -------------------- Body Parsing -------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------- Logging -------------------- */
if (ENV.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* -------------------- Routes -------------------- */
app.use("/api", healthRoutes);
app.use("/api/theme", ThemeRoutes)
app.use("/api/package", PackagesRoutes)
app.use("/api/website", WebsiteRoutes)

/* -------------------- 404 Handler -------------------- */
app.use(notFound);

/* -------------------- Global Error Handler -------------------- */
app.use(globalErrorHandler);

module.exports = app;
