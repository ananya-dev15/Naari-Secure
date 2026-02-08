import { useEffect, useState } from 'react';
import LiveRouteMap from '@/components/maps/LiveRouteMap';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Clock, MapPin, Navigation, Shield, Bell, Volume2, VolumeX, Moon, Battery } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, differenceInSeconds } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Fix leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map center update
function MapAutoCenter({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center);
    }, [center, map]);
    return null;
}

const TrackUser = ({ id: propId }: { id?: string }) => {
    const { id: paramId } = useParams();
    const id = propId || paramId;
    const navigate = useNavigate();
    const { token } = useAuth();
    const { t } = useLanguage();
    const [ward, setWard] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<string>('');

    const fetchWardData = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/guardian/sos-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const currentWard = data.find((w: any) => w._id === id);
            setWard(currentWard);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch ward data", error);
        }
    };

    useEffect(() => {
        fetchWardData();
        const interval = setInterval(fetchWardData, 5000);
        return () => clearInterval(interval);
    }, [id, token]);

    // --- SOS AUDIO ALERT LOGIC ---
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [audio] = useState(() => {
        const a = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
        a.loop = true;
        return a;
    });

    useEffect(() => {
        if (ward?.sosActive && isAudioEnabled) {
            audio.play().catch(err => console.error("Audio playback failed:", err));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }

        return () => {
            audio.pause();
        };
    }, [ward?.sosActive, isAudioEnabled]);

    useEffect(() => {
        if (!ward?.travelMode?.isActive || !ward?.travelMode?.expectedArrivalTime) {
            setTimeLeft('');
            return;
        }

        const timer = setInterval(() => {
            const now = new Date();
            const eta = new Date(ward.travelMode.expectedArrivalTime);
            const diff = differenceInSeconds(eta, now);

            if (diff <= 0) {
                setTimeLeft('LATE');
            } else {
                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [ward]);

    if (loading) return <div className="flex items-center justify-center h-screen">{t('loadingTrackingData')}</div>;
    if (!ward) return <div className="p-8 text-center">{t('userNotFound')}</div>;

    const lastPos: [number, number] = ward.lastLocation ? [ward.lastLocation.lat, ward.lastLocation.lng] : [28.6139, 77.2090];
    const routePoints = ward.travelMode?.pathPoints?.map((p: any) => [p.lat, p.lng]) || [];

    return (
        <Layout>
            <div className="container px-4 py-6 max-w-[1600px]">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6 hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> {t('backToDashboard')}
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Map & History Section */}
                    <div className="lg:col-span-3 space-y-6">
                        <Card className="overflow-hidden border-2 shadow-lg h-[500px] lg:h-[65vh] relative z-0">
                            {ward.travelMode?.isActive ? (
                                <LiveRouteMap
                                    currentPos={{ lat: lastPos[0], lng: lastPos[1] }}
                                    destinationPos={ward.travelMode.destinationCoords}
                                />
                            ) : (
                                <MapContainer
                                    // @ts-ignore
                                    center={lastPos}
                                    zoom={15}
                                    style={{ height: '100%', width: '100%' }}
                                    // @ts-ignore
                                    zoomControl={false}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <MapAutoCenter center={lastPos} />

                                    {routePoints.length > 1 && (
                                        // @ts-ignore
                                        <Polyline positions={routePoints} color="#3b82f6" weight={5} opacity={0.7} />
                                    )}

                                    <Marker position={lastPos}>
                                        <Popup>
                                            <div className="text-center font-bold">
                                                {ward.name}<br />
                                                <span className="text-xs font-normal text-muted-foreground">
                                                    {t('lastUpdated')}: {ward.lastLocation ? format(new Date(ward.lastLocation.timestamp), 'h:mm:ss a') : 'Unknown'}
                                                </span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </MapContainer>
                            )}
                        </Card>

                        {/* Side-by-Side Cards (History & Logs) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            {/* Travel History Card */}
                            <Card className="border-2 shadow-md">
                                <CardHeader className="bg-primary/5 border-b py-4">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary" />
                                        {t('travelHistory') || 'Travel History'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {ward.travelHistory && ward.travelHistory.length > 0 ? (
                                        ward.travelHistory.slice().reverse().slice(0, 10).map((trip: any, idx: number) => (
                                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border flex justify-between items-center text-xs">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-bold text-foreground truncate">{trip.destination}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        <span className="font-semibold text-gray-700">Reached: </span>
                                                        {format(new Date(trip.endTime), 'h:mm a • MMM d')}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    {trip.status === 'sos' ? (
                                                        <span className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-full uppercase animate-pulse">
                                                            SOS
                                                        </span>
                                                    ) : (
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase",
                                                            trip.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                        )}>
                                                            {trip.status === 'completed' ? t('arrivedSafely') : trip.status}
                                                        </span>
                                                    )}
                                                    {trip.delayed && (
                                                        <span className="text-[8px] text-orange-600 font-bold flex items-center gap-0.5">
                                                            <Clock className="w-2 h-2" /> DELAYED
                                                        </span>
                                                    )}
                                                    {trip.audioFile && (
                                                        <button
                                                            onClick={() => {
                                                                const audio = new Audio(`${import.meta.env.VITE_API_BASE_URL}/uploads/audio/${trip.audioFile}`);
                                                                audio.play().catch(e => console.error("History audio play failed", e));
                                                            }}
                                                            className="mt-1 p-1 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-colors"
                                                            title="Play Recording"
                                                        >
                                                            <Volume2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-center py-4 text-muted-foreground">No recent travel history.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Emergency Logs Card */}
                            <Card className="border-2 border-red-100 shadow-md">
                                <CardHeader className="bg-red-50 border-b py-4">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                                        <Shield className="w-4 h-4" />
                                        {t('emergencyLogs') || 'Emergency Logs'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {ward.sosHistory && ward.sosHistory.length > 0 ? (
                                        ward.sosHistory.slice().reverse().slice(0, 10).map((log: any, idx: number) => (
                                            <div key={idx} className="p-3 bg-red-50/30 rounded-lg border border-red-100 flex justify-between items-center text-xs">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-bold text-red-900 uppercase tracking-tight">{t('sosTriggered') || 'SOS TRIGGERED'}</p>
                                                    <p className="text-[10px] text-red-700 mt-0.5">
                                                        {format(new Date(log.startTime), 'MMM d, h:mm a')}
                                                        {log.duration && ` • Duration: ${log.duration}`}
                                                    </p>
                                                </div>
                                                <div className="shrink-0">
                                                    {log.audioFile && (
                                                        <button
                                                            onClick={() => {
                                                                const audio = new Audio(`${import.meta.env.VITE_API_BASE_URL}/uploads/audio/${log.audioFile}`);
                                                                audio.play().catch(e => console.error("SOS log audio play failed", e));
                                                            }}
                                                            className="p-1.5 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-sm"
                                                            title="Play Recording"
                                                        >
                                                            <Volume2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-center py-4 text-muted-foreground">No emergency logs recorded.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* User Details & Tracking Card Sidebar */}
                    <div className="space-y-6">
                        <Card className="border-2 shadow-md">
                            <CardHeader className="bg-primary/5 border-b">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                                        {ward.name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-lg truncate">{ward.name}</CardTitle>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-2 h-2 rounded-full ${ward.travelMode?.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {ward.travelMode?.isActive ? t('liveTracking') : t('stayed')}
                                            </span>
                                            {ward.travelMode?.isNightMode && (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-950 text-yellow-300 text-[9px] font-black uppercase rounded-full border border-indigo-700 ml-1">
                                                    <Moon className="w-2.5 h-2.5" /> Night
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Battery Status */}
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider",
                                            (ward.batteryLevel || 100) <= 20
                                                ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                                                : "bg-green-50 text-green-700 border-green-100"
                                        )}>
                                            <Battery className={cn("w-3.5 h-3.5", (ward.batteryLevel || 100) <= 20 ? "text-red-500" : "text-green-500")} />
                                            {ward.batteryLevel !== undefined ? `${ward.batteryLevel}%` : '100%'}
                                        </div>
                                        {(ward.batteryLevel || 100) <= 20 && (
                                            <span className="text-[9px] font-black text-red-600 animate-bounce uppercase">Low Battery</span>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Countdown Timer or SOS Alert */}
                                {ward.sosActive ? (
                                    <div className="text-center p-4 bg-red-100 rounded-2xl border border-red-500 animate-pulse relative">
                                        <button
                                            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full text-white shadow-lg"
                                        >
                                            {isAudioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                                        </button>
                                        <p className="text-xl font-black uppercase tracking-widest text-red-600 mb-1">CRITICAL ALERT</p>
                                        <p className="text-4xl font-black text-red-700">SOS TRIGGERED</p>

                                        {ward.currentSOSAudioFile && (
                                            <div className="mt-4 p-3 bg-red-600 rounded-xl flex items-center justify-center gap-3 animate-bounce">
                                                <Volume2 className="w-5 h-5 text-white" />
                                                <audio
                                                    controls
                                                    className="h-8 max-w-[200px]"
                                                    src={`${import.meta.env.VITE_API_BASE_URL}/uploads/audio/${ward.currentSOSAudioFile}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : ward.travelMode?.isActive && (
                                    <div className="text-center p-4 bg-primary/5 rounded-2xl border border-primary/10 relative">
                                        <button
                                            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                                            className={cn(
                                                "absolute top-2 right-2 p-1.5 rounded-full transition-all",
                                                isAudioEnabled ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                                            )}
                                        >
                                            {isAudioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                                        </button>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">{t('timeToArrival')}</p>
                                        <p className={`text-4xl font-black ${timeLeft === 'LATE' ? 'text-red-600 animate-bounce' : 'text-primary'}`}>
                                            {timeLeft || '--:--'}
                                        </p>
                                    </div>
                                )}

                                {/* Tracking Details */}
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <Navigation className="w-5 h-5 text-blue-500 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">{t('destination')}</p>
                                            <p className="font-semibold">{ward.travelMode?.destination || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <Clock className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">{t('startTime')}</p>
                                            <p className="font-semibold">
                                                {ward.travelMode?.startTime ? format(new Date(ward.travelMode.startTime), 'h:mm a') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">{t('expectedArrival')}</p>
                                            <p className="font-semibold">
                                                {ward.travelMode?.expectedArrivalTime ? format(new Date(ward.travelMode.expectedArrivalTime), 'h:mm a') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t gap-3 flex flex-col">
                                    <a
                                        href={`tel:${ward.phone}`}
                                        className="w-full"
                                    >
                                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 h-12">
                                            <Bell className="w-4 h-4" /> {t('ringPhone')}
                                        </Button>
                                    </a>
                                    {ward.sosActive && (
                                        <Button variant="destructive" className="w-full h-12 font-black uppercase text-sm animate-pulse">
                                            {t('emergencyActive')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-secondary/5 border-dashed">
                            <CardContent className="p-4 flex items-center gap-3 text-xs text-muted-foreground">
                                <Shield className="w-4 h-4 text-primary" />
                                <p>{t('ensuringPrivacy')}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default TrackUser;
