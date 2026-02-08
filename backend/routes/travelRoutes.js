const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   POST /api/travel/start
// @desc    Start travel mode
// @access  Private
router.post('/start', authMiddleware, async (req, res) => {
    const { destination, expectedMinutes, location, destinationCoords } = req.body;

    if (!destination || !expectedMinutes) {
        return res.status(400).json({ message: 'Destination and expected minutes are required' });
    }

    try {
        const user = await User.findById(req.user.id);
        const startTime = new Date();
        const expectedArrivalTime = new Date(startTime.getTime() + expectedMinutes * 60000);

        const currentHour = startTime.getHours();
        const isNight = currentHour >= 21 || currentHour < 6;

        user.travelMode = {
            isActive: true,
            isNightMode: isNight,
            destination,
            startTime,
            expectedArrivalTime,
            startLocation: location,
            destinationCoords,
            pathPoints: location ? [{ ...location, timestamp: startTime }] : []
        };

        // Update last location as well
        if (location) {
            user.lastLocation = { ...location, timestamp: startTime };
        }

        await user.save();

        // Notify guardians (simulation)
        const timeStr = expectedArrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let message = `${user.name} has started travelling towards ${destination}. Expected arrival: ${timeStr}.`;

        if (isNight) {
            message = `[NIGHT TRAVEL ALERT] 🌙 ${user.name} is travelling at NIGHT towards ${destination}. Expected arrival: ${timeStr}.`;
        }

        console.log(`\n[TRAVEL UPDATE] Sending SMS to guardians: "${message}"`);

        res.json({
            message: 'Travel mode started',
            travelMode: user.travelMode
        });
    } catch (error) {
        console.error('Start Travel Error:', error);
        res.status(500).json({ message: 'Server error starting travel mode' });
    }
});

// @route   POST /api/travel/stop
// @desc    Stop travel mode (arrived safely)
// @access  Private
router.post('/stop', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        const travelData = user.travelMode;

        // Save to History
        if (travelData && travelData.startTime) {
            user.travelHistory.push({
                destination: travelData.destination,
                startTime: travelData.startTime,
                endTime: new Date(),
                status: (travelData.wasSosTriggered || user.sosActive) ? 'sos' : 'completed',
                audioFile: user.currentSOSAudioFile,
                delayed: new Date() > new Date(travelData.expectedArrivalTime)
            });
        }

        user.currentSOSAudioFile = null; // Clear after saving to history

        user.travelMode = {
            isActive: false,
            destination: null,
            startTime: null,
            expectedArrivalTime: null,
            pathPoints: []
        };

        await user.save();

        // Notify guardians (simulation)
        if (travelData.destination) {
            const message = `${user.name} has arrived safely at ${travelData.destination}.`;
            console.log(`\n[TRAVEL UPDATE] Sending SMS to guardians: "${message}"`);
        }

        res.json({ message: 'Travel mode stopped' });
    } catch (error) {
        res.status(500).json({ message: 'Server error stopping travel mode' });
    }
});

// @route   POST /api/travel/extend
// @desc    Extend travel time
// @access  Private
router.post('/extend', authMiddleware, async (req, res) => {
    const { additionalMinutes } = req.body; // e.g., 10

    try {
        const user = await User.findById(req.user.id);

        if (!user.travelMode.isActive) {
            return res.status(400).json({ message: 'Travel mode not active' });
        }

        const currentETA = new Date(user.travelMode.expectedArrivalTime);
        const newETA = new Date(currentETA.getTime() + additionalMinutes * 60000);

        user.travelMode.expectedArrivalTime = newETA;
        await user.save();

        res.json({
            message: 'Travel time extended',
            expectedArrivalTime: newETA
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error extending time' });
    }
});

// @route   POST /api/travel/update-location
// @desc    Update location during travel
// @access  Private
router.post('/update-location', authMiddleware, async (req, res) => {
    const { location } = req.body; // { lat, lng }

    try {
        const user = await User.findById(req.user.id);

        if (user.travelMode.isActive && location) {
            user.travelMode.pathPoints.push({ ...location, timestamp: new Date() });
        }

        if (location) {
            user.lastLocation = { ...location, timestamp: new Date() };
        }

        await user.save();
        res.json({ message: 'Location updated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating location' });
    }
});

// @route   POST /api/travel/acknowledge-delay
// @desc    Acknowledge a delay during travel (stops red UI/prompts)
// @access  Private
router.post('/acknowledge-delay', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.travelMode.isActive) {
            return res.status(400).json({ message: 'Travel mode not active' });
        }

        const now = new Date();
        const currentETA = new Date(user.travelMode.expectedArrivalTime);

        // Auto-extend by 5 minutes from NOW if overdue, or from current ETA if called early
        const baseTime = now > currentETA ? now : currentETA;
        const newETA = new Date(baseTime.getTime() + 5 * 60000);

        user.travelMode.expectedArrivalTime = newETA;
        user.travelMode.delayAcknowledged = true;
        await user.save();

        res.json({
            message: 'Delay acknowledged and time extended',
            expectedArrivalTime: newETA
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error acknowledging delay' });
    }
});

module.exports = router;
