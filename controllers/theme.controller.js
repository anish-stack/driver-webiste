const asyncHandler = require("../middlewares/asyncHandler");
const Theme = require("../models/theme.model");
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");
const Website = require("../models/webiste.model");

/* ================= CREATE ================= */
/* ================= CREATE ================= */
exports.createNewTheme = asyncHandler(async (req, res) => {
  let {
    themeId,
    name,
    tag,
    demo_url,
    previewUrl,
    description,
    pricePlans,
    isActive,
    displayOrder,
  } = req.body;

  /* ================= VALIDATION ================= */
  if (!themeId || !name) {
    return res.status(400).json({
      success: false,
      message: "themeId and name are required",
    });
  }

  /* ================= PARSE pricePlans ================= */
  if (pricePlans && typeof pricePlans === "string") {
    try {
      pricePlans = JSON.parse(pricePlans);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricePlans JSON",
      });
    }
  }

  // fallback
  if (!Array.isArray(pricePlans)) pricePlans = [];

  /* ================= CONVERT TYPES ================= */
  if (isActive !== undefined) {
    isActive = isActive === "true" || isActive === true;
  } else {
    isActive = true; // default
  }

  if (displayOrder !== undefined) {
    displayOrder = Number(displayOrder);
  }

  /* ================= CHECK DUPLICATE ================= */
  const exists = await Theme.findOne({ themeId });
  if (exists) {
    return res.status(409).json({
      success: false,
      message: "Theme already exists",
    });
  }

  /* ================= IMAGE UPLOAD ================= */
  let previewImage = "";
  let previewPublicId = "";

  if (req.file?.buffer) {
    const uploaded = await uploadBuffer(req.file.buffer, "themes/preview");
    previewImage = uploaded.secure_url;
    previewPublicId = uploaded.public_id;
  }

  /* ================= CREATE ================= */
  const theme = await Theme.create({
    themeId,
    name,
    tag: tag || "",
    previewUrl: previewUrl || "",
    description: description || "",
    pricePlans,
    demo_url: demo_url || "",
    isActive,
    displayOrder: displayOrder || 0,
    previewImage,
    previewPublicId,
  });

  res.status(201).json({
    success: true,
    data: theme,
  });
});

/* ================= UPDATE ================= */
exports.updateTheme = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const theme = await Theme.findById(id);
  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Theme not found",
    });
  }

  // ✅ 1) Parse pricePlans if coming as string
  if (req.body.pricePlans && typeof req.body.pricePlans === "string") {
    try {
      req.body.pricePlans = JSON.parse(req.body.pricePlans);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricePlans JSON",
      });
    }
  }

  // ✅ 2) Convert booleans + numbers (because formdata sends strings)
  if (req.body.isActive !== undefined) {
    req.body.isActive = req.body.isActive === "true" || req.body.isActive === true;
  }

  if (req.body.displayOrder !== undefined) {
    req.body.displayOrder = Number(req.body.displayOrder);
  }

  // ✅ 3) replace image
  if (req.file?.buffer) {
    if (theme.previewPublicId) {
      await deleteFile(theme.previewPublicId);
    }

    const uploaded = await uploadBuffer(req.file.buffer, "themes/preview");

    theme.previewImage = uploaded.secure_url;
    theme.previewPublicId = uploaded.public_id;
  }

  // ✅ 4) update theme fields
  Object.assign(theme, req.body);

  await theme.save();

  res.json({
    success: true,
    data: theme,
  });
});

/* ================= DELETE ================= */
exports.deleteTheme = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const theme = await Theme.findById(id);
    if (!theme) {
        return res.status(404).json({
            success: false,
            message: "Theme not found",
        });
    }

    if (theme.previewPublicId) {
        await deleteFile(theme.previewPublicId);
    }

    await theme.deleteOne();

    res.json({
        success: true,
        message: "Theme deleted successfully",
    });
});

/* ================= ADMIN LIST ================= */
exports.getAllThemesAdmin = asyncHandler(async (req, res) => {
  const now = new Date();

  const themes = await Theme.aggregate([
    // 👇 admin ke liye sab themes
    { $match: {} },

    // 👇 websites join
    {
      $lookup: {
        from: "websites",
        localField: "_id",
        foreignField: "themeId",
        as: "websites",
      },
    },

    // 👇 counts add
    {
      $addFields: {
        totalWebsites: { $size: "$websites" },

        liveWebsites: {
          $size: {
            $filter: {
              input: "$websites",
              as: "w",
              cond: { $eq: ["$$w.isLive", true] },
            },
          },
        },

        paidWebsites: {
          $size: {
            $filter: {
              input: "$websites",
              as: "w",
              cond: {
                $and: [
                  { $eq: ["$$w.subscription.status", "paid"] },
                  { $gt: ["$$w.subscription.paidTill", now] },
                ],
              },
            },
          },
        },
      },
    },

    // 👇 websites array hata do (heavy hota hai)
    {
      $project: {
        websites: 0,
      },
    },

    // 👇 sort
    { $sort: { displayOrder: 1 } },
  ]);

  return res.json({
    success: true,
    data: themes,
  });
});

/* ================= TOGGLE ACTIVE ================= */
exports.toggleThemeStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const theme = await Theme.findById(id);
    if (!theme) {
        return res.status(404).json({
            success: false,
            message: "Theme not found",
        });
    }

    theme.isActive = !theme.isActive;
    await theme.save();

    res.json({
        success: true,
        isActive: theme.isActive,
    });
});

/* ================= GET ACTIVE THEMES ================= */
exports.getActiveThemes = asyncHandler(async (req, res) => {
    const themes = await Theme.find({ isActive: true })
        .sort({ displayOrder: 1 })
        .select("-previewPublicId");

    res.json({
        success: true,
        data: themes,
    });
});

/* ================= GET SINGLE THEME ================= */
exports.getThemeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const theme = await Theme.findOne({
        $or: [{ _id: id }, { themeId: id }],
        isActive: true,
    }).select("-previewPublicId");

    if (!theme) {
        return res.status(404).json({
            success: false,
            message: "Theme not found",
        });
    }

    res.json({
        success: true,
        data: theme,
    });
});