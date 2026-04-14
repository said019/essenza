import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { fetchMyMembership } from '@/lib/memberships';
import type { BookingClient } from '@/types/booking';
import type { ClientMembership } from '@/types/membership';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Gift,
  ChevronRight,
  Plus,
  RefreshCw,
  Sparkles,
  Play,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface WalletSummary {
  pointsBalance: number;
}

const statusLabel: Record<ClientMembership['status'], string> = {
  active: 'Activa',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  pending_payment: 'Pago pendiente',
  pending_activation: 'Pendiente',
  paused: 'Pausada',
};

export default function ClientDashboard() {
  const { user } = useAuthStore();

  const { data: membership, isLoading: membershipLoading } = useQuery<ClientMembership | null>({
    queryKey: ['my-membership'],
    queryFn: fetchMyMembership,
  });

  const isExpiredOrCancelled = membership?.status === 'expired' || membership?.status === 'cancelled';
  const isOutOfCredits = membership?.status === 'active' && membership?.class_limit && (membership?.classes_remaining ?? 0) <= 0;

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingClient[]>({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/bookings/my-bookings')).data,
  });

  const { data: walletSummary } = useQuery<WalletSummary>({
    queryKey: ['wallet-pass'],
    queryFn: async () => (await api.get('/wallet/pass')).data,
  });

  const { data: latestVideos } = useQuery<any[]>({
    queryKey: ['latest-videos'],
    queryFn: async () => {
      const { data } = await api.get('/videos', { params: { limit: 4 } });
      return data;
    },
  });

  const upcomingClasses = useMemo(() => {
    if (!bookings) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return bookings
      .filter((booking) => booking.booking_status !== 'cancelled')
      .filter((booking) => {
        const classDate = parseISO(booking.date);
        return classDate >= today;
      })
      .sort((a, b) => {
        const dateA = parseISO(`${a.date}T${a.start_time}`);
        const dateB = parseISO(`${b.date}T${b.start_time}`);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 2);
  }, [bookings]);

  const membershipEndDate = membership?.end_date ? parseISO(membership.end_date) : null;
  const daysRemaining = membershipEndDate
    ? Math.max(differenceInCalendarDays(membershipEndDate, new Date()), 0)
    : null;
  const classLimit = membership?.class_limit ?? null;
  const classesRemaining = membership?.classes_remaining ?? null;
  const classesProgress = classLimit && classesRemaining !== null
    ? (classesRemaining / classLimit) * 100
    : null;
  const pointsBalance = walletSummary?.pointsBalance ?? 0;
  const rewardTarget = 1000;
  const pointsRemaining = Math.max(rewardTarget - pointsBalance, 0);
  const rewardProgress = Math.min((pointsBalance / rewardTarget) * 100, 100);

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          {/* ═══ Header with flowing gradient ═══ */}
          <div className="relative overflow-hidden rounded-2xl p-6">
            {/* Animated flowing background */}
            <div className="absolute inset-0 flow-gradient-dark rounded-2xl" />

            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-essenza-gold/[0.08] blur-3xl animate-drift" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-40 animate-breathe" style={{ background: 'radial-gradient(circle, hsla(210,40%,72%,0.3) 0%, transparent 70%)' }} />

            {/* Animated wave line */}
            <div className="absolute inset-0 opacity-10 overflow-hidden rounded-2xl">
              <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                <path d="M0,75 Q150,45 300,75 T600,75" fill="none" stroke="rgba(175,139,59,0.4)" strokeWidth="1">
                  <animate attributeName="d" dur="8s" repeatCount="indefinite"
                    values="M0,75 Q150,45 300,75 T600,75;M0,75 Q150,105 300,75 T600,75;M0,75 Q150,45 300,75 T600,75" />
                </path>
              </svg>
            </div>

            <div className="relative z-10">
              <h1 className="text-2xl font-heading font-bold text-white animate-fade-in">
                ¡Hola, {user?.display_name?.split(' ')[0] || 'bienvenido'}! 👋
              </h1>
              <p className="text-white/40 font-body text-sm mt-1 animate-fade-in delay-100">
                Bienvenido de vuelta a Essenza del Flusso
              </p>
            </div>
          </div>

          {/* ═══ Membership Card — Premium feel ═══ */}
          <Card className={`relative overflow-hidden transition-all duration-500 ${isExpiredOrCancelled || isOutOfCredits ? 'border-amber-300/40 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/30' : 'border-essenza-gold/20 bg-gradient-to-br from-essenza-cream via-white to-essenza-warmWhite'}`}>
            {/* Shimmer border effect */}
            <div className="shimmer-border" />
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-essenza-gold/[0.06] blur-2xl animate-breathe" />
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading">Tu Membresía</CardTitle>
                <Badge
                  variant={membership?.status === 'active' ? 'default' : 'secondary'}
                  className={
                    isOutOfCredits
                      ? 'bg-amber-100 text-amber-700 border border-amber-300 rounded-lg'
                      : membership?.status === 'active'
                        ? 'bg-essenza-sage rounded-lg'
                        : isExpiredOrCancelled
                          ? 'bg-amber-100 text-amber-700 border border-amber-300 rounded-lg'
                          : 'rounded-lg'
                  }
                >
                  {isOutOfCredits ? 'Sin créditos' : membership ? statusLabel[membership.status] : 'Sin membresía'}
                </Badge>
              </div>
              <CardDescription className="font-body">{membership?.plan_name || 'Activa tu plan para comenzar'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              {membershipLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ) : membership && isOutOfCredits ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0 animate-breathe" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800">
                        Agotaste tus {membership.class_limit} clases de {membership.plan_name}
                      </p>
                      <p className="text-xs text-amber-600">
                        Tu plan vence el {membership.end_date ? format(parseISO(membership.end_date), 'dd MMM yyyy', { locale: es }) : '—'}. Compra más clases para seguir reservando.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="w-full rounded-xl bg-essenza-gold hover:bg-essenza-gold/90 shadow-md ripple-btn">
                    <Link to="/app/checkout">
                      <Plus className="h-4 w-4 mr-2" />
                      Comprar más clases
                    </Link>
                  </Button>
                </div>
              ) : membership && isExpiredOrCancelled ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0 animate-breathe" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800">
                        Tu membresía {membership.status === 'expired' ? 'venció' : 'fue cancelada'}{membership.end_date ? ` el ${format(parseISO(membership.end_date), 'dd MMM yyyy', { locale: es })}` : ''}
                      </p>
                      <p className="text-xs text-amber-600">
                        Renueva para seguir reservando clases y acumulando puntos WalletClub.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="w-full rounded-xl bg-essenza-gold hover:bg-essenza-gold/90 shadow-md ripple-btn">
                    <Link to="/app/checkout">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Renovar membresía
                    </Link>
                  </Button>
                </div>
              ) : membership ? (
                <>
                  {classLimit ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Clases restantes</span>
                        <span className="font-medium">
                          {classesRemaining ?? 0} de {classLimit}
                        </span>
                      </div>
                      <Progress value={classesProgress ?? 0} className="h-2" />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      ✦ Clases ilimitadas activas
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {daysRemaining !== null ? `${daysRemaining} días restantes` : 'Sin fecha de vencimiento'}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {membership.end_date ? `Vence: ${format(membershipEndDate!, 'dd MMM yyyy', { locale: es })}` : 'Sin vencimiento'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Aún no tienes una membresía activa.
                  </p>
                  <Button asChild size="sm" className="ripple-btn">
                    <Link to="/app/checkout">
                      <Plus className="h-4 w-4 mr-2" />
                      Comprar membresía
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ Action buttons ═══ */}
          <div className="grid grid-cols-2 gap-3">
            <Button asChild size="lg" className="h-auto py-5 flex-col gap-2 rounded-xl bg-essenza-gold hover:bg-essenza-gold/90 shadow-md hover:shadow-lg transition-all duration-500 hover:-translate-y-1 ripple-btn">
              <Link to="/app/book">
                <Plus className="h-5 w-5" />
                <span className="font-body font-semibold">Reservar Clase</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-auto py-5 flex-col gap-2 rounded-xl border-essenza-flow/30 hover:border-essenza-gold/40 hover:bg-essenza-gold/5 transition-all duration-500 hover:-translate-y-1">
              <Link to="/app/wallet">
                <Gift className="h-5 w-5 text-essenza-gold" />
                <span className="font-body font-semibold">WalletClub</span>
              </Link>
            </Button>
          </div>

          {/* ═══ Upcoming classes ═══ */}
          <Card className="border-border/60 hover:shadow-md transition-all duration-500 hover:border-essenza-flow/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading">Próximas Clases</CardTitle>
                <Button variant="ghost" size="sm" className="font-body rounded-xl" asChild>
                  <Link to="/app/classes">
                    Ver todas
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : upcomingClasses.length > 0 ? (
                <div className="space-y-3">
                  {upcomingClasses.map((cls, i) => (
                    <div
                      key={cls.booking_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 overflow-hidden relative hover:bg-muted/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm animate-fade-up"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {cls.class_type_color && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                          style={{ backgroundColor: cls.class_type_color }}
                        />
                      )}
                      <div className="flex items-center gap-3 pl-2">
                        <div 
                          className="h-10 w-10 rounded-full flex items-center justify-center transition-transform duration-500 hover:scale-110"
                          style={{ 
                            backgroundColor: cls.class_type_color ? `${cls.class_type_color}20` : 'hsl(var(--primary) / 0.1)'
                          }}
                        >
                          <Calendar 
                            className="h-5 w-5" 
                            style={{ color: cls.class_type_color || 'hsl(var(--primary))' }}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{cls.class_type_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(cls.date), 'EEE d MMM', { locale: es })} • {cls.start_time.slice(0, 5)} • {cls.instructor_name}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/classes/${cls.booking_id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 animate-float-slow" />
                  <p className="mt-2 text-muted-foreground">No tienes clases próximas</p>
                  <Button asChild className="mt-4 ripple-btn">
                    <Link to="/app/book">Reservar ahora</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ Videos On-Demand ═══ */}
          {latestVideos && latestVideos.length > 0 && (
            <Card className="border-border/60 hover:shadow-md transition-all duration-500 hover:border-essenza-gold/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 font-heading">
                    <div className="h-8 w-8 rounded-xl bg-essenza-gold/10 flex items-center justify-center">
                      <Play className="h-4 w-4 text-essenza-gold" />
                    </div>
                    Videos On-Demand
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="font-body rounded-xl" asChild>
                    <Link to="/app/videos">
                      Ver todos
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <CardDescription className="font-body">Rutinas y técnica disponibles para ti</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {latestVideos.slice(0, 4).map((video: any, i: number) => (
                    <Link
                      key={video.id}
                      to={`/app/videos/${video.id}`}
                      className="group animate-fade-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <Play className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-100 scale-75">
                          <div className="bg-white/90 rounded-full p-2 shadow-lg">
                            <Play className="h-4 w-4 text-primary fill-primary ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-medium mt-1.5 group-hover:text-primary transition-colors line-clamp-1">
                        {video.title}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{video.level}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ WalletClub ═══ */}
          <Card className="border-essenza-gold/20 hover:shadow-md transition-all duration-500 relative overflow-hidden hover:border-essenza-gold/40">
            {/* Subtle flow blob */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-essenza-gold/[0.05] blur-xl animate-breathe" />
            <CardHeader className="pb-2 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 font-heading">
                  <Sparkles className="h-5 w-5 text-essenza-gold animate-float-slow" />
                  WalletClub
                </CardTitle>
                <span className="text-2xl font-bold text-essenza-gold font-heading">{pointsBalance} pts</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 relative z-10">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Próxima recompensa</span>
                  <span className="text-muted-foreground">{pointsRemaining} pts más</span>
                </div>
                <Progress value={rewardProgress} className="h-2" />
              </div>
              <Button variant="outline" asChild className="w-full rounded-xl border-essenza-gold/20 hover:border-essenza-gold/40 hover:bg-essenza-gold/5 font-body transition-all duration-300">
                <Link to="/app/wallet">
                  Ver recompensas
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
