const jwt = require('jsonwebtoken');
const store = require('../utils/store');

module.exports = async function(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await store.findById(decoded.userId);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        req.user = user;
        next();
    } catch (err) {
        console.error('Auth middleware error', err);
        return res.status(401).json({ message: 'Token is not valid' });
    }
};
