const asyncHandler = require("../middlewares/asyncHandler");
const Theme = require("../models/theme.model");
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");

/* ================= CREATE ================= */
exports.createNewTheme = asyncHandler(async (req, res) => {
    const {
        themeId,
        name,
        tag,
        previewUrl,
        description,
        pricePlans,
        isActive,
    } = req.body;

    if (!themeId || !name) {
        return res.status(400).json({
            success: false,
            message: "themeId and name are required",
        });
    }

    const exists = await Theme.findOne({ themeId });
    if (exists) {
        return res.status(409).json({
            success: false,
            message: "Theme already exists",
        });
    }

    let previewImage, previewPublicId;

    if (req.file?.buffer) {
        const uploaded = await uploadBuffer(
            req.file.buffer,
            "themes/preview"
        );
        previewImage = uploaded.secure_url;
        previewPublicId = uploaded.public_id;
    }

    const theme = await Theme.create({
        themeId,
        name,
        tag,
        previewUrl,
        description,
        pricePlans,
        isActive,
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

    // replace image
    if (req.file?.buffer) {
        if (theme.previewPublicId) {
            await deleteFile(theme.previewPublicId);
        }

        const uploaded = await uploadBuffer(
            req.file.buffer,
            "themes/preview"
        );

        theme.previewImage = uploaded.secure_url;
        theme.previewPublicId = uploaded.public_id;
    }

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
    const themes = await Theme.find({})
        .sort({ displayOrder: 1 });

    res.json({
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