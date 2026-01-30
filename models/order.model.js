const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        razorpayOrderId: {
            type: String,
            required: true,
            index: true,
        },

        razorpayPaymentId: {
            type: String,
            default: null,
        },

        razorpaySignature: {
            type: String,
            default: null,
        },

        amount: {
            type: Number,
            required: true,
        },

        currency: {
            type: String,
            default: "INR",
        },

        status: {
            type: String,
            enum: ["created", "paid", "failed"],
            default: "created",
        },
        expireDate:{
            type:Date
        },
        themeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Theme",
            index: true,
        },
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
