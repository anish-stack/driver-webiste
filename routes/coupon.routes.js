const express = require("express");
const router = express.Router();

const couponController = require("../controllers/coupon.controller");

// CRUD
router.post("/create", couponController.createCoupon);
router.get("/all", couponController.getAllCoupons);
router.get("/:id", couponController.getCouponById);
router.put("/update/:id", couponController.updateCoupon);
router.delete("/delete/:id", couponController.deleteCoupon);

// Extra
router.put("/toggle/:id", couponController.toggleCouponActive);

// Apply
router.post("/apply", couponController.applyCoupon);
router.post("/confirm-usage", couponController.confirmCouponUsage);

module.exports = router;
