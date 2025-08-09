import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    },
    tls: {
        rejectUnauthorized: false // For local testing only
    }
});

// Test connection on startup
transporter.verify((error) => {
    if (error) {
        console.error('Mail server error:', error);
    } else {
        console.log('Mail server is ready');
    }
});