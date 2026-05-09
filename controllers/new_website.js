// controllers/subscription.controller.js

const asyncHandler = require("../middlewares/asyncHandler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const ENV = require("../config/env");
const Website = require("../models/webiste.model");
const Theme = require("../models/theme.model");
const Coupon = require("../models/coupon.model");

const instance = new Razorpay({
  key_id: ENV.RAZORPAY_KEY_ID,
  key_secret: ENV.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────
// UTIL: Get or create a Razorpay Plan for a
// given (themeId + durationMonths) combo.
// Plans are cached on the Theme document so we
// don't create duplicates.
// ─────────────────────────────────────────────
const getOrCreateRazorpayPlan = async (theme, durationMonths) => {
  const pricePlan = theme.pricePlans.find(
    (p) => p.isActive && Number(p.durationMonths) === Number(durationMonths)
  );

  if (!pricePlan) throw new Error("Invalid plan duration for this theme");

  // Return cached plan id if already created
  if (pricePlan.razorpayPlanId) return pricePlan.razorpayPlanId;

  // Razorpay billing cycles map:
  //   1 month  → interval=1, period="monthly"
  //   3 months → interval=3, period="monthly"
  //   6 months → interval=6, period="monthly"
  //   12 months→ interval=1, period="yearly"
  const period = durationMonths >= 12 ? "yearly" : "monthly";
  const interval = durationMonths >= 12 ? 1 : Number(durationMonths);

  const amountPaise = Math.round(Number(pricePlan.price) * 100 * (1 + 18 / 100)); // price + 18% GST

  const plan = await instance.plans.create({
    period,
    interval,
    item: {
      name: `${theme.name} - ${durationMonths}M Plan`,
      amount: amountPaise,
      currency: "INR",
      description: `${theme.name} website subscription for ${durationMonths} month(s)`,
    },
    notes: {
      themeId: String(theme._id),
      durationMonths: String(durationMonths),
    },
  });

  // Cache planId on theme document
  pricePlan.razorpayPlanId = plan.id;
  await theme.save();

  return plan.id;
};

// ─────────────────────────────────────────────
// POST /website/:driverId/subscription/create
// Body: { themeId, durationMonths, slug, couponCode? }
// ─────────────────────────────────────────────
exports.createSubscription = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { themeId, durationMonths, slug, couponCode, customerEmail, customerName, customerPhone } = req.body;

  if (!driverId || !themeId || !durationMonths) {
    return res.status(400).json({ success: false, message: "driverId, themeId, durationMonths required" });
  }

  const theme = await Theme.findById(themeId);
  if (!theme) return res.status(404).json({ success: false, message: "Theme not found" });

  // 1. Get or create Razorpay plan
  const razorpayPlanId = await getOrCreateRazorpayPlan(theme, durationMonths);

  // 2. Validate coupon (if any) — for addons/offer_id flow
  //    For simplicity we handle coupon as an upfront addon amount deduction.
  let addonAmount = 0; // discount expressed as negative addon is NOT natively supported;
  // instead we pass offer_id if Razorpay offer exists, OR
  // handle discount in an upfront addon collection.

  // 3. Create Razorpay Subscription
  //    total_count = 0 means charge until cancelled (perpetual)
  //    quantity    = 1
  //    customer_notify = 1 → Razorpay sends SMS/email to customer

  const startAt = Math.floor(Date.now() / 1000) + 60; // start 1 minute from now

  const subscriptionPayload = {
    plan_id: razorpayPlanId,
    total_count: 0,          // perpetual — charge every billing cycle
    quantity: 1,
    customer_notify: 1,
    start_at: startAt,
    addons: [],               // optional: one-time charges at first billing
    notes: {
      driverId,
      themeId,
      durationMonths: String(durationMonths),
      slug: slug || "",
      couponCode: couponCode || "",
    },
  };

  // If there's a discount coupon with a flat amount, collect it as
  // a negative via reduced first addon — simplest approach:
  // Alternatively, link a Razorpay Offer (offer_id) here.
  if (couponCode) {
    // Validate coupon from your DB
    const Coupon = require("../models/coupon.model");
    try {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
      if (coupon) {
        // Store coupon intent in notes; actual discount handled post-webhook
        subscriptionPayload.notes.couponId = String(coupon._id);
      }
    } catch (_) { /* non-blocking */ }
  }

  const rzpSub = await instance.subscriptions.create(subscriptionPayload);

  // 4. Save pending subscription state in Website
  const website = await Website.findOne({ driverId });
  if (!website) return res.status(404).json({ success: false, message: "Website not found" });

  if (slug) website.website_url = slug.trim().toLowerCase();

  website.subscription = {
    planType: "subscription",
    durationMonths: Number(durationMonths),
    themeId,
    razorpaySubscriptionId: rzpSub.id,
    razorpayPlanId,
    orderId: null,
    paymentId: null,
    amountPay: null,
    amountPayPaise: null,
    status: "created",    // created → authenticated → active → cancelled
    paidTill: null,
    isActive: false,
    purchasedAt: new Date(),
    coupon: couponCode ? { code: couponCode } : null,
  };

  website.subscriptionHistory.push({ ...website.subscription });
  await website.save();

  // 5. Return subscription short_url + id to frontend
  return res.status(201).json({
    success: true,
    data: {
      subscriptionId: rzpSub.id,
      shortUrl: rzpSub.short_url,
      status: rzpSub.status,
      key_id: ENV.RAZORPAY_KEY_ID,
      // Pass these to Razorpay Checkout on frontend
      customerEmail: customerEmail || "",
      customerName: customerName || "",
      customerPhone: customerPhone || "",
    },
  });
});

// ─────────────────────────────────────────────
// POST /website/subscription/verify
// Called by frontend after user completes
// mandate authorization in Razorpay Checkout.
// ─────────────────────────────────────────────
exports.verifySubscriptionPayment = asyncHandler(async (req, res) => {
  const {
    driverId,
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = req.body;

  if (!driverId || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "Missing payment verification fields" });
  }

  // 1. Verify signature
  // For subscriptions: HMAC of "payment_id|subscription_id"
  const generatedSig = crypto
    .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");

  if (generatedSig !== razorpay_signature) {
    return res.status(400).json({ success: false, message: "Invalid payment signature" });
  }

  // 2. Fetch subscription from Razorpay to get ground truth
  const rzpSub = await instance.subscriptions.fetch(razorpay_subscription_id);

  const website = await Website.findOne({ driverId });
  if (!website) return res.status(404).json({ success: false, message: "Website not found" });

  // 3. Compute paidTill based on durationMonths
  const durationMonths = Number(website.subscription?.durationMonths || 1);
  const paidTill = new Date();
  paidTill.setMonth(paidTill.getMonth() + durationMonths);

  // 4. Update subscription
  const updatedSub = {
    ...website.subscription,
    paymentId: razorpay_payment_id,
    status: rzpSub.status === "active" || rzpSub.status === "authenticated" ? "active" : rzpSub.status,
    isActive: true,
    paidTill,
    activatedAt: new Date(),
  };

  website.subscription = updatedSub;

  // Update matching history entry
  website.subscriptionHistory = website.subscriptionHistory.map((s) =>
    s.razorpaySubscriptionId === razorpay_subscription_id
      ? { ...s, ...updatedSub }
      : { ...s, isActive: false }
  );

  website.paidTill = paidTill;
  website.isLive = true;

  await website.save();

  return res.status(200).json({
    success: true,
    message: "Subscription activated successfully 🎉",
    data: {
      driverId: website.driverId,
      subscriptionId: razorpay_subscription_id,
      status: updatedSub.status,
      paidTill,
      themeId: website.themeId,
    },
  });
});

// ─────────────────────────────────────────────
// POST /website/subscription/webhook
// Razorpay sends events here. Register this URL
// in Razorpay Dashboard → Webhooks.
// Secret: ENV.RAZORPAY_WEBHOOK_SECRET
// ─────────────────────────────────────────────
exports.handleSubscriptionWebhook = async (req, res) => {
  try {
    // 1. Verify webhook signature
    const webhookSecret = ENV.RAZORPAY_WEBHOOK_SECRET;
    const receivedSig = req.headers["x-razorpay-signature"];

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (receivedSig !== expectedSig) {
      console.error("❌ Webhook signature mismatch");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log("📦 Webhook event:", event);

    // 2. Route events
    switch (event) {

      // Mandate authorized — subscription is live, first charge pending
      case "subscription.authenticated": {
        const sub = payload.subscription?.entity;
        await handleSubscriptionActivated(sub, "authenticated");
        break;
      }

      // Recurring charge succeeded
      case "subscription.charged": {
        const sub = payload.subscription?.entity;
        const payment = payload.payment?.entity;
        await handleSubscriptionCharged(sub, payment);
        break;
      }

      // Subscription became active (after first payment)
      case "subscription.activated": {
        const sub = payload.subscription?.entity;
        await handleSubscriptionActivated(sub, "active");
        break;
      }

      // Subscription halted (payment failed multiple times)
      case "subscription.halted": {
        const sub = payload.subscription?.entity;
        await handleSubscriptionHalted(sub);
        break;
      }

      // Subscription cancelled (by you or customer)
      case "subscription.cancelled": {
        const sub = payload.subscription?.entity;
        await handleSubscriptionCancelled(sub);
        break;
      }

      // Subscription pending (mandate created, not yet charged)
      case "subscription.pending":
        break;

      default:
        console.log("ℹ️ Unhandled webhook event:", event);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Webhook Handlers ─────────────────────────

const handleSubscriptionActivated = async (rzpSub, status) => {
  if (!rzpSub?.notes?.driverId) return;

  const website = await Website.findOne({ driverId: rzpSub.notes.driverId });
  if (!website) return;

  const durationMonths = Number(rzpSub.notes?.durationMonths || website.subscription?.durationMonths || 1);
  const now = new Date();

  const paidTill = new Date(now);
  paidTill.setMonth(paidTill.getMonth() + durationMonths);

  website.subscription = {
    ...website.subscription,
    status,
    isActive: true,
    paidTill,
    activatedAt: now,
  };

  website.paidTill = paidTill;
  website.isLive = true;

  await website.save();
  console.log(`✅ Subscription ${status} for driver ${rzpSub.notes.driverId}`);
};

const handleSubscriptionCharged = async (rzpSub, payment) => {
  if (!rzpSub?.notes?.driverId) return;

  const website = await Website.findOne({ driverId: rzpSub.notes.driverId });
  if (!website) return;

  const durationMonths = Number(
    rzpSub.notes?.durationMonths || website.subscription?.durationMonths || 1
  );

  // Extend paidTill from current paidTill (or now if expired)
  const baseDate =
    website.paidTill && new Date(website.paidTill) > new Date()
      ? new Date(website.paidTill)
      : new Date();

  const paidTill = new Date(baseDate);
  paidTill.setMonth(paidTill.getMonth() + durationMonths);

  const chargeRecord = {
    paymentId: payment?.id,
    amount: payment?.amount,
    currency: payment?.currency,
    chargedAt: new Date(),
    paidTill,
  };

  website.subscription = {
    ...website.subscription,
    paymentId: payment?.id,
    status: "active",
    isActive: true,
    paidTill,
    lastChargedAt: new Date(),
  };

  website.paidTill = paidTill;
  website.isLive = true;

  // Append to charge history
  website.subscriptionCharges = website.subscriptionCharges || [];
  website.subscriptionCharges.push(chargeRecord);

  await website.save();
  console.log(`💰 Subscription charged for driver ${rzpSub.notes.driverId}, paidTill: ${paidTill}`);
};

const handleSubscriptionHalted = async (rzpSub) => {
  if (!rzpSub?.notes?.driverId) return;

  const website = await Website.findOne({ driverId: rzpSub.notes.driverId });
  if (!website) return;

  website.subscription = {
    ...website.subscription,
    status: "halted",
    isActive: false,
  };

  website.isLive = false;

  await website.save();
  console.log(`⛔ Subscription halted for driver ${rzpSub.notes.driverId}`);
};

const handleSubscriptionCancelled = async (rzpSub) => {
  if (!rzpSub?.notes?.driverId) return;

  const website = await Website.findOne({ driverId: rzpSub.notes.driverId });
  if (!website) return;

  website.subscription = {
    ...website.subscription,
    status: "cancelled",
    isActive: false,
  };

  // Keep isLive true until paidTill expires — user paid for this period
  await website.save();
  console.log(`🚫 Subscription cancelled for driver ${rzpSub.notes.driverId}`);
};

// ─────────────────────────────────────────────
// POST /website/:driverId/subscription/cancel
// ─────────────────────────────────────────────
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { cancelAtCycleEnd = true } = req.body; // true = cancel after current period

  const website = await Website.findOne({ driverId });
  if (!website) return res.status(404).json({ success: false, message: "Website not found" });

  const subId = website.subscription?.razorpaySubscriptionId;
  if (!subId) return res.status(400).json({ success: false, message: "No active subscription" });

  // cancel_at_cycle_end=1 → user keeps access till paidTill, then auto-cancels
  await instance.subscriptions.cancel(subId, cancelAtCycleEnd);

  website.subscription = {
    ...website.subscription,
    status: "cancellation_scheduled",
  };

  await website.save();

  return res.status(200).json({
    success: true,
    message: cancelAtCycleEnd
      ? "Subscription will cancel at end of current billing cycle"
      : "Subscription cancelled immediately",
    data: { paidTill: website.paidTill },
  });
});

// ─────────────────────────────────────────────
// GET /website/:driverId/subscription/status
// ─────────────────────────────────────────────
exports.getSubscriptionStatus = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const website = await Website.findOne({ driverId });
  if (!website) return res.status(404).json({ success: false, message: "Website not found" });

  const now = new Date();
  const isActive = website.paidTill && new Date(website.paidTill) > now;

  let rzpStatus = null;
  if (website.subscription?.razorpaySubscriptionId) {
    try {
      const rzpSub = await instance.subscriptions.fetch(
        website.subscription.razorpaySubscriptionId
      );
      rzpStatus = rzpSub.status;
    } catch (_) { /* non-blocking */ }
  }

  return res.status(200).json({
    success: true,
    data: {
      driverId,
      subscription: website.subscription || null,
      razorpayStatus: rzpStatus,
      paidTill: website.paidTill || null,
      isActive,
      daysRemaining: isActive
        ? Math.ceil((new Date(website.paidTill) - now) / (1000 * 60 * 60 * 24))
        : 0,
    },
  });
});