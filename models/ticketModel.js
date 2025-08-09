import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['open', 'pending', 'closed'], 
    default: 'open',
    index: true
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium'
  },
  category: { 
    type: String, 
    enum: ['general', 'technical', 'billing', 'account'], 
    default: 'general'
  },
  messages: [{
    sender: { 
      type: String, 
      enum: ['user', 'support'], 
      required: true 
    },
    content: { 
      type: String, 
      required: true,
      trim: true
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }]
}, { 
  timestamps: true,  // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

export default mongoose.model("Ticket", ticketSchema);