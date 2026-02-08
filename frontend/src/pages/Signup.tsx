import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Role is fixed to 'girl' now
    const role = 'girl';

    // Emergency Contacts State (Name, Phone, Relation, Email)
    const [contacts, setContacts] = useState([{ name: '', phone: '', relation: '', email: '' }]);

    const { signup } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Handle Contact Change
    const handleContactChange = (index: number, field: string, value: string) => {
        const newContacts = [...contacts];
        newContacts[index][field as keyof typeof newContacts[0]] = value;
        setContacts(newContacts);
    };

    // Add Contact
    const addContact = () => {
        if (contacts.length < 5) {
            setContacts([...contacts, { name: '', phone: '', relation: '', email: '' }]);
        }
    };

    // Frequent Places State
    const [frequentPlaces, setFrequentPlaces] = useState<{ name: string, lat: number, lng: number, address?: string }[]>([]);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [tempLocation, setTempLocation] = useState<{ lat: number, lng: number } | null>(null);

    const getCurrentLocation = () => {
        setIsLocating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setTempLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setIsLocating(false);
                    toast({ title: "Location Found", description: "Location captured successfully." });
                },
                (err) => {
                    toast({ variant: "destructive", title: "Error", description: "Failed to get location." });
                    setIsLocating(false);
                }
            );
        }
    };

    const addFrequentPlace = () => {
        if (newPlaceName && tempLocation) {
            setFrequentPlaces([...frequentPlaces, { ...tempLocation, name: newPlaceName }]);
            setNewPlaceName('');
            setTempLocation(null);
        }
    };

    const removeFrequentPlace = (idx: number) => {
        setFrequentPlaces(frequentPlaces.filter((_, i) => i !== idx));
    };

    // Remove Contact
    const removeContact = (index: number) => {
        const newContacts = contacts.filter((_, i) => i !== index);
        setContacts(newContacts);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validation for contacts
            if (contacts.length === 0) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "At least one emergency contact is required.",
                });
                setLoading(false);
                return;
            }
            const isValid = contacts.every(c => c.name.trim() !== '' && c.phone.trim() !== '' && c.relation.trim() !== '' && c.email.trim() !== '');
            if (!isValid) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please fill in all contact details (Name, Phone, Relation, Email).",
                });
                setLoading(false);
                return;
            }

            const payload = {
                name,
                email,
                password,
                emergencyContacts: contacts,
                frequentPlaces
            };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                signup(data);
                toast({
                    title: "Account Created",
                    description: "Welcome to Naari Guardian! Invites sent to contacts.",
                });

                // Show Invite Link in Toast for Demo (real world would be email)
                if (data.inviteLink) {
                    console.log("INVITE LINK:", data.inviteLink);
                    toast({
                        title: "Demo Invite Link Generated",
                        description: "Check console for invite link to simulate guardian acceptance.",
                        duration: 10000
                    });
                }

                navigate('/');
            } else {
                toast({
                    variant: "destructive",
                    title: "Signup Failed",
                    description: data.message || "Failed to create account",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Something went wrong. Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
            <Card className="w-full max-w-5xl shadow-xl">
                <CardHeader className="text-center border-b bg-muted/20">
                    <h1 className="text-3xl font-extrabold text-primary mb-1">NaariSecure</h1>
                    <CardTitle>Create Account for Girls</CardTitle>
                    <CardDescription>
                        Sign up and add your guardians instantly
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                        {/* Left Column: Personal Info */}
                        <div className="p-6 space-y-4">
                            <div className="mb-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                                    Your Details
                                </h3>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="Enter your name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-8 hidden md:block">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Already have an account?
                                </p>
                                <Link to="/login">
                                    <Button variant="outline" type="button" className="w-full">
                                        Login Instead
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Right Column: Guardians */}
                        <div className="p-6 bg-gray-50/50 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                                    Add Guardians (Max 5)
                                </h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addContact}
                                    disabled={contacts.length >= 5}
                                >
                                    + Add
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {contacts.map((contact, index) => (
                                    <div key={index} className="p-3 bg-white rounded-lg border shadow-sm relative group">
                                        {contacts.length > 1 && (
                                            <button
                                                type="button"
                                                className="absolute right-2 top-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                onClick={() => removeContact(index)}
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <div className="grid gap-3">
                                            <Input
                                                placeholder="Guardian Name"
                                                value={contact.name}
                                                onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                                                required
                                                className="bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Input
                                                        placeholder="Relation (e.g. Mom)"
                                                        value={contact.relation}
                                                        onChange={(e) => handleContactChange(index, 'relation', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Input
                                                        placeholder="Phone"
                                                        value={contact.phone}
                                                        onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Input
                                                    type="email"
                                                    placeholder="Email (for invite)"
                                                    value={contact.email}
                                                    onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Frequents Places Section */}
                            <div className="pt-4 border-t mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                                        Frequent Places (Max 3)
                                    </h3>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">Add places like Home, College, etc. for quick travel mode.</p>

                                <div className="space-y-3">
                                    {frequentPlaces.map((place, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white border rounded text-sm">
                                            <div>
                                                <span className="font-bold">{place.name}</span>
                                                <p className="text-xs text-muted-foreground truncate max-w-[150px]">{place.address || 'Lat: ' + place.lat.toFixed(4)}</p>
                                            </div>
                                            <button type="button" onClick={() => removeFrequentPlace(idx)} className="text-red-500 text-xs hover:underline">Remove</button>
                                        </div>
                                    ))}

                                    {frequentPlaces.length < 3 && (
                                        <div className="flex gap-2">
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    placeholder="Place Name (e.g. Home)"
                                                    value={newPlaceName}
                                                    onChange={(e) => setNewPlaceName(e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={isLocating} className="flex-1 text-xs">
                                                        {isLocating ? "Locating..." : "Use Current Loc"}
                                                    </Button>
                                                    {/* Placeholder for Search - for now simple input or we can rely on current loc for MVP speed */}
                                                </div>
                                            </div>
                                            <Button type="button" size="sm" onClick={addFrequentPlace} disabled={!newPlaceName || !tempLocation}>
                                                Add
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 p-6 border-t bg-gray-50/30">
                    <Button onClick={handleSubmit} className="w-full text-lg h-12" disabled={loading}>
                        {loading ? "Creating Account..." : "Create Account & Send Invites"}
                    </Button>
                    <div className="md:hidden text-center text-sm text-muted-foreground">
                        Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Signup;
