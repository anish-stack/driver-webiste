const express = require("express");
const router = express.Router();
const contactCtrl = require("../controllers/contact.controller");

router.post("/", contactCtrl.createContact);
router.get("/", contactCtrl.getAllContacts);
router.get("/driver/:driverId", contactCtrl.getContactsByDriver);
router.get("/:id", contactCtrl.getContactById);
router.put("/:id", contactCtrl.updateContact);
router.delete("/:id", contactCtrl.deleteContact);

module.exports = router;
