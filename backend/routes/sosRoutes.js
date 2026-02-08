const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const { triggerSOS, cancelSOS, updateLocation, uploadAudio, notifyHighRisk } = require('../controllers/sosController');

// Multer Storage Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/audio');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'sos-' + uniqueSuffix + '.webm'); // Using webm as it's common for MediaRecorder
    }
});

const upload = multer({ storage: storage });

router.post('/trigger', authMiddleware, triggerSOS);
router.post('/cancel', authMiddleware, cancelSOS);
router.post('/update-location', authMiddleware, updateLocation);
router.post('/upload-audio', authMiddleware, upload.single('audio'), uploadAudio);
router.post('/notify-risk', authMiddleware, notifyHighRisk);

module.exports = router;
