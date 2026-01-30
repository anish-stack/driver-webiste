const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema(
    {
        title: String,
        price: Number,
        image: String,
        displayOrder: { type: Number, default: 0 },
        description: String,
        duration: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model('Packages', PackageSchema);
