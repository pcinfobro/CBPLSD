import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
        profilePicture: { type: String },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpires: Date,
    balance: { 
        type: Number, 
        default: 0,
        min: 0,
    set: v => parseFloat(v.toFixed(2)) // Ensure 2 decimal places
    },
    role: { type: String, default: 'Member' },
    contactMethod: { 
        type: String, 
        enum: ['telegram', 'teams', 'whatsapp', 'slack', 'discord'],
        required: true 
    },
    contactValue: { type: String, required: true },
    apiKeys: [{
        key: String,
        name: String,
        createdAt: { type: Date, default: Date.now }
    }],
    lastLogin: { type: Date }
}, { timestamps: true });

// Add indexes for better query performance
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model("User", userSchema);