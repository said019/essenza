import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { InstallAppCard } from '@/components/InstallAppCard';

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');
    const { login, isLoading, error, clearError, isAuthenticated, user } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });
    const inputClassName = 'bg-card/95 border-primary/20 shadow-sm shadow-primary/10 focus-visible:ring-primary/30';

    useEffect(() => {
        if (isAuthenticated && user) {
            if (returnUrl) {
                navigate(returnUrl, { replace: true });
            } else if (user.role === 'admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user.role === 'instructor') {
                navigate('/coach', { replace: true });
            } else {
                navigate('/app', { replace: true });
            }
        }
    }, [isAuthenticated, user, navigate, returnUrl]);

    useEffect(() => {
        return () => clearError();
    }, [clearError]);

    const onSubmit = async (data: LoginForm) => {
        try {
            await login(data as any);
        } catch (err) {
            // Error is handled by the store
        }
    };

    return (
        <div className="min-h-screen flex">

            {/* ══════ LEFT — Image collage (desktop only) ══════ */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
                {/* Imagen principal de fondo */}
                <img
                    src="/test2.jpeg"
                    alt="Essenza del Flusso studio"
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Overlay gradiente */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-transparent z-[1]" />

                {/* Imagen flotante esquina inferior derecha */}
                <div className="absolute bottom-12 right-10 z-[3] w-[42%] max-w-[260px]">
                    <div className="rounded-[2rem] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)] ring-2 ring-white/20 animate-float-slow">
                        <img
                            src="/test1.jpeg"
                            alt="Essenza del Flusso clase"
                            className="w-full aspect-[4/5] object-cover"
                        />
                    </div>
                </div>

                {/* Blob dorado decorativo */}
                <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full bg-essenza-gold/20 blur-3xl z-[2] animate-breathe" />

                {/* Contenido sobre imagen */}
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    {/* Logo */}
                    <div>
                        <Brand variant="logo" className="h-20 w-auto brightness-0 invert" />
                    </div>

                    {/* Tagline */}
                    <div className="max-w-sm">
                        <Brand variant="cinzel" className="text-[11px] text-essenza-goldLight mb-4 block" />
                        <h2 className="font-headline text-white text-3xl font-light leading-snug mb-4">
                            Donde el movimiento<br />
                            se convierte en{' '}
                            <em style={{ color: '#d1b16b' }}>ritual.</em>
                        </h2>
                        <p className="text-white/55 text-sm font-light leading-relaxed">
                            Pilates Reformer Studio
                        </p>
                    </div>
                </div>
            </div>

            {/* ══════ RIGHT — Form panel ══════ */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative overflow-hidden"
                style={{
                    background: 'radial-gradient(circle at top, rgba(113,127,155,0.18), transparent 34%), linear-gradient(180deg, rgba(253,252,248,0.98) 0%, rgba(243,242,238,0.98) 52%, rgba(253,252,248,1) 100%)'
                }}
            >
                {/* Blobs decorativos */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-[-8rem] top-12 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
                    <div className="absolute right-[-7rem] bottom-24 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
                </div>

                {/* Logo solo en mobile */}
                <div className="lg:hidden flex items-center gap-3 mb-8">
                    <img
                        src="/essenza-logo.jpeg"
                        alt="Essenza del Flusso"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-primary/20"
                    />
                    <span className="font-headline text-xl tracking-tighter font-light text-on-surface">
                        ESSENZA
                    </span>
                </div>

                <Card className="relative w-full max-w-md border border-primary/15 bg-[rgba(253,252,248,0.9)] shadow-[0_28px_72px_-36px_rgba(113,127,155,0.38)] backdrop-blur-xl">
                    <CardHeader className="space-y-3 text-center">
                        <div className="flex justify-center">
                            <Brand variant="logo" className="h-20 w-auto mix-blend-multiply" />
                        </div>
                        <div className="space-y-2">
                            <div />
                            <CardTitle className="text-2xl font-heading text-foreground">Bienvenido</CardTitle>
                            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                                Ingresa a tu cuenta para reservar, gestionar tu membresía y seguir tu experiencia.
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        className={`pl-10 ${inputClassName}`}
                                        {...register('email')}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-sm text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Contraseña</Label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className={`pl-10 pr-10 ${inputClassName}`}
                                        {...register('password')}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-destructive">{errors.password.message}</p>
                                )}
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-primary py-6 text-base font-semibold shadow-[0_18px_40px_-20px_rgba(113,127,155,0.5)]"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Iniciando sesión...
                                    </>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </Button>

                            <p className="text-sm text-center text-muted-foreground">
                                ¿No tienes cuenta?{' '}
                                <Link
                                    to={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}
                                    className="font-medium text-primary hover:underline"
                                >
                                    Regístrate
                                </Link>
                            </p>

                            <div className="mt-2">
                                <InstallAppCard />
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
