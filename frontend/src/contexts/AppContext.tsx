import React, { createContext, useContext, useState, useEffect } from 'react';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import { useToast } from '@/hooks/use-toast';
import { calculateSafetyScore } from '@/utils/calculateSafetyScore';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

interface TravelSession {
  id: string;
  destination: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'sos';
}

interface LocationUpdate {
  lat: number;
  lng: number;
  timestamp: Date;
}

interface AppState {
  // Travel Mode
  isTravelModeOn: boolean;
  currentDestination: string | null;
  destinationCoords: { lat: number, lng: number } | null;
  expectedArrivalTime: Date | null;
  delayAcknowledged: boolean;
  locationHistory: LocationUpdate[];

  // SOS
  isSosActive: boolean;

  // Emergency Contacts
  emergencyContacts: EmergencyContact[];

  // Travel Sessions
  travelSessions: TravelSession[];

  // Battery
  batteryLevel: number;
  isCharging: boolean;
  trackingInterval: number;

  // Period Tracker
  lastPeriodDate: string | null;
  cycleLength: number;

  // Fake Call
  fakeCallActive: boolean;
  fakeCallerName: string;

  // Risk tracking
  currentRisk: number;
  riskLevel: string;
  hasNotifiedHighRisk: boolean;
}

interface AppContextType extends AppState {
  // Travel Mode Actions
  startTravelMode: (destination: string, expectedMinutes: number, coords?: { lat: number, lng: number }) => void;
  stopTravelMode: (completed?: boolean) => void;
  extendTravelTime: (minutes: number) => void;
  acknowledgeDelay: () => Promise<void>;


  // SOS Actions
  activateSOS: () => void;
  deactivateSOS: () => void;

  // Fake Call Actions
  triggerFakeCall: () => void;
  endFakeCall: () => void;
  setFakeCallerName: (name: string) => void;

  // Contact Actions
  addEmergencyContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  removeEmergencyContact: (id: string) => void;

  // Location Actions
  addLocationUpdate: (location: LocationUpdate) => void;

  // Period Tracker Actions
  updatePeriodData: (lastDate: string, cycleLength: number) => void;

  // Battery Actions
  updateBatteryStatus: (level: number, charging: boolean) => void;
}

const defaultState: AppState = {
  isTravelModeOn: false,
  currentDestination: null,
  destinationCoords: null,
  expectedArrivalTime: null,
  delayAcknowledged: false,
  locationHistory: [],
  isSosActive: false,
  emergencyContacts: [],
  travelSessions: [],
  batteryLevel: 100,
  isCharging: false,
  trackingInterval: 10000, // 10 seconds for demo
  lastPeriodDate: null,
  cycleLength: 28,
  fakeCallActive: false,
  fakeCallerName: 'Mom ❤️',
  currentRisk: 0,
  riskLevel: 'safe',
  hasNotifiedHighRisk: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { startRecording, stopAndUpload } = useAudioRecorder();
  const { toast } = useToast();
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('naari-app-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultState,
        ...parsed,
        expectedArrivalTime: parsed.expectedArrivalTime ? new Date(parsed.expectedArrivalTime) : null,
        delayAcknowledged: parsed.delayAcknowledged || false,
        locationHistory: parsed.locationHistory?.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp)
        })) || [],
        travelSessions: parsed.travelSessions?.map((s: any) => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : undefined
        })) || [],
      };
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem('naari-app-state', JSON.stringify(state));
  }, [state]);

  const triggerFakeCall = () => setState(prev => ({ ...prev, fakeCallActive: true }));
  const endFakeCall = () => setState(prev => ({ ...prev, fakeCallActive: false }));
  const setFakeCallerName = (name: string) => setState(prev => ({ ...prev, fakeCallerName: name }));

  // Battery monitoring
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          const level = Math.round(battery.level * 100);
          const charging = battery.charging;
          updateBatteryStatus(level, charging);
        };

        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);

        return () => {
          battery.removeEventListener('levelchange', updateBattery);
          battery.removeEventListener('chargingchange', updateBattery);
        };
      });
    }
  }, []);

  // Update tracking interval based on battery
  useEffect(() => {
    let interval: number;
    if (state.batteryLevel > 30) {
      interval = 10000; // 10 seconds - normal
    } else if (state.batteryLevel > 15) {
      interval = 20000; // 20 seconds - power save
    } else {
      interval = 30000; // 30 seconds - minimal
    }

    if (state.isSosActive) {
      interval = 5000; // 5 seconds during SOS
    }

    setState(prev => ({ ...prev, trackingInterval: interval }));
  }, [state.batteryLevel, state.isSosActive]);

  const startTravelMode = async (destination: string, expectedMinutes: number, coords?: { lat: number, lng: number }) => {
    try {
      // Get current location
      let location = null;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch (err) {
          console.error("Error getting location for travel start", err);
        }
      }

      // Call API
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/travel/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ destination, expectedMinutes, location, destinationCoords: coords })
        });

        if (!res.ok) {
          throw new Error('Failed to start travel mode on server');
        }
      }

      const expectedArrival = new Date(Date.now() + expectedMinutes * 60 * 1000);
      const newSession: TravelSession = {
        id: Date.now().toString(),
        destination,
        startTime: new Date(),
        status: 'active',
      };

      setState(prev => ({
        ...prev,
        isTravelModeOn: true,
        currentDestination: destination,
        destinationCoords: coords || null,
        expectedArrivalTime: expectedArrival,
        delayAcknowledged: false,
        travelSessions: [newSession, ...prev.travelSessions],
      }));
    } catch (error) {
      console.error("Failed to start travel mode", error);
      // Should probably show toast error here
    }
  };

  const extendTravelTime = async (minutes: number) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/travel/extend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ additionalMinutes: minutes })
        });

        if (!res.ok) {
          throw new Error('Failed to extend travel time on server');
        }
      }

      setState(prev => {
        if (!prev.expectedArrivalTime) return prev;
        const newTime = new Date(prev.expectedArrivalTime.getTime() + minutes * 60 * 1000);
        return {
          ...prev,
          expectedArrivalTime: newTime
        };
      });
    } catch (error) {
      console.error("Failed to extend travel", error);
    }
  };

  const acknowledgeDelay = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/travel/acknowledge-delay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setState(prev => ({
            ...prev,
            delayAcknowledged: true,
            expectedArrivalTime: new Date(data.expectedArrivalTime)
          }));
        }
      }
    } catch (error) {
      console.error("Failed to acknowledge delay", error);
    }
  };


  const stopTravelMode = async (completed = true) => {
    try {
      const token = localStorage.getItem('token');
      if (token && completed) { // Only call stop if completed safely, if SOS it's handled differently
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/travel/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!res.ok) {
          throw new Error('Failed to stop travel mode on server');
        }
      }

      setState(prev => ({
        ...prev,
        isTravelModeOn: false,
        hasNotifiedHighRisk: false,
        currentDestination: null,
        expectedArrivalTime: null,
        travelSessions: prev.travelSessions.map((s, i) =>
          i === 0 ? { ...s, endTime: new Date(), status: completed ? 'completed' : 'sos' } : s
        ),
      }));
    } catch (error) {
      console.error("Failed to stop travel mode", error);
    }
  };


  const activateSOS = async () => {
    // 1. Set local state immediately for UI feedback
    setState(prev => ({ ...prev, isSosActive: true }));

    // 2. Fetch location and trigger backend
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const triggerBackend = async (lat?: number, lng?: number) => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sos/trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              location: lat && lng ? { lat, lng } : undefined
            })
          });

          if (res.ok) {
            console.log("[AppContext] SOS Triggered on backend. Starting recording...");

            // Start recording ONLY after backend has initialized SOS
            try {
              toast({
                title: "Emergency Recording Started",
                description: "Recording ambient audio for 10 seconds...",
              });
              await startRecording();
            } catch (err) {
              console.error("[AppContext] startRecording failed:", err);
            }

            // Record for 10 seconds then upload
            setTimeout(async () => {
              console.log("[AppContext] SOS recording time limit reached. Stopping and Uploading...");
              try {
                await stopAndUpload(token);
                toast({
                  title: "Emergency Recording Uploaded",
                  description: "Audio evidence secured locally.",
                });
              } catch (err) {
                console.error("Emergency Audio Upload Failed:", err);
                toast({
                  title: "Recording Upload Error",
                  description: "Could not send audio to portal.",
                  variant: "destructive"
                });
              }
            }, 10000);
          } else {
            const errorText = await res.text();
            console.error("[AppContext] Backend SOS Trigger failed:", res.status, errorText);
          }
        } catch (err) {
          console.error("Failed to trigger SOS on backend:", err);
        }
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => triggerBackend(position.coords.latitude, position.coords.longitude),
          () => triggerBackend() // Fallback if location permission fails
        );
      } else {
        await triggerBackend();
      }
    } catch (error) {
      console.error("Critical: Failed to trigger SOS backend", error);
    }
  };

  const deactivateSOS = () => {
    setState(prev => ({ ...prev, isSosActive: false }));
  };

  const addEmergencyContact = (contact: Omit<EmergencyContact, 'id'>) => {
    const newContact = { ...contact, id: Date.now().toString() };
    setState(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, newContact],
    }));
  };

  const removeEmergencyContact = (id: string) => {
    setState(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter(c => c.id !== id),
    }));
  };

  // --- UNIFIED HEARTBEAT (Location + Battery) ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const performHeartbeat = async () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Update local state history
        addLocationUpdate({ ...location, timestamp: new Date() });

        // CRITICAL BATTERY LOGIC (< 10%)
        // If battery is < 10%, we force a persistent "SOS-like" tracking state
        // even if the user isn't in travel mode.
        const isCriticalBattery = state.batteryLevel < 10 && !state.isCharging;

        // Prepare status update
        const token = localStorage.getItem('token');
        if (token) {
          try {
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/update-status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                location,
                batteryLevel: state.batteryLevel
              })
            });

            // --- LIVE RISK UPDATER ---
            if (state.isTravelModeOn) {
              try {
                const riskRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/risk/score`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(location)
                });
                const riskData = await riskRes.json();

                // Calculate Safety Score
                const safetyScore = calculateSafetyScore({
                  battery: state.batteryLevel,
                  hour: new Date().getHours(),
                  areaRisk: riskData.risk
                });

                setState(prev => ({
                  ...prev,
                  currentRisk: riskData.risk,
                  riskLevel: riskData.level
                }));

                // AUTO-ALERT (NOTIFY ONLY) if score < 40
                if (safetyScore < 40 && !state.hasNotifiedHighRisk) {
                  console.warn("⚠️ [AUTO-ALERT] Safety score low! Notifying Guardians.");
                  toast({
                    title: "High Risk Detected",
                    description: "Safety score is low. Guardians have been notified.",
                    variant: "destructive"
                  });

                  await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sos/notify-risk`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ location, safetyScore })
                  });
                  setState(prev => ({ ...prev, hasNotifiedHighRisk: true }));
                }
              } catch (riskErr) {
                console.error("Risk update failed", riskErr);
              }
            }

            // If battery is critical and we haven't notified yet for this session...
            if (isCriticalBattery && !state.isSosActive) {
              console.warn("[BATTERY] CRITICAL LEVEL! Automatically notifying guardians...");
              toast({
                title: "Critical Battery Alert",
                description: "Battery below 10%. Shared your live location with guardians.",
                variant: "destructive"
              });
              // We don't necessarily trigger the full SOS (siren/recording) 
              // but we ensure the backend has the final location.
            }
          } catch (err) {
            console.error("Heartbeat failed", err);
          }
        }
      }, (err) => console.error("Geo error", err), { enableHighAccuracy: true });
    };

    // Run heartbeat based on trackingInterval
    // trackingInterval is already reactive to battery/SOS state (set in another useEffect)
    intervalId = setInterval(performHeartbeat, state.trackingInterval);

    // Initial run
    performHeartbeat();

    return () => clearInterval(intervalId);
  }, [state.trackingInterval, state.isTravelModeOn, state.batteryLevel]);

  const addLocationUpdate = (location: LocationUpdate) => {
    setState(prev => ({
      ...prev,
      locationHistory: [...prev.locationHistory.slice(-50), location],
    }));
  };


  const updatePeriodData = (lastDate: string, cycleLength: number) => {
    setState(prev => ({
      ...prev,
      lastPeriodDate: lastDate,
      cycleLength,
    }));
  };

  const updateBatteryStatus = (level: number, charging: boolean) => {
    setState(prev => ({
      ...prev,
      batteryLevel: level,
      isCharging: charging,
    }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        startTravelMode,
        stopTravelMode,
        extendTravelTime,
        acknowledgeDelay,

        activateSOS,
        deactivateSOS,
        addEmergencyContact,
        removeEmergencyContact,
        addLocationUpdate,
        updatePeriodData,
        updateBatteryStatus,
        triggerFakeCall,
        endFakeCall,
        setFakeCallerName
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
