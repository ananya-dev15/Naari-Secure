const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    accessCode: {
        type: String,
        unique: true,
        sparse: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['girl', 'guardian'],
        required: true
    },
    emergencyContacts: [{
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },
        relation: { type: String },
        status: { type: String, enum: ['pending', 'active'], default: 'pending' },
        guardianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    wards: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'User'
    }],
    sosActive: {
        type: Boolean,
        default: false
    },
    currentSOSStartTime: {
        type: Date
    },
    currentSOSAudioFile: {
        type: String
    },
    sosHistory: [{
        startTime: Date,
        endTime: Date,
        duration: String,
        audioFile: String,
        startLocation: {
            lat: Number,
            lng: Number
        }
    }],
    batteryLevel: {
        type: Number,
        default: 100
    },
    lastLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date
    },
    travelMode: {
        isActive: { type: Boolean, default: false },
        isNightMode: { type: Boolean, default: false },
        delayAcknowledged: { type: Boolean, default: false },
        destination: String,
        startTime: Date,
        expectedArrivalTime: Date,
        startLocation: { lat: Number, lng: Number },
        destinationCoords: { lat: Number, lng: Number },
        wasSosTriggered: { type: Boolean, default: false },
        pathPoints: [{ lat: Number, lng: Number, timestamp: Date }]
    },
    frequentPlaces: [{
        name: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: String
    }],
    travelHistory: [{
        destination: String,
        startTime: Date,
        endTime: Date,
        status: { type: String, enum: ['completed', 'sos', 'stopped'] },
        audioFile: String,
        delayed: { type: Boolean, default: false }
    }]
});

// Middleware to hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
