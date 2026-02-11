const asyncHandler = require("../middlewares/asyncHandler");
const Theme = require("../models/theme.model");
const Website = require("../models/webiste.model"); // note: typo in your original → website.model ?
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const ENV = require("../config/env");

const razorpay = new Razorpay({
  key_id: ENV.RAZORPAY_KEY_ID,
  key_secret: ENV.RAZORPAY_KEY_SECRET,
});

// ────────────────────────────────────────────────
// 1. Get All Websites (with filters & pagination)
// ────────────────────────────────────────────────
exports.getAllWebsites = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    isLive,
    themeId,
    hasSubscription,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  console.log(req.query)

  const query = {};

  if (search) {
    query.$or = [
      { "basicInfo.name": { $regex: search, $options: "i" } },
      { website_url: { $regex: search, $options: "i" } },
      { driverId: mongoose.isValidObjectId(search) ? search : null },
    ].filter(Boolean);
  }

  if (isLive !== undefined) {
    query.isLive = isLive === "true";
  }

  if (themeId && mongoose.isValidObjectId(themeId)) {
    query.themeId = themeId;
  }

  if (hasSubscription !== undefined) {
    query["subscription.status"] = hasSubscription === "true" ? "paid" : { $ne: "paid" };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const websites = await Website.find(query)
    .populate("themeId", "name themeId tag")
    .populate("driverId", "name phone email") // assuming Driver model has these
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const total = await Website.countDocuments(query);

  res.status(200).json({
    success: true,
    count: websites.length,
    total,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
    data: websites,
  });
});

// ────────────────────────────────────────────────
// 2. Get Single Website (detailed view)
// ────────────────────────────────────────────────
exports.getWebsiteById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid website ID" });
  }

  const website = await Website.findById(id)
    .populate("themeId", "name themeId tag pricePlans")
    .populate("driverId", "name phone email profileImage");

  if (!website) {
    return res.status(404).json({ success: false, message: "Website not found" });
  }

  res.status(200).json({
    success: true,
    data: website,
  });
});

// ────────────────────────────────────────────────
// 3. Get Websites by Theme (useful for analytics)
// ────────────────────────────────────────────────
exports.getWebsitesByTheme = asyncHandler(async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.isValidObjectId(themeId)) {
    return res.status(400).json({ success: false, message: "Invalid theme ID" });
  }

  const count = await Website.countDocuments({ themeId });
  const websites = await Website.find({ themeId })
    .select("driverId website_url isLive paidTill basicInfo.name subscription.status")
    .populate("driverId", "name phone");

  res.status(200).json({
    success: true,
    themeId,
    totalWebsites: count,
    data: websites,
  });
});

// ────────────────────────────────────────────────
// 4. Force Activate / Deactivate Website
// ────────────────────────────────────────────────
exports.toggleWebsiteLiveStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isLive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid website ID" });
  }

  if (typeof isLive !== "boolean") {
    return res.status(400).json({ success: false, message: "isLive must be boolean" });
  }

  const website = await Website.findById(id);
  if (!website) {
    return res.status(404).json({ success: false, message: "Website not found" });
  }

  website.isLive = isLive;
  await website.save();

  res.status(200).json({
    success: true,
    message: `Website ${isLive ? "published" : "unpublished"} successfully`,
    data: {
      websiteId: website._id,
      driverId: website.driverId,
      isLive: website.isLive,
    },
  });
});

// ────────────────────────────────────────────────
// 5. Admin Delete Website (with cleanup)
// ────────────────────────────────────────────────
exports.deleteWebsiteByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid website ID" });
  }

  const website = await Website.findById(id);
  if (!website) {
    return res.status(404).json({ success: false, message: "Website not found" });
  }

  // Cleanup Cloudinary assets
  if (website.basicInfo?.logoPublicId) {
    await deleteFile(website.basicInfo.logoPublicId).catch(console.error);
  }

  if (website.qrCode?.publicId) {
    await deleteFile(website.qrCode.publicId).catch(console.error);
  }

  // Optional: delete package images if any
  for (const pkg of website.packages || []) {
    if (pkg.imagePublicId) {
      await deleteFile(pkg.imagePublicId).catch(console.error);
    }
  }

  await Website.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Website permanently deleted by admin",
    deletedWebsiteId: id,
    driverId: website.driverId,
  });
});

// ────────────────────────────────────────────────
// 6. Get Subscription / Payment Overview
// ────────────────────────────────────────────────
exports.getSubscriptionOverview = asyncHandler(async (req, res) => {
  const stats = await Website.aggregate([
    {
      $group: {
        _id: null,
        totalWebsites: { $sum: 1 },
        liveWebsites: { $sum: { $cond: ["$isLive", 1, 0] } },
        paidWebsites: {
          $sum: { $cond: [{ $eq: ["$subscription.status", "paid"] }, 1, 0] },
        },
        totalRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$subscription.status", "paid"] },
              { $ifNull: ["$subscription.amountPay", 0] },
              0,
            ],
          },
        },
        activeSubscriptions: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$subscription.status", "paid"] },
                  { $gt: ["$paidTill", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const overview = stats[0] || {
    totalWebsites: 0,
    liveWebsites: 0,
    paidWebsites: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
  };

  res.status(200).json({
    success: true,
    data: overview,
  });
});

// ────────────────────────────────────────────────
// 7. Get All Expired / Expiring Soon Subscriptions
// ────────────────────────────────────────────────
exports.getExpiringSubscriptions = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + Number(days));

  const websites = await Website.find({
    "subscription.status": "paid",
    paidTill: { $lte: threshold, $gte: new Date() },
  })
    .select("driverId website_url paidTill subscription")
    .populate("driverId", "name phone email");

  res.status(200).json({
    success: true,
    count: websites.length,
    daysThreshold: Number(days),
    data: websites,
  });
});

// ────────────────────────────────────────────────
// 8. Manually Extend Subscription (admin override)
// ────────────────────────────────────────────────
exports.adminExtendSubscription = asyncHandler(async (req, res) => {
  const { websiteId } = req.params;
  const { months, note } = req.body;

  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ success: false, message: "Invalid website ID" });
  }

  if (!months || Number(months) < 1) {
    return res.status(400).json({ success: false, message: "Valid months required" });
  }

  const website = await Website.findById(websiteId);
  if (!website) {
    return res.status(404).json({ success: false, message: "Website not found" });
  }

  const now = new Date();
  const base = website.paidTill && new Date(website.paidTill) > now ? new Date(website.paidTill) : now;

  const newPaidTill = new Date(base);
  newPaidTill.setMonth(newPaidTill.getMonth() + Number(months));

  website.paidTill = newPaidTill;
  website.isLive = true;

  // Optional: record admin action
  website.subscriptionHistory = website.subscriptionHistory || [];
  website.subscriptionHistory.push({
    orderId: `admin_manual_${Date.now()}`,
    status: "paid",
    durationMonths: Number(months),
    amountPay: 0,
    note: note || "Admin manual extension",
    paidTill: newPaidTill,
    isActive: true,
    purchasedAt: now,
    adminAction: true,
  });

  await website.save();

  res.status(200).json({
    success: true,
    message: `Subscription extended by ${months} months`,
    newPaidTill,
    websiteId: website._id,
    driverId: website.driverId,
  });
});

// ────────────────────────────────────────────────
// 9. Get Theme Usage Statistics (very useful)
// ────────────────────────────────────────────────
exports.getThemeUsageStats = asyncHandler(async (req, res) => {
  const stats = await Website.aggregate([
    {
      $group: {
        _id: "$themeId",
        total: { $sum: 1 },
        live: { $sum: { $cond: ["$isLive", 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ["$subscription.status", "paid"] }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: "themes",
        localField: "_id",
        foreignField: "_id",
        as: "theme",
      },
    },
    { $unwind: { path: "$theme", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        themeId: "$_id",
        themeName: "$theme.name",
        themeIdString: "$theme.themeId",
        totalWebsites: "$total",
        liveWebsites: "$live",
        paidWebsites: "$paid",
      },
    },
    { $sort: { totalWebsites: -1 } },
  ]);

  res.status(200).json({
    success: true,
    count: stats.length,
    data: stats,
  });
});
