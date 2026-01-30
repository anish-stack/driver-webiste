const axios = require("axios");
const ENV = require("../config/env");

function formatStops(stops) {
    if (!stops) return "Direct trip (no stops)";

    // if array
    if (Array.isArray(stops)) {
        if (stops.length === 0) return "Direct trip (no stops)";
        if (stops.length === 1) return stops[0];
        return stops.join(" → ");
    }

    // if string
    if (typeof stops === "string") {
        return stops.trim() ? stops : "Direct trip (no stops)";
    }

    return "Direct trip (no stops)";
}

function formatReturnDate(returnDate, tripType) {
    if (tripType?.toLowerCase().includes("one")) {
        return "Not applicable (One way trip)";
    }

    if (!returnDate) {
        return "To be confirmed";
    }

    return returnDate;
}



const MYOPERATOR_API =
    "https://publicapi.myoperator.co/chat/messages";

/* ======================================================
   TEMPLATE BODY MAPPER (OBJECT, NOT ARRAY)
====================================================== */

function getTemplateBody(templateName, bookingData = {}) {
    switch (templateName) {

        case "contact_form_driver_webiste":
            return {
                2: bookingData.tripType || "Not specified",
                3: bookingData.customerName || "Website Visitor",
                4: bookingData.customerPhone || "NA",
                5: bookingData.messageText || "New enquiry from website",
            };

        case "trip_enquiry_driver_website":
            return {
                servicetype: bookingData.serviceType || "Outstation",
                triptype: bookingData.tripType || "One Way",
                pickup: bookingData.pickup || "NA",
                drop: bookingData.drop || "NA",
                stops: formatStops(bookingData.stops),
                pickupdate: bookingData.pickup_date || "NA",
                returndate: formatReturnDate(
                    bookingData.return_date,
                    bookingData.tripType
                ),
            };

        default:
            return null;
    }
}



/* ======================================================
   SEND WHATSAPP TEMPLATE
====================================================== */

async function sendWhatsappTemplateForContactForm(bookingData) {
    try {
        const templateName = bookingData.templateName;
        const body = getTemplateBody(templateName, bookingData);
        console.log(body)

        if (!body) throw new Error("Invalid template body");

        Object.keys(body).forEach((k) => (body[k] = String(body[k])));

        const context = {
            template_name: templateName,
            language: "en",
            body,
        };

        // ✅ Header ONLY for contact form
        if (templateName === "contact_form_driver_webiste") {
            context.header = {
                1: String(bookingData.websiteName || "TaxiSafar"),
            };
        }

        const payload = {
            phone_number_id: ENV.MYOPERATOR_PHONE_NUMBER_ID,
            customer_country_code: "91",
            customer_number: bookingData.driverWhatsapp,
            data: {
                type: "template",
                context,
            },
            reply_to: null,
            myop_ref_id: bookingData.id
                ? `TS${String(bookingData.id).padStart(3, "0")}`
                : null,
        };

        const response = await axios.post(MYOPERATOR_API, payload, {
            headers: {
                Authorization: `Bearer ${ENV.MYOPERATOR_API_KEY}`,
                "X-MYOP-COMPANY-ID": ENV.MYOPERATOR_COMPANY_ID,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        return response.data;
    } catch (err) {
        console.error("❌ WhatsApp Error:", err.response?.data || err.message);
        throw err;
    }
}

module.exports = {
    sendWhatsappTemplateForContactForm,
};
