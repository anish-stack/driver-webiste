const Coupon = require("../models/coupon.model");

// ===============================
// ✅ CREATE COUPON
// ===============================
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      amountOff,
      percentOff,
      minOrderValue,
      maxDiscountAmount,
      totalUsageLimit,
      perUserUsageLimit,
      startDate,
      expireDate,
      active,
    } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!expireDate) {
      return res.status(400).json({
        success: false,
        message: "expireDate is required",
      });
    }

    const exists = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create({
      code,
      title,
      description,
      discountType,
      amountOff,
      percentOff,
      minOrderValue,
      maxDiscountAmount,
      totalUsageLimit,
      perUserUsageLimit,
      startDate,
      expireDate,
      active,
    });

    return res.json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (err) {
    console.error("createCoupon error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create coupon",
    });
  }
};

// ===============================
// ✅ GET ALL COUPONS (Admin)
// Search + Pagination + filter
// ===============================
exports.getAllCoupons = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = req.query.search?.trim() || "";
    const active = req.query.active; // "true" | "false" | undefined

    const filter = {};

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ];
    }

    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const total = await Coupon.countDocuments(filter);

    const data = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getAllCoupons error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

// ===============================
// ✅ GET SINGLE COUPON
// ===============================
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      data: coupon,
    });
  } catch (err) {
    console.error("getCouponById error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupon",
    });
  }
};

// ===============================
// ✅ UPDATE COUPON
// ===============================
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "discountType",
      "amountOff",
      "percentOff",
      "minOrderValue",
      "maxDiscountAmount",
      "totalUsageLimit",
      "perUserUsageLimit",
      "startDate",
      "expireDate",
      "active",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        coupon[field] = req.body[field];
      }
    });

    await coupon.save(); // ✅ triggers pre("save")

    return res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (err) {
    console.error("updateCoupon error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update coupon",
    });
  }
};

// ===============================
// ✅ DELETE COUPON
// ===============================
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (err) {
    console.error("deleteCoupon error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
    });
  }
};

// ===============================
// ✅ TOGGLE ACTIVE
// ===============================
exports.toggleCouponActive = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.active = !coupon.active;
    await coupon.save();

    return res.json({
      success: true,
      message: `Coupon is now ${coupon.active ? "Active" : "Inactive"}`,
      data: coupon,
    });
  } catch (err) {
    console.error("toggleCouponActive error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle coupon",
    });
  }
};

// ===============================
// ✅ APPLY COUPON API
// ===============================
exports.applyCoupon = async (req, res) => {
  try {
    const { code, driverId, orderAmount } = req.body;

    if (!code || !driverId || orderAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "code, driverId and orderAmount are required",
      });
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    // ✅ Active check
    if (!coupon.active) {
      return res.status(400).json({
        success: false,
        message: "Coupon is inactive",
      });
    }

    const now = new Date();

    // ✅ Start date check
    if (coupon.startDate && now < coupon.startDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon not started yet",
      });
    }

    // ✅ Expiry check
    if (coupon.expireDate && now > coupon.expireDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon expired",
      });
    }

    // ✅ Min order check
    if (coupon.minOrderValue > 0 && orderAmount < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${coupon.minOrderValue}`,
      });
    }

    // ✅ Total usage limit check
    if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    // ✅ Per user usage check
    const existingUserUsage = coupon.usedByUsers.find(
      (u) => String(u.driverId) === String(driverId)
    );

    if (
      existingUserUsage &&
      existingUserUsage.usedCount >= coupon.perUserUsageLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "You already used this coupon maximum times",
      });
    }

    // =========================
    // ✅ Calculate discount
    // =========================
    let discountAmount = 0;

    if (coupon.discountType === "FLAT") {
      discountAmount = coupon.amountOff;
    }

    if (coupon.discountType === "PERCENT") {
      discountAmount = (orderAmount * coupon.percentOff) / 100;

      // max discount cap
      if (coupon.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    }

    // discount cannot exceed orderAmount
    discountAmount = Math.min(discountAmount, orderAmount);

    const finalPayableAmount = orderAmount - discountAmount;

    return res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        couponId: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount,
        orderAmount,
        finalPayableAmount,
      },
    });
  } catch (err) {
    console.error("applyCoupon error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
    });
  }
};

// ===============================
// ✅ CONFIRM COUPON USAGE
// (Call after successful payment)
// ===============================
exports.confirmCouponUsage = async (req, res) => {
  try {
    const { couponId, driverId } = req.body;

    if (!couponId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "couponId and driverId are required",
      });
    }

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // total usage limit check again
    if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    // update usage
    coupon.usedCount += 1;

    const userUsage = coupon.usedByUsers.find(
      (u) => String(u.driverId) === String(driverId)
    );

    if (userUsage) {
      userUsage.usedCount += 1;
      userUsage.usedAt = new Date();
    } else {
      coupon.usedByUsers.push({
        driverId,
        usedCount: 1,
        usedAt: new Date(),
      });
    }

    await coupon.save();

    return res.json({
      success: true,
      message: "Coupon usage confirmed",
      data: coupon,
    });
  } catch (err) {
    console.error("confirmCouponUsage error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm coupon usage",
    });
  }
};
