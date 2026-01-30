const mongoose = require("mongoose");
const ENV = require("./env");

const connectMainDB = async () => {
  try {
    await mongoose.connect(ENV.MONGODB_MAIN_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Main MongoDB connected");
  } catch (err) {
    console.error("❌ Main DB connection failed", err.message);
    process.exit(1);
  }
};



module.exports = { connectMainDB };
