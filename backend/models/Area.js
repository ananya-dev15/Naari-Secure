const mongoose = require("mongoose");

// Create separate connection for Risk Map database
const riskMapConn = mongoose.createConnection(process.env.RISK_MAP_DB_URI);

riskMapConn.on('connected', () => console.log('Risk Map MongoDB connected'));
riskMapConn.on('error', (err) => console.error('Risk Map MongoDB connection error:', err));

const areaSchema = new mongoose.Schema({
    state: String,
    city: String,
    area: String,
    risk_level: String,
    risk_score: Number,
    lat: Number,
    lng: Number
}, { collection: 'areas' });

module.exports = riskMapConn.model("Area", areaSchema);
