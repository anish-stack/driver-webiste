const mongoose = require('mongoose');


const PricePlanSchema = new mongoose.Schema(
  {
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true },
    discountPercentage: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);


const ThemeSchema = new mongoose.Schema(
  {
    themeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    previewImage: String,
    previewPublicId: String,

    displayOrder: {
      type: Number,
      index: true,
    },
    
    tag:String,
    previewUrl: String,
    description: String,

    pricePlans: {
      type: [PricePlanSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);


ThemeSchema.pre('save', async function (next) {
  if (!this.isNew || this.displayOrder !== undefined) {
    return next();
  }

  const lastTheme = await mongoose
    .model('Theme')
    .findOne({})
    .sort({ displayOrder: -1 })
    .select('displayOrder')
    .lean();

  this.displayOrder = lastTheme?.displayOrder
    ? lastTheme.displayOrder + 1
    : 1;

});

/* ================= MODEL ================= */

module.exports = mongoose.model('Theme', ThemeSchema);
