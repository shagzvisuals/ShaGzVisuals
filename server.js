const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;   // Важно для Render

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage
const verificationCodes = new Map();

// Clean up expired codes
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
        if (data.expires < now) {
            verificationCodes.delete(email);
        }
    }
}, 60000);

// Gmail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Generate code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send code
app.post('/api/send-code', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const code = generateCode();
    const expires = Date.now() + (5 * 60 * 1000);

    verificationCodes.set(email, {
        code,
        expires,
        userData: { username, password }
    });

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
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ success: false, message: 'Failed to send email' });
    }
});

// Verify code
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email and code required' });
    }

    const stored = verificationCodes.get(email);

    if (!stored) return res.json({ success: false, message: 'No code found' });
    if (Date.now() > stored.expires) {
        verificationCodes.delete(email);
        return res.json({ success: false, message: 'Code expired' });
    }
    if (stored.code !== code) {
        return res.json({ success: false, message: 'Invalid code' });
    }

    verificationCodes.delete(email);

    res.json({
        success: true,
        message: 'Email verified',
        userData: stored.userData
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
