const express = require("express");
const router = express.Router();
const { uploadBuffer } = require("../config/multer");

const adminCtrl = require("../controllers/theme.controller");

// Admin actions
router.post("/", uploadBuffer.single("previewImage"), adminCtrl.createNewTheme);
router.put("/:id", uploadBuffer.single("previewImage"), adminCtrl.updateTheme);
router.delete("/:id", adminCtrl.deleteTheme);
router.get("/", adminCtrl.getAllThemesAdmin);
router.patch("/:id/toggle", adminCtrl.toggleThemeStatus);


// User Actions
router.get("/user-theme", adminCtrl.getActiveThemes);
router.get("/user-theme/:id", adminCtrl.getThemeById);

module.exports = router;
