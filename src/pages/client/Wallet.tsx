import { useMutation, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import api, { getErrorMessage } from '@/lib/api';
import { Gift, History, QrCode, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { walletRewards } from '@/pages/client/walletData';
import { QRCodeSVG } from 'qrcode.react';
import { es } from 'date-fns/locale';

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
  return format(parsed, 'dd MMM yyyy');
};

export default function WalletClub() {
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useQuery<WalletPassResponse>({
    queryKey: ['wallet-pass'],
    queryFn: async () => {
      const { data } = await api.get('/wallet/pass');
      return data;
    },
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

  const recentActivity = (loyaltyData?.history || []).slice(0, 3);

  const errorMessage = isError ? getErrorMessage(error) : null;

  const canDownloadPass = data?.canDownloadPass ?? false;
  const hasMembership = Boolean(data?.membershipId);

  const formatActivityDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Hoy';
      if (diffDays === 1) return 'Ayer';
      return format(date, 'd MMM', { locale: es });
    } catch {
      return '';
    }
  };

  const getActivityLabel = (item: { type: string; description: string; class_name: string | null }) => {
    if (item.class_name) return `Clase ${item.class_name}`;
    if (item.type === 'bonus') return item.description || 'Bono';
    if (item.type === 'redemption') return item.description || 'Canje';
    return item.description || 'Puntos';
  };

  const applePassMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApplePassResponse>('/wallet/pass/apple');
      return data;
    },
    onSuccess: (response) => {
      if (response.downloadUrl) {
        window.location.assign(response.downloadUrl);
        return;
      }
      toast({
        title: 'Pase en preparación',
        description: response.message || 'Te avisaremos cuando esté listo.',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No pudimos generar tu pase',
        description: getErrorMessage(err),
      });
    },
  });

  const googlePassMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<GooglePassResponse>('/wallet/pass/google');
      return data;
    },
    onSuccess: (response) => {
      if (response.saveUrl) {
        window.open(response.saveUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      toast({
        title: 'Pase en preparación',
        description: response.message || 'Te avisaremos cuando esté listo.',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No pudimos generar tu pase',
        description: getErrorMessage(err),
      });
    },
  });

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-heading font-bold">WalletClub</h1>
            <p className="text-muted-foreground">
              Tu membresía, puntos y check-in en un solo lugar.
            </p>
          </div>

          <Card className="overflow-hidden border-none">
            <CardContent className="p-0">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                {/* Essenza Barre colors: Verde salvia #8F9A8A, Crema #F4EFE6, Terracota #C6A77A, Chocolate #3F352D */}
                <div className="bg-gradient-to-br from-[#8F9A8A] via-[#8F9A8A]/90 to-[#C6A77A]/80 text-white p-6 md:p-8">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-40 bg-white/20" />
                      <Skeleton className="h-4 w-64 bg-white/20" />
                      <Skeleton className="h-32 w-full bg-white/20" />
                    </div>
                  ) : errorMessage ? (
                    <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-sm text-white/80">
                      No pudimos cargar tu pase. {errorMessage}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-white/70">
                            Essenza del Flusso
                          </p>
                          <h2 className="text-2xl font-semibold">{data?.memberName || 'Miembro'}</h2>
                          <p className="text-sm text-white/80">
                            Miembro desde {formatDate(data?.memberSince)}
                          </p>
                        </div>
                        <Badge className="bg-white/20 text-white hover:bg-white/30">
                          {data?.membershipStatus === 'active'
                            ? 'Activa'
                            : hasMembership
                              ? 'Inactiva'
                              : 'Sin plan'}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 text-sm">
                        <div>
                          <p className="text-xs uppercase text-white/70">Plan</p>
                          <p className="font-medium">{data?.planName || 'Sin plan activo'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-white/70">Válido hasta</p>
                          <p className="font-medium">{formatDate(data?.expirationDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-white/70">Puntos</p>
                          <p className="font-medium">{data?.pointsBalance ?? 0} pts</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-white/70">Clases</p>
                          <p className="font-medium">
                            {hasMembership
                              ? data?.classesRemaining ?? 'Ilimitado'
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                        <div className="flex items-center gap-2 text-sm text-white/80">
                          <QrCode className="h-4 w-4" />
                          QR de check-in
                        </div>
                        <div className="mt-3 flex items-center justify-center">
                          {data?.qrPayload ? (
                            <div className="p-2 bg-white rounded-lg">
                              <QRCodeSVG
                                value={data.qrPayload}
                                size={112}
                                level="M"
                                bgColor="#FFFFFF"
                                fgColor="#3F352D"
                              />
                            </div>
                          ) : (
                            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-white/30 bg-white/20 text-xs text-white/60">
                              Sin QR
                            </div>
                          )}
                        </div>
                        <p className="mt-3 text-[10px] text-white/50 break-all text-center">
                          {data?.membershipId ? `ID: ${data.membershipId.substring(0, 8)}...` : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-8 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    Agrega tu pase digital
                  </div>
                  <Button
                    className="w-full"
                    disabled={!canDownloadPass || applePassMutation.isPending}
                    onClick={() => applePassMutation.mutate()}
                  >
                    {applePassMutation.isPending ? 'Generando...' : 'Agregar a Apple Wallet'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!canDownloadPass || googlePassMutation.isPending}
                    onClick={() => googlePassMutation.mutate()}
                  >
                    {googlePassMutation.isPending ? 'Generando...' : 'Agregar a Google Pay'}
                  </Button>
                  {!canDownloadPass && (
                    <p className="text-xs text-muted-foreground">
                      Necesitas una membresía asignada para generar tu pase.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="h-5 w-5 text-warning" />
                  Canjear recompensas
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/app/wallet/rewards">Ver todas</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {walletRewards.slice(0, 3).map((reward) => (
                  <div key={reward.id} className="rounded-xl border bg-muted/40 p-4 text-center">
                    <div className="text-3xl">{reward.icon}</div>
                    <p className="mt-2 text-sm font-medium">{reward.name}</p>
                    <p className="text-xs text-muted-foreground">{reward.points} pts</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Historial reciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{getActivityLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">{formatActivityDate(item.created_at)}</p>
                      </div>
                      <span className={item.points > 0 ? 'text-success' : 'text-rose-600'}>
                        {item.points > 0 ? `+${item.points}` : item.points} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aún no tienes movimientos. Asiste a clases para ganar puntos.
                  </p>
                )}
                {recentActivity.length > 0 && (
                  <Button variant="ghost" size="sm" asChild className="px-0">
                    <Link to="/app/wallet/history">Ver todo</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
