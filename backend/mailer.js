import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return null; // email disabled
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
  return transporter;
}

export async function sendAdminEmail(subject, text) {
  const t = getTransporter();
  if (!t) {
    console.log('[email disabled]', subject, text);
    return;
  }
  await t.sendMail({
    from: `SocialEarn <${config.smtp.user}>`,
    to: config.smtp.adminEmail,
    subject,
    text
  });
}

