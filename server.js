const app = require("./app");
const ENV = require("./config/env");

const {
  connectMainDB } = require("./config/database");

const mongoose = require("mongoose");
const { sendWhatsappTemplateForContactForm } = require("./utils/sendWhatsappTemplate");

mongoose.set("bufferCommands", false);

const startServer = async () => {
  await connectMainDB();

  server = app.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on port ${ENV.PORT}`);
  });


  // await sendWhatsappTemplateForContactForm({
  //   templateName: "trip_enquiry_driver_website",
  //   serviceType: "Outstation",
  //   tripType: "One Way",
  //   pickup: "M2K",
  //   drop: "Dwarka",
  //   pickup_date: "31/01/2026 12:00 AM",
  //   driverWhatsapp: "7217619794",
  //   id: 22,
  // });


  // await sendWhatsappTemplateForContactForm({
  //   websiteName: "Raju Travels",
  //   tripType: "One Way",
  //   customerName: "Anish",
  //   customerPhone: "9900112222",
  //   messageText: "You’ve received a new enquiry from your website",
  //   driverWhatsapp: "7217619794",
  //   id: 11,
  // });



};

startServer();

/* -------------------- Graceful Shutdown -------------------- */
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down...");
  server.close(() => {
    console.log("✅ Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
