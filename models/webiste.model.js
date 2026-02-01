const mongoose = require('mongoose');


const SubscriptionSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ["basic", "premium", "enterprise"],
      required: true,
    },
    planDuration: {
      type: String,
      enum: ["1month", "3months", "6months", "1year"],
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    paymentId: {
      type: String,
      required: true,
      index: true,
    },
    paidTill: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);
const BasicInfoSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    whatsapp: String,
    logoUrl: String,
    logoPublicId: String,
    city: String,
    serviceArea: String,
    officeHours: String,
  },
  { _id: false }
);

const SocialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    youtube: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    website: { type: String, default: "" },
  },
  { _id: false }
);


const PackageSchema = new mongoose.Schema(
  {
    title: String,
    price: Number,
    image: String,
    displayOrder: { type: Number, default: 0 },
    description: String,
    duration: String,
  },
  { _id: false }
);

const VehiclePriceSchema = new mongoose.Schema(
  {
    price: Number,
    allExclusive: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const PopularPriceSchema = new mongoose.Schema(
  {
    start: String,
    end: String,
    type: String,

    mini: VehiclePriceSchema,
    sedan: VehiclePriceSchema,
    suv: VehiclePriceSchema,
    innova: VehiclePriceSchema,
    sleeperBus: VehiclePriceSchema,
    traveller: VehiclePriceSchema,
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    name: String,
    rating: { type: Number, min: 1, max: 5 },
    text: String,
  },
  { _id: false }
);

const SectionsSchema = new mongoose.Schema(
  {
    popularPrices: { type: Boolean, default: true },
    packages: { type: Boolean, default: true },
    reviews: { type: Boolean, default: true },
    contact: { type: Boolean, default: true },
    socialLinks: { type: Boolean, default: true },
  },
  { _id: false }
);


const WebsiteSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    themeId: {
      type: mongoose.Schema.ObjectId,
      ref: "Theme",
      required: true,
      index: true,
    },

    isLive: {
      type: Boolean,
      default: false,
      index: true,
    },

    basicInfo: {
      type: BasicInfoSchema,
      default: {},
    },

    packages: {
      type: [PackageSchema],
      default: [],
    },

    popularPrices: {
      type: [PopularPriceSchema],
      default: [],
    },

    socialLinks: {
      type: SocialLinksSchema,
      default: {},
    },

    reviews: {
      type: [ReviewSchema],
      default: [],
    },

    sections: {
      type: SectionsSchema,
      default: {},
    },
    subscription: {
      type: SubscriptionSchema,
      default: null,
    },

    subscriptionHistory: {
      type: [SubscriptionSchema],
      default: [],
    },
    QrCode: {
      url: String,
      publicId: String
    },
    qrCode: {
      url: { type: String },
      image: { type: String }, 
      generatedAt: { type: Date },
    },
    paidTill: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* ================= MODEL ================= */

module.exports = mongoose.model('Website', WebsiteSchema);
