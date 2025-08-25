import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    },
    tls: {
        rejectUnauthorized: false // For local testing only
    }
});

// Verify transport in all environments; only log errors (no noisy success log)
transporter.verify((error) => {
    if (error) {
        console.error('Mail server error:', error);
    }
});