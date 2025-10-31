const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
let UserModel;
try {
    UserModel = require('../models/User');
} catch (e) {
    UserModel = null;
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

async function ensureDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (e) {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, '[]', 'utf8');
    }
}

async function readFileUsers() {
    await ensureDataFile();
    const txt = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(txt || '[]');
}

async function writeFileUsers(users) {
    await ensureDataFile();
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function isMongooseConnected() {
    return mongoose && mongoose.connection && mongoose.connection.readyState === 1 && UserModel;
}

async function findByEmail(email) {
    if (isMongooseConnected()) {
        return UserModel.findOne({ email }).exec();
    }
    const users = await readFileUsers();
    const u = users.find(x => x.email === email.toLowerCase());
    if (!u) return null;
    // attach comparePassword helper
    u.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return u;
}

async function findById(id) {
    if (isMongooseConnected()) {
        return UserModel.findById(id).exec();
    }
    const users = await readFileUsers();
    const u = users.find(x => x.id === String(id));
    if (!u) return null;
    u.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return u;
}

async function findByVerificationToken(token) {
    if (isMongooseConnected()) {
        return UserModel.findOne({ verificationToken: token }).exec();
    }
    const users = await readFileUsers();
    const u = users.find(x => x.verificationToken === token);
    if (!u) return null;
    u.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return u;
}

async function findByResetToken(token) {
    if (isMongooseConnected()) {
        return UserModel.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } }).exec();
    }
    const users = await readFileUsers();
    const u = users.find(x => x.resetPasswordToken === token && x.resetPasswordExpires && x.resetPasswordExpires > Date.now());
    if (!u) return null;
    u.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return u;
}

async function createUser({ name, email, password, verificationToken }) {
    if (isMongooseConnected()) {
        const u = new UserModel({ name, email, password, verificationToken });
        return u.save();
    }

    const users = await readFileUsers();
    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const user = {
        id,
        name,
        email: String(email).toLowerCase(),
        password: hashed,
        isVerified: false,
        verificationToken: verificationToken || null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        lastLogin: null,
        loginStreak: 0,
        lastLoginDate: null,
        earnings: 0,
        connectedAccounts: [],
        points: 0,
        createdAt: now,
        updatedAt: now
    };
    users.push(user);
    await writeFileUsers(users);
    user.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return user;
}

async function updateUser(id, updates) {
    if (isMongooseConnected()) {
        return UserModel.findByIdAndUpdate(id, updates, { new: true }).exec();
    }
    const users = await readFileUsers();
    const idx = users.findIndex(x => x.id === String(id) || x._id === String(id));
    if (idx === -1) return null;
    const user = users[idx];
    // If password is being updated in file-mode, hash it
    if (updates && updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
    }
    Object.assign(user, updates);
    user.updatedAt = new Date().toISOString();
    users[idx] = user;
    await writeFileUsers(users);
    user.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, this.password);
    };
    return user;
}

module.exports = {
    findByEmail,
    findById,
    findByVerificationToken,
    findByResetToken,
    createUser,
    updateUser,
    isMongooseConnected
};
