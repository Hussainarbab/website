const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const store = require('../utils/store');

// Points awarded per social account connection
const POINTS_PER_CONNECTION = 50;
// Conversion rate: 1 point = 1 PKR (assumption)
const POINTS_TO_PKR = 1;

// Get user dashboard info
router.get('/dashboard', auth, async (req, res) => {
    try {
        const user = await store.findById(req.user._id || req.user.id);
        const connected = user.connectedAccounts || [];
        const points = user.points || 0;
        const earnings = user.earnings || 0;
        const rupeesFromPoints = points * POINTS_TO_PKR;

        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            connectedAccounts: connected,
            points,
            rupeesFromPoints,
            earnings
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching dashboard' });
    }
});

// Connect a social account (whatsapp, tiktok, facebook, etc.)
router.post('/connect-account', auth, async (req, res) => {
    try {
        const { provider } = req.body;
        if (!provider) return res.status(400).json({ message: 'Provider is required' });
        const user = await store.findById(req.user._id || req.user.id);
        const alreadyConnected = (user.connectedAccounts || []).includes(provider);
        if (alreadyConnected) {
            return res.status(400).json({ message: `${provider} already connected` });
        }

        // Simulate linking flow: award points and update connected accounts
        const updates = {};
        updates.connectedAccounts = (user.connectedAccounts || []).concat([provider]);
        updates.points = (user.points || 0) + POINTS_PER_CONNECTION;
        updates.earnings = (user.earnings || 0) + (POINTS_PER_CONNECTION * POINTS_TO_PKR);

        const saved = await store.updateUser(user._id || user.id, updates);

        res.json({ message: `${provider} connected`, connectedAccounts: saved.connectedAccounts, points: saved.points, earnings: saved.earnings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error connecting account' });
    }
});

module.exports = router;
