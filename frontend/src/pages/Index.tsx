import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Shield, Navigation, MapPin, Bell, Zap, Phone, Clock, UserPlus, CheckCircle, History as ActivityHistory, Volume2, VolumeX, Moon, Mic, MicOff, Battery } from 'lucide-react';
import useVoiceSOS from '@/hooks/useVoiceSOS';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Layout from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

const Index = () => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { triggerFakeCall } = useApp();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [wards, setWards] = useState<any[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const { activateSOS, isSosActive } = useApp();

  // Voice SOS Hook for Dashboard
  useVoiceSOS(voiceEnabled, () => {
    if (!isSosActive) {
      activateSOS();
      toast({
        title: t('voiceProtectionOn'),
        description: t('voiceHelpDescription'),
        variant: "destructive"
      });
    }
  });

  // Fetch Full User Data (including contacts/wards)
  const fetchUserData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUserData(data);

      if (user?.role === 'guardian') {
        fetchWards();
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
    }
  };

  // Fetch Wards for Guardian
  const fetchWards = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/guardian/sos-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWards(data);
    } catch (error) {
      console.error("Failed to fetch SOS status", error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData();

      // Polling for guardians to detect SOS in real-time
      let interval: NodeJS.Timeout;
      if (user?.role === 'guardian') {
        interval = setInterval(fetchWards, 5000); // Check every 5 seconds
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [token, user]);

  // --- SOS AUDIO ALERT LOGIC ---
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const audioRef = useState(() => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
    audio.loop = true;
    return audio;
  })[0];

  useEffect(() => {
    const hasActiveSos = wards.some(ward => ward.sosActive);

    if (hasActiveSos && isAudioEnabled) {
      audioRef.play().catch(err => console.error("Audio playback failed:", err));
    } else {
      audioRef.pause();
      audioRef.currentTime = 0;
    }

    return () => {
      audioRef.pause();
    };
  }, [wards, isAudioEnabled]);


  const handleAcceptInvite = async () => {
    if (!inviteCode) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/guardian/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode })
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: t('success'), description: `${t('protectingUser')} ${data.linkedUser}` });
        setInviteCode('');
        fetchWards();
      } else {
        toast({ variant: "destructive", title: t('failed'), description: data.message });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('somethingWentWrong') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container px-4 py-8 md:py-16">

        {/* Welcome Section */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold mb-2">{t('welcome')}, {user?.name}</h1>
          <p className="text-muted-foreground">{user?.role === 'guardian' ? t('guardianPortal') : t('userDashboard')}</p>
        </div>

        {/* --- EMERGENCY ALERT SECTION (Guardian Only) --- */}
        {user?.role === 'guardian' && wards.some(ward => ward.sosActive) && (
          <div className="mb-12 space-y-4 animate-pulse">
            {wards.filter(ward => ward.sosActive).map((ward) => (
              <Card key={ward._id} className="border-red-500 bg-red-50 shadow-xl">
                <div className="bg-red-600 px-6 py-3 rounded-t-xl flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Bell className="w-6 h-6 animate-bounce" />
                    <h2 className="text-xl font-black uppercase tracking-widest">{t('emergencyActive')}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all",
                        isAudioEnabled ? "bg-white text-red-600" : "bg-red-700 text-white border border-red-400"
                      )}
                    >
                      {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      {isAudioEnabled ? t('soundOn') : t('soundOff')}
                    </button>
                    <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">{t('sosActive')}</span>
                  </div>
                </div>
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h3 className="text-3xl font-bold text-red-700">{ward.name} {t('isDanger')}</h3>
                      <p className="text-lg text-red-600 font-medium tracking-tight">{t('immediateAssistance')}</p>

                      {ward.currentSOSAudioFile && (
                        <div className="mt-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center gap-4 border border-red-200 animate-pulse max-w-md shadow-inner">
                          <Volume2 className="w-6 h-6 text-red-600" />
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1 opacity-80">{t('liveEnvAudio')}</p>
                            <audio
                              controls
                              className="h-8 w-full filter brightness-90 saturate-150"
                              src={`${import.meta.env.VITE_API_BASE_URL}/uploads/audio/${ward.currentSOSAudioFile}`}
                            />
                          </div>
                        </div>
                      )}

                      {ward.lastLocation && (
                        <p className="text-sm text-gray-500 mt-2">
                          {t('lastUpdate')}: {new Date(ward.lastLocation.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                      <a
                        href={`https://wa.me/${ward.phone?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-green-500/50"
                      >
                        <Zap className="w-6 h-6" />
                        {t('whatsappCall')}
                      </a>
                      {ward.lastLocation && (
                        <a
                          href={`https://www.google.com/maps?q=${ward.lastLocation.lat},${ward.lastLocation.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border-2 border-red-200 hover:border-red-400 text-red-600 px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-md"
                        >
                          <MapPin className="w-6 h-6" />
                          {t('liveLocationLabel')}
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* --- GIRL DASHBOARD --- */}
        {user?.role === 'girl' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 items-start">
            {/* Emergency Contacts / Invite Codes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  {t('myGuardiansInvites')}
                </CardTitle>
                <CardDescription>
                  {t('shareInviteCodes')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userData?.emergencyContacts?.length > 0 ? (
                  userData.emergencyContacts.map((contact: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                      <div className="text-right">
                        {contact.status === 'active' ? (
                          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> {t('linked')}
                          </span>
                        ) : (
                          <div className="bg-white px-2 py-1 border rounded text-sm font-mono tracking-wider">
                            {t('code')}: <span className="font-bold text-primary">{contact.inviteCode}</span>
                          </div>
                        )}
                        <p className="text-[10px] uppercase text-muted-foreground mt-1">
                          {contact.status === 'active' ? t('active') : contact.status === 'pending' ? t('pending') : contact.status}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noUsersLinked')}</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="space-y-4">
              <Link to="/travel" className="block w-full">
                <Button className="w-full h-16 text-lg" size="lg">
                  <Navigation className="mr-2 w-6 h-6" /> {t('startTravelMode')}
                </Button>
              </Link>
              <Link to="/safe-zones" className="block w-full">
                <Button className="w-full h-16 text-lg bg-accent text-accent-foreground hover:bg-accent/90 border-none shadow-md shadow-accent/20" size="lg">
                  <Shield className="mr-2 w-6 h-6" /> {t('viewSafeZones')}
                </Button>
              </Link>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={triggerFakeCall}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all h-24"
                >
                  <Phone className="w-7 h-7" />
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-70">Security</p>
                    <p className="text-lg font-bold">{t('fakeCall') || 'Fake Call'}</p>
                  </div>
                </button>

                {/* Voice Protection Toggle Quick Action */}
                <button
                  onClick={() => {
                    setVoiceEnabled(!voiceEnabled);
                    toast({
                      title: !voiceEnabled ? t('voiceProtectionOn') : t('voiceProtectionOff'),
                      description: !voiceEnabled ? t('voiceHelpDescription') : t('voiceDisabledDescription'),
                    });
                  }}
                  className={cn(
                    "flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all h-24",
                    voiceEnabled
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg animate-pulse-subtle"
                      : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                  )}
                >
                  {voiceEnabled ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7 opacity-50" />}
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-70">Voice SOS</p>
                    <p className="text-lg font-bold">{voiceEnabled ? t('active').toUpperCase() : t('enable') || 'ENABLE'}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- SOS HISTORY (FULL WIDTH) --- */}
        {user?.role === 'girl' && (
          <div className="mb-16">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ActivityHistory className="w-5 h-5 text-primary" />
                  {t('mySOSHistory')}
                </CardTitle>
                <CardDescription>{t('compHistoryDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {userData?.sosHistory?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userData.sosHistory.slice().reverse().map((item: any, i: number) => (
                      <div key={i} className="p-4 border rounded-2xl bg-gray-50/50 space-y-3 hover:border-primary/30 transition-all hover:bg-white hover:shadow-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{new Date(item.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p className="text-xs text-muted-foreground font-medium mt-1">
                              {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {" → "}
                              {new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-wider">
                            {item.duration === 'UNKNOWN' ? t('unknown') : item.duration}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          {item.startLocation && (
                            <a
                              href={`https://www.google.com/maps?q=${item.startLocation.lat},${item.startLocation.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary font-bold hover:underline flex items-center gap-1.5"
                            >
                              <MapPin className="w-4 h-4" /> {t('viewStartLocation')}
                            </a>
                          )}
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recorded</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground bg-gray-50/50 rounded-2xl border border-dashed">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">{t('noEmergencyHistory')}</p>
                    <p className="text-sm opacity-70">{t('historyEmptyDesc') || 'Your emergency history will appear here once an SOS is triggered.'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- GUARDIAN DASHBOARD --- */}
        {user?.role === 'guardian' && (
          <div className="grid grid-cols-1 gap-8 mb-16 max-w-4xl mx-auto">
            {/* My Wards */}
            <Card>
              <CardHeader>
                <CardTitle>{t('myWards')}</CardTitle>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter transition-all",
                      isAudioEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {isAudioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    {isAudioEnabled ? t('soundEnabled') : t('enableSosSound')}
                  </button>
                  <CardDescription>{t('usersProtecting')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {wards.length > 0 ? (
                  <div className="space-y-2">
                    {wards.map((ward, i) => (
                      <div key={i} className={cn(
                        "p-6 rounded-2xl space-y-6 border transition-all duration-500 shadow-sm",
                        ward.travelMode?.isActive
                          ? "bg-blue-50/50 border-blue-400 shadow-xl shadow-blue-100 animate-pulse-subtle bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(59,130,246,0.03)_20px,rgba(59,130,246,0.03)_40px)]"
                          : "bg-secondary/10 border-secondary/20 hover:border-primary/30"
                      )}>
                        {ward.travelMode?.isActive && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                            </span>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t('liveTravelModeActive')}</span>
                            {ward.travelMode?.isNightMode && (
                              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-950 text-yellow-300 text-[10px] font-black uppercase rounded-full border border-indigo-700 ml-auto">
                                <Moon className="w-3 h-3" /> {t('night')}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shadow-inner border border-primary/10">
                              {ward.name[0]}
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-xl flex items-center gap-3 text-gray-900 tracking-tight">
                                {ward.name}
                                {ward.sosActive && (
                                  <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse outline outline-offset-2 outline-red-400"></span>
                                )}
                                {(ward.batteryLevel || 100) <= 20 && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded border border-red-200 animate-pulse">
                                    <Battery className="w-2 h-2" /> Low Bat: {ward.batteryLevel}%
                                  </span>
                                )}
                              </p>
                              <p className="text-sm font-medium text-muted-foreground">{ward.email}</p>
                            </div>
                          </div>
                          <Link to="/safe-zones" className="ml-auto">
                            <Button size="lg" className="px-8 font-bold shadow-lg shadow-primary/20">{t('track')}</Button>
                          </Link>
                        </div>

                        {/* Travel Status for Guardian View */}
                        {ward.travelMode?.isActive && (
                          <div className={cn(
                            "mt-3 p-3 border rounded-lg animate-in fade-in slide-in-from-top-2",
                            (new Date() > new Date(ward.travelMode.expectedArrivalTime) && !ward.travelMode.delayAcknowledged)
                              ? "bg-red-50 border-red-200"
                              : "bg-blue-50 border-blue-200"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className={cn(
                                "flex items-center gap-2 font-bold",
                                (new Date() > new Date(ward.travelMode.expectedArrivalTime) && !ward.travelMode.delayAcknowledged) ? "text-red-700" : "text-blue-700"
                              )}>
                                <Navigation className="w-4 h-4 animate-pulse" />
                                <span>{(new Date() > new Date(ward.travelMode.expectedArrivalTime) && !ward.travelMode.delayAcknowledged) ? t('userDelayed') : t('userTravelling')}</span>
                              </div>
                              {new Date() > new Date(ward.travelMode.expectedArrivalTime) && !ward.travelMode.delayAcknowledged && (
                                <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] uppercase font-black rounded-full animate-bounce">
                                  {t('late')}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              "flex items-center gap-2 mt-1 pl-6 text-sm font-medium",
                              (new Date() > new Date(ward.travelMode.expectedArrivalTime) && !ward.travelMode.delayAcknowledged) ? "text-red-600" : "text-blue-600"
                            )}>
                              <Clock className="w-3 h-3" />
                              <span>{t('expectedArrival')}: {ward.travelMode.expectedArrivalTime ? format(new Date(ward.travelMode.expectedArrivalTime), 'h:mm a') : t('calculating')}</span>
                            </div>
                          </div>
                        )}

                        {/* SOS History for Guardian View */}
                        {ward.sosHistory?.length > 0 && (
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <ActivityHistory className="w-3 h-3" /> {t('recentActivity')}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ward.sosHistory.slice().reverse().map((history: any, hIdx: number) => (
                                <div key={hIdx} className="p-4 border rounded-2xl bg-gray-50/50 space-y-3 hover:border-primary/30 transition-all hover:bg-white hover:shadow-md">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-[12px] font-bold text-gray-900">{new Date(history.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                      <p className="text-[10px] text-muted-foreground font-medium mt-1">
                                        {new Date(history.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {" → "}
                                        {new Date(history.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-wider">
                                      {history.duration}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                    {history.startLocation && (
                                      <a
                                        href={`https://www.google.com/maps?q=${history.startLocation.lat},${history.startLocation.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                                      >
                                        <MapPin className="w-3 h-3" /> {t('viewStartLocation')}
                                      </a>
                                    )}
                                    {history.audioFile && (
                                      <button
                                        onClick={() => {
                                          const audio = new Audio(`${import.meta.env.VITE_API_BASE_URL}/uploads/audio/${history.audioFile}`);
                                          audio.play().catch(e => console.error("History audio play failed", e));
                                        }}
                                        className="p-1 px-2 bg-primary/10 rounded-full text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 text-[9px] font-black uppercase italic"
                                        title="Play Recording"
                                      >
                                        <Volume2 className="w-3 h-3" /> {t('audio')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>{t('noUsersLinked')}</p>
                    <p className="text-sm">{t('enterInviteToStart')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
