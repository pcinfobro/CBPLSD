import mongoose from "mongoose";

const rentalSchema = new mongoose.Schema(
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
    duration: {
      type: String,
      enum: ["3days", "30days"],
      required: true,
    },
    number: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    actions: {
      type: {
        hotspot: { type: Boolean, default: false },
        dislike: { type: Boolean, default: false },
        addToCart: { type: Boolean, default: false },
      },
      default: {},
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
rentalSchema.index({ userId: 1, createdAt: -1 });
rentalSchema.index({ status: 1 });
rentalSchema.index({ expiresAt: 1 });
rentalSchema.index({ service: 1 });

export default mongoose.model("Rental", rentalSchema);
