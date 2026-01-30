const express = require("express");
const router = express.Router();
const { uploadBuffer } = require("../config/multer");
const {
  updateBasicInfo,
  updatePopularPrices,
  addPopularPrice,
  deletePopularPrice,
  updatePackages,
  addPackage,
  deletePackage,
  updateReviews,
  addReview,
  deleteReview,
  updateSections,
  toggleLiveStatus,
  getWebsite,
  deleteWebsite,
  genrateQrCodeForWebsite,
} = require("../controllers/website.controller");

router.get("/:driverId", getWebsite);

router.patch("/:driverId/basic-info", uploadBuffer.single("logo"), updateBasicInfo);

router.patch("/:driverId/popular-prices", updatePopularPrices);
router.post("/:driverId/popular-prices", addPopularPrice);
router.delete("/:driverId/popular-prices/:index", deletePopularPrice);

router.patch("/:driverId/packages", updatePackages);
router.post("/:driverId/packages", addPackage);
router.delete("/:driverId/packages/:index", deletePackage);

router.patch("/:driverId/reviews", updateReviews);
router.post("/:driverId/reviews", addReview);
router.delete("/:driverId/reviews/:index", deleteReview);

router.patch("/:driverId/sections", updateSections);

router.patch("/:driverId/live-status", toggleLiveStatus);

router.delete("/:driverId", deleteWebsite);



router.post("/qr-code", genrateQrCodeForWebsite);


module.exports = router;