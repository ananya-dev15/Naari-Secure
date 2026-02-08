const User = require('../models/User');
// const { sendSMS, makeCall } = require('../utils/communication');

// @route   POST /api/sos/trigger
// @desc    Trigger SOS: Alert guardians and police, update location
// @access  Private
const triggerSOS = async (req, res) => {
    const { location } = req.body;

    console.log('\n\n\n');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!!              SOS TRIGGERED                 !!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

    try {
        const user = await User.findById(req.user.id).populate('emergencyContacts.guardianId');

        if (!user) {
            console.error('[ERROR] User not found during SOS trigger');
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`User: ${user.name}`);
        console.log(`Phone: ${user.phone}`);
        console.log(`Location: ${location?.lat}, ${location?.lng}`);

        user.sosActive = true;
        user.currentSOSStartTime = new Date();

        // Mark active travel mode as having SOS triggered
        if (user.travelMode && user.travelMode.isActive) {
            user.travelMode.wasSosTriggered = true;
        }

        if (location) {
            user.lastLocation = {
                lat: location.lat,
                lng: location.lng,
                timestamp: user.currentSOSStartTime
            };
        }
        await user.save();

        // 1. Alert Guardians
        const message = `SOS ALERT! ${user.name} is in danger! Live Location: https://maps.google.com/?q=${location?.lat},${location?.lng}`;

        console.log('\n--- ALERTING GUARDIANS ---');
        // Let's alert ALL contacts regardless of status for testing, or just log which ones are skipped
        user.emergencyContacts.forEach((contact, idx) => {
            const status = contact.status === 'active' ? '[ACTIVE]' : '[PENDING]';
            console.log(`Contact ${idx + 1}: ${contact.name} (${contact.phone}) ${status}`);

            if (contact.status === 'active') {
                console.log(`  >>> RINGING PHONE... Simulation ongoing.`);
                console.log(`  >>> SENDING SMS: "${message}"`);
            } else {
                console.log(`  >>> Skipping SMS/Call: Guardian has not accepted invite yet.`);
            }
        });

        // 2. Alert Police (Simulation)
        console.log('\n--- ALERTING POLICE DISPATCH ---');
        console.log('**************************************************');
        console.log('*** DIALING 100...                             ***');
        console.log('*** CONNECTING TO POLICE EMERGENCY CONTROL...   ***');
        console.log(`*** SENDING LOCATION: ${location?.lat}, ${location?.lng} ***`);
        console.log('*** POLICE DISPATCHED TO LOCATION.             ***');
        console.log('**************************************************');
        console.log('\n\n');

        res.json({
            message: 'SOS Triggered',
            sosActive: user.sosActive,
            alertedContacts: user.emergencyContacts.length + 1
        });

    } catch (error) {
        console.error('SOS Trigger Error:', error);
        res.status(500).json({ message: 'Server error triggering SOS' });
    }
};


// @route   POST /api/sos/cancel
// @desc    Cancel SOS
// @access  Private
const cancelSOS = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const startTime = user.currentSOSStartTime;
        let durationStr = 'Unknown';

        if (startTime) {
            const diffMs = now - startTime;
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            durationStr = `${diffMins}m ${diffSecs}s`;
        }

        user.sosActive = false;
        user.sosHistory.push({
            startTime: startTime || now,
            endTime: now,
            duration: durationStr,
            audioFile: user.currentSOSAudioFile,
            startLocation: user.lastLocation ? { lat: user.lastLocation.lat, lng: user.lastLocation.lng } : null
        });
        user.currentSOSStartTime = null;
        user.currentSOSAudioFile = null;

        await user.save();

        // Notify guardians that user is safe
        const message = `SOS CANCELLED. ${user.name} has marked themselves as safe. Duration: ${durationStr}`;

        user.emergencyContacts
            .filter(contact => contact.status === 'active') // Filter if needed
            .forEach(contact => {
                console.log(`[SIMULATED SMS] Sending safety update to ${contact.phone}: ${message}`);
            });

        res.json({ message: 'SOS Cancelled', sosActive: false });

    } catch (error) {
        console.error('SOS Cancel Error:', error);
        res.status(500).json({ message: 'Server error cancelling SOS' });
    }
};

// @route   POST /api/sos/update-location
// @desc    Update live location during SOS
// @access  Private
const updateLocation = async (req, res) => {
    const { location } = req.body;

    try {
        const user = await User.findById(req.user.id);
        user.lastLocation = {
            lat: location.lat,
            lng: location.lng,
            timestamp: new Date()
        };
        await user.save();
        res.json({ message: 'Location updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating location' });
    }
};


// @route   POST /api/sos/upload-audio
// @desc    Upload emergency audio recording
// @access  Private
const uploadAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No audio file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Save filename to current session
        user.currentSOSAudioFile = req.file.filename;
        await user.save();

        console.log(`[AUDIO] SOS Recording uploaded for ${user.name}: ${req.file.filename}`);
        res.json({
            message: 'Audio uploaded successfully',
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Audio Upload Error:', error);
        res.status(500).json({ message: 'Error uploading audio' });
    }
};


// @route   POST /api/sos/notify-risk
// @desc    Notify guardians about high risk zone (No full SOS)
// @access  Private
const notifyHighRisk = async (req, res) => {
    const { location, safetyScore } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        console.log('\n--- HIGH RISK ZONE NOTIFICATION ---');
        console.log(`User: ${user.name} | Score: ${safetyScore} | Loc: ${location?.lat}, ${location?.lng}`);

        const message = `⚠️ HIGH RISK ALERT: ${user.name} has entered a risky area (Safety Score: ${safetyScore}/100). Live location: https://maps.google.com/?q=${location?.lat},${location?.lng}`;

        user.emergencyContacts.forEach((contact) => {
            if (contact.status === 'active') {
                console.log(`[SIMULATED SMS] Sent to ${contact.name} (${contact.phone}): ${message}`);
            }
        });
        res.json({ message: 'Guardians notified' });
    } catch (error) {
        res.status(500).json({ message: 'Error notifying guardians' });
    }
};

module.exports = { triggerSOS, cancelSOS, updateLocation, uploadAudio, notifyHighRisk };
