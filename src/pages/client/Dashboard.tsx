import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { fetchMyMembership } from '@/lib/memberships';
import type { BookingClient } from '@/types/booking';
import type { ClientMembership } from '@/types/membership';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  ChevronRight,
  CalendarX2,
  Sparkles,
  Wallet as WalletIcon,
  CalendarDays,
  PartyPopper,
} from 'lucide-react';
import { Brand } from '@/components/Brand';

interface WalletSummary {
  pointsBalance: number;
}

export default function ClientDashboard() {
  const { user } = useAuthStore();

  const { data: membership, isLoading: membershipLoading } = useQuery<ClientMembership | null>({
    queryKey: ['my-membership'],
    queryFn: fetchMyMembership,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingClient[]>({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/bookings/my-bookings')).data,
  });

  const { data: walletSummary } = useQuery<WalletSummary>({
    queryKey: ['wallet-pass'],
    queryFn: async () => (await api.get('/wallet/pass')).data,
  });

  const upcomingClasses = useMemo(() => {
    if (!bookings) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return bookings
      .filter((b) => b.booking_status !== 'cancelled')
      .filter((b) => parseISO(b.date) >= today)
      .sort((a, b) => {
        const dA = parseISO(`${a.date}T${a.start_time}`);
        const dB = parseISO(`${b.date}T${b.start_time}`);
        return dA.getTime() - dB.getTime();
      })
      .slice(0, 3);
  }, [bookings]);

  const firstName = user?.display_name?.split(' ')[0] || 'bienvenido';
  const membershipEndDate = membership?.end_date ? parseISO(membership.end_date) : null;
  const daysRemaining =
    membershipEndDate !== null
      ? Math.max(differenceInCalendarDays(membershipEndDate, new Date()), 0)
      : null;
  const classLimit = membership?.class_limit ?? null;
  const classesRemaining = membership?.classes_remaining ?? null;
  const classesUsed = classLimit && classesRemaining !== null ? classLimit - classesRemaining : 0;
  const usagePercent =
    classLimit && classesRemaining !== null ? Math.round((classesUsed / classLimit) * 100) : 0;
  const pointsBalance = walletSummary?.pointsBalance ?? 0;

  const isExpiredOrCancelled =
    membership?.status === 'expired' || membership?.status === 'cancelled';
  const isOutOfCredits =
    membership?.status === 'active' && classLimit !== null && (classesRemaining ?? 0) <= 0;

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-7">
          {/* ═══ Greeting header ═══ */}
          <section className="relative overflow-hidden rounded-3xl p-7 md:p-10 bg-gradient-to-br from-essenza-cream via-surface-container-lowest to-essenza-surfaceLow border border-primary/10">
            <div className="relative z-10 max-w-2xl">
              <Brand variant="cinzel" className="text-[11px] text-primary/80 font-semibold mb-5 block" />
              <h1 className="font-signature text-5xl md:text-7xl text-primary leading-[1.3] mb-6">
                ¡Hola, {firstName}
              </h1>
              <p className="font-body text-essenza-secondary text-base md:text-lg italic">
                Es un gran día para mover tu cuerpo.
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 md:w-64 md:h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -top-8 -left-8 w-24 h-24 md:w-40 md:h-40 rounded-full bg-essenza-goldLight/20 blur-2xl pointer-events-none" aria-hidden="true" />
          </section>

          {/* ═══ Membership ═══ */}
          <MembershipCard
            loading={membershipLoading}
            membership={membership ?? null}
            isExpiredOrCancelled={isExpiredOrCancelled}
            isOutOfCredits={isOutOfCredits}
            classLimit={classLimit}
            classesUsed={classesUsed}
            classesRemaining={classesRemaining}
            usagePercent={usagePercent}
            daysRemaining={daysRemaining}
          />

          {/* ═══ Actions — Reservar + WalletClub + Eventos ═══ */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Link
              to="/app/book"
              className="lg:col-span-2 flex items-center justify-between p-6 bg-primary text-white rounded-2xl hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group shadow-md shadow-primary/20"
            >
              <div className="text-left">
                <p className="text-[10px] font-bold tracking-[0.1em] text-primary-fixed-dim mb-1">
                  MOVIMIENTO
                </p>
                <h2 className="text-xl font-headline font-bold">Reservar clase</h2>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <CalendarDays className="h-5 w-5" />
              </div>
            </Link>

            <Link
              to="/app/wallet"
              className="flex items-center gap-4 p-6 bg-surface-container-lowest border border-essenza-outlineVariant/40 text-on-surface rounded-2xl hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <WalletIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.1em] text-primary mb-0.5">
                  BENEFICIOS
                </p>
                <h2 className="text-base font-headline font-bold">WalletClub</h2>
                {pointsBalance > 0 && (
                  <p className="text-[10px] text-essenza-secondary mt-0.5">{pointsBalance} pts</p>
                )}
              </div>
            </Link>

            <Link
              to="/app/events"
              className="flex items-center gap-4 p-6 bg-surface-container-lowest border border-essenza-outlineVariant/40 text-on-surface rounded-2xl hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <PartyPopper className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.1em] text-primary mb-0.5">
                  AGENDA
                </p>
                <h2 className="text-base font-headline font-bold">Eventos</h2>
              </div>
            </Link>
          </section>

          {/* ═══ Upcoming classes ═══ */}
          <section className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="font-signature text-4xl md:text-5xl text-primary leading-tight">
                Próximas clases
              </h2>
              <Link
                to="/app/classes"
                className="text-sm font-semibold text-primary hover:underline transition-all flex items-center gap-1"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {bookingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : upcomingClasses.length > 0 ? (
              <div className="space-y-3">
                {upcomingClasses.map((cls) => (
                  <Link
                    key={cls.booking_id}
                    to={`/app/classes/${cls.booking_id}`}
                    className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-essenza-outlineVariant/40 rounded-2xl hover:border-primary/30 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline text-base font-semibold truncate">
                        {cls.class_type_name}
                      </p>
                      <p className="text-sm text-essenza-secondary truncate">
                        {format(parseISO(cls.date), "EEE d 'de' MMM", { locale: es })} ·{' '}
                        {cls.start_time.slice(0, 5)} · {cls.instructor_name}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-essenza-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-low rounded-2xl p-10 md:p-12 flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div
                    className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-150"
                    aria-hidden="true"
                  />
                  <div className="relative w-20 h-20 bg-surface-container-lowest rounded-full flex items-center justify-center text-primary shadow-sm">
                    <CalendarX2 className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="max-w-[280px]">
                  <h3 className="text-lg font-headline font-semibold mb-1.5">
                    Aún no tienes reservas
                  </h3>
                  <p className="text-sm text-essenza-secondary leading-relaxed">
                    Encuentra el equilibrio perfecto. Explora el horario y reserva tu próxima
                    sesión hoy mismo.
                  </p>
                </div>
                <Link
                  to="/app/book"
                  className="px-7 py-3 bg-primary text-white font-semibold rounded-full hover:bg-essenza-goldLight transition-colors text-xs uppercase tracking-widest"
                >
                  Reservar ahora
                </Link>
              </div>
            )}
          </section>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}

/* ═══ Membership Card subcomponent ═══ */
function MembershipCard({
  loading,
  membership,
  isExpiredOrCancelled,
  isOutOfCredits,
  classLimit,
  classesUsed,
  classesRemaining,
  usagePercent,
  daysRemaining,
}: {
  loading: boolean;
  membership: ClientMembership | null;
  isExpiredOrCancelled: boolean;
  isOutOfCredits: boolean;
  classLimit: number | null;
  classesUsed: number;
  classesRemaining: number | null;
  usagePercent: number;
  daysRemaining: number | null;
}) {
  if (loading) {
    return (
      <section className="bg-surface-container-lowest rounded-2xl p-6 border border-essenza-outlineVariant/40">
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-4 w-56 mb-5" />
        <Skeleton className="h-2 w-full mb-2" />
        <Skeleton className="h-10 w-40" />
      </section>
    );
  }

  const hasMembership = !!membership && !isExpiredOrCancelled;

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 border border-essenza-outlineVariant/40 shadow-[0px_10px_32px_rgba(175,139,59,0.06)] flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-headline font-bold text-lg text-on-surface">
            {hasMembership ? 'Membresía activa' : 'Sin membresía activa'}
          </h3>
          <p className="text-sm text-essenza-secondary font-medium truncate">
            {membership?.plan_name
              ? `${membership.plan_name}${
                  daysRemaining !== null ? ` · Vence en ${daysRemaining} días` : ''
                }`
              : 'Compra un pack para empezar a reservar'}
          </p>
        </div>
      </div>

      {hasMembership && classLimit !== null && classesRemaining !== null && (
        <div className="pt-4 border-t border-essenza-outlineVariant/30">
          <div className="flex justify-between items-end mb-2">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold tracking-[0.15em] text-primary uppercase">
                Paquete · {classLimit} clases
              </p>
              <p className="text-sm font-semibold text-on-surface">
                Has usado {classesUsed} de {classLimit} clases
              </p>
            </div>
            <span className="text-xs font-bold text-primary">{usagePercent}%</span>
          </div>
          <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      )}

      {hasMembership && classLimit === null && (
        <div className="pt-4 border-t border-essenza-outlineVariant/30">
          <p className="text-sm text-essenza-secondary font-medium">
            Acceso ilimitado a todas las clases
          </p>
        </div>
      )}

      {isOutOfCredits && (
        <p className="text-sm text-primary font-medium">
          Agotaste tus créditos. Compra un nuevo pack para seguir reservando.
        </p>
      )}

      <Link
        to="/app/checkout"
        className="w-full sm:w-auto self-start px-6 py-3 bg-gradient-to-r from-primary to-essenza-goldLight text-white font-semibold rounded-full hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20 text-sm tracking-wide text-center"
      >
        {hasMembership ? 'Agregar más clases' : 'Comprar primer pack'}
      </Link>
    </section>
  );
}
