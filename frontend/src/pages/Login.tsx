import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [role, setRole] = useState<'girl' | 'guardian'>('girl');

    const { login } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = role === 'guardian'
                ? { accessCode, role }
                : { email, password, role };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                login(data);
                toast({
                    title: "Login Successful",
                    description: "Welcome back!",
                });
                navigate('/');
            } else {
                toast({
                    variant: "destructive",
                    title: "Login Failed",
                    description: data.message || "Invalid credentials",
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-center text-primary mb-2">NaariSecure</h1>
                    <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
                    <CardDescription className="text-center">
                        Access your safety dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center mb-6">
                        <div className="bg-muted p-1 rounded-lg inline-flex">
                            <button
                                onClick={() => setRole('girl')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${role === 'girl'
                                        ? 'bg-white text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Girl / User
                            </button>
                            <button
                                onClick={() => setRole('guardian')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${role === 'guardian'
                                        ? 'bg-white text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Guardian
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {role === 'girl' ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="accessCode">Access Code</Label>
                                <Input
                                    id="accessCode"
                                    type="text"
                                    placeholder="Enter 6-digit code"
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="text-center text-2xl tracking-widest font-mono"
                                    maxLength={6}
                                    required
                                />
                                <p className="text-xs text-muted-foreground text-center">
                                    Check your invitation for the code.
                                </p>
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Logging in..." : "Login"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 text-sm text-center">
                    <div className="text-gray-500">
                        Don't have an account?{" "}
                        <Link to="/signup" className="font-medium text-primary hover:underline">
                            Sign up (Girls only)
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Login;
