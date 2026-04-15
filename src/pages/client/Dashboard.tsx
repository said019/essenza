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
  Play,
  PartyPopper,
} from 'lucide-react';

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
              <span className="font-label text-[10px] uppercase tracking-[0.35em] text-primary/80 font-semibold block mb-2">
                Essenza del Flusso
              </span>
              <h1 className="font-headline text-2xl md:text-4xl font-semibold tracking-tight text-on-surface mb-1.5">
                ¡Hola, {firstName} <span className="inline-block ml-1">✿</span>
              </h1>
              <p className="text-essenza-secondary text-sm md:text-base font-medium">
                Es un gran día para mover tu cuerpo.
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 md:w-64 md:h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -top-8 -left-8 w-24 h-24 md:w-40 md:h-40 rounded-full bg-essenza-goldLight/20 blur-2xl pointer-events-none" aria-hidden="true" />
          </section>

          {/* ═══ Desktop 2-col grid · Mobile stack ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {/* Columna izquierda (2/3 en desktop) */}
            <div className="lg:col-span-2 space-y-7">
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

              {/* Actions — 2 en móvil, 4 en desktop */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Link
                  to="/app/book"
                  className="col-span-2 lg:col-span-2 flex items-center justify-between p-5 md:p-6 bg-primary text-white rounded-2xl hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group shadow-md shadow-primary/20"
                >
                  <div className="text-left">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-primary-fixed-dim mb-1">
                      MOVIMIENTO
                    </p>
                    <h2 className="text-lg md:text-xl font-headline font-bold">Reservar clase</h2>
                  </div>
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                </Link>

                <Link
                  to="/app/wallet"
                  className="flex flex-col justify-between p-5 md:p-6 bg-surface-container-lowest border border-essenza-outlineVariant/40 text-on-surface rounded-2xl hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 group min-h-[108px]"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <WalletIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.1em] text-primary mb-0.5">
                      BENEFICIOS
                    </p>
                    <h2 className="text-sm md:text-base font-headline font-bold">WalletClub</h2>
                    {pointsBalance > 0 && (
                      <p className="text-[10px] text-essenza-secondary mt-0.5">{pointsBalance} pts</p>
                    )}
                  </div>
                </Link>

                <Link
                  to="/app/videos"
                  className="flex flex-col justify-between p-5 md:p-6 bg-surface-container-lowest border border-essenza-outlineVariant/40 text-on-surface rounded-2xl hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 group min-h-[108px]"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Play className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.1em] text-primary mb-0.5">
                      BIBLIOTECA
                    </p>
                    <h2 className="text-sm md:text-base font-headline font-bold">Videos</h2>
                  </div>
                </Link>
              </section>
            </div>

            {/* Columna derecha (1/3 en desktop) — featured card + eventos */}
            <div className="space-y-7">
              <Link
                to="/app/videos"
                className="relative block h-56 md:h-full md:min-h-[320px] w-full rounded-tr-[3.5rem] rounded-bl-[3.5rem] rounded-tl-2xl rounded-br-2xl overflow-hidden group"
              >
                <img
                  src="/test1.jpeg"
                  alt="Pilates Reformer en Essenza del Flusso"
                  className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-on-surface/85 via-on-surface/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-7 text-white">
                  <span className="text-[10px] font-bold tracking-[0.25em] mb-2 inline-flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    REFORMER FLOW
                  </span>
                  <h3 className="text-xl font-headline font-bold leading-tight mb-3">
                    Biblioteca de clases bajo demanda
                  </h3>
                  <span className="text-xs font-semibold uppercase tracking-widest inline-flex items-center gap-1 text-white/90 group-hover:gap-2 transition-all">
                    Explorar <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>

              <Link
                to="/app/events"
                className="flex items-center gap-4 p-5 bg-surface-container-lowest border border-essenza-outlineVariant/40 rounded-2xl hover:border-primary/30 transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <PartyPopper className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.1em] text-primary mb-0.5">
                    AGENDA
                  </p>
                  <h2 className="text-sm font-headline font-bold">Eventos especiales</h2>
                </div>
                <ChevronRight className="h-4 w-4 text-essenza-secondary flex-shrink-0" />
              </Link>
            </div>
          </div>

          {/* ═══ Upcoming classes ═══ */}
          <section className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="text-2xl font-headline font-semibold tracking-tight">
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

          {/* ═══ Featured asymmetric card ═══ */}
          <section className="pt-2">
            <Link
              to="/app/videos"
              className="relative block h-64 w-full rounded-tr-[4rem] rounded-bl-[4rem] rounded-tl-2xl rounded-br-2xl overflow-hidden group"
            >
              <img
                src="/test1.jpeg"
                alt="Pilates Reformer en Essenza del Flusso"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-on-surface/75 via-on-surface/30 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
                <span className="text-[10px] font-bold tracking-[0.25em] mb-2 inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  REFORMER FLOW
                </span>
                <h3 className="text-xl md:text-2xl font-headline font-bold leading-tight max-w-xs">
                  Descubre tu librería de clases bajo demanda
                </h3>
              </div>
            </Link>
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
