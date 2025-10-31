import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getUserByEmail, saveUser, ensureUserDefaults } from '../store.js';
import { sendAdminEmail } from '../mailer.js';

const router = express.Router();

function sign(user) {
  return jwt.sign({ email: user.email }, config.jwtSecret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    if (getUserByEmail(email)) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = ensureUserDefaults({ name, email, passwordHash: hash, points: 0, earnings: 0, rupeesFromPoints: 0, connectedAccounts: [] });
    saveUser(user);
    await sendAdminEmail('New registration', `User: ${name} <${email}>`);
    res.json({ message: 'Registration successful' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign(user);
    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        points: user.points,
        earnings: user.earnings,
        rupeesFromPoints: user.rupeesFromPoints,
        connectedAccounts: user.connectedAccounts
      }
    });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email required' });
    await sendAdminEmail('Password recovery requested', `Email: ${email}`);
    res.json({ message: 'If this email exists, a recovery link will be sent.' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

