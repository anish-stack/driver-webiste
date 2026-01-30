const cloudinary = require("cloudinary").v2;
const ENV = require("./env");

cloudinary.config({
  cloud_name: ENV.CLOUD_NAME,
  api_key: ENV.CLOUD_API,
  api_secret: ENV.CLOUD_SECRET_KEY,
});

module.exports = cloudinary;
