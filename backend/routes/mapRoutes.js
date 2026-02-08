const express = require('express');
const router = express.Router();
const Area = require("../models/Area");

router.get("/map-data", async (req, res) => {
    try {
        const { city } = req.query;

        const query = city ? { city: new RegExp(city, 'i') } : {};

        const data = await Area.find(query)
            .select("area risk_level lat lng risk_score") // include risk_score for popup
            .limit(400); // prevent map overload

        res.json(data);
    } catch (err) {
        console.error("Map data fetch error:", err);
        res.status(500).send("Server error");
    }
});

module.exports = router;
