import { useState, useEffect } from 'react';
import { MapPin, Phone, Navigation, Shield, Building2, HeartPulse, Loader2, Users } from 'lucide-react';
import RiskMap from '../components/RiskMap';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import TrackUser from './TrackUser';

// Helper to calculate distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d.toFixed(1);
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface Place {
  id: number;
  name: string;
  distance: string;
  phone?: string;
  coords: { lat: number; lng: number };
}

const SafeZones = () => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'police' | 'hospitals' | 'helpCenters'>('police');
  const [zones, setZones] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guardian specific state
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [fetchingWards, setFetchingWards] = useState(false);

  // Fetch wards if Guardian
  useEffect(() => {
    if (user?.role === 'guardian' && token) {
      setFetchingWards(true);
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/guardian/sos-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setWards(data);
          if (data.length > 0) {
            setSelectedWardId(data[0]._id);
          }
          setFetchingWards(false);
        })
        .catch(err => {
          console.error("Failed to fetch wards:", err);
          setFetchingWards(false);
        });
    }
  }, [user, token]);

  const tabs = [
    { id: 'police' as const, icon: Shield, label: t('nearbyPolice') },
    { id: 'hospitals' as const, icon: HeartPulse, label: t('nearbyHospitals') },
    { id: 'helpCenters' as const, icon: Building2, label: t('womenHelpCenters') },
  ];

  // Get User Location on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.error("Error getting location:", err);
          setError(t('locationAccessDenied'));
        }
      );
    } else {
      setError(t('geolocationNotSupported'));
    }
  }, []);

  // API Endpoints for redundancy
  const OVERPASS_INSTANCES = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  const fetchPlaces = async () => {
    if (!userLocation || user?.role === 'guardian') return;

    setLoading(true);
    setError(null);
    setZones([]);

    const radius = 5000; // 5km radius
    const { lat, lng } = userLocation;
    let query = '';

    // Overpass API Query Construction
    if (activeTab === 'police') {
      query = `
        [out:json][timeout:25];
        (
          node["amenity"="police"](around:${radius},${lat},${lng});
          way["amenity"="police"](around:${radius},${lat},${lng});
        );
        out center;
      `;
    } else if (activeTab === 'hospitals') {
      query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lng});
          way["amenity"="hospital"](around:${radius},${lat},${lng});
          node["amenity"="clinic"](around:${radius},${lat},${lng});
        );
        out center;
      `;
    } else if (activeTab === 'helpCenters') {
      query = `
        [out:json][timeout:25];
        (
          node["social_facility"](around:${radius},${lat},${lng});
          way["social_facility"](around:${radius},${lat},${lng});
          node["building"="dormitory"](around:${radius},${lat},${lng});
        );
        out center;
      `;
    }

    let success = false;
    for (const instance of OVERPASS_INSTANCES) {
      if (success) break;
      try {
        const response = await fetch(`${instance}?data=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Process Data
        const places: Place[] = data.elements.map((element: any) => {
          const placeLat = element.lat || element.center?.lat;
          const placeLon = element.lon || element.center?.lon;
          const name = element.tags.name || element.tags.description || element.tags.operator || `${activeTab === 'police' ? 'Police Station' : activeTab === 'hospitals' ? 'Hospital' : 'Help Center'}`;
          return {
            id: element.id,
            name: name,
            distance: `${calculateDistance(lat, lng, placeLat, placeLon)} km`,
            phone: element.tags.phone || element.tags['contact:phone'] || null,
            coords: { lat: placeLat, lng: placeLon }
          };
        });

        places.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        setZones(places);
        success = true;
      } catch (err) {
        console.warn(`Failed to fetch from ${instance}:`, err);
        if (instance === OVERPASS_INSTANCES[OVERPASS_INSTANCES.length - 1]) {
          setError(t('failedToFetchPlaces'));
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlaces();
  }, [activeTab, userLocation]);

  const handleNavigate = (coords: { lat: number; lng: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
    window.open(url, '_blank');
  };

  // --- GUARDIAN VIEW ---
  if (user?.role === 'guardian') {
    if (fetchingWards) return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Initializing Tracking Portal...</p>
        </div>
      </Layout>
    );

    if (wards.length === 0) return (
      <Layout>
        <div className="container px-4 py-12 text-center max-w-xl mx-auto">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Wards Linked</h2>
          <p className="text-muted-foreground mb-8">You haven't linked any accounts to protect yet. Please use an invite code on the home dashboard to get started.</p>
          <Navigation className="w-4 h-4 mx-auto mb-1 animate-bounce text-primary" />
          <button onClick={() => window.location.href = '/'} className="font-bold text-primary hover:underline">Go to Dashboard</button>
        </div>
      </Layout>
    );

    return (
      <div className="relative">
        {/* Ward Selector (if multiple) */}
        {wards.length > 1 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-white/90 backdrop-blur shadow-xl rounded-full px-2 py-1 flex gap-1 border border-primary/20">
            {wards.map(ward => (
              <button
                key={ward._id}
                onClick={() => setSelectedWardId(ward._id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                  selectedWardId === ward._id
                    ? "bg-primary text-white shadow-md shadow-primary/30"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {ward.name}
              </button>
            ))}
          </div>
        )}
        <TrackUser id={selectedWardId!} />
      </div>
    );
  }

  // --- GIRL VIEW ---
  return (
    <Layout>
      <div className="container px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">{t('safeZones')}</h1>
          <p className="text-sm text-muted-foreground">{t('findHelpNearby')}</p>
        </div>

        <div className="elevated-card overflow-hidden mb-6">
          <RiskMap />
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground text-foreground shadow-md'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-3">{error}</p>
              <button onClick={fetchPlaces} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">{t('retry')}</button>
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('noPlacesFound')}</div>
          ) : (
            zones.map((zone) => (
              <div key={zone.id} className="elevated-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{zone.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{zone.distance}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {zone.phone && (
                      <a href={`tel:${zone.phone}`} className="p-3 rounded-xl bg-safe/10 text-safe hover:bg-safe/20 transition-colors">
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                    <button onClick={() => handleNavigate(zone.coords)} className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SafeZones;
