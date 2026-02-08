import { useState, useEffect } from 'react';
import { Home, Building, GraduationCap, MapPin, Power, Clock, ShieldCheck, AlertTriangle, Trash2, Plus, CheckCircle, Moon, Phone, Mic, MicOff } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/layout/Layout';
import TravelStatusCard from '@/components/cards/TravelStatusCard';
import BatteryCard from '@/components/cards/BatteryCard';
import RiskScoreCard from '@/components/cards/RiskScoreCard';
import SafetyCheckModal from '@/components/modals/SafetyCheckModal';
import LocationPicker from '@/components/LocationPicker';
import LiveRouteMap from '@/components/maps/LiveRouteMap';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import useVoiceSOS from '@/hooks/useVoiceSOS';

const destinations = [
  { id: 'home', icon: Home, label: 'homeLocation', time: 30 },
  { id: 'hostel', icon: Building, label: 'hostel', time: 15 },
  { id: 'college', icon: GraduationCap, label: 'college', time: 20 },
  { id: 'custom', icon: MapPin, label: 'custom', time: 45 },
];

const Travel = () => {
  const { isTravelModeOn, startTravelMode, stopTravelMode, expectedArrivalTime, extendTravelTime, activateSOS, isSosActive, destinationCoords, triggerFakeCall, travelSessions, acknowledgeDelay } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState('30');
  const [showSafetyCheck, setShowSafetyCheck] = useState(false);
  const [frequentPlaces, setFrequentPlaces] = useState<any[]>([]);
  const [travelHistory, setTravelHistory] = useState<any[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [currentLoc, setCurrentLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickingFor, setPickingFor] = useState<'custom' | 'onetime'>('custom');

  // Night Mode State
  const [isNightMode, setIsNightMode] = useState(false);
  const [midJourneyChecked, setMidJourneyChecked] = useState(false);
  const [latePromptShown, setLatePromptShown] = useState(false);
  const [isMidJourneyCheck, setIsMidJourneyCheck] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const { toast } = useToast();

  // Voice SOS Hook
  useVoiceSOS(voiceEnabled && isTravelModeOn, () => {
    if (!isSosActive) {
      handleSOS();
      toast({
        title: "VOICE SOS ACTIVATED!",
        description: "Emergency command heard.",
        variant: "destructive"
      });
    }
  });

  // Check Night Mode Logic
  useEffect(() => {
    const checkNightMode = () => {
      const hour = new Date().getHours();
      setIsNightMode(hour >= 21 || hour < 6);
    };

    checkNightMode();
    const interval = setInterval(checkNightMode, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPlaces = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setFrequentPlaces(data.frequentPlaces || []);
        setTravelHistory(data.travelHistory || []);
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => {
    fetchPlaces();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  useEffect(() => {
    if (!isTravelModeOn) {
      setSelectedDest(null);
      setCustomTime('30');
      setNewPlaceName('');
      setLatePromptShown(false);
      setMidJourneyChecked(false);
      setIsMidJourneyCheck(false);
      fetchPlaces();
    }
  }, [isTravelModeOn]);

  const calculateETA = (destLat: number, destLng: number) => {
    if (!currentLoc) return 30;
    const R = 6371;
    const dLat = (destLat - currentLoc.lat) * Math.PI / 180;
    const dLon = (destLng - currentLoc.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(currentLoc.lat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return Math.ceil((dist / 30) * 60);
  };

  const handleStartTravel = () => {
    if (!selectedDest) return;
    const place = frequentPlaces.find(p => p._id === selectedDest);
    if (place) {
      const eta = (currentLoc) ? calculateETA(place.lat, place.lng) : 30;
      startTravelMode(place.name, eta, { lat: place.lat, lng: place.lng });
      return;
    }

    const dest = destinations.find(d => d.id === selectedDest);
    let name = t(dest?.label || 'custom');
    let coords = null;

    if (selectedDest === 'custom') {
      const customNameInput = document.getElementById('onetime-search') as HTMLInputElement;
      if (customNameInput && customNameInput.value) name = customNameInput.value;
      coords = currentLoc;
    }

    const time = selectedDest === 'custom' ? parseInt(customTime) || 30 : (dest?.time || 30);
    startTravelMode(name, time, coords || undefined);
  };

  const handleSafe = async () => {
    const now = new Date();
    if (now > expectedArrivalTime!) {
      await acknowledgeDelay();
      await extendTravelTime(5); // Add 5 mins of buffer as requested
      setLatePromptShown(false); // Reset so it can trigger again after the 5 min buffer passes
    }
    setShowSafetyCheck(false);
  };

  const handleSOS = async () => {
    activateSOS();
    setShowSafetyCheck(false);
    navigate('/');
  };

  useEffect(() => {
    if (!isTravelModeOn || !expectedArrivalTime || isSosActive) return;

    const interval = setInterval(() => {
      const now = new Date();
      if (now > expectedArrivalTime && !showSafetyCheck && !isSosActive && !latePromptShown) {
        setIsMidJourneyCheck(false);
        setShowSafetyCheck(true);
        setLatePromptShown(true); // Flag that we've shown the prompt for this delay period
      }

      if (isNightMode && !midJourneyChecked && !showSafetyCheck && !isSosActive && travelSessions.length > 0) {
        const activeSession = travelSessions[0];
        if (activeSession.status === 'active') {
          const start = new Date(activeSession.startTime).getTime();
          const end = expectedArrivalTime.getTime();
          const totalDuration = end - start;
          const elapsed = now.getTime() - start;
          if (elapsed >= totalDuration / 2 && elapsed < totalDuration) {
            setIsMidJourneyCheck(true);
            setShowSafetyCheck(true);
            setMidJourneyChecked(true);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTravelModeOn, expectedArrivalTime, showSafetyCheck, isSosActive, isNightMode, midJourneyChecked, latePromptShown, travelSessions]);

  const renderHistory = () => (
    <div className="elevated-card p-6">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        {t('travelHistory')}
      </h3>
      <div className="space-y-3">
        {travelHistory && travelHistory.length > 0 ? (
          travelHistory.slice().reverse().slice(0, 5).map((trip: any, idx: number) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
              <div>
                <p className="font-bold text-sm text-foreground">{trip.destination}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-gray-700">Reached: </span>
                  {new Date(trip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' • '}
                  {new Date(trip.endTime).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {trip.status === 'sos' ? (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full uppercase animate-pulse">
                    SOS TRIGGERED
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {trip.status === 'completed' ? t('arrivedSafely') : trip.status}
                  </span>
                )}
                {trip.delayed && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Delayed
                  </span>
                )}
                {trip.status === 'completed' && !trip.delayed && (
                  <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> On Time
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No recent travel history.</p>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container px-4 py-6 max-w-4xl mx-auto">
        {showMapPicker && (
          <LocationPicker
            onSelect={(loc) => {
              const eta = calculateETA(loc.lat, loc.lng);
              if (pickingFor === 'custom') {
                setNewPlaceName(loc.name.split(',')[0]);
                setCurrentLoc({ lat: loc.lat, lng: loc.lng });
                setShowCustomModal(true);
              } else {
                setSelectedDest('custom');
                setCustomTime(eta.toString());
                setNewPlaceName(loc.name);
                setCurrentLoc({ lat: loc.lat, lng: loc.lng });
              }
              setShowMapPicker(false);
            }}
            onClose={() => setShowMapPicker(false)}
          />
        )}

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-1">{t('travelMode')}</h1>
          <p className="text-sm text-muted-foreground">{t('staySafeOnJourney') || 'Stay safe on your journey'}</p>
        </div>

        {!isTravelModeOn ? (
          <div className="space-y-6">
            {isNightMode && (
              <div className="mb-6 p-4 bg-indigo-950 rounded-xl border border-indigo-800 shadow-lg animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-900/50 rounded-full">
                    <Moon className="w-6 h-6 text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{t('nightTravelModeActive')}</h3>
                    <p className="text-indigo-200 text-sm">{t('nightTravelDescription')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="elevated-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Power className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{t('travelModeOff')}</h2>
                    <p className="text-sm text-muted-foreground">{t('selectDestinationToStart')}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-medium text-foreground">{t('selectDestination')}</p>
                  <button onClick={() => {
                    setPickingFor('custom');
                    setShowMapPicker(true);
                  }} className="text-xs text-primary font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {t('addNew')}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {frequentPlaces.map((place) => {
                    const isSelected = selectedDest === place._id;
                    return (
                      <div key={place._id} className="relative group">
                        <button
                          onClick={() => setSelectedDest(place._id)}
                          className={cn(
                            'w-full p-4 rounded-xl border-2 transition-all text-left pr-8',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 bg-card'
                          )}
                        >
                          <MapPin className={cn('w-6 h-6 mb-2', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                          <p className="font-medium text-foreground truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{calculateETA(place.lat, place.lng)} {t('minEta')}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this place?")) {
                              const token = localStorage.getItem('token');
                              fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/delete-place/${place._id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                              }).then(res => res.json()).then(data => setFrequentPlaces(data));
                            }
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => {
                      setSelectedDest('custom');
                      setPickingFor('onetime');
                      setShowMapPicker(true);
                    }}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all text-left',
                      selectedDest === 'custom'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 bg-card'
                    )}
                  >
                    <Clock className={cn('w-6 h-6 mb-2', selectedDest === 'custom' ? 'text-primary' : 'text-muted-foreground')} />
                    <p className="font-medium text-foreground">{t('oneTimeTrip')}</p>
                    <p className="text-xs text-muted-foreground">{t('selectOnMap')}</p>
                  </button>
                </div>
              </div>

              {showCustomModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
                    <h3 className="font-bold text-lg">Add New Destination</h3>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Place Name</label>
                      <input
                        className="w-full input-soft"
                        placeholder="e.g. Gym, Library"
                        value={newPlaceName}
                        onChange={(e) => setNewPlaceName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Location</label>
                      <button
                        onClick={() => {
                          setPickingFor('custom');
                          setShowMapPicker(true);
                        }}
                        className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        {currentLoc ? "Change Location" : "Select on Map"}
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowCustomModal(false)} className="flex-1 py-3 text-sm font-bold text-gray-500">Cancel</button>
                      <button
                        onClick={async () => {
                          if (!newPlaceName || !currentLoc) return;
                          const token = localStorage.getItem('token');
                          try {
                            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/add-place`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({ ...currentLoc, name: newPlaceName, address: 'Custom Destination' })
                            });
                            const updatedPlaces = await res.json();
                            setFrequentPlaces(updatedPlaces);
                            setShowCustomModal(false);
                            setNewPlaceName('');
                          } catch (e) { console.error(e); }
                        }}
                        disabled={!currentLoc || !newPlaceName}
                        className="flex-1 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedDest === 'custom' && (
                <div className="mb-6 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold">Destination</p>
                      <p className="font-bold text-lg truncate max-w-[200px]">{newPlaceName || "Selected on Map"}</p>
                    </div>
                    <button
                      onClick={() => {
                        setPickingFor('onetime');
                        setShowMapPicker(true);
                      }}
                      className="p-2 bg-white border rounded-lg"
                    >
                      <MapPin className="w-5 h-5 text-primary" />
                    </button>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <label className="text-sm font-bold text-blue-900 block mb-1">
                      <Clock className="w-4 h-4 inline mr-2" />
                      {t('estimatedTime')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customTime}
                        readOnly
                        className="w-full bg-transparent p-2 text-3xl font-black text-blue-950 outline-none"
                      />
                      <span className="text-sm font-medium text-blue-700">min</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleStartTravel}
                disabled={!selectedDest}
                className={cn(
                  'w-full py-4 rounded-xl font-semibold text-lg transition-all',
                  selectedDest
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {t('startTravelMode')}
              </button>
            </div>

            {renderHistory()}

            <div className="space-y-4">
              <RiskScoreCard />
              <BatteryCard />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentLoc && (
              <div className="h-[250px] w-full rounded-xl overflow-hidden border border-border shadow-inner">
                <LiveRouteMap currentPos={currentLoc} destinationPos={destinationCoords} />
              </div>
            )}
            <TravelStatusCard />
            {renderHistory()}
            <div className="space-y-4">
              <RiskScoreCard />
              <BatteryCard />
            </div>
          </div>
        )}
      </div>

      <SafetyCheckModal
        isOpen={showSafetyCheck}
        isMidJourney={isMidJourneyCheck}
        onSafe={handleSafe}
        onSOS={handleSOS}
      />
    </Layout>
  );
};

export default Travel;
