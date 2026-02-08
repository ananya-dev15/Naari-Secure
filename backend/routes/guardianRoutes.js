const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /api/guardian/accept-invite
// @desc    Accept invite code to link guardian with girl
// @access  Private (Guardian only)
router.post('/accept-invite', authMiddleware, async (req, res) => {
    const { inviteCode } = req.body;

    if (!inviteCode) {
        return res.status(400).json({ message: 'Invite code is required' });
    }

    try {
        // Find user (girl) who has this invite code in pending contacts
        const girl = await User.findOne({
            'emergencyContacts.inviteCode': inviteCode,
            'emergencyContacts.status': 'pending'
        });

        if (!girl) {
            return res.status(404).json({ message: 'Invalid or expired invite code' });
        }

        // Update Girl's contact status
        const contactIndex = girl.emergencyContacts.findIndex(
            c => c.inviteCode === inviteCode
        );

        if (contactIndex === -1) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        // Link Guardian to Girl
        girl.emergencyContacts[contactIndex].status = 'active';
        girl.emergencyContacts[contactIndex].guardianId = req.user.id;
        await girl.save();

        // Add Girl to Guardian's wards
        const guardian = await User.findById(req.user.id);
        if (!guardian.wards.includes(girl._id)) {
            guardian.wards.push(girl._id);
            await guardian.save();
        }

        res.json({ message: 'Successfully linked to user', linkedUser: girl.name });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/guardian/wards
// @desc    Get list of wards
// @access  Private
router.get('/wards', authMiddleware, async (req, res) => {
    try {
        const guardian = await User.findById(req.user.id).populate('wards', 'name email');
        res.json(guardian.wards);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/guardian/sos-status
// @desc    Get SOS status and location of all wards
// @access  Private (Guardian only)
router.get('/sos-status', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'guardian') {
            return res.status(403).json({ message: 'Access denied: Guardian only' });
        }

        // Direct query to ensure fresh documents from data instead of using populate
        // which can sometimes return stale nested data during frequent polling
        const wards = await User.find({ _id: { $in: req.user.wards } })
            .select('name email phone sosActive lastLocation sosHistory travelMode travelHistory currentSOSAudioFile batteryLevel');

        res.json(wards);
    } catch (error) {
        console.error('Error fetching ward SOS status:', error);
        res.status(500).json({ message: 'Server error fetching SOS status' });
    }
});

module.exports = router;
