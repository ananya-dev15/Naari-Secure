const express = require('express');
const router = express.Router();
const Area = require('../models/Area');
const authMiddleware = require('../middleware/authMiddleware');

// Haversine formula for production-grade distance calculation
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

router.post('/score', authMiddleware, async (req, res) => {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
        return res.status(400).json({ msg: "Location required" });
    }

    try {
        // Fetch zones from the risk_map database (Area model is connected there)
        const zones = await Area.find();

        let nearest = null;
        let minDistance = Infinity;

        for (const zone of zones) {
            const dist = getDistance(lat, lng, zone.lat, zone.lng);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = zone;
            }
        }

        if (!nearest) {
            return res.json({
                risk: 0.1,
                level: "safe",
                distance: null
            });
        }

        res.json({
            risk: nearest.risk_score || 0.1,
            level: nearest.risk_level || "safe",
            distance: minDistance.toFixed(2)
        });

    } catch (err) {
        console.error("Risk score calculation error:", err);
        res.status(500).json({ msg: "Risk fetch error" });
    }
});

module.exports = router;
