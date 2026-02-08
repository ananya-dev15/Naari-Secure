const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const authMiddleware = require('../middleware/authMiddleware');

// Generate JWT Token
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/signup
// @desc    Register a new user (Girl only)
// @access  Public
router.post('/signup', async (req, res) => {
    const { name, email, password, emergencyContacts, frequentPlaces } = req.body;
    const role = 'girl'; // Enforce role

    try {
        if (!emergencyContacts || emergencyContacts.length === 0) {
            return res.status(400).json({ message: 'At least one emergency contact is required.' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            emergencyContacts,
            frequentPlaces
        });

        if (user) {
            // Process Guardians
            for (const contact of emergencyContacts) {
                if (contact.email) {
                    // Check if guardian account exists
                    let guardian = await User.findOne({ email: contact.email });

                    let accessCode;
                    if (!guardian) {
                        // Generate Access Code
                        let isUnique = false;
                        while (!isUnique) {
                            accessCode = Math.floor(100000 + Math.random() * 900000).toString();
                            const existing = await User.findOne({ accessCode });
                            if (!existing) isUnique = true;
                        }

                        // Create Pre-Verified Guardian Account
                        guardian = await User.create({
                            name: contact.name,
                            email: contact.email,
                            role: 'guardian',
                            accessCode,
                            password: 'guardian123', // Default
                            isVerified: false, // Needs activation
                            wards: [user._id]
                        });
                    } else {
                        accessCode = guardian.accessCode;
                        if (!guardian.wards.includes(user._id)) {
                            guardian.wards.push(user._id);
                            await guardian.save();
                        }
                    }

                    // Update Girl's contact with Guardian ID 
                    const contactIndex = user.emergencyContacts.findIndex(c => c.email === contact.email);
                    if (contactIndex !== -1) {
                        user.emergencyContacts[contactIndex].guardianId = guardian._id;
                    }
                    await user.save();

                    // Invite Link (Token contains Guardian ID)
                    const inviteToken = Buffer.from(JSON.stringify({
                        guardianId: guardian._id,
                        girlId: user._id
                    })).toString('base64');

                    const inviteLink = `http://localhost:8080/invite?token=${inviteToken}`;

                    const emailContent = `
                        <h1>Action Required: Activate Your Guardian Account</h1>
                        <p>Hello ${contact.name},</p>
                        <p>${user.name} has chosen you as their Guardian on <strong>NaariSecure</strong>.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h2 style="margin: 0; color: #333;">Your Access Code: <span style="color: #4CAF50;">${accessCode}</span></h2>
                        </div>

                        <p><strong>Step 1:</strong> Click the link below to ACTIVATE your code.</p>
                        <p><strong>Step 2:</strong> Use the code to login.</p>
                        
                        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">ACTIVATE CODE</a>
                        <p style="font-size: 12px; color: #666;">Or copy link: ${inviteLink}</p>
                    `;

                    await sendEmail({
                        to: contact.email,
                        subject: 'Your Guardian Code & Activation - NaariSecure',
                        html: emailContent
                    });
                }
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/auth/accept-invite
// @desc    Activate Guardian Account (Link Click)
// @access  Public
router.post('/accept-invite', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const { guardianId, girlId } = decoded;

        const guardian = await User.findById(guardianId);
        if (!guardian) return res.status(404).json({ message: 'Guardian account not found' });

        // Activate
        guardian.isVerified = true;
        await guardian.save();

        // Update Girl's Link Status
        const girl = await User.findById(girlId);
        if (girl) {
            const contactIndex = girl.emergencyContacts.findIndex(c => c.guardianId && c.guardianId.toString() === guardianId);
            if (contactIndex !== -1) {
                girl.emergencyContacts[contactIndex].status = 'active';
                await girl.save();
            }
        }

        res.status(200).json({
            message: 'Account Activated',
            accessCode: guardian.accessCode
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/auth/login
// @desc    Auth user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password, accessCode, role } = req.body;

    try {
        if (role === 'guardian') {
            // Code-based login
            if (!accessCode) {
                return res.status(400).json({ message: 'Access code required' });
            }

            const user = await User.findOne({ accessCode });
            if (user && user.role === 'guardian') {
                if (!user.isVerified) {
                    return res.status(401).json({ message: 'Access Code not activated. Please click the link in your email.' });
                }

                return res.json({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    token: generateToken(user._id, user.role)
                });
            } else {
                return res.status(401).json({ message: 'Invalid access code' });
            }
        } else {
            // Email/Password login (Girl)
            const user = await User.findOne({ email });
            if (user && (await user.matchPassword(password))) {
                res.json({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    token: generateToken(user._id, user.role)
                });
            } else {
                res.status(401).json({ message: 'Invalid email or password' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user profile (Protected)
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/auth/add-place
// @desc    Add a frequent place
// @access  Private
router.put('/add-place', authMiddleware, async (req, res) => {
    const { name, lat, lng, address } = req.body;
    try {
        const user = await User.findById(req.user.id);
        user.frequentPlaces.push({ name, lat, lng, address });
        await user.save();
        res.json(user.frequentPlaces);
    } catch (error) {
        res.status(500).json({ message: 'Server error adding place' });
    }
});

// @route   POST /api/auth/add-contact
// @desc    Add an emergency contact
// @access  Private
router.post('/add-contact', authMiddleware, async (req, res) => {
    const { name, email, phone, relation } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.emergencyContacts.length >= 5) {
            return res.status(400).json({ message: 'Maximum 5 emergency contacts allowed' });
        }

        // Process Guardian logic (extracted from signup)
        let guardian = await User.findOne({ email });
        let accessCode;

        if (!guardian) {
            // Generate Access Code
            let isUnique = false;
            while (!isUnique) {
                accessCode = Math.floor(100000 + Math.random() * 900000).toString();
                const existing = await User.findOne({ accessCode });
                if (!existing) isUnique = true;
            }

            // Create Pre-Verified Guardian Account
            guardian = await User.create({
                name,
                email,
                role: 'guardian',
                accessCode,
                password: 'guardian123', // Default
                isVerified: false,
                wards: [user._id]
            });
        } else {
            accessCode = guardian.accessCode;
            if (!guardian.wards.includes(user._id)) {
                guardian.wards.push(user._id);
                await guardian.save();
            }
        }

        // Add contact to girl's list
        user.emergencyContacts.push({
            name,
            email,
            phone,
            relation,
            guardianId: guardian._id,
            status: guardian.isVerified ? 'active' : 'pending'
        });

        await user.save();

        // Send Email Invite
        const inviteToken = Buffer.from(JSON.stringify({
            guardianId: guardian._id,
            girlId: user._id
        })).toString('base64');

        const inviteLink = `http://localhost:8080/invite?token=${inviteToken}`;

        const emailContent = `
            <h1>Action Required: Activate Your Guardian Account</h1>
            <p>Hello ${name},</p>
            <p>${user.name} has chosen you as their Guardian on <strong>NaariSecure</strong>.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px;">
                <h2 style="margin: 0; color: #333;">Your Access Code: <span style="color: #4CAF50;">${accessCode}</span></h2>
            </div>

            <p><strong>Step 1:</strong> Click the link below to ACTIVATE your code.</p>
            <p><strong>Step 2:</strong> Use the code to login.</p>
            
            <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">ACTIVATE CODE</a>
        `;

        await sendEmail({
            to: email,
            subject: 'New Guardian Request - NaariSecure',
            html: emailContent
        });

        res.json(user.emergencyContacts);
    } catch (error) {
        console.error("Add Contact Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/auth/delete-place/:placeId
// @desc    Delete a frequent place
// @access  Private
router.delete('/delete-place/:placeId', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.frequentPlaces = user.frequentPlaces.filter(p => p._id.toString() !== req.params.placeId);
        await user.save();
        res.json(user.frequentPlaces);
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting place' });
    }
});

// @route   POST /api/auth/update-status
// @desc    Update location and battery level
// @access  Private
router.post('/update-status', authMiddleware, async (req, res) => {
    const { location, batteryLevel } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (location) {
            user.lastLocation = { ...location, timestamp: new Date() };
            // If travel mode is active, also update path points
            if (user.travelMode && user.travelMode.isActive) {
                user.travelMode.pathPoints.push({ ...location, timestamp: new Date() });
            }
        }

        if (batteryLevel !== undefined) {
            user.batteryLevel = batteryLevel;
        }

        await user.save();
        res.json({ message: 'Status updated', batteryLevel: user.batteryLevel });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ message: 'Server error updating status' });
    }
});

module.exports = router;
