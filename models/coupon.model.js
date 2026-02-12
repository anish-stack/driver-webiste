const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        title: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },

        discountType: {
            type: String,
            enum: ["FLAT", "PERCENT"],
            required: true,
            default: "FLAT",
        },

        amountOff: { type: Number, default: 0, min: 0 },
        percentOff: { type: Number, default: 0, min: 0, max: 100 },

        totalUsageLimit: { type: Number, default: 0, min: 0 },
        perUserUsageLimit: { type: Number, default: 1, min: 1 },

        usedCount: { type: Number, default: 0, min: 0 },

        usedByUsers: [
            {
                driverId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Driver",
                    required: true,
                },
                usedCount: { type: Number, default: 1 },
                usedAt: { type: Date, default: Date.now },
            },
        ],

        startDate: { type: Date, default: Date.now },
        expireDate: { type: Date, required: true },

        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// ✅ index
CouponSchema.index({ code: 1 }, { unique: true });

// ✅ Validation: discountType rules
CouponSchema.pre("save", function (next) {
    if (this.discountType === "FLAT") {
        this.percentOff = 0;
        if (!this.amountOff || this.amountOff <= 0) {
            return new Error("amountOff must be > 0 for FLAT coupon")
        }
    }

    if (this.discountType === "PERCENT") {
        this.amountOff = 0;
        if (!this.percentOff || this.percentOff <= 0) {
            return new Error("percentOff must be > 0 for PERCENT coupon");
        }
    }


});

module.exports = mongoose.model("Coupon", CouponSchema);
