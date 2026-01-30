const mongoose = require("mongoose");
const Package = require("./models/default.package.model"); // adjust path if needed
require("dotenv").config();
const ENV = require("./config/env");

/* ================= PACKAGE DATA ================= */
const packages = [
  {
    title: "Haridwar Darshan",
    price: 4999,
    duration: "1 Day",
    description:
      "Ganga Aarti, Har Ki Pauri, Mansa Devi & Chandi Devi temples",
    displayOrder: 1,
  },
  {
    title: "Haridwar + Rishikesh",
    price: 5999,
    duration: "1 Day",
    description:
      "Ganga Aarti + Laxman Jhula, Ram Jhula & Beatles Ashram",
    displayOrder: 2,
  },
  {
    title: "Agra Taj Mahal Tour",
    price: 8499,
    duration: "1 Day",
    description:
      "Taj Mahal, Agra Fort & Mehtab Bagh sunrise/sunset",
    displayOrder: 3,
  },
  {
    title: "Mathura Vrindavan Yatra",
    price: 6499,
    duration: "1 Day",
    description:
      "Krishna Janmabhoomi, Banke Bihari, ISKCON & Prem Mandir",
    displayOrder: 4,
  },
  {
    title: "Rishikesh Adventure",
    price: 7999,
    duration: "1-2 Days",
    description:
      "River Rafting + Yoga, Ganga Aarti & waterfalls",
    displayOrder: 5,
  },
  {
    title: "Golden Triangle (Delhi-Agra-Jaipur)",
    price: 24999,
    duration: "3-4 Days",
    description:
      "Taj Mahal, Amber Fort, Hawa Mahal & City Palace",
    displayOrder: 6,
  },
];

/* ================= SEED FUNCTION ================= */
const seedPackages = async () => {
  try {
    await mongoose.connect(ENV.MONODB_MAIN_URL);
    console.log("✅ DB connected for package seeding");

    for (const pkg of packages) {
      const exists = await Package.findOne({ title: pkg.title });

      if (exists) {
        console.log(`⚠️ Package already exists: ${pkg.title}`);
        continue;
      }

      await Package.create(pkg);
      console.log(`🌱 Package seeded: ${pkg.title}`);
    }

    console.log("✅ Package seeding completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Package seeding failed:", err);
    process.exit(1);
  }
};

seedPackages();
