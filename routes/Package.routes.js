const express = require("express");
const router = express.Router();
const { uploadBuffer } = require("../config/multer");

const adminCtrl = require("../controllers/adminPackage.controller");

router.post("/", uploadBuffer.single("image"), adminCtrl.createPackage);

router.put("/:id", uploadBuffer.single("image"), adminCtrl.updatePackage);

router.delete("/:id", adminCtrl.deletePackage);
router.get("/", adminCtrl.getAllPackagesAdmin);

router.get("/user-packages", adminCtrl.getPackages);
router.get("/user-packages/:id", adminCtrl.getPackageById);

module.exports = router;
