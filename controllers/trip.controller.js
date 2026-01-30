const Trip = require("../models/Trip.model");
const { sendWhatsappTemplateForContactForm } = require("../utils/sendWhatsappTemplate");

exports.createTrip = async (req, res) => {
    try {
        const {
            trip,
            trip_type,
            pickup,
            drop,
            stops,
            pickupDateAndTime,
            returnDateAndTime,
            website,
        } = req.body;

        // 1️⃣ Save trip
        const tripDoc = await Trip.create({
            trip,
            trip_type,
            pickup,
            drop,
            stops,
            pickupDateAndTime,
            returnDateAndTime,
            websiteId: website?._id,
        });

        // 2️⃣ Send WhatsApp to driver
        if (website?.basicInfo?.whatsapp) {
            try {
                await sendWhatsappTemplateForContactForm({
                    templateName: "trip_enquiry_driver_website",

                    serviceType: trip,
                    tripType: trip_type,
                    pickup,
                    drop,
                    stops,
                    pickup_date: pickupDateAndTime,
                    return_date: returnDateAndTime,

                    driverWhatsapp: website.basicInfo.whatsapp,
                    id: tripDoc._id,
                });
            } catch (waErr) {
                console.error("WhatsApp failed:", waErr.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Trip enquiry created",
            data: tripDoc,
        });
    } catch (error) {
        console.error("Create Trip Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create trip enquiry",
        });
    }
};


exports.getTripsByWebsite = async (req, res) => {
    try {
        const { websiteId } = req.params;

        const trips = await Trip.find({ websiteId })
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: trips,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch trips",
        });
    }
};


exports.getTripById = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        return res.json({
            success: true,
            data: trip,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch trip",
        });
    }
};


exports.updateTrip = async (req, res) => {
    try {
        const trip = await Trip.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        return res.json({
            success: true,
            message: "Trip updated",
            data: trip,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update trip",
        });
    }
};


exports.deleteTrip = async (req, res) => {
    try {
        const trip = await Trip.findByIdAndDelete(req.params.id);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        return res.json({
            success: true,
            message: "Trip deleted",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete trip",
        });
    }
};
