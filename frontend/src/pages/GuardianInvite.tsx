import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const GuardianInvite = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Verifying your invitation...');

    useEffect(() => {
        const acceptInvite = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Invalid Invite Link');
                return;
            }

            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/accept-invite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });

                if (res.ok) {
                    setStatus('success');
                    setMessage('Your code is now active.');
                } else {
                    setStatus('error');
                    setMessage('Failed to activate code. It may be invalid or already used.');
                }
            } catch (error) {
                setStatus('error');
                setMessage('Server connection failed.');
            }
        };

        acceptInvite();
    }, [token]);


    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Guardian Activation</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-center">
                    {status === 'verifying' && (
                        <div className="py-8">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Activating your access code...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className="p-4 bg-green-50 rounded-lg text-green-800 border border-green-100">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-600" />
                                <h3 className="text-lg font-bold">Account Activated!</h3>
                                <p className="text-sm mt-1">
                                    You have successfully linked with the user.
                                </p>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Please check your email for your <strong>Access Code</strong> if you haven't already.
                            </p>

                            <Link to="/login" className="block w-full">
                                <Button className="w-full h-12 text-lg">
                                    Login with Code
                                </Button>
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-6">
                            <p className="text-red-500 font-medium mb-4">{message}</p>
                            <Link to="/"><Button variant="outline">Go Home</Button></Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default GuardianInvite;
