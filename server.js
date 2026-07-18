const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Firebase Admin SDK (optional - for advanced features)
// Uncomment and add your service account key if needed
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
// });

// In-memory storage for verification codes
const verificationCodes = new Map(); // email -> { code, expires, userData }

// Clean up expired codes every minute
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
        if (data.expires < now) {
            verificationCodes.delete(email);
        }
    }
}, 60000);

// Gmail configuration
// IMPORTANT: You need to use an App Password, not your regular Gmail password
// See README-SETUP.txt for instructions
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'shagzvisuals@gmail.com',
        pass: 'cqtaeoezsygogsjd' // Replace with your Gmail App Password
    },
    tls: {
        rejectUnauthorized: false // Fix SSL certificate verification issue
    }
});

// Generate 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/send-code - Send verification code
app.post('/api/send-code', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Generate verification code
    const code = generateCode();
    const expires = Date.now() + (5 * 60 * 1000); // 5 minutes expiry

    // Store code with user data
    verificationCodes.set(email, {
        code,
        expires,
        userData: { username, password }
    });

    // Send email
    const mailOptions = {
        from: 'ShaGZVisuals <shagzvisuals@gmail.com>',
        to: email,
        subject: 'Your Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: #ffffff;">
                <h1 style="color: #a855f7;">ShaGZVisuals</h1>
                <h2>Email Verification</h2>
                <p>Your verification code is:</p>
                <h1 style="color: #a855f7; font-size: 48px; letter-spacing: 10px; text-align: center; padding: 20px; background: #2d1b4e; border-radius: 10px;">${code}</h1>
                <p>This code is valid for <strong>5 minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <br/>
                <p style="color: #cccccc; font-size: 12px;">© 2026 ShaGZVisuals. All rights reserved.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Verification code sent to your email' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send verification code. Please check the server configuration.' 
        });
    }
});

// POST /api/verify-code - Verify the code
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const storedData = verificationCodes.get(email);

    if (!storedData) {
        return res.json({ success: false, message: 'No verification code found for this email' });
    }

    if (Date.now() > storedData.expires) {
        verificationCodes.delete(email);
        return res.json({ success: false, message: 'Verification code has expired' });
    }

    if (storedData.code !== code) {
        return res.json({ success: false, message: 'Invalid verification code' });
    }

    // Code is valid - remove it from storage
    verificationCodes.delete(email);

    res.json({ 
        success: true, 
        message: 'Email verified successfully',
        userData: storedData.userData
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Email verification API ready!');
});
