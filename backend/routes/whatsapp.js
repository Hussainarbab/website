import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { sendAdminEmail } from '../mailer.js';

const router = express.Router();

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userEmail = payload.email;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

router.post('/start', auth, async (req, res) => {
  // Demo implementation: generate a temporary code that would be encoded into a QR by the client
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresInSeconds = 60; // demo expiry
  try {
    await sendAdminEmail('WhatsApp pairing requested', `User ${req.userEmail} requested pairing. Code: ${code}`);
  } catch {}
  res.json({ code, expiresInSeconds });
});

// Request user opt-in/confirmation via WhatsApp (stub)
router.post('/request', auth, async (req, res) => {
  const { number } = req.body || {};
  if (!number) return res.status(400).json({ message: 'Number required' });
  try {
    // In production: Call WhatsApp Business Cloud API to send a template message to the provided number
    // See: https://developers.facebook.com/docs/whatsapp/cloud-api
    await sendAdminEmail('WhatsApp link requested', `User ${req.userEmail} requested link for number ${number}`);
    res.json({ message: 'Confirmation message sent via WhatsApp (stub)' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to request link' });
  }
});

export default router;

