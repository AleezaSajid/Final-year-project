const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['customer', 'tailor'],
      default: 'customer',
      index: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    experience: {
      type: String,
      default: '',
      trim: true,
    },
    /** Legacy link-based verification flag (kept for backward compatibility). */
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Account active only after OTP (or legacy migration). */
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** SHA-256 hash of OTP (never store plaintext). */
    emailOtpHash: {
      type: String,
      default: '',
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },
    emailVerifyToken: {
      type: String,
      default: '',
      index: true,
    },
    emailVerifyTokenExpiresAt: {
      type: Date,
      default: null,
    },
    /** Measurement wizard autosave (customer). */
    wizardDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    wizardDraftUpdatedAt: {
      type: Date,
      default: null,
    },
    /** Latest wizard-completed order id (Mongo string) for map / location flow. */
    lastWizardOrderId: {
      type: String,
      default: '',
      trim: true,
    },
    /** { lat, lng, address } — saved from location step. */
    lastKnownLocation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Last tailor request from map select mode { orderId, tailorId, tailorName?, sentAt }. */
    lastMapTailorRequest: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Tailor onboarding: false until /tailor/complete-profile is submitted. */
    profileComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
