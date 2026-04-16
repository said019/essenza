import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff, User, Phone, Cake } from 'lucide-react';
import { Brand } from '@/components/Brand';

const registerSchema = z.object({
    displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z
        .string()
        .regex(/^\+52[0-9]{10}$/, 'Formato: +52 seguido de 10 dígitos'),
    dateOfBirth: z.string().optional().or(z.literal('')),
    password: z
        .string()
        .min(8, 'Mínimo 8 caracteres')
        .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
        .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string(),
    acceptsTerms: z.boolean().refine(val => val === true, 'Debes aceptar los términos'),
    acceptsCommunications: z.boolean().default(false),
    referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');
    const { register: registerUser, isLoading, error, clearError, isAuthenticated, user } = useAuthStore();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            acceptsTerms: false,
            acceptsCommunications: false,
        },
    });

    const acceptsTerms = watch('acceptsTerms');
    const acceptsCommunications = watch('acceptsCommunications');
    const inputClassName = 'bg-card/95 border-primary/20 shadow-sm shadow-primary/10 focus-visible:ring-primary/30';

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            navigate(returnUrl || '/app', { replace: true });
        }
    }, [isAuthenticated, user, navigate, returnUrl]);

    // Clear error on unmount
    useEffect(() => {
        return () => clearError();
    }, [clearError]);

    // Format phone number as user types
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        // Remove non-digits except +
        value = value.replace(/[^\d+]/g, '');
        // Ensure starts with +52
        if (!value.startsWith('+52') && value.length > 0) {
            if (value.startsWith('52')) {
                value = '+' + value;
            } else if (value.startsWith('+')) {
                value = '+52' + value.substring(1);
            } else {
                value = '+52' + value;
            }
        }
        // Limit to +52 + 10 digits
        if (value.length > 13) {
            value = value.substring(0, 13);
        }
        e.target.value = value;
    };

    const onSubmit = async (data: RegisterForm) => {
        try {
            await registerUser({
                email: data.email,
                password: data.password,
                displayName: data.displayName,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth || undefined,
                acceptsTerms: data.acceptsTerms,
                acceptsCommunications: data.acceptsCommunications,
                referralCode: data.referralCode || undefined,
            });
        } catch (err) {
            // Error is handled by the store
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(113,127,155,0.18),_transparent_34%),linear-gradient(180deg,_rgba(253,252,248,0.98)_0%,_rgba(243,242,238,0.98)_52%,_rgba(253,252,248,1)_100%)] p-4 py-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-8rem] top-12 h-72 w-72 rounded-full bg-primary/16 blur-3xl" />
                <div className="absolute right-[-7rem] top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-secondary/6 blur-3xl" />
            </div>

            <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <Card className="w-full max-w-md border border-primary/15 bg-[rgba(253,252,248,0.9)] shadow-[0_28px_72px_-36px_rgba(113,127,155,0.38)] backdrop-blur-xl">
                    <CardHeader className="space-y-3 text-center">
                        <div className="flex justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top,_rgba(253,252,248,0.98),_rgba(243,242,238,0.9)_50%,_rgba(113,127,155,0.16)_100%)] shadow-[0_18px_40px_-20px_rgba(113,127,155,0.34)]">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-sm font-semibold tracking-[0.35em] text-primary-foreground pl-1">
                                    L
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1">
                                <Brand variant="cinzel" className="text-[11px] text-primary/80 font-semibold" />
                            </div>
                            <CardTitle className="text-3xl font-heading text-foreground">Crear Cuenta</CardTitle>
                            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                                Activa tu acceso a clases, membresias y beneficios de WalletClub desde una experiencia mas luminosa.
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

                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="displayName">Nombre completo</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="displayName"
                                        placeholder="Tu nombre"
                                        className={`pl-10 ${inputClassName}`}
                                        {...register('displayName')}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.displayName && (
                                    <p className="text-sm text-destructive">{errors.displayName.message}</p>
                                )}
                            </div>

                            {/* Email */}
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

                            {/* Phone */}
                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+525512345678"
                                        className={`pl-10 ${inputClassName}`}
                                        {...register('phone')}
                                        onChange={(e) => {
                                            handlePhoneChange(e);
                                            register('phone').onChange(e);
                                        }}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.phone && (
                                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                                )}
                            </div>

                            {/* Date of Birth */}
                            <div className="space-y-2">
                                <Label htmlFor="dateOfBirth">Fecha de nacimiento (opcional)</Label>
                                <div className="relative">
                                    <Cake className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="dateOfBirth"
                                        type="date"
                                        className={`pl-10 ${inputClassName}`}
                                        {...register('dateOfBirth')}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
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
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-destructive">{errors.password.message}</p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-primary/55" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className={`pl-10 pr-10 ${inputClassName}`}
                                        {...register('confirmPassword')}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            {/* Terms */}
                            <div className="space-y-3 rounded-2xl border border-primary/10 bg-primary/[0.035] p-4">
                                <div className="flex items-start space-x-2">
                                    <Checkbox
                                        id="acceptsTerms"
                                        checked={acceptsTerms}
                                        onCheckedChange={(checked) => setValue('acceptsTerms', checked as boolean)}
                                        disabled={isLoading}
                                    />
                                    <label htmlFor="acceptsTerms" className="text-sm leading-tight cursor-pointer">
                                        Acepto los{' '}
                                        <Link to="/terms" className="text-primary hover:underline">
                                            términos y condiciones
                                        </Link>{' '}
                                        y la{' '}
                                        <Link to="/privacy" className="text-primary hover:underline">
                                            política de privacidad
                                        </Link>
                                    </label>
                                </div>
                                {errors.acceptsTerms && (
                                    <p className="text-sm text-destructive">{errors.acceptsTerms.message}</p>
                                )}

                                <div className="flex items-start space-x-2">
                                    <Checkbox
                                        id="acceptsCommunications"
                                        checked={acceptsCommunications}
                                        onCheckedChange={(checked) => setValue('acceptsCommunications', checked as boolean)}
                                        disabled={isLoading}
                                    />
                                    <label htmlFor="acceptsCommunications" className="text-sm leading-tight cursor-pointer">
                                        Deseo recibir promociones y novedades por email
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="referralCode">¿Alguien te refirió? (opcional)</Label>
                                    <Input
                                        id="referralCode"
                                        placeholder="Código de referido"
                                        {...register('referralCode')}
                                        disabled={isLoading}
                                        className={`uppercase ${inputClassName}`}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Si alguien te invitó, ingresa su código para que ambos ganen puntos.
                                    </p>
                                </div>
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
                                        Creando cuenta...
                                    </>
                                ) : (
                                    'Crear Cuenta'
                                )}
                            </Button>

                            <p className="text-sm text-center text-muted-foreground">
                                ¿Ya tienes cuenta?{' '}
                                <Link to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'} className="font-medium text-primary hover:underline">
                                    Inicia sesión
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
