const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Send verification code
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const code = generateCode();
    const expires = Date.now() + (5 * 60 * 1000);

    verificationCodes.set(email, {
        code,
        expires,
        userData: req.body
    });

    const mailOptions = {
        from: 'ShaGZVisuals <shagzvisuals@gmail.com>',
        to: email,
        subject: 'Ваш код подтверждения',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: #ffffff;">
                <h1 style="color: #a855f7;">ShaGZVisuals</h1>
                <h2>Подтверждение email</h2>
                <p>Ваш код подтверждения:</p>
                <h1 style="color: #a855f7; font-size: 48px; letter-spacing: 10px; text-align: center; padding: 20px; background: #2d1b4e; border-radius: 10px;">${code}</h1>
                <p>Код действителен <strong>5 минут</strong>.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Код отправлен на email' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ success: false, message: 'Ошибка отправки письма' });
    }
});

// Verify code
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email и код обязательны' });
    }

    const stored = verificationCodes.get(email);

    if (!stored) return res.json({ success: false, message: 'Код не найден' });
    if (Date.now() > stored.expires) {
        verificationCodes.delete(email);
        return res.json({ success: false, message: 'Код устарел' });
    }
    if (stored.code !== code) {
        return res.json({ success: false, message: 'Неверный код' });
    }

    verificationCodes.delete(email);

    res.json({
        success: true,
        message: 'Email успешно подтверждён',
        userData: stored.userData
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
