// Update the server.js imports
const facebookRoutes = require('./routes/facebook');

// Add the Facebook routes to Express
app.use('/api/facebook', facebookRoutes);