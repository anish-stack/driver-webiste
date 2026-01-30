const asyncHandler = require("../middlewares/asyncHandler");
const Theme = require("../models/theme.model");
const Package = require("../models/default.package.model");
const Website = require("../models/webiste.model");
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

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
    const { themeId, name, phone, whatsapp, city, serviceArea, officeHours } = req.body;
    console.log(req.body)
    console.log(req.file)

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    const website = await getOrCreateWebsite(driverId, themeId);

    let logoUrl = website.basicInfo.logoUrl;
    let logoPublicId = website.basicInfo.logoPublicId;

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

    website.basicInfo = {
        name: name || website.basicInfo.name,
        phone: phone || website.basicInfo.phone,
        whatsapp: whatsapp || website.basicInfo.whatsapp,
        city: city || website.basicInfo.city,
        serviceArea: serviceArea || website.basicInfo.serviceArea,
        officeHours: officeHours || website.basicInfo.officeHours,
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
    const { driverId } = req.params;
    const { packages } = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!Array.isArray(packages)) {
        return res.status(400).json({
            success: false,
            message: "packages must be an array",
        });
    }

    const website = await getOrCreateWebsite(driverId);

    const validPackages = packages.every(
        (p) => p.title && p.price !== undefined
    );

    if (!validPackages) {
        return res.status(400).json({
            success: false,
            message: "Each package must have title and price",
        });
    }

    website.packages = packages;
    await website.save();

    res.status(200).json({
        success: true,
        message: "Packages updated successfully",
        data: {
            driverId: website.driverId,
            packages: website.packages,
        },
    });
});

exports.addPackage = asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const packageData = req.body;

    if (!driverId) {
        return res.status(400).json({
            success: false,
            message: "driverId is required",
        });
    }

    if (!packageData.title || packageData.price === undefined) {
        return res.status(400).json({
            success: false,
            message: "title and price are required",
        });
    }

    const website = await getOrCreateWebsite(driverId);

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

    const website = await Website.findOne({ driverId });

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

    const url = `https://taxisafar.com/${driverId}/${themeId}`;

    // Generate QR as base64
    const qrCodeBase64 = await QRCode.toDataURL(url, {
      width: 380,
      margin: 2,
    });

    

    res.status(201).json({
      success: true,
      message: "QR generated successfully",
      data: {
        url,
        qrCode: qrCodeBase64, // frontend can directly show this
      },
    });
  } catch (error) {
    console.error("QR ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
    });
  }
};