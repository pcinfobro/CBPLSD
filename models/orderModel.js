import mongoose from "mongoose";
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      default: "random",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "expired", "rejected"],
      default: "pending",
    },
    transactionId: { type: String },
    number: { type: String }, // The phone number
    sms: { type: String }, // The received SMS
    pin: { type: String }, // The verification PIN extracted from SMS
    lastMessageTime: { type: Date }, // When the last message was received

    // Store the exact API response from Tellabot
    apiResponse: {
      timestamp: { type: String },
      date_time: { type: String },
      from: { type: String },
      to: { type: String },
      service: { type: String },
      price: { type: Number },
      reply: { type: String },
      pin: { type: String },
    },

    expiresAt: { type: Date }, // When the number expires
    isPremium: { type: Boolean, default: false },
    markupPercentage: { type: Number, default: 0 },

    // Renewal tracking fields
    isRenewal: { type: Boolean, default: false }, // Flag to indicate if this is a renewal order
    originalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Reference to original order for renewals

    actions: {
      hotspot: { type: Boolean, default: false },
      dislike: { type: Boolean, default: false },
      addToCart: { type: Boolean, default: false },
      renew: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ service: 1 });
orderSchema.index({ transactionId: 1 });
orderSchema.index({ expiresAt: 1 });

export default mongoose.model("Order", orderSchema);
