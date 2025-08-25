import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    available: { type: String },
    lastUpdated: { type: Date },
    ltr_available: { type: String },
    ltr_price: { type: String },
    ltr_short_price: { type: String },
    recommended_markup: { type: String }
}, { timestamps: true });

// Add indexes for better query performance
serviceSchema.index({ name: 1 });
serviceSchema.index({ available: 1 });
serviceSchema.index({ price: 1 });

export default mongoose.model("Service", serviceSchema);