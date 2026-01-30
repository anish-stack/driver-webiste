const Contact = require("../models/contact.model");
const { sendWhatsappTemplateForContactForm } = require("../utils/sendWhatsappTemplate");

exports.createContact = async (req, res) => {
  try {
    const { name, phone, email, tripType, message, website } = req.body;

    // 1️⃣ Save contact correctly
    const contact = await Contact.create({
      f_name: name,
      p_number: phone,
      e_address: email,
      t_type: tripType,
      message,
      driver_id: website?.driverId, // must match schema type
    });

    // 2️⃣ Send WhatsApp
    if (website?.basicInfo?.whatsapp) {
      console.log("Start")
      try {
        await sendWhatsappTemplateForContactForm({
          templateName: "contact_form_driver_webiste",
          websiteName: website?.basicInfo?.name,
          tripType,
          customerName: name,
          customerPhone: phone,
          messageText: message,
          driverWhatsapp: website?.basicInfo?.whatsapp,
          id: contact._id,
        });

        contact.is_whatsapp_send = true;
        await contact.save();
        console.log("End")

      } catch (waErr) {
        console.error("WhatsApp send failed:", waErr.message);
      }
    }
    return res.status(201).json({
      success: true,
      message: "Contact enquiry submitted successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Create Contact Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit contact enquiry",
    });
  }
};



exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
    });
  }
};


exports.getContactsByDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    const contacts = await Contact.find({ driver_id: driverId })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch driver contacts",
    });
  }
};


exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    return res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact",
    });
  }
};


exports.updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    return res.json({
      success: true,
      message: "Contact updated successfully",
      data: contact,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update contact",
    });
  }
};


exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    return res.json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete contact",
    });
  }
};

