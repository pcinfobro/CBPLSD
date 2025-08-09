import mongoose from 'mongoose';

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { 
    type: Number, 
    required: true,
    default: 0,
    set: v => parseFloat(v.toFixed(2)) // Ensure amount is always a number with 2 decimals
  },
  method: { type: String, required: true },
  status: { type: String, default: 'pending' },
  transactionId: { type: String },
  paymentUrl: { type: String },
  paymentData: { type: Object },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Deposit", depositSchema);