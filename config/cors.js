const cors = require("cors");
const ENV = require("./env");

module.exports = cors({
  origin: (origin, cb) => {
    if (!origin || ENV.CLIENT_URL === "*" || origin === ENV.CLIENT_URL) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
