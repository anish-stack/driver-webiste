const asyncHandler = require("../middlewares/asyncHandler");
const Theme = require("../models/theme.model");
const Package = require("../models/default.package.model");
const Website = require("../models/webiste.model");
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const ENV = require('../config/env')
const crypto = require('crypto')
const Razorpay = require('razorpay');
const Coupon = require("../models/coupon.model");

var instance = new Razorpay({
    key_id: ENV.RAZORPAY_KEY_ID,
    key_secret: ENV.RAZORPAY_KEY_SECRET,
});


const getOrCreateWebsite = async (driverId, themeId = null) => {
    let website = await Website.findOne({ driverId });

    if (!website) {
        if (!themeId) {
            throw new Error("themeId is required for new website creation");
        }

        const themeExists = await Theme.findById(themeId);
        if (!themeExists) {
            throw new Error("Invalid themeId");
        }

        website = await Website.create({
            driverId,
            themeId,
            basicInfo: {},
            packages: [],
            popularPrices: [],
            reviews: [],
            sections: {
                popularPrices: true,
                packages: true,
                reviews: true,
                contact: true,
            },
        });
    }

    return website;
};



exports.updateBasicInfo = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    let {
        themeId,
        name,
        phone,
        logo_name,
        whatsapp,
        city,
        serviceArea,
        officeHours,
        logoUrl,
    } = req.body;

    console.log("📥 BODY:", req.body);
    console.log("📦 FILE:", req.file ? "YES" : "NO");

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    // ✅ clean themeId
    const cleanThemeId =
        themeId && String(themeId).trim() !== "" ? String(themeId).trim() : null;

    // ✅ clean logoUrl
    const cleanLogoUrl =
        logoUrl && String(logoUrl).trim() !== "" ? String(logoUrl).trim() : null;

    const website = await getOrCreateWebsite(driverId, cleanThemeId);

    let finalLogoUrl = website.basicInfo?.logoUrl || null;
    let finalLogoPublicId = website.basicInfo?.logoPublicId || null;

    /* ================= LOGO UPDATE ================= */

    // ✅ Case 1: File upload
    if (req.file) {
        console.log("🟦 LOGO UPDATE: Uploading new file...");

        if (finalLogoPublicId) {
            console.log("🗑 Deleting old cloudinary file:", finalLogoPublicId);
            await deleteFile(finalLogoPublicId);
        }

        const uploadResult = await uploadBuffer(
            req.file.buffer,
            `websites/${driverId}/logo`
        );

        finalLogoUrl = uploadResult.secure_url;
        finalLogoPublicId = uploadResult.public_id;

        console.log("🟩 LOGO UPDATED VIA FILE:", finalLogoUrl);
    }

    // ✅ Case 2: Direct logo URL
    else if (cleanLogoUrl) {
        console.log("🟦 LOGO UPDATE: Saving direct URL:", cleanLogoUrl);

        if (finalLogoPublicId) {
            console.log("🗑 Deleting old cloudinary file:", finalLogoPublicId);
            await deleteFile(finalLogoPublicId);
        }

        finalLogoUrl = cleanLogoUrl;
        finalLogoPublicId = null;

        console.log("🟩 LOGO UPDATED VIA URL:", finalLogoUrl);
    } else {
        console.log("🟨 LOGO UPDATE: No new logo provided");
    }

    /* ================= BASIC INFO UPDATE ================= */

    website.basicInfo = {
        name: name ?? website.basicInfo?.name,
        logo_name: logo_name ?? website.basicInfo?.logo_name,
        phone: phone ?? website.basicInfo?.phone,
        whatsapp: whatsapp ?? website.basicInfo?.whatsapp,
        city: city ?? website.basicInfo?.city,
        serviceArea: serviceArea ?? website.basicInfo?.serviceArea,
        officeHours: officeHours ?? website.basicInfo?.officeHours,
        logoUrl: finalLogoUrl,
        logoPublicId: finalLogoPublicId,
    };

    await website.save();

    console.log("✅ FINAL BASIC INFO SAVED:", website.basicInfo);

    return res.status(200).json({
        success: true,
        message: "Basic info updated successfully",
        data: {
            driverId: website.driverId,
            themeId: website.themeId,
            basicInfo: website.basicInfo,
        },
    });
});



exports.updatePopularPrices = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { popularPrices } = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!Array.isArray(popularPrices)) {
        return res.status(400).json({
            success: false,
            message: "popularPrices must be an array",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const validPrices = popularPrices.every(
        (p) => p.start && p.end && p.type
    );

    if (!validPrices) {
        return res.status(400).json({
            success: false,
            message: "Each price must have start, end, and type",
        });
    }

    website.popularPrices = popularPrices;
    await website.save();

    res.status(200).json({
        success: true,
        message: "Popular prices updated successfully",
        data: {
            driverId: website.driverId,
            popularPrices: website.popularPrices,
        },
    });
});

exports.addPopularPrice = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const priceData = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!priceData.start || !priceData.end || !priceData.type) {
        return res.status(400).json({
            success: false,
            message: "start, end, and type are required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    website.popularPrices.push(priceData);
    await website.save();

    res.status(201).json({
        success: true,
        message: "Popular price added successfully",
        data: {
            driverId: website.driverId,
            popularPrices: website.popularPrices,
        },
    });
});

exports.deletePopularPrice = asyncHandler(async (req, res) => {
    const { driverId, index } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= website.popularPrices.length) {
        return res.status(400).json({
            success: false,
            message: "Invalid index",
        });
    }

    website.popularPrices.splice(idx, 1);
    await website.save();

    res.status(200).json({
        success: true,
        message: "Popular price deleted successfully",
        data: {
            driverId: website.driverId,
            popularPrices: website.popularPrices,
        },
    });
});

exports.updatePackages = asyncHandler(async (req, res) => {
    const { driverId, index } = req.params;
    const packageData = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (index === undefined || isNaN(index)) {
        return res.status(400).json({
            success: false,
            message: "valid package index is required",
        });
    }

    if (!packageData.title || packageData.price === undefined) {
        return res.status(400).json({
            success: false,
            message: "title and price are required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    if (!website.packages[index]) {
        return res.status(404).json({
            success: false,
            message: "Package not found at given index",
        });
    }

    /* ===== UPDATE ONLY TARGET PACKAGE ===== */
    website.packages[index] = {
        ...website.packages[index],
        title: packageData.title,
        price: packageData.price,
        description: packageData.description || "",
        duration: packageData.duration || "",
        displayOrder: packageData.displayOrder ?? index,
        image: packageData.image || website.packages[index].image,
    };

    await website.save();

    res.status(200).json({
        success: true,
        message: "Package updated successfully",
        data: {
            driverId: website.driverId,
            updatedIndex: Number(index),
            package: website.packages[index],
        },
    });
});

exports.addPackage = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const {
        title,
        price,
        description,
        duration,
        displayOrder,
        image: bodyImageUrl,
    } = req.body;
    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!title || price === undefined) {
        return res.status(400).json({
            success: false,
            message: "title and price are required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    let image = bodyImageUrl || null;

    /* ============ IMAGE HANDLING ============ */
    if (req.file) {
        const uploadResult = await uploadBuffer(
            req.file.buffer,
            `websites/${driverId}/packages`
        );

        image = uploadResult.secure_url;
    }

    const packageData = {
        title,
        price,
        description,
        duration,
        displayOrder: displayOrder ?? 0,
        image,
    };

    website.packages.push(packageData);
    await website.save();

    res.status(201).json({
        success: true,
        message: "Package added successfully",
        data: {
            driverId: website.driverId,
            packages: website.packages,
        },
    });
});

exports.deletePackage = asyncHandler(async (req, res) => {
    const { driverId, index } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= website.packages.length) {
        return res.status(400).json({
            success: false,
            message: "Invalid index",
        });
    }

    website.packages.splice(idx, 1);
    await website.save();

    res.status(200).json({
        success: true,
        message: "Package deleted successfully",
        data: {
            driverId: website.driverId,
            packages: website.packages,
        },
    });
});

exports.updateReviews = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { reviews } = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!Array.isArray(reviews)) {
        return res.status(400).json({
            success: false,
            message: "reviews must be an array",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const validReviews = reviews.every(
        (r) => r.name && r.rating && r.rating >= 1 && r.rating <= 5 && r.text
    );

    if (!validReviews) {
        return res.status(400).json({
            success: false,
            message: "Each review must have name, rating (1-5), and text",
        });
    }

    website.reviews = reviews;
    await website.save();

    res.status(200).json({
        success: true,
        message: "Reviews updated successfully",
        data: {
            driverId: website.driverId,
            reviews: website.reviews,
        },
    });
});

exports.addReview = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const reviewData = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!reviewData.name || !reviewData.rating || !reviewData.text) {
        return res.status(400).json({
            success: false,
            message: "name, rating, and text are required",
        });
    }

    if (reviewData.rating < 1 || reviewData.rating > 5) {
        return res.status(400).json({
            success: false,
            message: "rating must be between 1 and 5",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    website.reviews.push(reviewData);
    await website.save();

    res.status(201).json({
        success: true,
        message: "Review added successfully",
        data: {
            driverId: website.driverId,
            reviews: website.reviews,
        },
    });
});

exports.deleteReview = asyncHandler(async (req, res) => {
    const { driverId, index } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= website.reviews.length) {
        return res.status(400).json({
            success: false,
            message: "Invalid index",
        });
    }

    website.reviews.splice(idx, 1);
    await website.save();

    res.status(200).json({
        success: true,
        message: "Review deleted successfully",
        data: {
            driverId: website.driverId,
            reviews: website.reviews,
        },
    });
});

exports.updateSections = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { sections } = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!sections || typeof sections !== "object") {
        return res.status(400).json({
            success: false,
            message: "sections must be an object",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    website.sections = {
        popularPrices: sections.popularPrices !== undefined ? sections.popularPrices : website.sections.popularPrices,
        packages: sections.packages !== undefined ? sections.packages : website.sections.packages,
        reviews: sections.reviews !== undefined ? sections.reviews : website.sections.reviews,
        contact: sections.contact !== undefined ? sections.contact : website.sections.contact,
    };

    await website.save();

    res.status(200).json({
        success: true,
        message: "Sections updated successfully",
        data: {
            driverId: website.driverId,
            sections: website.sections,
        },
    });
});

exports.toggleLiveStatus = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { isLive } = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (typeof isLive !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "isLive must be a boolean",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    website.isLive = isLive;
    await website.save();

    res.status(200).json({
        success: true,
        message: `Website ${isLive ? 'published' : 'unpublished'} successfully`,
        data: {
            driverId: website.driverId,
            isLive: website.isLive,
        },
    });
});

exports.getWebsite = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await Website.findOne({ driverId }).populate("themeId", "name");

    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found",
        });
    }

    res.status(200).json({
        success: true,
        data: website,
    });
});


exports.getWebsiteBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    if (!slug) {
        return res.status(400).json({
            success: false,
            message: "Slug is required",
        });
    }

    const website = await Website.findOne({ website_url: slug }).populate("themeId");

    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found",
        });
    }

    res.status(200).json({
        success: true,
        data: website,
    });
});

exports.deleteWebsite = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await Website.findOne({ driverId });

    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found",
        });
    }

    if (website.basicInfo.logoPublicId) {
        await deleteFile(website.basicInfo.logoPublicId);
    }

    await Website.deleteOne({ driverId });

    res.status(200).json({
        success: true,
        message: "Website deleted successfully",
    });
});



exports.genrateQrCodeForWebsite = async (req, res) => {
    try {
        const { driverId, themeId } = req.query;

        if (!driverId || !themeId) {
            return res.status(400).json({
                success: false,
                message: "driverId and themeId are required",
            });
        }

        const website = await Website.findOne({ driverId });
        if (!website) {
            return res.status(404).json({
                success: false,
                message: "Website not found",
            });
        }

        const url = `https://taxisafar.com/${website?.website_url}`;

        /* ===== Generate QR (buffer) ===== */
        const qrBuffer = await QRCode.toBuffer(url, {
            width: 380,
            margin: 2,
        });

        /* ===== Delete old QR from Cloudinary (if exists) ===== */
        if (website.qrCode?.publicId) {
            await deleteFile(website.qrCode.publicId);
        }

        /* ===== Upload new QR to Cloudinary ===== */
        const uploadResult = await uploadBuffer(
            qrBuffer,
            `websites/${driverId}/qr-code`
        );

        /* ===== Save in website ===== */
        website.qrCode = {
            url,
            image: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            generatedAt: new Date(),
        };

        await website.save();

        return res.status(201).json({
            success: true,
            message: "QR generated and saved successfully",
            data: {
                driverId: website.driverId,
                qrCode: website.qrCode,
            },
        });
    } catch (error) {
        console.error("QR ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate QR code",
            error: error.message,
        });
    }
};

exports.getWhichStepIAmOn = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!mongoose.isValidObjectId(driverId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid driverId format",
        });
    }

    const website = await Website.findOne({ driverId });

    if (!website) {
        return res.status(200).json({
            success: true,
            data: {
                currentStep: 1,
                stepName: "Choose Theme",
                completedSteps: 0,
                totalSteps: 7,
                completed: [],
                progress: 0,
                hasWebsite: false,
                popularPricesSkipped: false,
            },
        });
    }

    let currentStep = 1;
    let stepName = "Choose Theme";
    const completed = [];

    // ✅ NEW FLAG
    let popularPricesSkipped = false;

    /* ===== STEP 1: Theme ===== */
    completed.push("Theme Selected");
    currentStep = 2;
    stepName = "Basic Information";

    /* ===== STEP 2: Basic Info ===== */
    const basic = website.basicInfo || {};
    const hasBasicInfo =
        basic.name?.trim() &&
        basic.phone?.trim() &&
        (basic.logoUrl || basic.logoPublicId) &&
        basic.city?.trim();

    if (hasBasicInfo) {
        completed.push("Basic Information");
        currentStep = 3;
        stepName = "Popular Prices";
    }

    /* ===== STEP 3: Popular Prices (OPTIONAL) ===== */
    if (Array.isArray(website.popularPrices) && website.popularPrices.length >= 1) {
        completed.push("Popular Prices");
    } else {
        popularPricesSkipped = true; // ✅ mark skipped if empty
    }

    // ✅ Always allow next step
    currentStep = 4;
    stepName = "Packages";

    /* ===== STEP 4: Packages ===== */
    if (Array.isArray(website.packages) && website.packages.length >= 1) {
        completed.push("Packages");
        currentStep = 5;
        stepName = "Customer Reviews";
    }

    /* ===== STEP 5: Reviews ===== */
    if (Array.isArray(website.reviews) && website.reviews.length >= 1) {
        completed.push("Customer Reviews");
        currentStep = 6;
        stepName = "Social Links";
    }

    /* ===== STEP 6: Social Links ===== */
    const social = website.socialLinks || {};
    const hasSocialLinks =
        social.facebook?.trim() ||
        social.instagram?.trim() ||
        social.twitter?.trim() ||
        social.linkedin?.trim() ||
        social.youtube?.trim() ||
        social.whatsapp?.trim() ||
        social.website?.trim();

    if (hasSocialLinks) {
        completed.push("Social Links");
        currentStep = 7;
        stepName = "Publish Website";
    }

    /* ===== STEP 7: Website Live ===== */
    if (website.isLive === true) {
        stepName = "Website is Live";
    }

    return res.status(200).json({
        success: true,
        data: {
            currentStep,
            stepName,
            completedSteps: completed.length,
            totalSteps: 7,
            completed,
            isLive: website.isLive || false,
            hasWebsite: true,
            popularPricesSkipped, // ✅ added
            progress: Math.round((completed.length / 7) * 100),
        },
    });
});


exports.upsertSocialLinks = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const socialLinks = req.body;
    console.log(req.body)
    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    website.socialLinks = {
        facebook: socialLinks.facebook ?? website.socialLinks.facebook ?? "",
        instagram: socialLinks.instagram ?? website.socialLinks.instagram ?? "",
        twitter: socialLinks.twitter ?? website.socialLinks.twitter ?? "",
        linkedin: socialLinks.linkedin ?? website.socialLinks.linkedin ?? "",
        youtube: socialLinks.youtube ?? website.socialLinks.youtube ?? "",
        whatsapp: socialLinks.whatsapp ?? website.socialLinks.whatsapp ?? "",
        website: socialLinks.website ?? website.socialLinks.website ?? "",
    };

    await website.save();

    res.status(200).json({
        success: true,
        message: "Social links saved successfully",
        data: {
            driverId: website.driverId,
            socialLinks: website.socialLinks,
        },
    });
});



exports.getSocialLinks = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    res.status(200).json({
        success: true,
        data: {
            driverId: website.driverId,
            socialLinks: website.socialLinks || {},
        },
    });
});


exports.checkWebsiteUrlPresentOrNot = async (req, res) => {
    try {
        let { slug } = req.body;
        console.log(slug)
        slug = (slug || "").toString().trim().toLowerCase();

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Please enter a website URL name.",
            });
        }

        // allow only a-z, 0-9, -
        const slugRegex = /^[a-z0-9-]{3,50}$/;
        if (!slugRegex.test(slug)) {
            return res.status(400).json({
                success: false,
                message:
                    "Only letters, numbers, and hyphen (-) are allowed. Example: vicky-cabs",
            });
        }

        // Check if already exists
        const websiteFound = await Website.findOne({ website_url: slug }).lean();

        // If available
        if (!websiteFound) {
            return res.json({
                success: true,
                available: true,
                message: "Great! This website URL is available 🎉",
                slug,
            });
        }

        // If not available → generate suggestions
        const suggestions = [];
        const candidates = [
            `${slug}1`,
            `${slug}24`,
            `${slug}cab`,
            `${slug}cabs`,
            `${slug}taxi`,
            `${slug}-official`,
            `${slug}-india`,
            `${slug}-online`,
        ];

        for (let candidate of candidates) {
            if (suggestions.length >= 3) break;
            const exists = await Website.findOne({ website_url: candidate, isLive: true }).lean();
            if (!exists) suggestions.push(candidate);
        }

        return res.json({
            success: true,
            available: false,
            message: "Oops! This website URL is already taken 😕",
            slug,
            suggestions,
        });
    } catch (error) {
        console.error("checkWebsiteUrlPresentOrNot error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again.",
        });
    }
};

const validateAndCalculateCoupon = async ({
    couponCode,
    driverId,
    orderAmountRupees,
}) => {
    if (!couponCode) {
        return {
            applied: false,
            discountAmount: 0,
            finalAmount: orderAmountRupees,
            coupon: null,
        };
    }

    const code = couponCode.trim().toUpperCase();

    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
        throw new Error("Invalid coupon code");
    }

    if (!coupon.active) {
        throw new Error("Coupon is inactive");
    }

    const now = new Date();

    if (coupon.startDate && now < coupon.startDate) {
        throw new Error("Coupon not started yet");
    }

    if (coupon.expireDate && now > coupon.expireDate) {
        throw new Error("Coupon expired");
    }

    // min order
    if (coupon.minOrderValue > 0 && orderAmountRupees < coupon.minOrderValue) {
        throw new Error(`Minimum order value is ₹${coupon.minOrderValue}`);
    }

    // total usage
    if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
        throw new Error("Coupon usage limit reached");
    }

    // per user usage
    const userUsage = (coupon.usedByUsers || []).find(
        (u) => String(u.driverId) === String(driverId)
    );

    if (userUsage && userUsage.usedCount >= coupon.perUserUsageLimit) {
        throw new Error("You already used this coupon maximum times");
    }

    // calculate discount
    let discountAmount = 0;

    if (coupon.discountType === "FLAT") {
        discountAmount = coupon.amountOff;
    }

    if (coupon.discountType === "PERCENT") {
        discountAmount = (orderAmountRupees * coupon.percentOff) / 100;

        if (coupon.maxDiscountAmount > 0) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
    }

    discountAmount = Math.min(discountAmount, orderAmountRupees);

    const finalAmount = orderAmountRupees - discountAmount;

    return {
        applied: true,
        coupon,
        discountAmount,
        finalAmount,
    };
};


exports.createPaymentOrder = asyncHandler(async (req, res) => {
    const { driverId, themeId, durationMonths, slug, websiteId, upgrade, amountInPaise, couponCode, } = req.body;
    console.log(req.body)
    if (!driverId || !themeId || !durationMonths) {
        return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const theme = await Theme.findById(themeId);
    if (!theme) {
        return res.status(404).json({ success: false, message: "Theme not found" });
    }
    const plan = theme.pricePlans.find(
        (p) => p.durationMonths === Number(durationMonths) && p.isActive
    );

    if (!plan) {
        return res.status(400).json({ success: false, message: "Invalid plan duration" });
    }

    const amount = upgrade ? Number(amountInPaise) : Number(plan.price) * 100; // paise
    const amountRupees = amount / 100;

    let couponInfo = {
        applied: false,
        discountAmount: 0,
        finalAmount: amountRupees,
        coupon: null,
    };


    try {
        couponInfo = await validateAndCalculateCoupon({
            couponCode,
            driverId,
            orderAmountRupees: amountRupees,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message || "Invalid coupon",
        });
    }

    // final amount in paise
    const finalAmountPaise = Math.round(couponInfo.finalAmount * 100);

    // safety: never 0 amount for razorpay
    if (finalAmountPaise < 100) {
        return res.status(400).json({
            success: false,
            message: "Final amount too low after discount",
        });
    }

    console.log("ouponInfo", couponInfo)
    const order = await instance.orders.create({
        amount: finalAmountPaise,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: {
            driverId,
            themeId,
            durationMonths,
            websiteId,
            slug,
            upgrade: !!upgrade,

            // coupon info
            couponApplied: couponInfo.applied,
            couponCode: couponInfo.coupon?.code || "",
            couponId: couponInfo.coupon?._id?.toString() || "",
            discountAmount: couponInfo.discountAmount,
            baseAmount: amountRupees,
            finalAmount: couponInfo.finalAmount,
        },
    });


    // ✅ Save slug on order create
    const website = await Website.findById(websiteId);
    if (!website) {
        return res.status(404).json({ success: false, message: "Website not found" });
    }

    if (!upgrade) {
        website.website_url = slug;
    }

    // ✅ Save pending subscription
    website.subscription = {
        planType: theme.planType || "basic",
        durationMonths: Number(durationMonths),
        themeId,
        orderId: order.id,
        paymentId: "",
        amountPay: couponInfo.finalAmount,       // ✅ FINAL AMOUNT
        amountPayPaise: finalAmountPaise,
        status: "pending",
        paidTill: null,
        coupon: couponInfo.applied
            ? {
                couponId: couponInfo.coupon._id,
                code: couponInfo.coupon.code,
                discountAmount: couponInfo.discountAmount,
                baseAmount: amountRupees,
                finalAmount: couponInfo.finalAmount,
            }
            : null,
        purchasedAt: new Date(),
    };

    // Optional: history me bhi daal do
    website.subscriptionHistory.push(website.subscription);

    await website.save();

    res.status(201).json({
        success: true,
        data: {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: ENV.RAZORPAY_KEY_ID,
            coupon: couponInfo.applied
                ? {
                    code: couponInfo.coupon.code,
                    discountAmount: couponInfo.discountAmount,
                    baseAmount: amountRupees,
                    finalAmount: couponInfo.finalAmount,
                }
                : null,
        },
    });
});
exports.verifyPayment = asyncHandler(async (req, res) => {
    const {
        driverId,
        orderId,
        paymentId,
        signature,
        durationMonths,
        theme,
        upgrade,
    } = req.body;


    if (!driverId || !orderId || !paymentId || !signature || !durationMonths) {
        console.log("❌ Missing required fields");
        return res.status(400).json({
            success: false,
            message: "Required payment fields missing",
        });
    }

    try {
        /* =========================================================
           1) VERIFY SIGNATURE
        ========================================================= */
        const generatedSignature = crypto
            .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");


        if (generatedSignature !== signature) {
            console.log("❌ Signature mismatch");
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        /* =========================================================
           2) FIND WEBSITE
        ========================================================= */
        const website = await Website.findOne({ driverId });

        if (!website) {
            console.log("❌ Website not found for driverId:", driverId);
            return res.status(404).json({
                success: false,
                message: "Website not found",
            });
        }


        /* =========================================================
           3) CLEAN OLD INVALID HISTORY (IMPORTANT FIX)
           - Purane records me required fields missing the
        ========================================================= */
        website.subscriptionHistory = (website.subscriptionHistory || []).filter(
            (s) => s && s.orderId && s.themeId
        );

        /* =========================================================
           4) DUPLICATE CHECK (CORRECT)
           - same paymentId => duplicate
           - same orderId => duplicate ONLY if status paid
        ========================================================= */
        const alreadyExists = (website.subscriptionHistory || []).some((s) => {
            if (s.paymentId && s.paymentId === paymentId) return true;
            if (s.orderId === orderId && s.status === "paid") return true;
            return false;
        });

        console.log("🔁 Duplicate Check:", alreadyExists);

        if (alreadyExists) {
            console.log("⚠️ Payment already verified, returning existing data.");
            return res.status(200).json({
                success: true,
                message: "Payment already verified",
                data: {
                    driverId: website.driverId,
                    subscription: website.subscription,
                    paidTill: website.paidTill,
                    themeId: website.themeId,
                },
            });
        }

        /* =========================================================
           5) CHECK CURRENT PENDING SUBSCRIPTION
        ========================================================= */
        console.log("📌 Current subscription on website:", website.subscription);

        if (!website.subscription) {
            console.log("❌ No subscription found on website");
            return res.status(400).json({
                success: false,
                message: "No subscription found",
            });
        }

        if (website.subscription.orderId !== orderId) {
            console.log("❌ OrderId mismatch");
            console.log("🧾 Website OrderId:", website.subscription.orderId);
            console.log("🧾 Request OrderId:", orderId);

            return res.status(400).json({
                success: false,
                message: "OrderId does not match current pending subscription",
            });
        }

        console.log("✅ OrderId matched with pending subscription");
        try {
            const subCoupon = website.subscription?.coupon;

            if (subCoupon?.couponId && subCoupon?.code) {
                console.log("🎟 Coupon detected in subscription:", subCoupon);

                const coupon = await Coupon.findById(subCoupon.couponId);

                if (coupon) {
                    // total usage limit check again
                    if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
                        return res.status(400).json({
                            success: false,
                            message: "Coupon usage limit reached (during confirm)",
                        });
                    }

                    // per user usage check again
                    const userUsage = (coupon.usedByUsers || []).find(
                        (u) => String(u.driverId) === String(driverId)
                    );

                    if (userUsage && userUsage.usedCount >= coupon.perUserUsageLimit) {
                        return res.status(400).json({
                            success: false,
                            message: "Coupon per-user usage limit reached",
                        });
                    }

                    // update usage
                    coupon.usedCount += 1;

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
                    console.log("✅ Coupon usage confirmed successfully");
                } else {
                    console.log("⚠️ Coupon not found, skipping usage confirm");
                }
            } else {
                console.log("🎟 No coupon applied");
            }
        } catch (err) {
            console.log("🔥 Coupon confirm error:", err.message);
        }
        /* =========================================================
           6) PAID TILL EXTEND LOGIC
        ========================================================= */
        const now = new Date();

        const baseDate =
            website.paidTill && new Date(website.paidTill) > now
                ? new Date(website.paidTill)
                : now;

        const paidTill = new Date(baseDate);
        paidTill.setMonth(paidTill.getMonth() + Number(durationMonths));



        /* =========================================================
           7) UPDATE SUBSCRIPTION (PAID)
        ========================================================= */
        const oldSubscription = website.subscription;

        const updatedSubscription = {
            planType: oldSubscription.planType || "basic",
            durationMonths: Number(durationMonths),
            themeId: oldSubscription.themeId || website.themeId,
            coupon: oldSubscription.coupon || null,
            orderId,
            paymentId,

            amountPay: Number(oldSubscription.amountPay || 0),
            amountPayPaise: Number(oldSubscription.amountPayPaise || 0),

            status: "paid",
            paidTill,

            isActive: true,
            purchasedAt: oldSubscription.purchasedAt || now,
        };

        if (updatedSubscription.coupon) {
            updatedSubscription.coupon.appliedAt = new Date();
        }

        console.log("🧾 Updated Subscription:", updatedSubscription);

        /* =========================================================
           8) MARK OLD HISTORY INACTIVE
        ========================================================= */
        website.subscriptionHistory = (website.subscriptionHistory || []).map((s) => ({
            ...s,
            isActive: false,
        }));

        /* =========================================================
           9) SAVE NEW SUBSCRIPTION
        ========================================================= */
        website.subscription = updatedSubscription;
        website.subscriptionHistory.push(updatedSubscription);

        website.paidTill = paidTill;
        website.isLive = true;

        console.log("✅ Subscription saved + website marked live");

        /* =========================================================
           10) THEME UPGRADE (OPTIONAL)
        ========================================================= */
        const isUpgrade = upgrade === true || upgrade === "true";
        console.log("🎨 Upgrade Flag:", isUpgrade);

        if (isUpgrade) {
            const newThemeId = theme?._id || theme?.themeId || null;

            console.log("🎨 New ThemeId:", newThemeId);

            if (!newThemeId || !mongoose.isValidObjectId(newThemeId)) {
                console.log("❌ Invalid themeId for upgrade");
                return res.status(400).json({
                    success: false,
                    message: "Theme is required for upgrade",
                });
            }

            const oldThemeId = website.themeId;

            if (String(oldThemeId) !== String(newThemeId)) {
                website.themeHistory = website.themeHistory || [];
                website.themeHistory.push({
                    oldThemeId,
                    newThemeId,
                    amountPay: String(updatedSubscription.amountPay || ""),
                    changedAt: new Date(),
                    reason: "upgrade",
                    orderId,
                    paymentId,
                });

                website.themeId = newThemeId;
                console.log("✅ Theme upgraded & history saved");
            } else {
                console.log("⚠️ Same theme selected, no theme change required");
            }
        }

        /* =========================================================
           11) FINAL SAVE
        ========================================================= */
        await website.save();

        console.log("✅ Website saved successfully in DB");
        console.log("========================================");

        return res.status(200).json({
            success: true,
            message: isUpgrade
                ? "Payment verified & theme upgraded successfully 🎉"
                : "Payment verified successfully 🎉",
            data: {
                driverId: website.driverId,
                subscription: website.subscription,
                paidTill: website.paidTill,
                themeId: website.themeId,
                upgrade: isUpgrade,
            },
        });
    } catch (error) {
        console.log("🔥 ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Payment verification failed",
            error: error.message,
        });
    }
});




exports.getSubscriptionStatus = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await Website.findOne({ driverId });

    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found",
        });
    }

    const now = new Date();
    const isSubscriptionActive = website.paidTill && website.paidTill > now;

    res.status(200).json({
        success: true,
        data: {
            driverId: website.driverId,
            subscription: website.subscription || null,
            paidTill: website.paidTill || null,
            isActive: isSubscriptionActive,
            daysRemaining: isSubscriptionActive
                ? Math.ceil((website.paidTill - now) / (1000 * 60 * 60 * 24))
                : 0,
        },
    });
});

const calculateProratedRefund = (oldPrice, oldDurationMonths, paidTill) => {
    if (!paidTill) return 0;

    const now = new Date();
    const paidTillDate = new Date(paidTill);

    const remainingMs = paidTillDate.getTime() - now.getTime();
    if (remainingMs <= 0) return 0;

    const totalMsInPlan = Number(oldDurationMonths) * 30 * 24 * 60 * 60 * 1000;
    if (!totalMsInPlan || totalMsInPlan <= 0) return 0;

    const remainingRatio = Math.min(remainingMs / totalMsInPlan, 1);
    return Math.round(Number(oldPrice) * remainingRatio);
};

const getLatestSubscription = (website) => {
    if (website.subscription && website.subscription.orderId) {
        return website.subscription;
    }

    const paidSubs = (website.subscriptionHistory || []).filter(
        (s) => s && s.status === "paid"
    );

    if (!paidSubs.length) return null;

    paidSubs.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    return paidSubs[0];
};

/* ==========================================
   CHANGE THEME + CALCULATE PAYABLE AMOUNT
   ========================================== */
exports.changeThemeAndCalculatePrice = asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    const {
        newThemeId,
        plan, // { durationMonths, price }
        upgrade = true,
    } = req.body;

    console.log("🟢 Request body:", req.body);

    /* ================= VALIDATIONS ================= */
    if (!driverId || !mongoose.isValidObjectId(driverId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing driverId",
        });
    }

    if (!newThemeId || !mongoose.isValidObjectId(newThemeId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing newThemeId",
        });
    }

    if (!plan || typeof plan !== "object") {
        return res.status(400).json({
            success: false,
            message: "Selected plan is required",
        });
    }

    if (!plan.durationMonths || !plan.price) {
        return res.status(400).json({
            success: false,
            message: "Plan must include durationMonths and price",
        });
    }

    const durationMonths = Number(plan.durationMonths);
    const newPrice = Number(plan.price);

    if (!durationMonths || durationMonths < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid durationMonths in plan",
        });
    }

    if (!newPrice || newPrice < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid price in plan",
        });
    }

    /* ================= FIND WEBSITE ================= */
    const website = await Website.findOne({ driverId });
    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found",
        });
    }

    /* ================= CURRENT THEME ================= */
    const oldTheme = await Theme.findById(website.themeId);
    if (!oldTheme) {
        return res.status(404).json({
            success: false,
            message: "Current theme not found",
        });
    }

    /* ================= NEW THEME ================= */
    const newTheme = await Theme.findById(newThemeId);
    if (!newTheme) {
        return res.status(404).json({
            success: false,
            message: "New theme not found",
        });
    }

    /* ================= LATEST SUBSCRIPTION ================= */
    const latestSub = getLatestSubscription(website);

    const oldDurationMonths = Number(latestSub?.durationMonths || 0);
    const oldPaidTill = latestSub?.paidTill || website.paidTill || null;

    console.log("📌 Latest Subscription Used:", latestSub);

    /* ================= OLD PLAN PRICE (FROM OLD THEME) ================= */
    let oldPlan = null;

    if (oldDurationMonths) {
        oldPlan = oldTheme.pricePlans?.find(
            (p) => p.isActive && Number(p.durationMonths) === Number(oldDurationMonths)
        );
    }

    if (!oldPlan) oldPlan = oldTheme.pricePlans?.find((p) => p.isActive);
    if (!oldPlan) oldPlan = oldTheme.pricePlans?.[0];

    const oldPrice = Number(oldPlan?.price || latestSub?.amountPay || 0);

    /* ================= PRORATED REFUND ================= */
    let proratedRefund = 0;

    const hasActivePaid = oldPaidTill && new Date(oldPaidTill) > new Date();

    if (upgrade === true && hasActivePaid && oldPrice > 0 && oldDurationMonths > 0) {
        proratedRefund = calculateProratedRefund(
            oldPrice,
            oldDurationMonths,
            oldPaidTill
        );
    }

    /* ================= FINAL AMOUNT ================= */
    let amountToPay = newPrice - proratedRefund;
    amountToPay = Math.max(0, amountToPay);

    const MIN_UPGRADE_FEE = 49;

    if (upgrade === true && amountToPay === 0) {
        amountToPay = MIN_UPGRADE_FEE;
    }

    /* ================= MESSAGE ================= */
    let message = "";

    if (upgrade === true) {
        if (amountToPay === MIN_UPGRADE_FEE) {
            message =
                `Upgrade charge: ₹${MIN_UPGRADE_FEE}\n` +
                `Aapka remaining subscription amount adjust ho gaya hai.\n` +
                `Bas ₹${MIN_UPGRADE_FEE} pay karke upgrade complete kar sakte hain!`;
        } else {
            message =
                `Upgrade ka total kharcha: ₹${amountToPay}\n` +
                `Aapke bache hue ₹${proratedRefund} rupaye adjust kar diye gaye hain.\n\n` +
                `Bas ₹${amountToPay} pay karke upgrade complete kar sakte hain!`;
        }
    } else {
        message =
            `Plan purchase amount: ₹${amountToPay}\n` +
            `Proceed to payment to activate your website.`;
    }

    /* ================= RESPONSE ================= */
    return res.status(200).json({
        success: true,
        data: {
            driverId,

            // Current
            currentThemeId: website.themeId,
            currentThemeName: oldTheme.name,
            currentPlanPrice: oldPrice,
            currentPaidTill: oldPaidTill,

            // New
            newThemeId,
            newThemeName: newTheme.name,
            selectedPlan: {
                durationMonths,
                price: newPrice,
            },

            // Upgrade calculation
            upgrade: upgrade === true,
            proratedRefund,
            amountToPay,
            amountInPaise: Math.round(amountToPay * 100),
            currency: "INR",
            message,
        },
    });
});


exports.applyNewTheme = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { newThemeId, paymentId, orderId, signature, durationMonths } = req.body;

    if (!driverId || !newThemeId) {
        return res.status(400).json({
            success: false,
            message: "driverId and newThemeId required",
        });
    }

    const website = await Website.findOne({ driverId });
    if (!website) {
        return res.status(404).json({ success: false, message: "Website not found" });
    }

    const newTheme = await Theme.findById(newThemeId);
    if (!newTheme) {
        return res.status(404).json({ success: false, message: "New theme not found" });
    }

    // If payment was required → verify
    let amountPaid = 0;
    if (paymentId && orderId && signature) {
        // Verify Razorpay signature
        const generatedSignature = crypto
            .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");

        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        amountPaid = req.body.amountPaid || 0; // you should pass this from frontend
    }

    // Update theme
    website.themeId = newThemeId;

    // Extend / refresh subscription
    const paidTill = new Date();
    paidTill.setMonth(paidTill.getMonth() + (durationMonths || 1));

    website.paidTill = paidTill;
    website.isLive = true;

    await website.save();

    res.status(200).json({
        success: true,
        message: "Theme changed and subscription updated successfully",
        data: {
            newThemeId,
            newThemeName: newTheme.name,
            paidTill,
            isLive: true,
        },
    });
});


exports.updateWebsiteUrl = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    let { slug } = req.body;

    // ✅ Validation 1: driverId required
    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    // ✅ Validation 2: Check if driver's website exists
    const website = await Website.findOne({ driverId });

    if (!website) {
        return res.status(404).json({
            success: false,
            message: "Website not found for this driver",
        });
    }


    // ✅ Validation 4: slug required
    slug = (slug || "").toString().trim().toLowerCase();

    if (!slug) {
        return res.status(400).json({
            success: false,
            message: "Website URL (slug) is required",
        });
    }

    // ✅ Validation 5: slug format (only a-z, 0-9, -, min 4, max 30)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    
    if (!slugRegex.test(slug)) {
        return res.status(400).json({
            success: false,
            message: "Only lowercase letters, numbers, and single hyphens allowed",
        });
    }

    if (slug.length < 4) {
        return res.status(400).json({
            success: false,
            message: "URL must be at least 4 characters long",
        });
    }

    if (slug.length > 30) {
        return res.status(400).json({
            success: false,
            message: "URL too long (maximum 30 characters)",
        });
    }

    // ✅ Validation 6: Check if slug is already taken (by another driver)
    const existingWebsite = await Website.findOne({ 
        website_url: slug,
        driverId: { $ne: driverId } // Not the same driver
    }).lean();

    if (existingWebsite) {
        return res.status(400).json({
            success: false,
            message: "This URL is already taken by another driver",
            available: false,
        });
    }

    // ✅ Update the website URL
    website.website_url = slug;
    await website.save();

    return res.status(200).json({
        success: true,
        message: "Website URL updated successfully",
        data: {
            driverId: website.driverId,
            website_url: website.website_url,
            slug: slug,
        },
    });
});