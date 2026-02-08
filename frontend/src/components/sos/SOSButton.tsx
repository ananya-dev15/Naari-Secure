import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';


const SOSButton = () => {
  const { isSosActive, activateSOS, deactivateSOS } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);



  // If user is not a 'girl', don't show the SOS button at all
  if (user?.role !== 'girl') {
    return null;
  }

  const handleSOSClick = () => {
    if (isSosActive) {
      // Confirm before deactivation? Or just deactivate?
      // Usually safer to ask confirmation to cancel too, but for speed just deactivate implies "I'm safe"
      cancelSOS();
    } else {
      setShowConfirm(true);
    }
  };

  const cancelSOS = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sos/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      deactivateSOS();
    } catch (error) {
      console.error("Failed to cancel SOS", error);
      alert("Failed to cancel SOS. Please try again.");
    }
  };

  const confirmSOS = async () => {
    setLoading(true);
    try {
      await activateSOS();
      console.log("SOS Button: Unified activateSOS called.");
    } catch (error) {
      console.error("SOS Button Error", error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const triggerWithoutLocation = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log("[SOS TRIGGER] Dispatching request (NO LOCATION) with token...");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sos/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log("[SOS TRIGGER NO LOC] Server Response:", response.status, data);

      if (response.ok) {
        activateSOS();
        console.log("SOS Triggered Successfully (No Location)");
      } else {
        alert(`Failed to trigger SOS: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to trigger SOS", error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      {/* SOS Active Banner */}
      {isSosActive && (
        <div className="fixed top-0 md:top-16 left-0 right-0 z-[100] bg-red-600 text-white py-4 px-4 flex flex-col md:flex-row items-center justify-center gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 fill-white text-red-600" />
            <span className="font-bold text-lg">SOS ACTIVE - HELP ON THE WAY</span>
          </div>
          <button
            onClick={cancelSOS}
            className="mt-2 md:mt-0 px-6 py-2 bg-white text-red-600 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
          >
            I AM SAFE - CANCEL SOS
          </button>
        </div>
      )}

      {/* Floating SOS Button */}
      <button
        onClick={handleSOSClick}
        className={cn(
          'fixed bottom-24 md:bottom-8 right-4 z-50 w-16 h-16 md:w-20 md:h-20 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105',
          isSosActive ? 'bg-gray-800 hover:bg-gray-900 animate-none' : 'bg-red-600 hover:bg-red-700'
        )}
      >
        {isSosActive ? (
          <X className="w-8 h-8 md:w-10 md:h-10 text-white" />
        ) : (
          <div className="relative flex items-center justify-center w-full h-full">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
            <span className="text-white font-bold text-lg md:text-xl relative z-10">SOS</span>
          </div>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-50 duration-200">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center animate-bounce">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Emergency Alert?
              </h3>
              <p className="text-gray-600 mb-8">
                This will immediately alert your guardians and police with your live location.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmSOS}
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-red-600 text-white font-bold text-lg shadow-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Sending Alert...</span>
                  ) : (
                    <>
                      <Phone className="w-5 h-5" />
                      TRIGGER SOS
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SOSButton;
