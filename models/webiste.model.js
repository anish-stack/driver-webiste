const mongoose = require('mongoose');

/* =========================================================
   COUPON SUB-SCHEMA (reusable)
========================================================= */
const CouponInfoSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    code: { type: String, default: '', uppercase: true, trim: true },
    discountAmount: { type: Number, default: 0 },
    baseAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    appliedAt: { type: Date, default: null },
  },
  { _id: false }
);

/* =========================================================
   SUBSCRIPTION SCHEMA
   Covers both one-time (orderId) and autopay (razorpaySubscriptionId)
========================================================= */
const SubscriptionSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic',
    },

    durationMonths: { type: Number, required: true },

    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      required: true,
    },

    // ── One-time payment fields ──────────────────────────
    orderId: { type: String, default: '', index: true },
    paymentId: { type: String, default: '', index: true },

    // ── Autopay / UPI-mandate fields ─────────────────────
    razorpaySubscriptionId: { type: String, default: '', index: true },
    razorpayPlanId: { type: String, default: '' },

    // Charges collected under autopay subscription
    subscriptionCharges: [
      {
        paymentId: String,
        amount: Number,        // paise
        currency: String,
        chargedAt: Date,
        paidTill: Date,
        webhookPayload: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    // ── Amount fields ────────────────────────────────────
    amountPay: { type: Number, required: true },       // rupees (final payable)
    amountPayPaise: { type: Number, required: true },  // paise  (final payable)

    // ── Coupon (nullable — use CouponInfoSchema wrapped in Mixed-compatible way) ──
    coupon: {
      type: CouponInfoSchema,
      default: null,
    },

    // ── Status ───────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'active', 'paid', 'failed', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },

    isActive: { type: Boolean, default: false },

    paidTill: { type: Date, default: null },

    purchasedAt: { type: Date, default: Date.now },

    // Full raw webhook payload stored for audit
    webhookPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

/* =========================================================
   BASIC INFO
========================================================= */
const BasicInfoSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    whatsapp: String,
    logo_name: String,
    logoUrl: String,
    logoPublicId: String,
    city: String,
    serviceArea: String,
    officeHours: String,
  },
  { _id: false }
);

/* =========================================================
   SOCIAL LINKS
========================================================= */
const SocialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  { _id: false }
);

/* =========================================================
   PACKAGE
========================================================= */
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

/* =========================================================
   VEHICLE / POPULAR PRICES
========================================================= */
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

/* =========================================================
   REVIEW
========================================================= */
const ReviewSchema = new mongoose.Schema(
  {
    name: String,
    rating: { type: Number, min: 1, max: 5 },
    text: String,
  },
  { _id: false }
);

/* =========================================================
   SECTIONS VISIBILITY
========================================================= */
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

/* =========================================================
   WEBSITE SCHEMA
========================================================= */
const WebsiteSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, unique: true, index: true },

    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      required: true,
      index: true,
    },

    isLive: { type: Boolean, default: false, index: true },

    basicInfo: { type: BasicInfoSchema, default: {} },

    packages: { type: [PackageSchema], default: [] },

    popularPrices: { type: [PopularPriceSchema], default: [] },

    socialLinks: { type: SocialLinksSchema, default: {} },

    reviews: { type: [ReviewSchema], default: [] },

    sections: { type: SectionsSchema, default: {} },

    website_url: { type: String, default: '' },

    /* ── Active subscription ── */
    subscription: { type: SubscriptionSchema, default: null },

    /* ── History ── */
    subscriptionHistory: { type: [SubscriptionSchema], default: [] },

    /* ── Pending (one-time or autopay mandate in progress) ── */
    pendingSubscription: {
      planType: { type: String, default: 'basic' },
      durationMonths: Number,
      themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme' },

      // one-time
      orderId: String,
      paymentId: { type: String, default: '' },

      // autopay
      razorpaySubscriptionId: { type: String, default: '' },
      razorpayPlanId: { type: String, default: '' },

      amountPay: Number,
      amountPayPaise: Number,

      status: {
        type: String,
        enum: ['pending', 'active', 'paid', 'failed', 'cancelled', 'expired'],
        default: 'pending',
      },

      paidTill: Date,

      coupon: { type: CouponInfoSchema, default: null },

      purchasedAt: Date,
      createdAt: { type: Date, default: Date.now },
    },

    /* ── Theme history ── */
    themeHistory: {
      type: [
        {
          oldThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme' },
          newThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme' },
          amountPay: String,
          changedAt: { type: Date, default: Date.now },
          reason: { type: String, default: 'upgrade' },
          orderId: { type: String, default: '' },
          paymentId: { type: String, default: '' },
        },
      ],
      default: [],
    },

    paidTill: { type: Date, default: null },

    /* ── QR codes ── */
    QrCode: { url: String, publicId: String },
    qrCode: {
      url: String,
      image: String,
      generatedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Website', WebsiteSchema);