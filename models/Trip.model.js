const mongoose = require("mongoose");

const TripSchema = new mongoose.Schema(
  {
    trip: {
      type: String,
      required: true, // e.g. Outstation / Local / Airport
      trim: true,
    },

    trip_type: {
      type: String,
      enum: ["one_way", "round_trip", "local"],
      required: true,
      index: true,
    },

    pickup: {
      type: String,
      required: true,
      trim: true,
    },

    drop: {
      type: String,
      required: true,
      trim: true,
    },

    stops: {
      type: [String],
      default: [],
    },

    pickupDateAndTime: {
      type: Date,
      required: true,
      index: true,
    },

    returnDateAndTime: {
      type: Date,
      default: null,
    },

    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", TripSchema);
