const mongoose = require('mongoose');

/**
 * Public-facing tailor listing + shop id used on orders (`tailorId` / `tailorShopId`).
 * One profile per tailor user (userId = User.id numeric).
 */
const tailorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    tailorShopId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    skillsNotes: {
      type: String,
      default: '',
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceStart: {
      type: Number,
      default: 1500,
      min: 0,
    },
    deliveryDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      default: 4.7,
      min: 0,
      max: 5,
    },
    availability: {
      type: String,
      enum: ['available', 'busy'],
      default: 'available',
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TailorProfile', tailorProfileSchema);
