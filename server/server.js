require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files from project root so visiting / will load index.html
app.use(express.static(path.join(__dirname, '..')));

// Connect to MongoDB
const net = require('net');

async function startMongooseIfAvailable() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn('MONGODB_URI not set — skipping MongoDB connection');
        return;
    }

    // If URI points to localhost, probe the port first to avoid crash when MongoDB is down
    if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
        const port = 27017;
        const host = uri.includes('127.0.0.1') ? '127.0.0.1' : '127.0.0.1';
        const socket = new net.Socket();
        let connected = false;

        await new Promise(resolve => {
            socket.setTimeout(1000);
            socket.on('connect', () => { connected = true; socket.destroy(); resolve(); });
            socket.on('timeout', () => { socket.destroy(); resolve(); });
            socket.on('error', () => { resolve(); });
            socket.connect(port, host);
        });

        if (!connected) {
            console.warn('MongoDB not reachable at localhost:27017 — skipping mongoose.connect (using file fallback)');
            return;
        }
    }

    mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

startMongooseIfAvailable();

// Prevent the process from crashing on unhandled rejections / exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error (event):', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});