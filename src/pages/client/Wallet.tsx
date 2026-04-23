import { useMutation, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import api, { getErrorMessage } from '@/lib/api';
import { Brand } from '@/components/Brand';
import {
  QrCode,
  Sparkles,
  Tag,
  Star,
  CalendarDays,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { walletRewards } from '@/pages/client/walletData';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface WalletPassResponse {
  memberName: string;
  memberSince: string | null;
  planName: string | null;
  membershipStatus: string | null;
  membershipId: string | null;
  expirationDate: string | null;
  classesRemaining: number | null;
  pointsBalance: number;
  qrPayload: string;
  walletPasses: Array<{ platform: string; serial_number: string }>;
  canDownloadPass: boolean;
}
interface ApplePassResponse {
  downloadUrl?: string;
  message?: string;
}
interface GooglePassResponse {
  saveUrl?: string;
  message?: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, "d MMM yyyy", { locale: es });
};

const categoryIcon = (category: string) => {
  switch (category) {
    case 'Clases': return CalendarDays;
    case 'Wellness': return Sparkles;
    case 'Premium': return Star;
    default: return Tag;
  }
};

export default function WalletClub() {
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useQuery<WalletPassResponse>({
    queryKey: ['wallet-pass'],
    queryFn: async () => (await api.get('/wallet/pass')).data,
  });

  const { data: loyaltyData } = useQuery<{
    history: Array<{
      id: string;
      points: number;
      type: string;
      description: string;
      created_at: string;
      class_name: string | null;
    }>;
    totalPoints: number;
  }>({
    queryKey: ['loyalty-history'],
    queryFn: async () => (await api.get('/loyalty/my-history')).data,
  });

  const recentActivity = (loyaltyData?.history || []).slice(0, 5);
  const errorMessage = isError ? getErrorMessage(error) : null;
  const canDownloadPass = data?.canDownloadPass ?? false;
  const hasMembership = Boolean(data?.membershipId);
  const isActive = data?.membershipStatus === 'active';

  const formatActivityDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
      if (diffDays === 0) return 'Hoy';
      if (diffDays === 1) return 'Ayer';
      return format(date, 'd MMM', { locale: es });
    } catch {
      return '';
    }
  };

  const getActivityLabel = (item: {
    type: string;
    description: string;
    class_name: string | null;
  }) => {
    if (item.class_name) return `Clase · ${item.class_name}`;
    if (item.type === 'bonus') return item.description || 'Bono';
    if (item.type === 'redemption') return item.description || 'Canje';
    return item.description || 'Puntos';
  };

  const applePassMutation = useMutation({
    mutationFn: async () => (await api.post<ApplePassResponse>('/wallet/pass/apple')).data,
    onSuccess: (res) => {
      if (res.downloadUrl) { window.location.assign(res.downloadUrl); return; }
      toast({ title: 'Pase en preparación', description: res.message || 'Te avisaremos cuando esté listo.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'No pudimos generar tu pase', description: getErrorMessage(err) }),
  });

  const googlePassMutation = useMutation({
    mutationFn: async () => (await api.post<GooglePassResponse>('/wallet/pass/google')).data,
    onSuccess: (res) => {
      if (res.saveUrl) { window.open(res.saveUrl, '_blank', 'noopener,noreferrer'); return; }
      toast({ title: 'Pase en preparación', description: res.message || 'Te avisaremos cuando esté listo.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'No pudimos generar tu pase', description: getErrorMessage(err) }),
  });

  const featuredReward = walletRewards[0];
  const otherRewards = walletRewards.slice(1, 3);

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-8">

          {/* ═══ Page header ═══ */}
          <div className="flex items-end justify-between px-1">
            <div>
              <Brand variant="cinzel" className="text-[10px] text-primary/70 mb-2 block" />
              <h1 className="font-signature text-5xl md:text-6xl text-primary leading-tight">
                WalletClub
              </h1>
            </div>
            {!isLoading && data && (
              <div className="text-right">
                <p className="text-[10px] font-label font-bold tracking-[0.18em] text-primary/70 uppercase mb-0.5">
                  Puntos
                </p>
                <p className="font-signature text-4xl text-primary leading-none">
                  {data.pointsBalance}
                </p>
              </div>
            )}
          </div>

          {/* ═══ Premium membership pass card ═══ */}
          {isLoading ? (
            <div className="rounded-3xl overflow-hidden">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : errorMessage ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 text-sm text-essenza-secondary">
              No pudimos cargar tu pase. {errorMessage}
            </div>
          ) : (
            <div
              className="rounded-3xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(27,22,14,0.35)]"
              style={{
                background: 'linear-gradient(135deg, #2c2418 0%, #3d3020 50%, #1d1a14 100%)',
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr]">
                {/* Left: member info */}
                <div className="p-8 md:p-10 flex flex-col justify-between gap-8 relative overflow-hidden">
                  {/* Subtle gold glow blob */}
                  <div
                    className="absolute -top-16 -left-16 w-64 h-64 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.18) 0%, transparent 70%)' }}
                    aria-hidden="true"
                  />

                  <div className="relative z-10">
                    <p
                      className="text-[9px] font-label font-bold tracking-[0.28em] uppercase mb-5"
                      style={{ color: 'rgba(201,169,110,0.7)' }}
                    >
                      Essenza del Flusso · Membership Pass
                    </p>

                    <h2
                      className="font-signature leading-[1.1] mb-1"
                      style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: '#f5ead8' }}
                    >
                      {data?.memberName || 'Miembro'}
                    </h2>
                    <p style={{ color: 'rgba(245,234,216,0.5)', fontSize: '0.8rem' }} className="font-body italic">
                      Miembro desde {formatDate(data?.memberSince)}
                    </p>
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-4">
                    {[
                      { label: 'Plan', value: data?.planName || 'Sin plan' },
                      { label: 'Válido hasta', value: formatDate(data?.expirationDate) },
                      {
                        label: 'Clases',
                        value: hasMembership
                          ? (data?.classesRemaining !== null ? String(data?.classesRemaining) : '∞')
                          : '—',
                      },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p
                          className="text-[9px] font-label font-bold tracking-[0.18em] uppercase mb-1"
                          style={{ color: 'rgba(201,169,110,0.6)' }}
                        >
                          {label}
                        </p>
                        <p
                          className="font-headline text-sm font-semibold truncate"
                          style={{ color: 'rgba(245,234,216,0.85)' }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Status pill */}
                  <div className="relative z-10 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[10px] font-label font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full',
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-white/10 text-white/50'
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400' : 'bg-white/40')} />
                      {isActive ? 'Activa' : hasMembership ? 'Inactiva' : 'Sin plan'}
                    </span>
                  </div>
                </div>

                {/* Right: QR + points */}
                <div
                  className="p-8 md:p-10 flex flex-col items-center justify-center gap-6 border-t md:border-t-0 md:border-l"
                  style={{ borderColor: 'rgba(201,169,110,0.15)' }}
                >
                  <div className="text-center">
                    <p
                      className="text-[9px] font-label font-bold tracking-[0.2em] uppercase mb-1"
                      style={{ color: 'rgba(201,169,110,0.6)' }}
                    >
                      Check-in QR
                    </p>
                    {data?.qrPayload ? (
                      <div className="inline-block p-3 bg-white rounded-2xl shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]">
                        <QRCodeSVG
                          value={data.qrPayload}
                          size={108}
                          level="M"
                          bgColor="#FFFFFF"
                          fgColor="#2c2418"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-[132px] h-[132px] rounded-2xl flex flex-col items-center justify-center gap-2 mx-auto"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,169,110,0.2)' }}
                      >
                        <QrCode className="w-8 h-8" style={{ color: 'rgba(201,169,110,0.4)' }} />
                        <p className="text-[9px] font-label" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Sin membresía
                        </p>
                      </div>
                    )}
                    {data?.membershipId && (
                      <p className="mt-2 text-[9px] font-mono" style={{ color: 'rgba(201,169,110,0.4)' }}>
                        {data.membershipId.substring(0, 8).toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Digital pass actions ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!canDownloadPass || applePassMutation.isPending}
              onClick={() => applePassMutation.mutate()}
              className={cn(
                'flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200 group active:scale-[0.98]',
                canDownloadPass
                  ? 'border-primary/30 bg-surface-container-lowest hover:border-primary/60 hover:shadow-[0_4px_20px_-8px_rgba(201,169,110,0.25)]'
                  : 'border-essenza-outlineVariant/30 bg-surface-container-lowest opacity-50 cursor-not-allowed'
              )}
            >
              <div className="text-left">
                <p className="text-[9px] font-label font-bold tracking-[0.18em] text-primary/60 uppercase mb-0.5">
                  Apple
                </p>
                <p className="font-headline text-sm font-semibold text-on-surface">
                  {applePassMutation.isPending ? 'Generando…' : 'Agregar a Wallet'}
                </p>
              </div>
              <Smartphone className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </button>

            <button
              type="button"
              disabled={!canDownloadPass || googlePassMutation.isPending}
              onClick={() => googlePassMutation.mutate()}
              className={cn(
                'flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200 group active:scale-[0.98]',
                canDownloadPass
                  ? 'border-primary/30 bg-surface-container-lowest hover:border-primary/60 hover:shadow-[0_4px_20px_-8px_rgba(201,169,110,0.25)]'
                  : 'border-essenza-outlineVariant/30 bg-surface-container-lowest opacity-50 cursor-not-allowed'
              )}
            >
              <div className="text-left">
                <p className="text-[9px] font-label font-bold tracking-[0.18em] text-primary/60 uppercase mb-0.5">
                  Google
                </p>
                <p className="font-headline text-sm font-semibold text-on-surface">
                  {googlePassMutation.isPending ? 'Generando…' : 'Agregar a Google Pay'}
                </p>
              </div>
              <Smartphone className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </button>

            {!canDownloadPass && (
              <p className="sm:col-span-2 text-xs font-body italic text-essenza-secondary text-center">
                Necesitas una membresía activa para generar tu pase digital.
              </p>
            )}
          </div>

          {/* ═══ Rewards + History ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">

            {/* Rewards — asymmetric, not 3 equal cards */}
            <section className="space-y-4">
              <div className="flex items-end justify-between px-1">
                <h2 className="font-signature text-3xl md:text-4xl text-primary leading-tight">
                  Recompensas
                </h2>
                <Link
                  to="/app/wallet/rewards"
                  className="flex items-center gap-1 text-xs font-label font-semibold text-primary hover:underline transition-all"
                >
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Featured reward */}
              <Link
                to="/app/wallet/rewards"
                className="group flex items-center gap-5 p-5 rounded-2xl bg-surface-container-lowest border border-essenza-outlineVariant/40 hover:border-primary/30 hover:shadow-[0_8px_24px_-12px_rgba(201,169,110,0.2)] transition-all duration-300 active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  {(() => {
                    const Icon = categoryIcon(featuredReward.category);
                    return <Icon className="h-6 w-6 text-primary" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-base text-on-surface truncate">
                    {featuredReward.name}
                  </p>
                  <p className="text-sm font-body italic text-essenza-secondary">
                    {featuredReward.category}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-signature text-2xl text-primary leading-none">{featuredReward.points}</p>
                  <p className="text-[10px] font-label tracking-[0.15em] text-primary/60 uppercase">pts</p>
                </div>
              </Link>

              {/* Other rewards */}
              <div className="grid grid-cols-2 gap-3">
                {otherRewards.map((reward) => {
                  const Icon = categoryIcon(reward.category);
                  return (
                    <Link
                      key={reward.id}
                      to="/app/wallet/rewards"
                      className="group flex flex-col gap-3 p-4 rounded-2xl bg-surface-container-lowest border border-essenza-outlineVariant/40 hover:border-primary/30 transition-all duration-200 active:scale-[0.98]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-headline font-semibold text-sm text-on-surface leading-tight mb-0.5 truncate">
                          {reward.name}
                        </p>
                        <p className="text-[10px] font-label text-primary/70">
                          {reward.points} pts
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Activity — divider list, no card box */}
            <section className="space-y-4">
              <div className="flex items-end justify-between px-1">
                <h2 className="font-signature text-3xl md:text-4xl text-primary leading-tight">
                  Actividad
                </h2>
                {recentActivity.length > 0 && (
                  <Link
                    to="/app/wallet/history"
                    className="flex items-center gap-1 text-xs font-label font-semibold text-primary hover:underline transition-all"
                  >
                    Ver todo <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {recentActivity.length > 0 ? (
                <div className="divide-y divide-essenza-outlineVariant/30">
                  {recentActivity.map((item, i) => {
                    const isEarned = item.points > 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          isEarned ? 'bg-emerald-500/10' : 'bg-primary/10'
                        )}>
                          {isEarned
                            ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                            : <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm font-medium text-on-surface truncate">
                            {getActivityLabel(item)}
                          </p>
                          <p className="text-[11px] font-body italic text-essenza-secondary">
                            {formatActivityDate(item.created_at)}
                          </p>
                        </div>
                        <span className={cn(
                          'text-sm font-label font-bold flex-shrink-0',
                          isEarned ? 'text-emerald-600' : 'text-primary'
                        )}>
                          {isEarned ? `+${item.points}` : item.points}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-4 py-12">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-150" aria-hidden="true" />
                    <div className="relative w-16 h-16 bg-surface-container-lowest rounded-full flex items-center justify-center text-primary shadow-sm">
                      <Gift className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="max-w-[220px]">
                    <p className="font-headline font-semibold text-sm text-on-surface mb-1">
                      Aún sin movimientos
                    </p>
                    <p className="text-xs font-body italic text-essenza-secondary leading-relaxed">
                      Asiste a clases para acumular puntos y canjear recompensas.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
