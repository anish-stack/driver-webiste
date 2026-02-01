const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,
  CLIENT_URL: "*",
  MONGODB_MAIN_URL: process.env.MONODB_MAIN_URL || "*",
  MONGO_DB_SHARED_URL: process.env.MONGO_DB_SHARED_URL || "*",
  CLOUD_NAME: process.env.CLOUDNAME,
  CLOUD_API: process.env.CLOUD_KEY,
  CLOUD_SECRET_KEY: process.env.CLOUD_SECRET_KEY,
  MYOPERATOR_API_KEY: process.env.MYOPERATOR_API_KEY,
  MYOPERATOR_COMPANY_ID: process.env.MYOPERATOR_COMPANY_ID,
  MYOPERATOR_PHONE_NUMBER_ID: process.env.MYOPERATOR_PHONE_NUMBER_ID,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
};
