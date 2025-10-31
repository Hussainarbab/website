const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/store');

// Email transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Register user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await store.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create verification token
        const verificationToken = uuidv4();

        // Create new user (store handles mongoose or file fallback)
        const user = await store.createUser({ name, email, password, verificationToken });

        // Send verification email (best-effort)
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        try {
            await transporter.sendMail({
                to: email,
                subject: 'Verify your SocialEarn account',
                html: `
                    <h1>Welcome to SocialEarn!</h1>
                    <p>Please click the link below to verify your email address:</p>
                    <a href="${verificationUrl}">${verificationUrl}</a>
                `
            });
            res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
        } catch (mailErr) {
            console.error('Warning: failed to send verification email', mailErr);
            // In development it's common not to have valid email creds. Return success but inform client
            res.status(201).json({ message: 'Registration successful. (Warning: failed to send verification email)' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// Verify email
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        const user = await store.findByVerificationToken(token);
        if (!user) {
            return res.status(400).json({ message: 'Invalid verification token' });
        }
        await store.updateUser(user._id || user.id, { isVerified: true, verificationToken: undefined });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error verifying email' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await store.findByEmail(email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Allow login in development or when SKIP_EMAIL_VERIFICATION is set
        const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'development';
        if (!user.isVerified && !skipVerification) {
            return res.status(401).json({ message: 'Please verify your email first' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Update login streak
        const now = new Date();
        const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : now;
        const daysSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

        let updates = {};
        if (daysSinceLastLogin <= 1) {
            updates.loginStreak = (user.loginStreak || 0) + 1;
            // Add daily reward if streak is maintained
            updates.earnings = (user.earnings || 0) + 100;
        } else {
            updates.loginStreak = 1;
        }
        updates.lastLoginDate = now;
        updates.lastLogin = now;
        const savedUser = await store.updateUser(user._id || user.id, updates);

        // Generate JWT token
        const id = savedUser._id || savedUser.id;
        const token = jwt.sign(
            { userId: id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id,
                name: savedUser.name,
                email: savedUser.email,
                earnings: savedUser.earnings,
                loginStreak: savedUser.loginStreak
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await store.findByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = uuidv4();
        await store.updateUser(user._id || user.id, { resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 3600000 });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
        // Send mail best-effort like registration: don't fail the whole request if email isn't configured
        try {
            await transporter.sendMail({
                to: email,
                subject: 'Reset your SocialEarn password',
                html: `
                    <h1>Password Reset Request</h1>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetUrl}">${resetUrl}</a>
                    <p>This link will expire in 1 hour.</p>
                `
            });
            return res.json({ message: 'Password reset email sent' });
        } catch (mailErr) {
            console.error('Warning: failed to send password reset email', mailErr);
            return res.json({ message: 'Password reset requested. (Warning: failed to send email)' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error requesting password reset' });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const user = await store.findByResetToken(token);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        await store.updateUser(user._id || user.id, { password: newPassword, resetPasswordToken: undefined, resetPasswordExpires: undefined });

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;