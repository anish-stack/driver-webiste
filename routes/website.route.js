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
  getWhichStepIAmOn,
  createPaymentOrder,
  verifyPayment,
  getSubscriptionStatus,
  upsertSocialLinks,
  getSocialLinks,
  checkWebsiteUrlPresentOrNot,
  changeThemeAndCalculatePrice,
  getWebsiteBySlug,
  updateWebsiteUrl,

} = require("../controllers/website.controller");



const {
  getAllWebsites,
  getWebsiteById,
  getWebsitesByTheme,
  toggleWebsiteLiveStatus,
  deleteWebsiteByAdmin,
  getSubscriptionOverview,
  getExpiringSubscriptions,
  adminExtendSubscription,
  getThemeUsageStats,
} = require('../controllers/website.admin.controller');

router.get("/:driverId", getWebsite);
router.get("/detail/:slug", getWebsiteBySlug);


router.patch("/:driverId/basic-info", uploadBuffer.single("logo"), updateBasicInfo);

router.patch("/:driverId/popular-prices", updatePopularPrices);
router.post("/:driverId/popular-prices", addPopularPrice);
router.delete("/:driverId/popular-prices/:index", deletePopularPrice);

router.patch("/:driverId/packages/:index", uploadBuffer.single("image"), updatePackages);
router.post("/:driverId/packages", uploadBuffer.single("image"), addPackage);
router.delete("/:driverId/packages/:index", deletePackage);

router.patch("/:driverId/reviews", updateReviews);
router.post("/:driverId/reviews", addReview);
router.delete("/:driverId/reviews/:index", deleteReview);

router.patch("/:driverId/sections", updateSections);

router.patch("/:driverId/live-status", toggleLiveStatus);

router.delete("/:driverId", deleteWebsite);

router.get('/step/:driverId', getWhichStepIAmOn)
router.post("/qr-code", genrateQrCodeForWebsite);


router.post("/check-webiste-url", checkWebsiteUrlPresentOrNot)
router.post("/check-webiste-theme/:driverId", changeThemeAndCalculatePrice)


router.patch(
  "/:driverId/social-links",
  upsertSocialLinks
);

router.get(
  "/:driverId/social-links",
  getSocialLinks
);

router.post("/payment/create-order", createPaymentOrder);
router.post("/payment/verify", verifyPayment);
router.get("/subscription/:driverId", getSubscriptionStatus);
router.put("/update-webiste-url/:driverId", updateWebsiteUrl)



router.get("/admin/websites", getAllWebsites);
router.get("/admin/websites/:id", getWebsiteById);
router.get("/admin/websites/theme/:themeId", getWebsitesByTheme);
router.patch("/admin/websites/:id/toggle-live", toggleWebsiteLiveStatus);
router.delete("/admin/websites/:id", deleteWebsiteByAdmin);
router.get("/subscriptions/overview", getSubscriptionOverview);
router.get("/subscriptions/expiring", getExpiringSubscriptions);
router.post("/subscriptions/extend", adminExtendSubscription);
router.get("/themes/usage-stats", getThemeUsageStats);





module.exports = router;