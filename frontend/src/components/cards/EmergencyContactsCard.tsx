import { useState, useEffect } from 'react';
import { Phone, Users, CheckCircle, Plus, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

const EmergencyContactsCard = () => {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    relation: 'Friend'
  });

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.emergencyContacts) {
        setContacts(data.emergencyContacts);
      }
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    }
  };

  useEffect(() => {
    if (token) fetchContacts();
  }, [token]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/add-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const updatedContacts = await res.json();
        setContacts(updatedContacts);
        setShowAddModal(false);
        setFormData({ name: '', email: '', phone: '', relation: 'Friend' });
        toast({
          title: "Contact Added",
          description: "Guardian invite has been sent via email.",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.message || "Failed to add contact",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not reach the server.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="elevated-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t('emergencyContacts')}</h3>
            <p className="text-xs text-muted-foreground">{contacts.length}/5 contacts</p>
          </div>
        </div>

        {contacts.length < 5 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-primary rounded-xl text-white shadow-lg hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No emergency contacts added yet
          </p>
        ) : (
          contacts.map((contact, index) => (
            <div
              key={index}
              className="p-3 bg-muted/30 rounded-xl border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-xs font-medium text-secondary-foreground">
                      {contact.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                </div>
                {contact.status === 'active' ? (
                  <span className="text-green-600 text-[10px] font-bold flex items-center gap-1 bg-green-100 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> LINKED
                  </span>
                ) : (
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-widest leading-none">Pending</span>
                    <span className="text-[9px] text-primary block mt-1">Verification sent</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                <a
                  href={`tel:${contact.phone}`}
                  className="p-2 rounded-lg bg-safe/10 hover:bg-safe/20 text-safe transition-colors flex items-center gap-2 text-xs font-medium"
                >
                  <Phone className="w-3 h-3" /> Call
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add Guardian</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Full Name</label>
                <input
                  required
                  className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Papa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Email (for invite)</label>
                <input
                  required
                  type="email"
                  className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="guardian@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Phone Number</label>
                <input
                  required
                  type="tel"
                  className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all mt-4"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Add & Send Invite</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyContactsCard;
