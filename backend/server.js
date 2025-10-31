import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import whatsappRoutes from './routes/whatsapp.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: config.allowOrigin === '*' ? true : config.allowOrigin }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

