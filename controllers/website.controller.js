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

const validateDriverOwnership = (website, requestDriverId) => {
    if (website.driverId !== requestDriverId) {
        throw new Error("Unauthorized: You can only update your own website");
    }
};

exports.updateBasicInfo = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const {
        themeId,
        name,
        phone,
        whatsapp,
        city,
        serviceArea,
        officeHours,
        logoUrl: bodyLogoUrl, // 👈 direct link from body
    } = req.body;


    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId, themeId);

    let logoUrl = website.basicInfo.logoUrl;
    let logoPublicId = website.basicInfo.logoPublicId;

    /* ================= LOGO UPDATE ================= */

    // ✅ Case 1: File upload
    if (req.file) {
        if (logoPublicId) {
            await deleteFile(logoPublicId);
        }

        const uploadResult = await uploadBuffer(
            req.file.buffer,
            `websites/${driverId}/logo`
        );

        logoUrl = uploadResult.secure_url;
        logoPublicId = uploadResult.public_id;
    }

    // ✅ Case 2: Direct logo URL (no file)
    else if (bodyLogoUrl) {
        // agar pehle cloudinary logo tha to delete
        if (logoPublicId) {
            await deleteFile(logoPublicId);
        }

        logoUrl = bodyLogoUrl;
        logoPublicId = null; // 👈 direct link, no public id
    }

    /* ================= BASIC INFO UPDATE ================= */

    website.basicInfo = {
        name: name ?? website.basicInfo.name,
        phone: phone ?? website.basicInfo.phone,
        whatsapp: whatsapp ?? website.basicInfo.whatsapp,
        city: city ?? website.basicInfo.city,
        serviceArea: serviceArea ?? website.basicInfo.serviceArea,
        officeHours: officeHours ?? website.basicInfo.officeHours,
        logoUrl,
        logoPublicId,
    };

    await website.save();

    res.status(200).json({
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

        const url = `https://taxisafar.com/${driverId}/${themeId}`;

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

    /* ===== STEP 1: No website yet ===== */
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
            },
        });
    }

    let currentStep = 1;
    let stepName = "Choose Theme";
    const completed = [];

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

    /* ===== STEP 3: Popular Prices ===== */
    if (Array.isArray(website.popularPrices) && website.popularPrices.length >= 1) {
        completed.push("Popular Prices");
        currentStep = 4;
        stepName = "Packages";
    }

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



exports.createPaymentOrder = asyncHandler(async (req, res) => {
    const { driverId, themeId, durationMonths } = req.body;
    console.log(req.body)

    if (!driverId || !themeId || !durationMonths) {
        return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const theme = await Theme.findOne({ _id: themeId });

    if (!theme) {
        return res.status(404).json({ success: false, message: "Theme not found" });
    }

    const plan = theme.pricePlans.find(p =>
        p.durationMonths === Number(durationMonths) && p.isActive
    );

    if (!plan) {
        return res.status(400).json({ success: false, message: "Invalid plan duration" });
    }

    const amount = plan.price * 100; // convert to paise

    const order = await instance.orders.create({
        amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: { driverId, themeId, durationMonths },
    });

    res.status(201).json({
        success: true,
        data: {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: ENV.RAZORPAY_KEY_ID,
        },
    });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
    console.log(req.body);

    const { driverId, orderId, paymentId, signature, durationMonths } = req.body;

    if (!driverId || !orderId || !paymentId || !signature || !durationMonths) {
        return res.status(400).json({
            success: false,
            message: "Required payment fields missing",
        });
    }

    try {
        /* ===== Verify Razorpay Signature ===== */
        const generatedSignature = crypto
            .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");

        if (generatedSignature !== signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        /* ===== Find Website ===== */
        const website = await Website.findOne({ driverId });
        if (!website) {
            return res.status(404).json({
                success: false,
                message: "Website not found",
            });
        }

        /* ===== Calculate Paid Till ===== */
        const paidTill = new Date();
        paidTill.setMonth(paidTill.getMonth() + Number(durationMonths));

        /* ===== Map Duration ===== */
        const durationMap = {
            1: "1month",
            3: "3months",
            6: "6months",
            12: "1year",
        };

        const planDuration = durationMap[Number(durationMonths)];

        if (!planDuration) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan duration",
            });
        }

        /* ===== Decide Plan Type ===== */
        // Simple logic: based on theme OR fixed for now
        const planType = "premium"; // or derive from theme later

        /* ===== Save Subscription ===== */
        website.subscription = {
            planType,
            planDuration,
            orderId,
            paymentId,
            paidTill,
            isActive: true,
            purchasedAt: new Date(),
        };

        website.paidTill = paidTill;
        website.isLive = true; // optional: auto-publish after payment

        await website.save();

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                driverId: website.driverId,
                subscription: website.subscription,
                paidTill: website.paidTill,
            },
        });
    } catch (error) {
        console.error("Payment Verification Error:", error);
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