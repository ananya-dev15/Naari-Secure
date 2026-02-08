import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const getColor = (level) => {
    if (!level) return '#22c55e';
    const val = level.toLowerCase().trim();
    switch (val) {
        case 'critical':
        case 'high':
            return '#ef4444'; // red-500
        case 'moderate':
        case 'medium':
            return '#f97316'; // orange-500
        case 'low':
        case 'mild':
            return '#facc15'; // yellow-400
        case 'safe':
        case 'green':
            return '#22c55e'; // green-500
        default: return '#22c55e';
    }
};

// Component to handle map view updates
function MapController({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 10); // Zoomed out for regional view as requested
        }
    }, [center, map]);
    return null;
}

export default function RiskMap() {
    const [position, setPosition] = useState(null);
    const [showRiskLayer, setShowRiskLayer] = useState(false);
    const [areas, setAreas] = useState([]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setPosition([pos.coords.latitude, pos.coords.longitude]);
                },
                (err) => {
                    console.error("Error getting location:", err);
                    // Default to Delhi if location access denied/fails
                    setPosition([28.7041, 77.1025]);
                }
            );
        } else {
            // Default to Delhi if geolocation not supported
            setPosition([28.7041, 77.1025]);
        }
    }, []);

    // Fetch risk areas from backend
    useEffect(() => {
        if (showRiskLayer) {
            axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/map/map-data`)
                .then(res => setAreas(res.data))
                .catch(err => console.error("Error fetching map data:", err));
        }
    }, [showRiskLayer]);

    if (!position) {
        return (
            <div style={{ height: "350px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0" }}>
                Loading map...
            </div>
        );
    }

    return (
        <div className="w-full">
            <div style={{ position: 'relative', height: "350px", width: "100%", borderRadius: "1rem", overflow: "hidden" }}>
                <button
                    onClick={() => setShowRiskLayer(!showRiskLayer)}
                    className="glass-card"
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        zIndex: 1000,
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(255,255,255,0.5)'
                    }}
                >
                    {showRiskLayer ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showRiskLayer ? 'Hide Heatmap' : 'Show Heatmap'}
                </button>

                <MapContainer center={position} zoom={10} style={{ height: "100%", width: "100%", zIndex: 0 }}>
                    <MapController center={position} />
                    <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* User location marker */}
                    <CircleMarker
                        center={position}
                        radius={5}
                        pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.8 }}
                    >
                        <Popup>You are here</Popup>
                    </CircleMarker>

                    {/* Risk Data Markers from Backend */}
                    {showRiskLayer && areas.map((place) => (
                        <CircleMarker
                            key={place._id}
                            center={[place.lat, place.lng]}
                            radius={20}
                            pathOptions={{
                                fillColor: getColor(place.risk_level),
                                fillOpacity: 0.6,
                                weight: 1,
                                color: getColor(place.risk_level) // stroke color
                            }}
                        >
                            <Popup>
                                <b>{place.area || place.city}</b><br />
                                Risk Level: <span style={{ textTransform: 'capitalize', color: getColor(place.risk_level), fontWeight: 'bold' }}>{place.risk_level}</span><br />
                                {place.risk_score && <span>Score: {place.risk_score}</span>}
                            </Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 px-2">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></span>
                    <span className="text-sm text-gray-600 font-medium">Safe</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#facc15' }}></span>
                    <span className="text-sm text-gray-600 font-medium">Low Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></span>
                    <span className="text-sm text-gray-600 font-medium">Medium Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>
                    <span className="text-sm text-gray-600 font-medium">High Risk</span>
                </div>
            </div>
        </div>
    );
}
