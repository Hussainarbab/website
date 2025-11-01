const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const store = require('../utils/store');
const QRCode = require('qrcode');

// Store pending link codes (in memory for demo - use Redis/DB in production)
const pendingLinks = new Map();

// Generate linking code for a social platform
router.post('/generate-code', auth, async (req, res) => {
    try {
        const { platform } = req.body;
        if (!platform) {
            return res.status(400).json({ message: 'Platform is required' });
        }

        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store the pending link
        pendingLinks.set(code, {
            userId: req.user.id || req.user._id,
            platform,
            expiry
        });

        res.json({ code, expiresIn: '10 minutes' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error generating code' });
    }
});

// Generate QR code for a social platform
router.post('/generate-qr', auth, async (req, res) => {
    try {
        const { platform } = req.body;
        if (!platform) {
            return res.status(400).json({ message: 'Platform is required' });
        }

        const linkId = uuidv4();
        const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store the pending link
        pendingLinks.set(linkId, {
            userId: req.user.id || req.user._id,
            platform,
            expiry
        });

        // Generate QR code containing the link ID
        const qrData = JSON.stringify({
            action: 'link',
            platform,
            linkId
        });

        const qrCodeDataUrl = await QRCode.toDataURL(qrData);
        
        res.json({ 
            qrCode: qrCodeDataUrl,
            linkId,
            expiresIn: '10 minutes'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error generating QR code' });
    }
});

// Verify a linking code
router.post('/verify-code', auth, async (req, res) => {
    try {
        const { code, platform } = req.body;
        if (!code || !platform) {
            return res.status(400).json({ message: 'Code and platform are required' });
        }

        const linkInfo = pendingLinks.get(code);
        if (!linkInfo) {
            return res.status(404).json({ message: 'Invalid or expired code' });
        }

        if (linkInfo.expiry < Date.now()) {
            pendingLinks.delete(code);
            return res.status(400).json({ message: 'Code has expired' });
        }

        if (linkInfo.platform !== platform) {
            return res.status(400).json({ message: 'Invalid platform for this code' });
        }

        // Get user and update their connected accounts
        const user = await store.findById(linkInfo.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updates = {
            connectedAccounts: [...new Set([...(user.connectedAccounts || []), platform])],
            points: (user.points || 0) + 50,
            earnings: (user.earnings || 0) + 50
        };

        const updatedUser = await store.updateUser(user.id || user._id, updates);
        pendingLinks.delete(code);

        res.json({
            message: `Successfully linked ${platform}`,
            connectedAccounts: updatedUser.connectedAccounts,
            points: updatedUser.points,
            earnings: updatedUser.earnings
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error verifying code' });
    }
});

// Check QR code status
router.get('/qr-status/:linkId', auth, async (req, res) => {
    try {
        const { linkId } = req.params;
        const linkInfo = pendingLinks.get(linkId);

        if (!linkInfo) {
            return res.status(404).json({ message: 'Invalid or expired QR code' });
        }

        if (linkInfo.expiry < Date.now()) {
            pendingLinks.delete(linkId);
            return res.status(400).json({ message: 'QR code has expired' });
        }

        res.json({ status: 'pending' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error checking QR status' });
    }
});

// Get connected platforms for the authenticated user
router.get('/connected-platforms', auth, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const user = await store.findById(userId);

        const connections = {
            whatsapp: !!(user && user.whatsappSession),
            facebook: !!(user && (user.facebookData || (user.connectedAccounts || []).includes('facebook'))),
            tiktok: !!(user && ((user.connectedAccounts || []).includes('tiktok') || user.tiktokToken))
        };

        res.json(connections);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching connected platforms' });
    }
});

module.exports = router;