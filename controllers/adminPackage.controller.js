const asyncHandler = require("../middlewares/asyncHandler");
const Package = require("../models/default.package.model");
const { uploadBuffer, deleteFile } = require("../utils/uploadToCloudinary");



exports.createPackage = asyncHandler(async (req, res) => {
  const { title, price, description, duration, displayOrder } = req.body;

  if (!title || !price) {
    return res.status(400).json({
      success: false,
      message: "title and price are required",
    });
  }

  let image, imagePublicId;

  if (req.file?.buffer) {
    const uploaded = await uploadBuffer(
      req.file.buffer,
      "packages"
    );
    image = uploaded.secure_url;
    imagePublicId = uploaded.public_id;
  }

  const pkg = await Package.create({
    title,
    price,
    description,
    duration,
    displayOrder,
    image,
    imagePublicId,
  });

  res.status(201).json({
    success: true,
    data: pkg,
  });
});

exports.updatePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await Package.findById(id);
  if (!pkg) {
    return res.status(404).json({
      success: false,
      message: "Package not found",
    });
  }

  // Replace image if new one uploaded
  if (req.file?.buffer) {
    if (pkg.imagePublicId) {
      await deleteFile(pkg.imagePublicId);
    }

    const uploaded = await uploadBuffer(
      req.file.buffer,
      "packages"
    );

    pkg.image = uploaded.secure_url;
    pkg.imagePublicId = uploaded.public_id;
  }

  Object.assign(pkg, req.body);
  await pkg.save();

  res.json({
    success: true,
    data: pkg,
  });
});

exports.deletePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await Package.findById(id);
  if (!pkg) {
    return res.status(404).json({
      success: false,
      message: "Package not found",
    });
  }

  if (pkg.imagePublicId) {
    await deleteFile(pkg.imagePublicId);
  }

  await pkg.deleteOne();

  res.json({
    success: true,
    message: "Package deleted successfully",
  });
});

exports.getAllPackagesAdmin = asyncHandler(async (req, res) => {
  const packages = await Package.find({})
    .sort({ displayOrder: 1, createdAt: -1 });

  res.json({
    success: true,
    data: packages,
  });
});


/* ================= PUBLIC LIST ================= */
exports.getPackages = asyncHandler(async (req, res) => {
  const packages = await Package.find({})
    .sort({ displayOrder: 1 })
    .select("-imagePublicId");

  res.json({
    success: true,
    data: packages,
  });
});


/* ================= SINGLE PACKAGE ================= */
exports.getPackageById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await Package.findById(id).select("-imagePublicId");

  if (!pkg) {
    return res.status(404).json({
      success: false,
      message: "Package not found",
    });
  }

  res.json({
    success: true,
    data: pkg,
  });
});