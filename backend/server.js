const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

if (!process.env.USER_DB_URI) {
    console.error('ERROR: USER_DB_URI is not defined in .env file');
    process.exit(1);
}

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads/audio', express.static(path.join(__dirname, 'uploads/audio')));

// Database Connection (User Auth)
mongoose.connect(process.env.USER_DB_URI)
    .then(() => console.log('User Auth MongoDB connected'))
    .catch(err => console.error('User Auth MongoDB connection error:', err));

mongoose.connection.on('error', err => {
    console.error('Mongoose default connection error:', err);
});

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const guardianRoutes = require('./routes/guardianRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/travel', require('./routes/travelRoutes'));
app.use('/api/sos', require('./routes/sosRoutes'));
app.use('/api/map', require('./routes/mapRoutes'));
app.use('/api/risk', require('./routes/riskRoutes'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

