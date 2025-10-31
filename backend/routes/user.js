import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getUserByEmail, saveUser, ensureUserDefaults } from '../store.js';
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

router.get('/dashboard', auth, (req, res) => {
  const user = ensureUserDefaults(getUserByEmail(req.userEmail));
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({
    name: user.name,
    email: user.email,
    points: user.points,
    earnings: user.earnings,
    rupeesFromPoints: user.rupeesFromPoints,
    connectedAccounts: user.connectedAccounts
  });
});

router.post('/connect-account', auth, (req, res) => {
  const { provider } = req.body || {};
  const valid = ['whatsapp', 'tiktok', 'facebook'];
  if (!valid.includes(provider)) return res.status(400).json({ message: 'Invalid provider' });
  const user = ensureUserDefaults(getUserByEmail(req.userEmail));
  if (!user) return res.status(404).json({ message: 'Not found' });
  if (!user.connectedAccounts.includes(provider)) user.connectedAccounts.push(provider);
  user.points += 100; // reward for connecting
  user.rupeesFromPoints = Math.floor(user.points / 100) * 10;
  saveUser(user);
  sendAdminEmail('Account linked', `User ${user.email} linked ${provider}`).catch(() => {});
  res.json({ message: `Connected ${provider}`, points: user.points });
});

router.post('/withdraw', auth, (req, res) => {
  const { provider, rupees, points, name, number } = req.body || {};
  const valid = ['Easypaisa', 'JazzCash'];
  if (!valid.includes(provider)) return res.status(400).json({ message: 'Invalid provider' });
  if (!points || points % 100 !== 0) return res.status(400).json({ message: 'Points must be multiple of 100' });
  const expectedRupees = (points / 100) * 10;
  if (expectedRupees !== rupees) return res.status(400).json({ message: 'Invalid conversion' });
  const user = ensureUserDefaults(getUserByEmail(req.userEmail));
  if (!user) return res.status(404).json({ message: 'Not found' });
  if (user.points < points) return res.status(400).json({ message: 'Insufficient points' });
  user.points -= points;
  user.earnings += rupees;
  user.rupeesFromPoints = Math.floor(user.points / 100) * 10;
  saveUser(user);
  sendAdminEmail('Withdrawal request', `User ${user.email}\nProvider: ${provider}\nName: ${name}\nNumber: ${number}\nPoints: ${points}\nRupees: ${rupees}`).catch(() => {});
  res.json({ message: 'Withdrawal requested', balance: user.earnings, points: user.points });
});

export default router;

