const express = require("express");
const router = express.Router();
const tripCtrl = require("../controllers/trip.controller");

router.post("/", tripCtrl.createTrip);
router.get("/website/:websiteId", tripCtrl.getTripsByWebsite);
router.get("/:id", tripCtrl.getTripById);
router.put("/:id", tripCtrl.updateTrip);
router.delete("/:id", tripCtrl.deleteTrip);

module.exports = router;
