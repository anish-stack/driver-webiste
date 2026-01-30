const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    f_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    p_number: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number'],
    },

    e_address: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },

    t_type: {
      type: String
    },

    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    is_whatsapp_send: {
      type: Boolean,
      default: false,
    },

    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
